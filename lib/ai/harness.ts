import { generateText } from 'ai'
import { budgetLeft, spend } from './budget'
import { CRISIS_REPLY } from './crisis'
import { checkInput } from './guards/input'
import { checkOutput, tidy } from './guards/output'
import { modelChain } from './models'
import { systemFor } from './persona'
import { trace } from './trace'

/**
 * Обвязка (harness) кота — единственный вход к модели (research/20-ai-harness/design.md). Порядок хода:
 * 1) проверка входа (кризис → проверенный ответ без модели); 2) бюджет; 3) системный промпт ярусами;
 * 4) цепочка моделей со страхующими запросами и общим бюджетом времени; 5) разбор ответа задачей + проверка тона/медицины/языка;
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
  /** бюджет времени на весь ход (все попытки вместе) */
  timeoutMs: number
  /** через сколько мс без годного ответа запускать следующую модель параллельно (страхующий запрос) */
  hedgeAfterMs?: number
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
  const verdict = checkInput(input.userTexts)
  const attempts: Array<{ model: string; ms: number; result: string }> = []
  const done = (r: TurnResult<T>, tokens?: { in?: number; out?: number }) => {
    trace({
      task: input.task,
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

  const system = systemFor(input.system)
  const messages = [
    ...(input.data ? [{ role: 'user' as const, content: input.data }] : []),
    { role: 'user' as const, content: input.prompt },
  ]

  // Страхующие запросы (hedged requests, Dean & Barroso, «The Tail at Scale», CACM 2013): основная модель стартует
  // сразу; если за hedgeAfterMs годного ответа нет (или она уже ответила негодным) — параллельно стартует следующая.
  // Берём первый ГОДНЫЙ ответ, остальные отменяем. Весь ход укладывается в timeoutMs. Замер 11.11: последовательный
  // перебор давал 8–12 с и 9 заготовок из 23 — DeepSeek то отвечает за 2 с, то молчит десятки секунд.
  const chain = modelChain()
  const deadline = AbortSignal.timeout(input.timeoutMs)
  const all = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline
  const controllers: AbortController[] = []
  const inFlight = new Map<string, number>() // модель → время старта: на общем лимите незавершённые пишем как timeout
  let winner: { value: T; model: string; usage?: { in?: number; out?: number } } | null = null

  await new Promise<void>((resolve) => {
    let started = 0
    let finished = 0
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(hedgeTimer)
      if (!winner) for (const [model, a0] of inFlight) attempts.push({ model, ms: Date.now() - a0, result: 'timeout' })
      inFlight.clear()
      controllers.forEach((c) => c.abort())
      resolve()
    }
    const launchNext = () => {
      clearTimeout(hedgeTimer)
      if (winner || started >= chain.length || all.aborted) return
      const step = chain[started++]
      const ctrl = new AbortController()
      controllers.push(ctrl)
      const a0 = Date.now()
      inFlight.set(step.id, a0)
      generateText({
        model: step.model,
        instructions: system,
        messages,
        maxOutputTokens: input.maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.any([all, ctrl.signal]),
      })
        .then((res) => {
          spend(res.usage?.totalTokens)
          if (!inFlight.delete(step.id) || winner) return
          const text = tidy(res.text)
          const check = checkOutput(text, { maxChars: input.maxChars })
          const value = check.ok ? input.parse(text) : null
          attempts.push({ model: step.id, ms: Date.now() - a0, result: check.ok ? (value === null ? 'parse' : 'ok') : check.reason })
          if (value !== null) {
            winner = { value, model: step.id, usage: { in: res.usage?.inputTokens, out: res.usage?.outputTokens } }
            finish()
          } else launchNext() // негодный ответ — не ждём таймера, сразу следующая модель
        })
        .catch((e) => {
          if (!inFlight.delete(step.id) || winner) return
          const timeout = all.aborted || (e instanceof Error && /timeout|abort/i.test(`${e.name} ${e.message}`))
          attempts.push({ model: step.id, ms: Date.now() - a0, result: timeout ? 'timeout' : 'error' })
          if (!timeout) launchNext()
        })
        .finally(() => {
          finished++
          if (!winner && finished === started && (started >= chain.length || all.aborted)) finish()
        })
      if (started < chain.length) hedgeTimer = setTimeout(launchNext, input.hedgeAfterMs ?? 1500)
    }
    all.addEventListener('abort', finish, { once: true })
    if (chain.length === 0) finish()
    else launchNext()
  })

  if (winner) {
    const w = winner as { value: T; model: string; usage?: { in?: number; out?: number } }
    return done({ value: w.value, outcome: 'model', model: w.model }, w.usage)
  }
  return done({ value: input.fallback(), outcome: 'fallback' })
}
