import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleUpdate, looksLikeTask, T, type Deps } from '@/lib/tg/bot'
import { MemoryStore } from '@/lib/tg/store'
import { isGone, tgCall } from '@/lib/tg/telegram'

/** Проверка 20.11: бот на уровне крупных ботов — сбои Telegram, не текст, пересланное, дело без «разбей» */

const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }))
const fail = (error_code: number, description: string, retry_after?: number) =>
  new Response(JSON.stringify({ ok: false, error_code, description, ...(retry_after ? { parameters: { retry_after } } : {}) }), { status: error_code })

describe('tgCall: устойчивость к сбоям Telegram', () => {
  const env = process.env.TELEGRAM_BOT_TOKEN
  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = env
    vi.useRealTimers()
  })

  it('429 «Too Many Requests» — ждёт retry_after и повторяет', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't'
    const calls: number[] = []
    const f = vi.fn(async () => (calls.push(Date.now()), calls.length === 1 ? fail(429, 'Too Many Requests: retry after 1', 1) : ok({ message_id: 7 })))
    const r = await tgCall('sendMessage', { chat_id: 1, text: 'x' }, f as unknown as typeof fetch)
    expect(r).toEqual({ ok: true, result: { message_id: 7 } })
    expect(calls).toHaveLength(2)
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(950)
  })

  it('5xx и обрыв сети — один повтор; 400 — без повтора', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't'
    let n = 0
    const f5 = vi.fn(async () => (++n === 1 ? fail(502, 'Bad Gateway') : ok(true)))
    expect((await tgCall('sendMessage', {}, f5 as unknown as typeof fetch)).ok).toBe(true)
    n = 0
    const fnet = vi.fn(async () => {
      if (++n === 1) throw new TypeError('fetch failed')
      return ok(true)
    })
    expect((await tgCall('sendMessage', {}, fnet as unknown as typeof fetch)).ok).toBe(true)
    const f4 = vi.fn(async () => fail(400, 'Bad Request: message to edit not found'))
    const r = await tgCall('editMessageText', {}, f4 as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    expect(f4).toHaveBeenCalledTimes(1)
  })

  it('долгий retry_after (больше 5 с) не держит функцию — сразу отказ', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't'
    const f = vi.fn(async () => fail(429, 'Too Many Requests: retry after 30', 30))
    const t0 = Date.now()
    expect((await tgCall('sendMessage', {}, f as unknown as typeof fetch)).ok).toBe(false)
    expect(Date.now() - t0).toBeLessThan(500)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('блокировку бота узнаём по 403', () => {
    expect(isGone({ ok: false, code: 403, description: 'Forbidden: bot was blocked by the user' })).toBe(true)
    expect(isGone({ ok: false, code: 403, description: 'Forbidden: user is deactivated' })).toBe(true)
    expect(isGone({ ok: false, code: 400, description: 'Bad Request: chat not found' })).toBe(false)
    expect(isGone({ ok: true, result: true })).toBe(false)
  })
})

const CHAT = 77
function rig() {
  const store = new MemoryStore()
  const sent: { method: string; body: Record<string, unknown> }[] = []
  const deps: Deps = {
    store,
    send: async (method, body) => (sent.push({ method, body }), true),
    now: () => Date.UTC(2026, 10, 3, 6, 0),
    site: 'https://adhd-naparnik.vercel.app',
    breakdown: async (task) => ({ steps: [`Начать «${task}»`, 'Два', 'Три'], fallback: false }),
    sign: (v) => `sig${v}`,
  }
  const msg = (m: Record<string, unknown>) => handleUpdate({ message: { chat: { id: CHAT, type: 'private' }, ...m } }, deps)
  const texts = () => sent.filter((s) => s.method === 'sendMessage' && s.body.text !== T.menuHint).map((s) => String(s.body.text))
  return { store, sent, deps, msg, texts }
}

describe('бот: не текст, пересланное, дело без «разбей»', () => {
  it('голосовое и стикер — короткий честный ответ, а не справка', async () => {
    const r = rig()
    await r.msg({ text: '/start' })
    await r.msg({ voice: { file_id: 'x' } })
    expect(r.texts().at(-1)).toBe(T.noVoice)
    await r.msg({ sticker: { file_id: 'y' } })
    expect(r.texts().at(-1)).toBe(T.noText)
  })

  it('фото с подписью — подпись и есть сообщение', async () => {
    const r = rig()
    const heard: string[] = []
    r.deps.converse = async (_u, t) => (heard.push(t), { text: 'Мур.' })
    await r.msg({ text: '/start' })
    await r.msg({ photo: [{}], caption: 'смотри что нашёл' })
    expect(heard).toEqual(['смотри что нашёл'])
  })

  it('пересланное идёт коту с пометкой, а не как команда или дело', async () => {
    const r = rig()
    const got: { t: string; f?: boolean }[] = []
    let broke = 0
    r.deps.converse = async (_u, t, o) => (got.push({ t, f: o?.forwarded }), { text: 'Понял.' })
    r.deps.breakdown = async () => (broke++, { steps: ['a', 'b', 'c'], fallback: false })
    r.deps.known = () => true
    await r.msg({ text: '/start' })
    await r.msg({ text: 'разбей помыть посуду', forward_origin: { type: 'user' } })
    expect(got).toEqual([{ t: 'разбей помыть посуду', f: true }])
    expect(broke).toBe(0)
  })

  it('дело из базы без «разбей» — сразу весь план; чувства и разговор — коту', async () => {
    const r = rig()
    const asked: string[] = []
    let talked = 0
    r.deps.breakdown = async (t) => (asked.push(t), { steps: ['a', 'b', 'c'], fallback: false })
    r.deps.converse = async () => (talked++, { text: 'Мур.' })
    r.deps.known = (t) => ['помыть посуду', 'мне скучно', 'лень'].includes(t)
    await r.msg({ text: '/start' })
    await r.msg({ text: 'помыть посуду' })
    expect(asked).toEqual(['помыть посуду'])
    await r.msg({ text: 'мне скучно' })
    await r.msg({ text: 'лень' })
    await r.msg({ text: 'хочу научиться рисовать' })
    expect(asked).toEqual(['помыть посуду'])
    expect(talked).toBe(3)
  })

  it('looksLikeTask: глагол в неопределённой форме в начале', () => {
    for (const t of ['помыть посуду', 'записаться к врачу', 'испечь пирог', 'отнести документы']) expect([t, looksLikeTask(t)]).toEqual([t, true])
    for (const t of ['мне скучно', 'лень', 'привет', 'спать', 'кот', 'что делать']) expect([t, looksLikeTask(t)]).toEqual([t, false])
  })

  it('пока кот думает, «печатает…» обновляется', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const r = rig()
    let release!: () => void
    r.deps.converse = async () => (await new Promise<void>((res) => (release = res)), { text: 'Мур.' })
    await r.msg({ text: '/start' })
    const run = r.msg({ text: 'как дела' })
    await new Promise((res) => setTimeout(res, 5))
    vi.advanceTimersByTime(8500)
    release()
    await run
    vi.useRealTimers()
    expect(r.sent.filter((s) => s.method === 'sendChatAction').length).toBeGreaterThanOrEqual(3)
  })
})

describe('бот: разметка не прошла — план всё равно приходит', () => {
  it('Telegram отверг HTML (и правку полоски, и новое сообщение) — план приходит простым текстом', async () => {
    const r = rig()
    const send = r.deps.send
    let n = 100
    r.deps.send = async (m, b) => {
      if (b.parse_mode === 'HTML') return null
      await send(m, b)
      return m === 'sendMessage' ? { message_id: n++ } : true
    }
    r.deps.wait = async () => {}
    await r.msg({ text: '/start' })
    await r.msg({ text: 'разбей помыть посуду' })
    const last = r.sent.filter((s) => s.method === 'sendMessage').map((s) => String(s.body.text)).find((t) => t.startsWith('🐾 '))
    expect(last).toMatch(/^🐾 помыть посуду\n🪄 Котик разломал на 3 микрошага:/)
    expect(last).not.toContain('<b>')
  })
})
