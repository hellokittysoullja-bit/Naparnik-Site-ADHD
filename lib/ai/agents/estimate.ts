import { dataMessage } from '../context'
import { newTurn, type TurnContext } from '../core/turn'
import { runTurn } from '../core/run-turn'

/**
 * «Оценить» в «Делах» — как кнопка Estimator у goblin.tools: сколько реально займёт каждый шаг. Модель отвечает
 * столбиком чисел (минуты на шаг, по строке на шаг); сумма — время всего дела. Не вышло — честное «не вышло»,
 * а не выдуманные цифры.
 */
export const ESTIMATE_SYSTEM = `Ты оцениваешь, сколько времени реально займёт каждый шаг дела у обычного взрослого человека, который делает его сам, без спешки. Дело и шаги — в блоке данных. Учитывай настоящее время шага: если шаг включает ожидание (стирка, доставка, запись к врачу), считай его целиком. Ответь ровно столькими строками, сколько шагов, по порядку: на каждой строке только целое число минут, без слов и пояснений.`

export function parseEstimate(text: string, count: number): number[] | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length !== count) return null
  const nums = lines.map((l) => {
    const m = l.replace(/^\d+[.)]\s+/, '').match(/\d+/)
    return m ? Number(m[0]) : NaN
  })
  // от минуты до месяца на шаг; иначе ответ негоден
  return nums.every((n) => Number.isFinite(n) && n >= 1 && n <= 43200) ? nums : null
}

export async function estimate(input: { task: string; steps: string[]; ctx?: TurnContext; signal?: AbortSignal }): Promise<number[] | null> {
  const { value } = await runTurn<number[] | null>({
    ctx: input.ctx ?? newTurn({ task: 'estimate' }),
    system: ESTIMATE_SYSTEM,
    noPersona: true,
    data: dataMessage({ Дело: input.task, Шаги: input.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') }),
    userTexts: [input.task, ...input.steps],
    timeoutMs: 6000,
    hedgeAfterMs: 2000,
    maxOutputTokens: 600,
    temperature: 0.2,
    maxChars: 400,
    parse: (t) => parseEstimate(t, input.steps.length),
    fallback: () => null,
    onCrisis: () => null,
    signal: input.signal,
  })
  return value
}
