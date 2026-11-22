import { expect, test, type Page } from '@playwright/test'
import { seedStarts } from './helpers'
import { sync, type Cloud } from '../lib/tg-cloud'

/**
 * Мини-апп в Telegram (21.11, владелец: «сайт 1:1 в боте»). Настоящего Telegram в стенде нет — его роль играет
 * подставной клиент: window.TelegramWebviewProxy (так приложения Telegram дают странице канал к себе) записывает
 * события сайта и отвечает на вызовы облачного хранилища так же, как Telegram (custom_method_invoked).
 */
type Ev = [string, unknown]

const HASH = (v = '8.0', platform = 'android') =>
  '#' +
  new URLSearchParams({
    tgWebAppData: `query_id=AAE&user=${encodeURIComponent(JSON.stringify({ id: 777, first_name: 'Аня' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=${'a'.repeat(64)}`,
    tgWebAppVersion: v,
    tgWebAppPlatform: platform,
  }).toString()

/** подставной Telegram: события — в window.__ev, облако — в localStorage['__cloud'] (переживает перезагрузку) */
async function asTelegram(page: Page, cloud: Record<string, string> = {}) {
  await page.addInitScript((seed) => {
    if (localStorage.getItem('__cloud') === null) localStorage.setItem('__cloud', JSON.stringify(seed))
    const w = window as unknown as { __ev: [string, unknown][]; Telegram?: { WebView?: { receiveEvent?: (t: string, d: unknown) => void } } }
    w.__ev = []
    const reply = (data: unknown) => setTimeout(() => w.Telegram?.WebView?.receiveEvent?.('custom_method_invoked', data), 5)
    ;(window as unknown as { TelegramWebviewProxy: unknown }).TelegramWebviewProxy = {
      postEvent(type: string, raw: string) {
        const data = raw ? JSON.parse(raw) : raw
        w.__ev.push([type, data])
        if (type !== 'web_app_invoke_custom_method') return
        const { req_id, method, params } = data as { req_id: string; method: string; params: { key?: string; value?: string; keys?: string[] } }
        const c = JSON.parse(localStorage.getItem('__cloud') || '{}') as Record<string, string>
        if (method === 'getStorageValues') {
          const out: Record<string, string> = {}
          for (const k of params.keys ?? []) if (k in c) out[k] = c[k]
          return reply({ req_id, result: out })
        }
        if (method === 'saveStorageValue') {
          if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.key!) || params.value!.length > 4096) return reply({ req_id, error: 'BAD' })
          c[params.key!] = params.value!
        }
        if (method === 'deleteStorageValues') for (const k of params.keys ?? []) delete c[k]
        localStorage.setItem('__cloud', JSON.stringify(c))
        reply({ req_id, result: true })
      },
    }
  }, cloud)
}

const events = (page: Page) => page.evaluate(() => (window as unknown as { __ev: Ev[] }).__ev)
const last = async (page: Page, type: string) => (await events(page)).filter((e) => e[0] === type).at(-1)?.[1]
const press = (page: Page, type: string, data?: unknown) =>
  page.evaluate(([t, d]) => (window as unknown as { Telegram: { WebView: { receiveEvent: (t: string, d: unknown) => void } } }).Telegram.WebView.receiveEvent(t as string, d), [type, data] as const)

test('в обычном браузере мини-аппа нет: ни метки, ни моста, ни событий', async ({ page }) => {
  await page.goto('/' + HASH())
  await expect(page.getByRole('link', { name: /Давай/ }).first()).toBeVisible()
  expect(await page.evaluate(() => ({ tg: document.documentElement.getAttribute('data-tg'), bridge: 'tg' in window && !!(window as unknown as { __tg?: unknown }).__tg }))).toEqual({ tg: null, bridge: false })
})

test('запуск: окно раскрыто, «смахнуть — закрыть» выключено, данные запуска убраны из адреса, «готово» после первого кадра', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/' + HASH())
  await expect(page.getByRole('link', { name: /Давай/ }).first()).toBeVisible()
  await expect.poll(async () => (await events(page)).map((e) => e[0])).toContain('web_app_ready')
  const ev = await events(page)
  const types = ev.map((e) => e[0])
  expect(types.indexOf('web_app_expand')).toBeLessThan(types.indexOf('web_app_ready'))
  expect(await last(page, 'web_app_setup_swipe_behavior')).toEqual({ allow_vertical_swipe: false })
  expect(page.url()).not.toContain('tgWebApp')
  expect(page.url()).not.toContain('777')
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-tg'))).toBe('android')
  // шапка Telegram в цвет неба сцены
  expect(await last(page, 'web_app_set_header_color')).toEqual({ color: '#060c1f' })
})

test('шапка Telegram в цвет верха экрана: на Мире — небо по часу, а не ночная сцена', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-21T22:30:00') })
  await asTelegram(page)
  await page.goto('/app/world' + HASH())
  const expected = await page.evaluate(() => {
    const g = document.createElement('canvas').getContext('2d')!
    g.fillStyle = 'oklch(0.2 0.035 268)'
    g.fillRect(0, 0, 1, 1)
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data
    return '#' + [r, gg, b].map((x) => x.toString(16).padStart(2, '0')).join('')
  })
  await expect.poll(() => last(page, 'web_app_set_header_color')).toEqual({ color: expected })
  expect(expected).not.toBe('#060c1f')
})

test('экран, который ждёт памяти (Фокус): «готово» только когда экран готов, а не на пустом кадре', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/app/session' + HASH())
  await expect.poll(async () => (await events(page)).some((e) => e[0] === 'web_app_ready')).toBe(true)
  // в момент «готово» страница уже не скрыта
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-hold'))).toBe(false)
  await expect(page.getByRole('button', { name: /25 мин/ })).toBeVisible()
})

test('«Назад» Telegram: на первом экране скрыта, в глубине видна и ведёт туда же, куда «назад» браузера', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/' + HASH())
  await expect.poll(() => last(page, 'web_app_setup_back_button')).toEqual({ is_visible: false })
  await page.getByRole('link', { name: /Давай/ }).first().click()
  await page.waitForURL('**/app/start**')
  await expect.poll(() => last(page, 'web_app_setup_back_button')).toEqual({ is_visible: true })
  await press(page, 'back_button_pressed')
  await page.waitForURL((u) => u.pathname === '/')
  await expect.poll(() => last(page, 'web_app_setup_back_button')).toEqual({ is_visible: false })
  await expect(page.getByRole('link', { name: /Давай/ }).first()).toBeVisible()
})

test('вибрация — через Telegram (на iPhone в окне Telegram navigator.vibrate нет)', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/app/session' + HASH())
  await page.getByRole('button', { name: /15 мин/ }).click()
  await expect.poll(() => last(page, 'web_app_trigger_haptic_feedback')).toEqual({ type: 'selection_change' })
})

test('ссылки наружу: t.me открывает сам Telegram, остальные — внешний браузер; окно сайта остаётся на месте', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/app' + HASH())
  await expect.poll(async () => (await events(page)).some((e) => e[0] === 'web_app_ready')).toBe(true)
  const here = page.url()
  await page.evaluate(() => {
    for (const [id, href, top] of [['a1', 'https://t.me/naparnik_bot?start=island', '0'], ['a2', 'https://example.com/page', '60px']]) {
      const a = document.createElement('a')
      a.id = id
      a.href = href
      a.textContent = id
      a.style.cssText = `position:fixed;top:${top};left:0;z-index:9999;padding:8px;background:#fff`
      document.body.appendChild(a)
    }
  })
  await page.click('#a1')
  expect(await last(page, 'web_app_open_tg_link')).toEqual({ path_full: '/naparnik_bot?start=island' })
  await page.click('#a2')
  expect(await last(page, 'web_app_open_link')).toEqual({ url: 'https://example.com/page' })
  await page.evaluate(() => window.open('https://t.me/other_bot', '_blank'))
  expect(await last(page, 'web_app_open_tg_link')).toEqual({ path_full: '/other_bot' })
  expect(page.url()).toBe(here)
})

test('идёт сессия — закрыть окно случайно нельзя (Telegram спрашивает), сессии нет — закрывается сразу', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/app' + HASH())
  await expect.poll(() => last(page, 'web_app_setup_closing_behavior')).toEqual({ need_confirmation: false })
  await page.evaluate(() => {
    localStorage.setItem('naparnik:activeSession', JSON.stringify({ startedAt: Date.now(), minutes: 25, step: 'x' }))
    window.dispatchEvent(new CustomEvent('naparnik:memory', { detail: { key: 'naparnik:activeSession' } }))
  })
  await expect.poll(() => last(page, 'web_app_setup_closing_behavior')).toEqual({ need_confirmation: true })
})

test('память копируется в облако Telegram и «Забудь всё» стирает копию', async ({ page }) => {
  await seedStarts(page, 9)
  await asTelegram(page)
  await page.goto('/app' + HASH())
  const cloudKeys = () => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('__cloud') || '{}')))
  await expect.poll(cloudKeys, { timeout: 8000 }).toContain('naparnik_m')
  const man = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('__cloud')!).naparnik_m))
  expect(Object.keys(man.k)).toEqual(expect.arrayContaining(['naparnik:starts', 'naparnik:companionName']))
  await page.evaluate(() => {
    localStorage.removeItem('naparnik:starts')
    window.dispatchEvent(new CustomEvent('naparnik:memory', { detail: { key: 'naparnik:starts' } }))
  })
  await expect
    .poll(() => page.evaluate(() => Object.keys(JSON.parse(JSON.parse(localStorage.getItem('__cloud')!).naparnik_m).k)), { timeout: 8000 })
    .not.toContain('naparnik:starts')
})

test('новый телефон: память пуста, в облаке остров — сайт возвращает его и открывает Дом', async ({ page }) => {
  // облако собирает та же функция, что на сайте
  const store: Record<string, string> = {}
  const cloud: Cloud = {
    get: async (keys) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
    set: async (k, v) => void (store[k] = v),
    del: async (keys) => keys.forEach((k) => delete store[k]),
  }
  const starts = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, date: '2026-11-1' + i, startedAt: new Date(Date.UTC(2026, 10, 10 + i)).toISOString(), label: `Шаг ${i + 1}`, fromPlan: false, minutes: 15 }))
  await sync(cloud, { 'naparnik:starts': JSON.stringify(starts), 'naparnik:companionName': '"Тень"', 'naparnik:onboarding': JSON.stringify({ v: 2 }) }, { v: 1, k: {} })
  await asTelegram(page, store)
  await page.goto('/' + HASH())
  await page.waitForURL((u) => u.pathname === '/app', { timeout: 10_000 })
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('naparnik:starts')))!)).toHaveLength(9)
  expect(await page.evaluate(() => localStorage.getItem('naparnik:companionName'))).toBe('"Тень"')
})

test('«Напоминать в Telegram» в мини-аппе: одно касание, без перехода в чат, сервер получает подпись запуска', async ({ page }) => {
  await seedStarts(page, 3)
  await page.addInitScript(() => {
    if (localStorage.getItem('naparnik:chat')) return
    localStorage.setItem(
      'naparnik:chat',
      JSON.stringify([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'завтра в десять открою черновик' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'tool-savePlan', toolCallId: 'c1', state: 'output-available', input: { task: 'Курсовая', firstStep: 'Открыть черновик', startTime: '10:00' }, output: 'План сохранён.' }] },
      ]),
    )
  })
  await asTelegram(page)
  let body: { initData?: string; plan?: { firstStep?: string } } = {}
  await page.route('**/api/tg/status', (r) => r.fulfill({ json: { available: true, linked: false } }))
  await page.route('**/api/tg/link', (r) => r.fulfill({ status: 500, json: {} }))
  await page.route('**/api/tg/webapp-link', async (r) => {
    body = r.request().postDataJSON()
    await r.fulfill({ json: { token: 't'.repeat(43), linked: true, hour: 10, active: true } })
  })
  await page.goto('/app/chat' + HASH())
  const here = page.url()
  await page.getByRole('button', { name: 'Напоминать в Telegram' }).click()
  await expect(page.getByText('Напомню в Telegram')).toBeVisible()
  expect(body.initData).toContain('query_id=AAE')
  expect(body.plan?.firstStep).toBe('Открыть черновик')
  expect(page.url()).toBe(here)
  expect(await last(page, 'web_app_open_tg_link')).toBeUndefined()
})

test('после первой сессии в мини-аппе: «сохранить в Telegram» — правда (облако), календарь — файл по адресу через Telegram', async ({ page }) => {
  await asTelegram(page)
  await page.goto('/app/start/after?m=relief&b=fear&s=work' + HASH())
  await page.getByRole('radio', { name: 'Нормально' }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByRole('radio', { name: 'Сохранить через Telegram' }).click()
  await expect(page.getByText('Остров уже хранится в твоём Telegram. На новом телефоне он вернётся сам.')).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()
  // уже в Telegram — в чат бота не уводим
  expect(await last(page, 'web_app_open_tg_link')).toBeUndefined()
  await page.getByRole('radio', { name: /Вечером/ }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByRole('radio', { name: 'Попробую' }).click()
  await page.getByRole('button', { name: 'Добавить в календарь' }).click()
  const dl = (await last(page, 'web_app_request_file_download')) as { url: string; file_name: string }
  expect(dl.file_name).toBe('naparnik.ics')
  const url = new URL(dl.url)
  expect(url.pathname).toBe('/api/ics')
  expect([...url.searchParams.keys()].sort()).toEqual(['at', 'w'])
  const res = await page.request.get(dl.url)
  expect(res.status()).toBe(200)
  expect(await res.text()).toMatch(/DTSTART:\d{8}T190000/)
})
