import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { streamText } from 'ai'
import { aiHealth, aiState, resetHealthForTests } from '@/lib/ai/health'
import { configuredProviders, modelChain, resetModelsForTests } from '@/lib/ai/models'
import { GET as healthRoute } from '@/app/api/health/ai/route'
import { hitsSize, IP_CEILING, rateLimit } from '@/lib/api-guard'

/**
 * Поставщики моделей и состояние ИИ (этап 2, 13.11; аудит 12.11, находки 24–25): второй независимый поставщик
 * включается ключом, владелец видит баланс до того, как он кончится, лимит запросов не наказывает людей за общий адрес.
 */
beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('ANYMODEL_API_KEY', '')
  vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
  vi.stubEnv('AI_BALANCE_LOW', '')
  resetModelsForTests()
  resetHealthForTests()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('цепочка поставщиков', () => {
  it('только AnyModel: три его маршрута, как раньше', () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    expect(modelChain('chat').map((s) => [s.id, s.provider])).toEqual([
      ['gc/gemini-2.5-flash', 'anymodel'],
      ['ag/gemini-2.5-flash', 'anymodel'],
      ['ds/deepseek-v4-flash', 'anymodel'],
    ])
    expect(configuredProviders()).toEqual(['anymodel'])
  })
  it('есть ключ Google: независимый поставщик добавляется последним звеном', () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'g')
    const chain = modelChain('breakdown')
    expect(chain.map((s) => s.provider)).toEqual(['anymodel', 'anymodel', 'anymodel', 'google'])
    expect(chain.at(-1)?.id).toBe('google/gemini-2.5-flash')
    expect(configuredProviders()).toEqual(['anymodel', 'google'])
  })
  it('у прямого Google рассуждение выключено в самом запросе (иначе ответ не уложится во время)', async () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'g')
    const bodies: string[] = []
    vi.stubGlobal('fetch', async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(String(init?.body ?? ''))
      return new Response('{"error":{"message":"stub"}}', { status: 500, headers: { 'content-type': 'application/json' } })
    })
    const step = modelChain('chat').at(-1)!
    const result = streamText({ model: step.model, providerOptions: step.options, prompt: 'привет', maxRetries: 0, onError: () => {} })
    for await (const part of result.stream) void part
    expect(bodies).toHaveLength(1)
    expect(JSON.parse(bodies[0]).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
  })
  it('без ключа AnyModel — прежний путь, как до обвязки', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'g')
    expect(modelChain('chat').map((s) => s.id)).toEqual(['gemini-2.5-flash'])
  })
})

describe('состояние ИИ', () => {
  const balance = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('итог по балансу и числу поставщиков', () => {
    expect(aiState('ok', ['anymodel'])).toBe('ok')
    expect(aiState('unlimited', ['anymodel'])).toBe('ok')
    expect(aiState('low', ['anymodel'])).toBe('low')
    expect(aiState('empty', ['anymodel'])).toBe('down')
    expect(aiState('rejected', ['anymodel'])).toBe('down')
    expect(aiState('empty', ['anymodel', 'google'])).toBe('degraded')
    expect(aiState('unknown', ['anymodel'])).toBe('ok') // неподтверждённое — не тревога
    expect(aiState('none', ['google'])).toBe('ok')
    expect(aiState('none', [])).toBe('unconfigured')
  })
  it('баланс читается у поставщика; наружу — только грубое состояние, без суммы и ключа', async () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'sk-secret')
    const h = await aiHealth({ fetchImpl: balance({ object: 'balance', balance: 30_431_629, unlimited: false, status: 'active', key: 'sk-…' }) })
    expect(h).toMatchObject({ ai: 'ok', balance: 'ok', providers: 1 })
    expect(JSON.stringify(h)).not.toMatch(/30431629|sk-/)
  })
  it('баланс ниже порога — «мало»; порог задаётся окружением', async () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    expect((await aiHealth({ fresh: true, fetchImpl: balance({ balance: 900_000, status: 'active' }) })).ai).toBe('low')
    vi.stubEnv('AI_BALANCE_LOW', '500000')
    expect((await aiHealth({ fresh: true, fetchImpl: balance({ balance: 900_000, status: 'active' }) })).ai).toBe('ok')
  })
  it('ноль, 402, отозванный ключ и неактивный аккаунт — ИИ выключен', async () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    const state = async (f: typeof fetch) => (await aiHealth({ fresh: true, fetchImpl: f })).ai
    expect(await state(balance({ balance: 0, status: 'active' }))).toBe('down')
    expect(await state(balance({}, 402))).toBe('down')
    expect(await state(balance({}, 401))).toBe('down')
    expect(await state(balance({ balance: 5_000_000, status: 'blocked' }))).toBe('down')
  })
  it('сбой сети при проверке — не тревога и держится 30 секунд; подтверждённый ответ — 5 минут', async () => {
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    let calls = 0
    const flaky = (async () => {
      calls++
      if (calls === 1) throw new Error('network')
      return new Response(JSON.stringify({ balance: 9_000_000, status: 'active' }))
    }) as unknown as typeof fetch
    expect(await aiHealth({ fetchImpl: flaky, now: 1_000 })).toMatchObject({ ai: 'ok', balance: 'unknown' })
    // публичная страница не ходит к поставщику с ключом на каждый запрос, даже когда баланс не подтверждён
    await aiHealth({ fetchImpl: flaky, now: 20_000 })
    expect(calls).toBe(1)
    expect(await aiHealth({ fetchImpl: flaky, now: 32_000 })).toMatchObject({ balance: 'ok' })
    await aiHealth({ fetchImpl: flaky, now: 90_000 })
    expect(calls).toBe(2)
    await aiHealth({ fetchImpl: flaky, now: 32_000 + 5 * 60_000 + 1 })
    expect(calls).toBe(3)
  })
  it('маршрут: 503, когда ИИ выключен; strict — 503 и когда баланс на исходе', async () => {
    const get = (q = '', n = 1) => healthRoute(new Request(`https://naparnik.test/api/health/ai${q}`, { headers: { 'x-real-ip': `203.0.113.${n}` } }))
    const none = await get()
    expect(none.status).toBe(503)
    expect(await none.json()).toMatchObject({ ai: 'unconfigured' })
    vi.stubEnv('ANYMODEL_API_KEY', 'k')
    vi.stubGlobal('fetch', balance({ balance: 900_000, status: 'active' }))
    resetHealthForTests()
    const low = await get('', 2)
    expect(low.status).toBe(200)
    expect(low.headers.get('cache-control')).toBe('no-store')
    expect(await low.json()).toMatchObject({ ai: 'low', balance: 'low' })
    expect((await get('?strict=1', 3)).status).toBe(503)
  })
})

describe('лимит запросов: человек и адрес', () => {
  let ip = 0
  const nid = (c: string) => c.repeat(22)
  const req = (address: string, cookie?: string) =>
    new Request('https://naparnik.test/api/x', { headers: { 'x-real-ip': address, ...(cookie ? { cookie } : {}) } })
  const hit = (r: Request, bucket: string, limit: number) => {
    try {
      rateLimit(r, bucket, limit)
      return 200
    } catch (e) {
      return (e as Response).status
    }
  }
  beforeEach(() => ip++)

  it('люди за одним адресом не делят лимит: у каждого свой', () => {
    const address = `198.51.100.${ip}`
    for (let i = 0; i < 5; i++) expect(hit(req(address, `nid=${nid('a')}`), 't1', 5)).toBe(200)
    expect(hit(req(address, `nid=${nid('a')}`), 't1', 5)).toBe(429)
    // сосед за тем же адресом оператора отвечает коту как ни в чём не бывало
    expect(hit(req(address, `nid=${nid('b')}; other=1`), 't1', 5)).toBe(200)
  })
  it('потолок на адрес остаётся: подделанные cookie дают скрипту не больше трёх лимитов', () => {
    const address = `198.51.100.${ip}`
    let ok = 0
    for (let i = 0; i < 40; i++) if (hit(req(address, `nid=${String(i).padStart(22, 'x')}`), 't2', 5) === 200) ok++
    expect(ok).toBe(5 * IP_CEILING)
  })
  it('без cookie и с негодной cookie — прежний лимит на адрес', () => {
    const address = `198.51.100.${ip}`
    for (let i = 0; i < 5; i++) expect(hit(req(address, i % 2 ? 'nid=short' : undefined), 't3', 5)).toBe(200)
    expect(hit(req(address), 't3', 5)).toBe(429)
  })
  it('отказанные запросы с перебором cookie не плодят записи в памяти сервера (проверка 13.11)', () => {
    const address = `198.51.100.${ip}`
    for (let i = 0; i < 15; i++) hit(req(address, `nid=${String(i).padStart(22, 'y')}`), 't5', 5)
    const before = hitsSize()
    for (let i = 100; i < 200; i++) expect(hit(req(address, `nid=${String(i).padStart(22, 'y')}`), 't5', 5)).toBe(429)
    expect(hitsSize()).toBe(before)
  })
  it('отказ не съедает место: исчерпавший свой лимит не отнимает запросы у соседей', () => {
    const address = `198.51.100.${ip}`
    for (let i = 0; i < 5; i++) hit(req(address, `nid=${nid('a')}`), 't4', 5)
    for (let i = 0; i < 30; i++) expect(hit(req(address, `nid=${nid('a')}`), 't4', 5)).toBe(429)
    for (let i = 0; i < 5; i++) expect(hit(req(address, `nid=${nid('b')}`), 't4', 5)).toBe(200)
    for (let i = 0; i < 5; i++) expect(hit(req(address, `nid=${nid('c')}`), 't4', 5)).toBe(200)
  })
})
