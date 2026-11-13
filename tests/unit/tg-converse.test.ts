import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { simulateReadableStream } from 'ai'
import { chatTurn } from '@/lib/ai/agents/chat'
import { newTurn } from '@/lib/ai/core/turn'
import { NoMemory } from '@/lib/ai/memory/provider'
import { situation } from '@/lib/ai/prompt/tasks/chat'
import { converse } from '@/lib/tg/deps'
import type { TgUser } from '@/lib/tg/store'

/**
 * Кот в боте через обвязку (13.11): у канала свой набор инструментов и честное обещание «напишу первым» только там,
 * где напоминания подключены.
 */
const chain = vi.hoisted(() => ({ steps: [] as Array<{ id: string; model: unknown }> }))
vi.mock('@/lib/ai/models', () => ({ modelChain: () => chain.steps }))

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
type Seen = { prompt: string; tools: string[]; toolChoice: unknown }
function scripted(chunks: Record<string, unknown>[], seen: Seen[] = []) {
  return new MockLanguageModelV4({
    doStream: async (opts) => {
      seen.push({ prompt: JSON.stringify(opts.prompt), tools: (opts.tools ?? []).map((t) => t.name), toolChoice: opts.toolChoice })
      return { stream: simulateReadableStream({ chunks: [{ type: 'stream-start', warnings: [] }, ...chunks] as never[] }) }
    },
  })
}
const say = (text: string) => [
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: text },
  { type: 'text-end', id: 't' },
  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
]
const call = (toolName: string, input: Record<string, unknown>) => [
  { type: 'tool-call', toolCallId: 'c1', toolName, input: JSON.stringify(input) },
  { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage },
]
const user = (over: Partial<TgUser> = {}): TgUser => ({ id: 7, createdAt: 0, tz: 180, ignored: 0, lastActive: 0, variant: 0, ...over })

beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}))

describe('кот в боте', () => {
  it('модель видит только то, что бот умеет исполнить: без памяти и вспоминания', async () => {
    const seen: Seen[] = []
    chain.steps = [{ id: 'm', model: scripted(say('Давай начнём с малого. Какой файл открыть первым?'), seen) }]
    const r = await converse(user(), 'не могу сесть за курсовую')
    expect(r).toEqual({ text: 'Давай начнём с малого. Какой файл открыть первым?', startFocus: undefined, plan: undefined })
    expect(seen[0].tools.sort()).toEqual(['savePlan', 'startFocus'])
    // коту сказано, что напоминания подключены, и местный час человека
    expect(seen[0].prompt).toContain('подключены')
  })
  it('акцент звёздочками в бот не уходит', async () => {
    chain.steps = [{ id: 'm', model: scripted(say('Открой *файл*, я рядом. Начнём?')) }]
    expect((await converse(user(), 'готов'))?.text).toBe('Открой файл, я рядом. Начнём?')
  })
  it('вызов savePlan возвращается боту планом', async () => {
    chain.steps = [{ id: 'm', model: scripted(call('savePlan', { task: 'Курсовая', firstStep: 'Открыть черновик', startTime: '10:00' })) }]
    const r = await converse(user(), 'давай завтра в десять открою черновик курсовой')
    expect(r?.plan).toEqual({ task: 'Курсовая', firstStep: 'Открыть черновик', startTime: '10:00' })
  })
  it('«так и запиши» после вопроса кота о плане: план обязателен, и модели предлагается только он', async () => {
    const seen: Seen[] = []
    chain.steps = [{ id: 'm', model: scripted(call('savePlan', { task: 'Курсовая', firstStep: 'Открыть черновик', startTime: '10:00' }), seen) }]
    const history = [
      { who: 'user' as const, text: 'хочу завтра сесть за курсовую', at: Date.now() - 60_000 },
      { who: 'cat' as const, text: 'Давай. Какой первый шаг и во сколько начнём завтра?', at: Date.now() - 50_000 },
    ]
    const r = await converse(user({ history }), 'открыть черновик, в 10:00. так и запиши')
    expect(r?.plan?.firstStep).toBe('Открыть черновик')
    expect(seen[0].tools).toEqual(['savePlan'])
    expect(seen[0].toolChoice).toMatchObject({ type: 'tool', toolName: 'savePlan' })
  })
  it('«запомни, что…»: памяти у бота нет, вызов не обязателен, коту сказано ответить честно', async () => {
    const seen: Seen[] = []
    chain.steps = [
      { id: 'liar', model: scripted(say('Запомнил, ты логист!'), seen) },
      { id: 'honest', model: scripted(say('Здесь я память не веду. С каким делом помочь сейчас?'), seen) },
    ]
    const r = await converse(user(), 'запомни, что я учусь на логиста')
    expect(r?.text).toBe('Здесь я память не веду. С каким делом помочь сейчас?')
    expect(seen[0].toolChoice).not.toMatchObject({ type: 'tool' })
    expect(seen[0].tools).not.toContain('memory')
    expect(seen[0].prompt).toContain('В этом чате ты ничего не запоминаешь надолго')
  })
  it('в память кота уходит только текущий план человека, без его номера чата', async () => {
    const seen: Seen[] = []
    chain.steps = [{ id: 'm', model: scripted(say('Как там черновик? Начнём с первой строки?'), seen) }]
    await converse(user({ id: 987654321, plan: { task: 'Курсовая', firstStep: 'Открыть черновик', startTime: '10:00' } }), 'я тут')
    expect(seen[0].prompt).toContain('Открыть черновик')
    expect(seen[0].prompt).not.toContain('987654321')
  })
  it('модели не ответили: null, бот перейдёт на правила', async () => {
    chain.steps = [{ id: 'm', model: new MockLanguageModelV4({ doStream: async () => { throw Object.assign(new Error('down'), { statusCode: 400 }) } }) }]
    expect(await converse(user(), 'привет, помоги начать')).toBeNull()
  })
  it('кризис: проверенный ответ без модели', async () => {
    const seen: Seen[] = []
    chain.steps = [{ id: 'm', model: scripted(say('не должно дойти'), seen) }]
    const r = await converse(user(), 'я не хочу жить')
    expect(r?.text).toContain('112')
    expect(seen).toHaveLength(0)
  })
})

describe('обещание «напишу первым»', () => {
  it('сайту без бота коту сказано, что напоминания не подключены; без сведений блок прежний', () => {
    expect(situation(10, 'off')).toContain('не подключены')
    expect(situation(10, 'on')).toContain('"напоминания в Telegram":"подключены"')
    expect(situation(10)).not.toContain('Telegram')
    expect(situation(undefined)).toBeUndefined()
    expect(situation(undefined, 'on')).toContain('подключены')
  })
  it('на сайте набор инструментов прежний', async () => {
    const seen: Seen[] = []
    chain.steps = [{ id: 'm', model: scripted(say('Привет-привет! Что сегодня висит?'), seen) }]
    const stream = await chatTurn({ ctx: newTurn({ task: 'chat' }), memory: NoMemory, mode: 'companion', conversation: [{ role: 'user', content: 'привет' }], userTexts: ['привет'] })
    for await (const p of stream as unknown as AsyncIterable<unknown>) void p
    expect(seen[0].tools.sort()).toEqual(['memory', 'recall', 'savePlan', 'startFocus'])
  })
})
