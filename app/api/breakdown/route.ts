import { generateText } from 'ai'
import { z } from 'zod'
import { google } from '@ai-sdk/google'
import { personaBase } from '@/lib/companion'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

export const maxDuration = 15

/**
 * «Раздроби мне задачу»: task initiation — главный bottleneck СДВГ.
 * Большая задача пугает; 3 микрошага по 1-5 минут — нет.
 * Возвращает массив из 3 шагов, каждый начинается с глагола.
 */
// дело длиннее 300 символов обрезаем, а не отклоняем: человек не должен получить отказ за подробность
const Body = z.object({ task: z.string().trim().min(3).transform((s) => s.slice(0, 300)) })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'breakdown', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ steps: null }, { status: 400 })
  const { task } = parsed.data
  try {
    const { text } = await generateText({
      model: process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? google('gemini-2.5-flash-lite')
        : 'openai/gpt-5.4-nano',
      instructions: `${personaBase}

Режим: ДРОБЛЕНИЕ ЗАДАЧИ. Человек назвал дело, которое его пугает своим размером. Разбей его на РОВНО 3 крошечных первых шага. Правила:
- Каждый шаг выполняется за 1-5 минут, не больше
- Каждый начинается с глагола («Открыть…», «Найти…», «Написать…»)
- Первый шаг — самый крошечный, почти смешной («Открыть документ»)
- Максимум 6 слов на шаг
- Никаких пояснений: ответь ТОЛЬКО тремя строками, по шагу на строку`,
      prompt: `Дело: «${task}»`,
      maxOutputTokens: 1024, // три строки по ≤ 6 слов; запас под токены рассуждения моделей шлюза
      maxRetries: 1,
      abortSignal: req.signal,
    })
    const steps = text
      .split('\n')
      .map((s) => s.replace(/^[\d\-.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    return Response.json({ steps: steps.length > 0 ? steps : null })
  } catch {
    // LLM недоступен — универсальные микрошаги вместо молчания
    return Response.json({
      steps: ['Открыть то, что нужно для дела', 'Сделать одно крошечное действие', 'Записать, что дальше'],
    })
  }
})
