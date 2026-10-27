import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
  validateUIMessages,
  tool,
} from 'ai'
import { z } from 'zod'
import { google } from '@ai-sdk/google'
import { buildInstructions } from '@/lib/companion'
import { fail, handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

export const maxDuration = 30

const MAX_BODY = 128 * 1024 // 30 реплик кириллицей с инструментами ≈ 20–40 КБ; запас ×3
const MAX_MESSAGES = 30 // столько же хранит клиент (MAX_CHAT_MESSAGES в lib/memory.ts)
const MAX_TEXT = 2000 // одна реплика; напарник отвечает 1–3 предложениями

// Память приходит с устройства и целиком ложится в системный промпт — поэтому строгая форма и потолки длины.
// Строки не отклоняем, а обрезаем: длинный шаг у живого человека не должен уводить ответ в фолбэк.
const clip = (n: number) => z.string().transform((s) => s.slice(0, n))
const MemorySchema = z.object({
  plan: z
    .object({ forDate: clip(40), task: clip(300), firstStep: clip(300), startTime: clip(40).optional() })
    .nullable(),
  recentStarts: z
    .array(z.object({ date: clip(40), label: clip(300), minutes: z.number().min(0).max(600), fromPlan: z.boolean() }))
    .max(5),
  patterns: z.object({
    totalStarts: z.number().int().min(0).max(1_000_000),
    runningDays: z.number().int().min(0).max(100_000),
    favoriteHour: z.number().int().min(0).max(23).nullable(),
    lastStartDate: clip(40).nullable(),
    daysAway: z.number().int().min(0).max(100_000).nullable().optional(),
  }),
  notes: z.array(clip(300)).max(6), // MAX_NOTES в lib/memory.ts
  recentFinds: z.array(z.object({ name: clip(80), rarity: clip(20), date: clip(40) })).max(3).optional(),
  companionName: clip(24).nullable().optional(), // тот же потолок, что у формы имени
})
const BodySchema = z.object({
  messages: z.array(z.unknown()).max(200),
  mode: z.enum(['companion', 'focus']).default('companion'),
  memory: MemorySchema.nullable().default(null),
  clientHour: z.number().int().min(0).max(23).optional(),
})

const TOOL_PARTS = new Set(['tool-savePlan', 'tool-rememberFact', 'tool-startFocus'])

/**
 * Клиент шлёт только текст и наши три инструмента. Всё остальное (file/source/data-части, роль system) выбрасываем:
 * file-часть с url заставляет AI SDK скачать этот адрес С СЕРВЕРА (до 2 ГБ, с повторами) и отдать модели —
 * воспроизведено на ai@7: запрос к внутреннему адресу, фильтр приватных IP обходится DNS-именем.
 */
function sanitize(raw: unknown[]): UIMessage[] {
  const out: UIMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const { id, role, parts } = m as Partial<UIMessage>
    if ((role !== 'user' && role !== 'assistant') || !Array.isArray(parts)) continue
    const clean = parts
      .filter(
        (p) =>
          !!p &&
          typeof p === 'object' &&
          (p.type === 'text' || p.type === 'step-start' || (role === 'assistant' && TOOL_PARTS.has(p.type))),
      )
      .map((p) => (p.type === 'text' ? { ...p, text: String(p.text ?? '').slice(0, MAX_TEXT) } : p))
    if (clean.length > 0) out.push({ id: String(id ?? ''), role, parts: clean })
  }
  return out.slice(-MAX_MESSAGES)
}

/**
 * Гибридный мозг: бесплатный ключ Google (GOOGLE_GENERATIVE_AI_API_KEY) —
 * основной путь; AI Gateway — когда подключён; при любом сбое клиент
 * переходит на скриптовые ответы (lib/scripted-companion).
 */
function pickModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google('gemini-2.5-flash')
  }
  // ВАЖНО: id должен существовать в AI Gateway. Прежний 'openai/gpt-5.5'
  // не существовал — каждый вызов падал, и ВСЕ ответы в проде шли через
  // скриптовый фолбэк (regex-мозг), что читалось как тупой бот.
  return 'google/gemini-3.6-flash'
}

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'companion', 20)
  const parsed = BodySchema.safeParse(await readJsonBody(req, MAX_BODY))
  if (!parsed.success) return fail(400)
  const { mode, memory, clientHour } = parsed.data

  let messages: UIMessage[]
  try {
    messages = await validateUIMessages({ messages: sanitize(parsed.data.messages) })
  } catch {
    return fail(400)
  }
  if (messages.length === 0) return fail(400)

  const result = streamText({
    model: pickModel(),
    instructions: buildInstructions({ mode, memory, clientHour }),
    messages: await convertToModelMessages(messages),
    tools: {
      // Клиентские инструменты: выполняются на устройстве (память живёт в браузере)
      savePlan: tool({
        description:
          'Сохранить план на завтра, когда он согласован с человеком. Вызывай один раз, с самым важным делом.',
        inputSchema: z.object({
          task: z.string().describe('Дело целиком, как его назвал человек'),
          firstStep: z
            .string()
            .describe('Первый крошечный физический шаг, например «открыть файл презентации»'),
          startTime: z
            .string()
            .optional()
            .describe('Примерное время старта, например «09:00» или «после обеда»'),
        }),
      }),
      rememberFact: tool({
        description:
          'Запомнить один короткий важный факт о человеке для будущих разговоров (имя, над чем работает, что мешает).',
        inputSchema: z.object({
          fact: z.string().describe('Один факт, максимум одно предложение'),
        }),
      }),
      startFocus: tool({
        description:
          'Предложить начать фокус-сессию прямо сейчас с конкретным первым шагом. Вызывай, когда шаг раздроблен и человек готов действовать сейчас (не вечером при планировании завтра).',
        inputSchema: z.object({
          firstStep: z
            .string()
            .describe('Первый крошечный физический шаг, например «открыть файл отчёта»'),
          minutes: z
            .number()
            .optional()
            .describe('Рекомендуемая длительность: 15, 25 или 45 минут. По умолчанию 15.'),
        }),
      }),
    },
    // потолок против «напиши эссе»; с запасом: у моделей с рассуждением (gemini-2.5-flash, gpt-5.x) думающие токены
    // входят в этот же лимит, и тесный потолок обрезал бы саму реплику
    maxOutputTokens: 2048,
    maxRetries: 1,
    abortSignal: req.signal, // человек закрыл вкладку — генерация останавливается
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        // Логируем на сервере; клиенту — только маркер, он перейдёт на скрипт
        console.error('[companion] stream error:', error)
        return 'companion-unavailable'
      },
    }),
  })
})
