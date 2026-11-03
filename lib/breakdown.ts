import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { personaBase } from '@/lib/companion'

/** Универсальные микрошаги на случай, когда модели нет (ключ не задан, сеть, лимит) */
export const FALLBACK_STEPS = ['Открыть то, что нужно для дела', 'Сделать одно крошечное действие', 'Записать, что дальше']

/**
 * «Раздроби мне задачу»: task initiation — главный bottleneck СДВГ. Общая часть для сайта (/api/breakdown) и бота
 * (/api/tg): три шага по 1–5 минут, каждый с глагола. `fallback: true` — модель не ответила, шаги заготовленные.
 */
export async function breakdownTask(task: string, signal?: AbortSignal): Promise<{ steps: string[]; fallback: boolean }> {
  try {
    const { text } = await generateText({
      model: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? google('gemini-2.5-flash-lite') : 'openai/gpt-5.4-nano',
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
      abortSignal: signal,
    })
    const steps = text
      .split('\n')
      .map((s) => s.replace(/^[\d\-.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    return steps.length > 0 ? { steps, fallback: false } : { steps: FALLBACK_STEPS, fallback: true }
  } catch {
    return { steps: FALLBACK_STEPS, fallback: true }
  }
}
