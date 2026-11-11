import { generateText } from 'ai'
import { budgetLeft, spend } from './budget'
import { CRISIS_REPLY } from './crisis'
import { checkInput } from './guards/input'
import { checkOutput, tidy } from './guards/output'
import { modelChain } from './models'
import { systemFor, type Audience } from './persona'
import { trace } from './trace'

/**
 * Обвязка (harness) кота — единственный вход к модели (research/20-ai-harness/design.md). Порядок хода:
 * 1) проверка входа (кризис → проверенный ответ без модели); 2) бюджет; 3) системный промпт ярусами;
 * 4) цепочка моделей с бюджетом времени на попытку; 5) разбор ответа задачей + проверка тона/медицины/языка;
 * 6) нарушение или сбой → следующая модель → заготовка задачи. 7) журнал без текстов.
 * Маршруты и бот не вызывают провайдера напрямую — только runTurn.
 */
export type TurnInput<T> = {
  task: string
  /** системная часть задачи: что делать в этом режиме (стабильна — кэшируется провайдером) */
  system: string
  /** данные человека — уже собранные dataMessage(), идут сообщением, не в инструкцию */
  data?: string
  /** что нужно сейчас (реплика-задание, без пользовательского текста) */
  prompt: string
  /** тексты человека для проверки входа (кризис, взлом промпта) */
  userTexts: string[]
  audience?: Audience
  /** бюджет времени на одну попытку модели */
  timeoutMs: number
  maxOutputTokens: number
  /** потолок длины ответа для проверки выхода */
  maxChars: number
  /** разбор ответа задачей; null — ответ не годится (следующая модель) */
  parse: (text: string) => T | null
  /** заготовка, если модели не ответили или ответили не так */
  fallback: () => T
  /** что вернуть при кризисе */
  onCrisis: (reply: string) => T
  signal?: AbortSignal
}

export type TurnResult<T> = { value: T; outcome: 'model' | 'fallback' | 'crisis' | 'budget'; model?: string }

export async function runTurn<T>(input: TurnInput<T>): Promise<TurnResult<T>> {
  const t0 = Date.now()
  const audience = input.audience ?? 'unknown'
  const verdict = checkInput(input.userTexts)
  const attempts: Array<{ model: string; ms: number; result: string }> = []
  const done = (r: TurnResult<T>, tokens?: { in?: number; out?: number }) => {
    trace({
      task: input.task,
      audience,
      outcome: r.outcome,
      model: r.model,
      ms: Date.now() - t0,
      attempts,
      injection: verdict.injection || undefined,
      inTokens: tokens?.in,
      outTokens: tokens?.out,
    })
    return r
  }

  if (verdict.crisis) return done({ value: input.onCrisis(CRISIS_REPLY), outcome: 'crisis' })
  if (!budgetLeft()) return done({ value: input.fallback(), outcome: 'budget' })

  const system = systemFor(input.system, audience)
  const messages = [
    ...(input.data ? [{ role: 'user' as const, content: input.data }] : []),
    { role: 'user' as const, content: input.prompt },
  ]

  for (const step of modelChain()) {
    if (input.signal?.aborted) break
    const a0 = Date.now()
    try {
      const signal = input.signal
        ? AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs)])
        : AbortSignal.timeout(input.timeoutMs)
      const res = await generateText({
        model: step.model,
        instructions: system,
        messages,
        maxOutputTokens: input.maxOutputTokens,
        maxRetries: 0,
        abortSignal: signal,
      })
      spend(res.usage?.totalTokens)
      const text = tidy(res.text)
      const check = checkOutput(text, { maxChars: input.maxChars })
      if (!check.ok) {
        attempts.push({ model: step.id, ms: Date.now() - a0, result: check.reason })
        continue
      }
      const value = input.parse(text)
      if (value === null) {
        attempts.push({ model: step.id, ms: Date.now() - a0, result: 'parse' })
        continue
      }
      attempts.push({ model: step.id, ms: Date.now() - a0, result: 'ok' })
      return done(
        { value, outcome: 'model', model: step.id },
        { in: res.usage?.inputTokens, out: res.usage?.outputTokens },
      )
    } catch (e) {
      const timeout = e instanceof Error && (e.name === 'TimeoutError' || /timeout|aborted/i.test(e.message))
      attempts.push({ model: step.id, ms: Date.now() - a0, result: timeout ? 'timeout' : 'error' })
    }
  }
  return done({ value: input.fallback(), outcome: 'fallback' })
}
