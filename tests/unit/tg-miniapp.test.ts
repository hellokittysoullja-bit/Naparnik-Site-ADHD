import { describe, expect, it } from 'vitest'
import { handleUpdate, T, type Deps } from '@/lib/tg/bot'
import { isToken } from '@/lib/tg/link'
import { linkStatus, linkWebApp, beginLink } from '@/lib/tg/site'
import { MemoryStore } from '@/lib/tg/store'
import { signInitData, verifyInitData } from '@/lib/tg/webapp'
import { CHUNK, MANIFEST_KEY, MAX_CHUNKS, chunkKey, fingerprint, loadManifest, parseManifest, restore, shouldRestore, sync, type Cloud, type Manifest } from '@/lib/tg-cloud'
import { icsText } from '@/lib/calendar'
import { GET as icsRoute } from '@/app/api/ics/route'
import { tgBoot } from '@/lib/tg-webapp-boot'

/**
 * Мини-апп в Telegram (21.11, владелец: «сайт 1:1 в боте»): подпись данных запуска, привязка напоминаний без перехода в
 * чат, копия памяти в облаке Telegram, календарь по адресу.
 */
const BOT = '123456:TEST-token-for-unit-tests'
const NOW = Date.UTC(2026, 10, 21, 12, 0)
const user = (id: number) => JSON.stringify({ id, first_name: 'Аня', language_code: 'ru' })
const init = (id = 777, auth = NOW / 1000 - 60) => signInitData({ query_id: 'AAE', user: user(id), auth_date: String(Math.floor(auth)), signature: 'sig' }, BOT)

describe('данные запуска мини-аппа: подпись Telegram', () => {
  it('настоящая подпись — человек узнан', () => {
    expect(verifyInitData(init(), BOT, NOW)).toEqual({ id: 777, firstName: 'Аня' })
  })
  it('подмена номера, чужой ключ, старая и «будущая» строка — отказ', () => {
    const good = init()
    const forged = good.replace(encodeURIComponent('"id":777'), encodeURIComponent('"id":778'))
    expect(forged).not.toBe(good)
    expect(verifyInitData(forged, BOT, NOW)).toBeNull()
    expect(verifyInitData(good, '999:other', NOW)).toBeNull()
    expect(verifyInitData(init(777, NOW / 1000 - 25 * 3600), BOT, NOW)).toBeNull()
    expect(verifyInitData(init(777, NOW / 1000 + 3600), BOT, NOW)).toBeNull()
    expect(verifyInitData('', BOT, NOW)).toBeNull()
    expect(verifyInitData('user=1&hash=zz', BOT, NOW)).toBeNull()
  })
  it('поля сортируются по ключу, как у Telegram (а не по строке «ключ=значение»)', () => {
    const raw = signInitData({ a: '1', a1: '2', user: user(5), auth_date: String(NOW / 1000) }, BOT)
    expect(verifyInitData(raw, BOT, NOW)?.id).toBe(5)
  })
})

function rig() {
  const store = new MemoryStore()
  store.now = () => NOW
  const sent: { method: string; body: Record<string, unknown> }[] = []
  const deps: Deps = {
    store,
    send: async (method, body) => {
      sent.push({ method, body })
      return true
    },
    now: () => NOW,
    site: 'https://adhd-naparnik.vercel.app',
    breakdown: async () => ({ steps: ['a', 'b', 'c'], fallback: false }),
    sign: (v) => `sig${v}`,
  }
  return { store, deps, sent }
}

describe('«Напоминать в Telegram» внутри мини-аппа', () => {
  it('одно касание: чат из подписи связан с устройством, бот пишет в чат шаг и время', async () => {
    const r = rig()
    const res = await linkWebApp(r.deps, 777, { task: 'Диплом', firstStep: 'Открыть файл диплома', startTime: '10:00', tz: 180 })
    expect(isToken(res.token)).toBe(true)
    expect(res).toMatchObject({ linked: true, hour: 10 })
    const u = await r.store.getUser(777)
    expect(u?.plan?.firstStep).toBe('Открыть файл диплома')
    expect(r.sent.some((s) => s.body.chat_id === 777 && String(s.body.text).includes('Открыть файл диплома'))).toBe(true)
    expect(await linkStatus(r.store, res.token, NOW)).toMatchObject({ linked: true })
  })
  it('тот же жетон второй раз — тот же чат, без «Да, связать?»; знакомый чат по подписи связывается сразу', async () => {
    const r = rig()
    await handleUpdate({ message: { chat: { id: 777, type: 'private' }, text: '/start' } }, r.deps)
    const first = await linkWebApp(r.deps, 777, { firstStep: 'Шаг один' })
    const again = await linkWebApp(r.deps, 777, { firstStep: 'Шаг два' }, first.token)
    expect(again.token).toBe(first.token)
    expect(r.sent.some((s) => s.body.text === T.linkAsk('Шаг два'))).toBe(false)
    expect((await r.store.getUser(777))?.plan?.firstStep).toBe('Шаг два')
  })
  it('устройство, связанное раньше по ссылке с другим чатом, переходит к чату из подписи', async () => {
    const r = rig()
    const { url, token } = await beginLink(r.store, 'bot', { firstStep: 'Старый шаг' })
    await handleUpdate({ message: { chat: { id: 555, type: 'private' }, text: `/start ${new URL(url).searchParams.get('start')}` } }, r.deps)
    expect((await r.store.getUser(555))?.device).toBeTruthy()
    await linkWebApp(r.deps, 777, { firstStep: 'Новый шаг' }, token)
    expect((await r.store.getUser(555))?.device).toBeUndefined()
    expect(await r.store.chatOfDevice((await r.store.getUser(777))!.device!)).toBe(777)
  })
  it('план с кризисом или ссылкой в бот не уходит (те же проверки, что у привязки по ссылке)', async () => {
    const r = rig()
    await linkWebApp(r.deps, 777, { firstStep: 'Зайти на https://evil.example' })
    expect((await r.store.getUser(777))?.plan).toBeUndefined()
  })
})

/** облако как у Telegram: те же лимиты на ключи и значения, ошибка при нарушении */
function fakeCloud() {
  const data = new Map<string, string>()
  let calls = 0
  const check = (k: string) => {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(k)) throw new Error(`bad key ${k}`)
  }
  const cloud: Cloud & { data: Map<string, string>; calls: () => number; failAfter?: number } = {
    data,
    calls: () => calls,
    get: async (keys) => {
      calls++
      const o: Record<string, string> = {}
      for (const k of keys) {
        check(k)
        if (data.has(k)) o[k] = data.get(k)!
      }
      return o
    },
    set: async (k, v) => {
      calls++
      if (cloud.failAfter !== undefined && calls > cloud.failAfter) throw new Error('network')
      check(k)
      if (v.length > 4096) throw new Error('value too long')
      data.set(k, v)
      if (data.size > 1024) throw new Error('too many keys')
    },
    del: async (keys) => {
      calls++
      for (const k of keys) data.delete(k)
    },
  }
  return cloud
}

const EMPTY: Manifest = { v: 1, k: {} }

describe('память мини-аппа в облаке Telegram', () => {
  it('копия и возврат: большие значения режутся на куски, всё возвращается байт в байт', async () => {
    const c = fakeCloud()
    const chat = JSON.stringify(Array.from({ length: 400 }, (_, i) => ({ id: i, text: `Реплика ${i} 🐾 — длинная, ёмкая` })))
    const local = { 'naparnik:chat': chat, 'naparnik:starts': '[{"at":1}]', 'naparnik:onboarding': '{"s":"study"}', 'other:key': 'x' }
    const man = await sync(c, local, EMPTY)
    expect(Object.keys(man.k).sort()).toEqual(['naparnik:chat', 'naparnik:onboarding', 'naparnik:starts'])
    expect(man.k['naparnik:chat'][2]).toBe(Math.ceil(chat.length / CHUNK))
    const back = await restore(c, (await loadManifest(c))!)
    expect(back).toEqual({ 'naparnik:chat': chat, 'naparnik:starts': '[{"at":1}]', 'naparnik:onboarding': '{"s":"study"}' })
  })
  it('неизменившееся не пишется повторно; изменилось одно — пишется одно и старые куски удаляются', async () => {
    const c = fakeCloud()
    const local = { 'naparnik:starts': '[1]', 'naparnik:plan': '{"a":1}' }
    const man = await sync(c, local, EMPTY)
    const n = c.calls()
    expect(await sync(c, local, man)).toBe(man)
    expect(c.calls()).toBe(n)
    const man2 = await sync(c, { ...local, 'naparnik:plan': '{"a":2}' }, man)
    const [id, gen] = man2.k['naparnik:plan']
    expect(gen).toBe(1)
    expect(c.data.has(chunkKey(id, 0, 0))).toBe(false)
    expect(c.data.get(chunkKey(id, 1, 0))).toBe('{"a":2}')
    expect([...c.data.keys()].sort()).toEqual([MANIFEST_KEY, chunkKey(man.k['naparnik:starts'][0], 0, 0), chunkKey(id, 1, 0)].sort())
  })
  it('«Забудь всё»: ключ пропал на устройстве — пропадает и в облаке', async () => {
    const c = fakeCloud()
    const man = await sync(c, { 'naparnik:facts': '[1,2]', 'naparnik:starts': '[1]' }, EMPTY)
    const man2 = await sync(c, { 'naparnik:starts': '[1]' }, man)
    expect(man2.k['naparnik:facts']).toBeUndefined()
    expect([...c.data.values()].join('')).not.toContain('[1,2]')
  })
  it('оборванная запись не портит копию: в облаке остаётся прежняя целая', async () => {
    const c = fakeCloud()
    const man = await sync(c, { 'naparnik:plan': 'старый план' }, EMPTY)
    c.failAfter = c.calls() + 1
    await expect(sync(c, { 'naparnik:plan': 'x'.repeat(9000) }, man)).rejects.toThrow()
    expect(await restore(c, (await loadManifest(c))!)).toEqual({ 'naparnik:plan': 'старый план' })
  })
  it('не влезающее в лимит Telegram не ломает остальное: самые большие значения пропускаются', async () => {
    const c = fakeCloud()
    const huge = 'я'.repeat(CHUNK * (MAX_CHUNKS + 5))
    const man = await sync(c, { 'naparnik:chatArchive': huge, 'naparnik:starts': '[1]' }, EMPTY)
    expect(man.k['naparnik:chatArchive']).toBeUndefined()
    expect(man.k['naparnik:starts']).toBeDefined()
    expect(c.data.size).toBeLessThanOrEqual(1024)
  })
  it('битые куски или чужое оглавление — не возвращаются', async () => {
    const c = fakeCloud()
    const man = await sync(c, { 'naparnik:starts': '[1,2,3]' }, EMPTY)
    c.data.set(chunkKey(man.k['naparnik:starts'][0], 0, 0), '[9]')
    expect(await restore(c, man)).toEqual({})
    expect(parseManifest('{"v":2}')).toBeNull()
    expect(parseManifest('{"v":1,"k":{"evil":[0,0,1,"x"],"naparnik:a":[0,0,99999,"x"]}}')).toEqual({ v: 1, k: {} })
  })
  it('возвращаем только на «чистое» устройство и только если человек в облаке уже жил', () => {
    const man: Manifest = { v: 1, k: { 'naparnik:starts': [0, 0, 1, fingerprint('[1]')] } }
    expect(shouldRestore({}, man)).toBe(true)
    expect(shouldRestore({ 'naparnik:cookies': '1' }, man)).toBe(true)
    expect(shouldRestore({ 'naparnik:onboarding': '{}' }, man)).toBe(false)
    expect(shouldRestore({}, { v: 1, k: { 'naparnik:cookies': [0, 0, 1, 'x'] } })).toBe(false)
    expect(shouldRestore({}, null)).toBe(false)
  })
})

describe('календарь в мини-аппе: файл по адресу без текста шага', () => {
  it('/api/ics отдаёт тот же файл, что собирает браузер, и не принимает лишнего', async () => {
    const res = await icsRoute(new Request('https://x.test/api/ics?at=20261122T090000&w=завтра утром'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    const body = await res.text()
    expect(body).toContain('DTSTART:20261122T090000')
    expect(body).toContain('DTEND:20261122T090200')
    expect(body).toContain('SUMMARY:2 минуты с Напарником')
    expect(body.replace(/UID:\d+|DTSTAMP:\d+T\d+/g, '')).toBe(icsText('20261122T090000', 'завтра утром', '2 минуты с Напарником', 'https://x.test').replace(/UID:\d+|DTSTAMP:\d+T\d+/g, ''))
    for (const bad of ['at=2026&w=x', 'at=20261322T090000', 'at=20261122T250000', 'at=20261122T090000&w=<script>'])
      expect((await icsRoute(new Request(`https://x.test/api/ics?${bad}`))).status).toBe(400)
  })
  it('конец события через 2 минуты переходит через полночь', () => {
    expect(icsText('20261122T235900', 'вечером', 't', 'o')).toContain('DTEND:20261123T000100')
  })
})

describe('ранний скрипт мини-аппа', () => {
  function env(hash: string, proxy: boolean) {
    const posted: [string, unknown][] = []
    const attrs: Record<string, string> = {}
    const store: Record<string, string> = {}
    let replaced = ''
    const w = {
      location: { hash, pathname: '/app', search: '?x=1' },
      history: { state: { a: 1 }, replaceState: (_s: unknown, _t: string, u: string) => (replaced = u) },
      sessionStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) },
      parent: null as unknown,
      setTimeout: () => 0,
      requestAnimationFrame: (f: () => void) => f(),
      addEventListener: () => {},
      ...(proxy ? { TelegramWebviewProxy: { postEvent: (t: string, d: string) => posted.push([t, d ? JSON.parse(d) : d]) } } : {}),
    } as Record<string, unknown>
    w.parent = w
    const d = {
      readyState: 'complete',
      documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), hasAttribute: () => false, style: { setProperty: (k: string, v: string) => (attrs[k] = v) } },
      addEventListener: () => {},
    }
    tgBoot(w as unknown as Window, d as unknown as Document, 'https://web.telegram.org', '#000000')
    return { posted, attrs, store, replaced: () => replaced, w }
  }
  const HASH = '#tgWebAppData=query_id%3D1%26user%3D%257B%2522id%2522%253A1%257D&tgWebAppVersion=8.0&tgWebAppPlatform=ios&foo=bar'

  it('в Telegram: раскрывает окно, выключает «смахнуть — закрыть», «готово» после кадра, убирает данные из адреса', () => {
    const e = env(HASH, true)
    const types = e.posted.map((p) => p[0])
    expect(types).toEqual(expect.arrayContaining(['web_app_expand', 'web_app_setup_swipe_behavior', 'web_app_set_header_color', 'web_app_request_safe_area', 'web_app_ready']))
    expect(e.posted.find((p) => p[0] === 'web_app_setup_swipe_behavior')?.[1]).toEqual({ allow_vertical_swipe: false })
    expect(e.attrs['data-tg']).toBe('ios')
    expect(e.replaced()).toBe('/app?x=1#foo=bar')
    expect(JSON.parse(e.store['naparnik:tgwa']).tgWebAppPlatform).toBe('ios')
  })
  it('поля экрана Telegram попадают в CSS', () => {
    const e = env(HASH, true)
    const receive = ((e.w.Telegram as Record<string, unknown>).WebView as { receiveEvent: (t: string, d: unknown) => void }).receiveEvent
    receive('safe_area_changed', { top: 47, bottom: 34, left: 0, right: 0 })
    receive('content_safe_area_changed', { top: 46, bottom: 0 })
    expect(e.attrs['--tg-sat']).toBe('93px')
    expect(e.attrs['--tg-sab']).toBe('34px')
  })
  it('в обычном браузере — ничего, даже с «#tgWebApp…» в адресе', () => {
    const e = env(HASH, false)
    expect(e.posted).toEqual([])
    expect(e.attrs['data-tg']).toBeUndefined()
    expect(e.w.__tg).toBeUndefined()
  })
  it('старый клиент Telegram (6.0): только то, что он умеет', () => {
    const e = env(HASH.replace('8.0', '6.0'), true)
    const types = e.posted.map((p) => p[0])
    expect(types).toContain('web_app_expand')
    expect(types).not.toContain('web_app_setup_swipe_behavior')
    expect(types).not.toContain('web_app_set_header_color')
    expect(types).not.toContain('web_app_request_safe_area')
  })
})
