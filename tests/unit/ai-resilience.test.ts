import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { simulateReadableStream } from 'ai'
import { setAlertSinkForTests } from '@/lib/ai/core/alerts'
import { BREAKER, breakerOpen, breakerSnapshot } from '@/lib/ai/core/breaker'
import { classify } from '@/lib/ai/core/errors'
import { emit, observe, type HarnessEvent } from '@/lib/ai/core/hooks'
import { resetLatencyForTests } from '@/lib/ai/core/latency'
import { applyRequestMiddleware, type TurnRequest } from '@/lib/ai/core/middleware'
import { runTurn } from '@/lib/ai/core/run-turn'
import { newTurn } from '@/lib/ai/core/turn'
import { dataMessage } from '@/lib/ai/context'
import type { ModelStep } from '@/lib/ai/models'

/**
 * Устойчивость к сбоям поставщика (этап 2, 13.11; аудит 12.11, находка 25): классификация сбоев, предохранитель,
 * сигналы владельцу. Живой прогон 13.11: в 3 запросах из 12 не ответила ни одна из трёх моделей одного поставщика.
 */
const chain = vi.hoisted(() => ({ steps: [] as ModelStep[] }))
vi.mock('@/lib/ai/models', () => ({ modelChain: () => chain.steps }))

const ctx = () => newTurn({ task: 'test' })
const end = (model: string, result: HarnessEvent & { type: 'model.end' } extends infer E ? (E extends { result: infer R } ? R : never) : never, over: Partial<{ status: number; ms: number; committed: boolean }> = {}) =>
  emit({ type: 'model.end', model, ms: over.ms ?? 4000, result, status: over.status, committed: over.committed }, ctx())
const step = (id: string, provider?: ModelStep['provider']): ModelStep => ({ id, model: id as never, provider })
const order = (steps: ModelStep[]) =>
  applyRequestMiddleware({ instructions: '', messages: [], chain: steps, hedgeAfterMs: 2000 } as TurnRequest, { ctx: ctx(), input: { crisis: false, injection: false } as never }).chain.map((s) => s.id)

beforeEach(() => {
  resetLatencyForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => vi.useRealTimers())

describe('классификация сбоев', () => {
  it('кончились деньги и негодный ключ: повтор бесполезен, нужен человек', () => {
    expect(classify('error', 402)).toEqual({ kind: 'billing', retry: false, infra: true, fatal: true })
    expect(classify('error', 401)).toMatchObject({ kind: 'auth', retry: false, fatal: true })
    expect(classify('error', 403)).toMatchObject({ kind: 'auth', retry: false, fatal: true })
  })
  it('сеть, 429, 408 и 5xx повторяются; другой 4xx на наш запрос — нет', () => {
    expect(classify('error')).toMatchObject({ kind: 'network', retry: true, infra: true })
    expect(classify('error', 429)).toMatchObject({ kind: 'rate-limit', retry: true })
    expect(classify('error', 408)).toMatchObject({ kind: 'overload', retry: true })
    expect(classify('error', 503)).toMatchObject({ kind: 'overload', retry: true })
    expect(classify('error', 400)).toEqual({ kind: 'bad-request', retry: false, infra: false, fatal: false })
  })
  it('негодный ответ модели — не сбой поставщика; успех и отмена — не сбой вовсе', () => {
    for (const r of ['shame', 'parse', 'empty', 'length', 'no-tool'] as const) expect(classify(r)).toMatchObject({ kind: 'model', infra: false })
    expect(classify('timeout')).toMatchObject({ kind: 'timeout', infra: true, retry: false })
    expect(classify('ok')).toBeNull()
    expect(classify('cancelled')).toBeNull()
  })
})

describe('предохранитель', () => {
  it('три сбоя поставщика подряд размыкают модель: она идёт последней, а не первой', () => {
    const steps = [step('a'), step('b'), step('c')]
    end('a', 'error', { status: 503 })
    end('a', 'error')
    expect(order(steps)).toEqual(['a', 'b', 'c'])
    end('a', 'timeout')
    expect(breakerOpen('a')).toBe(true)
    expect(order(steps)).toEqual(['b', 'c', 'a'])
    expect(breakerSnapshot()).toMatchObject([{ model: 'a', reason: 'timeout' }])
  })
  it('ответ модели между сбоями обнуляет счёт', () => {
    end('a', 'error')
    end('a', 'error')
    emit({ type: 'model.commit', model: 'a', ms: 900 }, ctx())
    end('a', 'error')
    expect(breakerOpen('a')).toBe(false)
  })
  it('негодный ответ, отмена и таймаут только что запущенной попытки сбоем не считаются', () => {
    for (let i = 0; i < 5; i++) {
      end('a', 'shame')
      end('a', 'cancelled')
      end('a', 'timeout', { ms: 400 })
      end('a', 'error', { status: 400 })
    }
    expect(breakerOpen('a')).toBe(false)
  })
  it('пауза истекла: одна пробная попытка; сбой размыкает снова, ответ замыкает', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 3; i++) end('a', 'error')
    vi.advanceTimersByTime(BREAKER.cooldownMs + 1)
    expect(order([step('a'), step('b')])).toEqual(['a', 'b'])
    end('a', 'error')
    expect(order([step('a'), step('b')])).toEqual(['b', 'a'])
    vi.advanceTimersByTime(BREAKER.cooldownMs + 1)
    expect(breakerOpen('a')).toBe(false)
    emit({ type: 'model.commit', model: 'a', ms: 900 }, ctx())
    end('a', 'error')
    end('a', 'error')
    expect(breakerOpen('a')).toBe(false)
  })
  it('402 размыкает сразу и весь поставщик: у его моделей общий баланс; чужой поставщик становится первым', () => {
    const steps = [step('gc', 'anymodel'), step('ag', 'anymodel'), step('ds', 'anymodel'), step('g', 'google')]
    order(steps) // цепочка сообщает предохранителю, чья какая модель
    end('gc', 'error', { status: 402 })
    expect(order(steps)).toEqual(['g', 'gc', 'ag', 'ds'])
    expect(breakerOpen('ag')).toBe(true)
    expect(breakerOpen('g')).toBe(false)
  })
  it('лежит всё: порядок прежний, пробуем как есть (лучше попытка, чем молчание)', () => {
    const steps = [step('a'), step('b')]
    for (const m of ['a', 'b']) for (let i = 0; i < 3; i++) end(m, 'error')
    expect(order(steps)).toEqual(['a', 'b'])
  })
})

describe('предохранитель в настоящем ходе', () => {
  const failing = (status: number, calls: string[], id: string) =>
    new MockLanguageModelV4({
      doStream: async () => {
        calls.push(id)
        throw Object.assign(new Error('provider'), { statusCode: status })
      },
    })
  const ok = (calls: string[], id: string) =>
    new MockLanguageModelV4({
      doStream: async () => {
        calls.push(id)
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Я рядом.' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } } },
            ] as never[],
          }),
        }
      },
    })
  const turn = () =>
    runTurn({
      ctx: ctx(),
      system: 'Режим: тест.',
      data: dataMessage({ Дело: 'убрать стол' }),
      userTexts: ['убрать стол'],
      timeoutMs: 2000,
      hedgeAfterMs: 5000,
      maxOutputTokens: 50,
      maxChars: 200,
      parse: (t: string) => t,
      fallback: () => 'заготовка',
      onCrisis: (r: string) => r,
    })

  it('кончился баланс у основного поставщика: со второго хода первым идёт независимый, без платных пустых вызовов', async () => {
    const calls: string[] = []
    chain.steps = [
      { id: 'gc', model: failing(402, calls, 'gc'), provider: 'anymodel' },
      { id: 'ag', model: failing(402, calls, 'ag'), provider: 'anymodel' },
      { id: 'g', model: ok(calls, 'g'), provider: 'google' },
    ]
    const alerts: string[] = []
    setAlertSinkForTests((l) => alerts.push(l))
    expect((await turn()).value).toBe('Я рядом.')
    calls.length = 0
    const second = await turn()
    expect(second).toMatchObject({ value: 'Я рядом.', outcome: 'model', model: 'g' })
    expect(calls).toEqual(['g'])
    // владельцу — один сигнал о балансе, без текста человека
    expect(alerts).toHaveLength(1)
    expect(JSON.parse(alerts[0])).toMatchObject({ t: 'ai-alert', kind: 'billing', provider: 'anymodel' })
    expect(alerts[0]).not.toContain('убрать стол')
  })
})

describe('сигналы владельцу', () => {
  it('пять ходов подряд без ответа модели: «ИИ лежит», один раз за десять минут', () => {
    const alerts: string[] = []
    setAlertSinkForTests((l) => alerts.push(l))
    const fallback = () => emit({ type: 'turn.end', outcome: 'fallback', ms: 100 }, ctx())
    for (let i = 0; i < 4; i++) fallback()
    expect(alerts).toHaveLength(0)
    fallback()
    fallback()
    expect(alerts).toHaveLength(1)
    expect(JSON.parse(alerts[0])).toMatchObject({ t: 'ai-alert', kind: 'all-down' })
  })
  it('ответ модели обнуляет счёт; кризис и отмена в него не входят', () => {
    const alerts: string[] = []
    setAlertSinkForTests((l) => alerts.push(l))
    for (let i = 0; i < 4; i++) emit({ type: 'turn.end', outcome: 'fallback', ms: 1 }, ctx())
    emit({ type: 'turn.end', outcome: 'crisis', ms: 1 }, ctx())
    emit({ type: 'turn.end', outcome: 'aborted', ms: 1 }, ctx())
    emit({ type: 'turn.end', outcome: 'model', ms: 1 }, ctx())
    for (let i = 0; i < 4; i++) emit({ type: 'turn.end', outcome: 'fallback', ms: 1 }, ctx())
    expect(alerts).toHaveLength(0)
  })
  it('наблюдатель видит размыкание событием breaker.open', () => {
    const seen: HarnessEvent[] = []
    const off = observe((e) => seen.push(e))
    for (let i = 0; i < 3; i++) end('a', 'error', { status: 500 })
    off()
    expect(seen.filter((e) => e.type === 'breaker.open')).toEqual([{ type: 'breaker.open', model: 'a', reason: 'overload', ms: BREAKER.cooldownMs }])
  })
})
