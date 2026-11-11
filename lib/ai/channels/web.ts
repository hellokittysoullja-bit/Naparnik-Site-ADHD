import { convertToModelMessages, validateUIMessages, type ModelMessage, type UIMessage } from 'ai'
import { clean } from '../context'
import { TOOL_REFUSED, tools } from '../tools/catalog'

/**
 * Веб-канал (Hermes gateway/platforms: адаптер нормализует сообщения платформы и доставляет ответ). Здесь —
 * граница доверия браузера: историю присылает клиент, значит любую её часть мог написать атакующий (подделка
 * реплик кота и результатов инструментов — многоходовый взлом, security-ai.md дефект 11). Поэтому:
 *  - остаются только текст и вызовы НАШИХ инструментов чата; file/source/data-части и роль system выбрасываются
 *    (file-часть с url заставляет AI SDK скачать адрес С СЕРВЕРА — SSRF, воспроизведено на ai@7, research/19);
 *  - реплика человека ≤ 2000 символов, реплика кота ≤ 600 (кот говорит 1–3 предложения);
 *  - вход инструмента перепроверяется той же схемой, что и у модели; негодный вызов выбрасывается целиком;
 *  - результат клиентского инструмента заменяется нашим текстом (clientResult): браузер не пишет модели ничего.
 */
export const WEB_LIMITS = { messages: 30, userText: 2000, catText: 600 } as const

type Part = UIMessage['parts'][number]

function sanitizeToolPart(p: Part & { type: `tool-${string}` }): Part | null {
  const spec = tools.get(p.type.slice('tool-'.length))
  if (!spec || spec.executor !== 'client' || !spec.tasks.includes('chat')) return null
  const x = p as { toolCallId?: unknown; state?: unknown; input?: unknown }
  if (typeof x.toolCallId !== 'string' || x.toolCallId.length > 80) return null
  const input = spec.input.safeParse(x.input)
  if (!input.success) return null
  // незавершённый вызов (результата нет) в историю модели не нужен — модель увидела бы «висящий» вызов
  if (x.state !== 'output-available') return null
  // браузер шлёт один из двух наших ответов; модели уходит наш же текст, а не присланный
  const refused = (p as { output?: unknown }).output === TOOL_REFUSED
  const output = refused ? 'Не сохранено: устройство отклонило запись.' : spec.clientResult
  return { type: p.type, toolCallId: x.toolCallId, state: 'output-available', input: input.data, output } as Part
}

function sanitizePart(p: unknown, role: 'user' | 'assistant'): Part | null {
  if (!p || typeof p !== 'object' || typeof (p as { type?: unknown }).type !== 'string') return null
  const part = p as Part
  if (part.type === 'step-start') return role === 'assistant' ? { type: 'step-start' } : null
  if (part.type === 'text') {
    const text = clean(String(part.text ?? ''), role === 'user' ? WEB_LIMITS.userText : WEB_LIMITS.catText)
    return text ? { type: 'text', text } : null
  }
  if (role === 'assistant' && part.type.startsWith('tool-')) return sanitizeToolPart(part as Part & { type: `tool-${string}` })
  return null
}

export function sanitizeUIMessages(raw: unknown[]): UIMessage[] {
  const out: UIMessage[] = []
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    const { id, role, parts } = m as Partial<UIMessage>
    if ((role !== 'user' && role !== 'assistant') || !Array.isArray(parts)) continue
    const clean = parts.map((p) => sanitizePart(p, role)).filter((p): p is Part => p !== null)
    if (clean.some((p) => p.type !== 'step-start')) out.push({ id: String(id ?? '').slice(0, 64), role, parts: clean })
  }
  return out.slice(-WEB_LIMITS.messages)
}

export type WebConversation = {
  conversation: ModelMessage[]
  userTexts: string[]
  /** сколько вызовов инструментов кот сделал после последней реплики человека (каждый = автокруг клиента) */
  autoRounds: number
}

/** Браузерная история → вход агента. null — после очистки нечего отвечать (400) */
export async function fromWeb(raw: unknown[]): Promise<WebConversation | null> {
  const clean = sanitizeUIMessages(raw)
  if (clean.length === 0) return null
  let messages: UIMessage[]
  try {
    messages = await validateUIMessages({ messages: clean })
  } catch {
    return null
  }
  const userTexts = messages
    .filter((m) => m.role === 'user')
    .map((m) =>
      m.parts
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join(' ')
        .trim(),
    )
    .filter(Boolean)
  // AI SDK дописывает каждый автокруг в ТО ЖЕ сообщение кота (createStreamingUIMessageState берёт последнее
  // assistant-сообщение), поэтому считаем не сообщения, а завершённые вызовы инструментов после реплики человека
  let autoRounds = 0
  for (let i = messages.length - 1; i >= 0 && messages[i].role === 'assistant'; i--) {
    autoRounds += messages[i].parts.filter((p) => p.type.startsWith('tool-')).length
  }
  return { conversation: await convertToModelMessages(messages), userTexts, autoRounds }
}
