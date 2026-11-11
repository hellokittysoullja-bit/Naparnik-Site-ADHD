import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { simulateReadableStream, type TextStreamPart, type ToolSet } from 'ai'
import { SentenceGuard } from '@/lib/ai/core/stream-guard'
import { HARNESS_UNAVAILABLE, streamTurn } from '@/lib/ai/core/stream-turn'
import { newTurn } from '@/lib/ai/core/turn'
import { observe, type HarnessEvent } from '@/lib/ai/core/hooks'
import { tools } from '@/lib/ai/tools/catalog'
import { CRISIS_REPLY } from '@/lib/ai/crisis'

const chain = vi.hoisted(() => ({ steps: [] as Array<{ id: string; model: unknown }> }))
vi.mock('@/lib/ai/models', () => ({ modelChain: () => chain.steps }))

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
}

type Chunk = Record<string, unknown>
/** модель, которая печатает куски с задержкой; abort — честно обрывает поток */
function streaming(chunks: Chunk[], opts: { initialDelayInMs?: number; chunkDelayInMs?: number } = {}) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [{ type: 'stream-start', warnings: [] }, ...chunks] as never[],
        initialDelayInMs: opts.initialDelayInMs ?? 0,
        chunkDelayInMs: opts.chunkDelayInMs ?? 0,
      }),
    }),
  })
}
const text = (...deltas: string[]): Chunk[] => [
  { type: 'text-start', id: 't' },
  ...deltas.map((d) => ({ type: 'text-delta', id: 't', delta: d })),
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
]

async function collect(stream: ReadableStream<TextStreamPart<ToolSet>>) {
  const parts: TextStreamPart<ToolSet>[] = []
  for await (const p of stream as unknown as AsyncIterable<TextStreamPart<ToolSet>>) parts.push(p)
  const shown = parts.map((p) => (p.type === 'text-delta' ? p.text : '')).join('')
  return { parts, shown, error: parts.some((p) => p.type === 'error') }
}

function run(over: Partial<Parameters<typeof streamTurn>[0]> = {}) {
  return streamTurn({
    ctx: newTurn({ task: 'chat' }),
    instructions: 'система',
    messages: [{ role: 'user', content: 'привет' }],
    userTexts: ['привет'],
    commitTimeoutMs: 800,
    totalTimeoutMs: 2000,
    hedgeAfterMs: 150,
    maxOutputTokens: 100,
    maxChars: 300,
    ...over,
  })
}

let events: HarnessEvent[] = []
beforeEach(() => {
  chain.steps = []
  events = []
  vi.spyOn(console, 'info').mockImplementation(() => {})
  observe((e) => events.push(e))
})

describe('проверка по предложениям', () => {
  it('держит текст до конца предложения и выпускает проверенное', () => {
    const g = new SentenceGuard({ maxChars: 200 })
    expect(g.push('Давай начнём')).toEqual({ kind: 'hold' })
    expect(g.push(' с файла. Отк')).toEqual({ kind: 'release', text: 'Давай начнём с файла.' })
    expect(g.end()).toEqual({ kind: 'release', text: ' Отк' })
  })
  it('не выпускает предложение со стыдом и снимает кавычки-обёртки и двойные звёздочки', () => {
    const g = new SentenceGuard({ maxChars: 200 })
    expect(g.push('«Это **первый шаг**. ')).toEqual({ kind: 'release', text: 'Это *первый шаг*.' })
    expect(g.push('Соберись уже. ').kind).toBe('violation')
  })
  it('латинские слова человека разрешены, чужие — нет', () => {
    const g = new SentenceGuard({ maxChars: 200, echo: new Set(['notion']) })
    expect(g.push('Открой Notion. ').kind).toBe('release')
    expect(g.push('It is fine. ').kind).toBe('violation')
  })
})

describe('потоковый ход', () => {
  it('печатает ответ основной модели', async () => {
    chain.steps = [{ id: 'a', model: streaming(text('Привет! ', 'Начнём с малого.')) }]
    const r = await collect(run())
    expect(r.shown).toBe('Привет! Начнём с малого.')
    expect(events.find((e) => e.type === 'turn.end')).toMatchObject({ outcome: 'model', model: 'a' })
  })

  it('негодный ответ до точки фиксации — тихо берёт следующую модель, человек плохого не видит', async () => {
    chain.steps = [
      { id: 'a', model: streaming(text('Надо было раньше начинать. ', 'Ладно.')) },
      { id: 'b', model: streaming(text('Начнём с одного шага.')) },
    ]
    const r = await collect(run())
    expect(r.shown).toBe('Начнём с одного шага.')
    expect(r.shown).not.toMatch(/раньше/)
    const ends = events.filter((e) => e.type === 'model.end')
    expect(ends).toContainEqual(expect.objectContaining({ model: 'a', result: 'shame' }))
  })

  it('нарушение после фиксации — обрезка по последнему проверенному предложению', async () => {
    chain.steps = [{ id: 'a', model: streaming(text('Ты молодец, что пришёл. ', 'Прими таблетку и садись.')) }]
    const r = await collect(run())
    expect(r.shown).toBe('Ты молодец, что пришёл.')
    expect(r.parts.at(-1)?.type).toBe('finish')
    expect(r.error).toBe(false)
  })

  it('медленная основная — страхующая побеждает, основная отменяется', async () => {
    chain.steps = [
      { id: 'slow', model: streaming(text('Медленно.'), { initialDelayInMs: 1500 }) },
      { id: 'fast', model: streaming(text('Быстро и по делу.')) },
    ]
    const t0 = Date.now()
    const r = await collect(run())
    expect(r.shown).toBe('Быстро и по делу.')
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(events.find((e) => e.type === 'turn.end')).toMatchObject({ model: 'fast' })
  })

  it('никто не ответил — маркер недоступности, канал перейдёт на заготовки', async () => {
    chain.steps = [{ id: 'a', model: streaming(text('Поздно.'), { initialDelayInMs: 5000 }) }]
    const r = await collect(run({ commitTimeoutMs: 200 }))
    expect(r.parts).toContainEqual(expect.objectContaining({ type: 'error' }))
    const err = r.parts.find((p) => p.type === 'error') as { error: Error }
    expect(err.error.message).toBe(HARNESS_UNAVAILABLE)
    expect(events.find((e) => e.type === 'turn.end')).toMatchObject({ outcome: 'fallback' })
  })

  it('кризис — проверенный ответ без вызова модели', async () => {
    const model = streaming(text('не должно вызываться'))
    chain.steps = [{ id: 'a', model }]
    const r = await collect(run({ userTexts: ['я не хочу больше жить'] }))
    expect(r.shown).toBe(CRISIS_REPLY)
    expect(model.doStreamCalls).toHaveLength(0)
  })

  it('вызов инструмента без текста — это ответ (кнопка), а не пустота', async () => {
    chain.steps = [
      {
        id: 'a',
        model: streaming([
          { type: 'tool-call', toolCallId: 'c1', toolName: 'startFocus', input: JSON.stringify({ firstStep: "открыть файл отчёта", minutes: 22 }) },
          { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
        ]),
      },
    ]
    const r = await collect(run({ tools: tools.forTask('chat') }))
    const call = r.parts.find((p) => p.type === 'tool-call') as { input: { minutes: number } } | undefined
    expect(call?.input.minutes).toBe(25) // 22 → ближайшая из 15/25/45
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool.call', tool: 'startFocus', valid: true }))
  })

  it('инструмент со ссылкой в аргументах не исполняется', async () => {
    chain.steps = [
      {
        id: 'a',
        model: streaming([
          { type: 'tool-call', toolCallId: 'c1', toolName: 'rememberFact', input: JSON.stringify({ fact: 'см. https://evil.example' }) },
          { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
        ]),
      },
    ]
    await collect(run({ tools: tools.forTask('chat'), commitTimeoutMs: 300 }))
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool.call', tool: 'rememberFact', valid: false }))
  })

  it('в журнале нет текста человека и ответа', async () => {
    const lines: string[] = []
    ;(console.info as unknown as { mockImplementation: (f: (l: string) => void) => void }).mockImplementation((l) => lines.push(l))
    chain.steps = [{ id: 'a', model: streaming(text('Секретный ответ кота.')) }]
    await collect(run({ messages: [{ role: 'user', content: 'мой секрет 12345' }], userTexts: ['мой секрет 12345'] }))
    const log = lines.join('\n')
    expect(log).toContain('"t":"ai"')
    expect(log).not.toMatch(/секрет|12345|Секретный/)
  })
})

describe('реестр инструментов', () => {
  it('задача видит только свои инструменты', () => {
    expect(Object.keys(tools.forTask('chat')).sort()).toEqual(['rememberFact', 'savePlan', 'startFocus'])
    expect(Object.keys(tools.forTask('session-voice'))).toEqual([])
  })
})
