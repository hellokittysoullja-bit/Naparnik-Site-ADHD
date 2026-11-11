import { dataMessage } from '../context'
import type { TurnContext } from '../core/turn'
import { runTurn } from '../harness'

/**
 * Дробление задачи на три крошечных шага (task initiation — главный барьер при СДВГ). Используется Фокусом
 * («Раздроби») и знакомством («Подскажи» со своим делом — берётся первый шаг).
 */
export const BREAKDOWN_SYSTEM = `Режим: ДРОБЛЕНИЕ ЗАДАЧИ. Человек назвал дело (оно в блоке данных), которое его пугает своим размером. Разбей его на РОВНО 3 крошечных первых шага. Правила:
- Каждый шаг выполняется за 1-5 минут, не больше
- Каждый начинается с глагола («Открыть…», «Найти…», «Написать…»)
- Первый шаг — самый крошечный, почти смешной («Открыть документ»)
- Максимум 6 слов на шаг
- Никаких пояснений: ответь ТОЛЬКО тремя строками, по шагу на строку`

export const BREAKDOWN_FALLBACK = ['Открыть то, что нужно для дела', 'Сделать одно крошечное действие', 'Записать, что дальше']

/** Три строки, в каждой 1–8 слов; нумерацию и маркеры срезаем. Иначе — ответ не годится (следующая модель). */
export function parseSteps(text: string): string[] | null {
  const steps = text
    .split('\n')
    .map((s) => s.replace(/^[\s\d\-–—.)•*]+/, '').trim())
    .filter(Boolean)
  if (steps.length < 3) return null
  const three = steps.slice(0, 3)
  return three.every((s) => {
    const words = s.split(/\s+/).length
    return words >= 1 && words <= 8
  })
    ? three
    : null
}

export type BreakdownResult =
  | { kind: 'steps'; steps: string[]; source: 'model' | 'fallback' }
  | { kind: 'care'; reply: string }

export async function breakdown(input: {
  ctx?: TurnContext
  task: string
  /** контекст знакомства: сфера и помеха (необязательно) */
  context?: Record<string, string | undefined>
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<BreakdownResult> {
  const { value, outcome } = await runTurn<BreakdownResult>({
    task: 'breakdown',
    ctx: input.ctx,
    system: BREAKDOWN_SYSTEM,
    data: dataMessage({ Дело: input.task, ...input.context }),
    userTexts: [input.task],
    timeoutMs: input.timeoutMs ?? 8000,
    hedgeAfterMs: 2000,
    maxOutputTokens: 160,
    maxChars: 300,
    parse: (text) => {
      const steps = parseSteps(text)
      return steps ? { kind: 'steps', steps, source: 'model' } : null
    },
    fallback: () => ({ kind: 'steps', steps: BREAKDOWN_FALLBACK, source: 'fallback' }),
    // кризисный текст вместо дела — не шаги, а бережный проверенный ответ (lib/ai/crisis.ts)
    onCrisis: (reply) => ({ kind: 'care', reply }),
    signal: input.signal,
  })
  return value.kind === 'steps' && outcome !== 'model' ? { ...value, source: 'fallback' } : value
}
