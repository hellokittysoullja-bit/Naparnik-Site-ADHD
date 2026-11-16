import { expect, test, type Page } from '@playwright/test'
import { seedStarts, walkOnboarding } from './helpers'

/**
 * Обновление страницы /app — с первого кадра своё (владелец 16.11, запись экрана: Дом на миг показывал «курсовая» или
 * «почта» и сферу «Дом», потом прыгал на «написать маме» и «Написать»). Страницы статические, память — только на
 * устройстве; раньше HTML нёс вариант «пустой памяти и ночи», и каждый экран менялся на глазах. Теперь память и час
 * читает скрипт первого кадра (lib/app-prepaint.ts), а экраны с личным содержимым не рисуют чужого.
 *
 * Тесты записывают состояние экрана в каждом кадре и при каждой вставке узлов, с самого начала загрузки, и проверяют,
 * что чужого не было ни разу. Процессор замедлен вчетверо — так, как это видно на телефоне. Все падают на сборке до 16.11.
 */

type Snap = Record<string, string | number | boolean | null>

/** запись с начала загрузки: fn вызывается на каждом кадре и при каждой вставке узлов, пока не пройдёт ms */
async function record(page: Page, fn: string, ms = 4000) {
  await page.addInitScript(
    ({ fn, ms }) => {
      const w = window as unknown as { __snaps: unknown[] }
      w.__snaps = []
      const take = new Function(`return (${fn})()`) as () => unknown
      let last = ''
      const snap = () => {
        try {
          const v = take()
          const k = JSON.stringify(v)
          if (v && k !== last) {
            w.__snaps.push(v)
            last = k
          }
        } catch {
          /* узлов ещё нет */
        }
      }
      // после вставки узлов — в конце микрозадачи: так снимок видит то же, что увидит отрисовка (наблюдатели страницы,
      // например скрипт первого кадра, к этому моменту уже отработали; кадра между ними не бывает)
      new MutationObserver(() => queueMicrotask(snap)).observe(document, { childList: true, subtree: true, attributes: true })
      const loop = () => {
        snap()
        if (performance.now() < ms) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    { fn, ms },
  )
}

const snaps = (page: Page) => page.evaluate(() => (window as unknown as { __snaps: Snap[] }).__snaps)

async function slow(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

/** человек прошёл знакомство (сфера «Написать или позвонить»), 9 стартов, находка, идёт сессия */
async function returning(page: Page, { session = false } = {}) {
  await page.goto('/app/start')
  await walkOnboarding(page, { toPlan: true })
  await seedStarts(page, 9)
  await page.evaluate((session) => {
    const o = JSON.parse(localStorage.getItem('naparnik:onboarding')!)
    o.sphere = 'message'
    localStorage.setItem('naparnik:onboarding', JSON.stringify(o))
    localStorage.setItem('naparnik:finds', JSON.stringify([{ key: 'shell', name: 'Ракушка', startId: 's1', seed: 1, rarity: 'common' }]))
    if (session) localStorage.setItem('naparnik:activeSession', JSON.stringify({ startedAt: Date.now() - 60_000, minutes: 25, task: 'Помыть посуду', startId: 's8' }))
  }, session)
}

const visible = (el: Element | null) => !!el && (el as HTMLElement).offsetParent !== null && getComputedStyle(el).visibility !== 'hidden'

test('Дом: пример в поле, сфера «Написать», строка над кнопкой и плашка находок — свои с первого кадра', async ({ page }) => {
  test.setTimeout(120_000)
  await returning(page)
  await page.goto('/app')
  await record(
    page,
    String(() => {
      const input = document.getElementById('home-task') as HTMLInputElement | null
      const group = document.querySelector('[aria-label="Сфера дела"]')
      if (!input || !group) return null
      const chips = [...group.querySelectorAll('button')].filter((b) => (b as HTMLElement).offsetParent !== null)
      const hint = document.getElementById('home-hint')
      const finds = document.querySelector('a[href="/app/world"]:not(nav a)')
      return {
        placeholder: input.placeholder,
        chips: chips.map((b) => (b as HTMLElement).innerText.trim()).join(' / '),
        pressed: chips.map((b) => getComputedStyle(b).backgroundColor).join(' / '),
        hint: hint ? (hint.innerText.trim() || getComputedStyle(hint, '::before').content) : null,
        finds: !!finds && (finds as HTMLElement).offsetParent !== null,
      }
    }),
  )
  await slow(page)
  await page.reload()
  await page.waitForTimeout(4500)
  const all = await snaps(page)
  expect(all.length).toBeGreaterThan(0)
  const last = all[all.length - 1]
  expect(last.placeholder).toBe('например, «написать маме»')
  expect(last.chips).toContain('Написать')
  for (const s of all) {
    expect(s.placeholder).toBe(last.placeholder)
    expect(s.chips).toBe(last.chips)
    expect(s.pressed).toBe(last.pressed)
    expect(String(s.hint).replace(/^"|"$/g, '')).toBe(String(last.hint).replace(/^"|"$/g, ''))
    expect(s.finds).toBe(true)
  }
})

test('Фокус с идущей сессией: после обновления сразу таймер, экрана выбора шага нет ни на кадр', async ({ page }) => {
  test.setTimeout(120_000)
  await returning(page, { session: true })
  await page.goto('/app/session')
  await page.getByText('Идёт фокус-сессия').waitFor()
  await record(page, String(() => ({ setup: /ПЕРВЫЙ ШАГ|Погнали|Что в фокусе/i.test(document.body.innerText), running: /Идёт фокус-сессия/.test(document.body.innerText) })))
  await slow(page)
  await page.reload()
  await page.waitForTimeout(3000)
  const all = await snaps(page)
  expect(all.some((s) => s.running)).toBe(true)
  expect(all.filter((s) => s.setup)).toEqual([])
})

test('переписка: строка о весточках приходит вместе с карточкой, карточка не прыгает', async ({ page }) => {
  test.setTimeout(120_000)
  await returning(page)
  await page.goto('/app/chat')
  await page.getByText(/Весточки выключены/).waitFor()
  await record(
    page,
    String(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /Повторить|Следующий шаг/.test(b.textContent ?? ''))
      if (!btn) return null
      // положение по вёрстке (без трансформаций): въезд экрана (app-page-in) двигает его на доли пикселя — это не прыжок
      let top = 0
      for (let el: HTMLElement | null = btn; el; el = el.offsetParent as HTMLElement | null) top += el.offsetTop
      return { top }
    }),
  )
  await slow(page)
  await page.reload()
  await page.waitForTimeout(3500)
  const tops = (await snaps(page)).map((s) => s.top)
  expect(tops.length).toBeGreaterThan(0)
  expect(new Set(tops).size).toBe(1)
})

test('Мир: с первого кадра весь остров стоит, ничего не прорастает заново', async ({ page }) => {
  test.setTimeout(120_000)
  await returning(page)
  await page.goto('/app/world')
  await record(
    page,
    String(() => {
      // кадры, которых человек не видит, не считаем: до #first-frame отрисовка заблокирована (app/layout.tsx), пока body
      // скрыт — страница держится до готовности (lib/first-frame.ts)
      if (!document.getElementById('first-frame') || getComputedStyle(document.body).visibility === 'hidden') return null
      const svg = document.querySelector('svg[role="img"][aria-label^="Остров"]')
      if (!svg) return null
      const pre = svg.hasAttribute('data-island-pre')
      // постройки, видимые в кадре: до чтения памяти — варианты «постройка», после — первые count мест (count — из подписи)
      const built = pre
        ? [...svg.querySelectorAll('[data-island-real]')].filter((g) => getComputedStyle(g).display !== 'none').length
        : Math.min(Number((svg.getAttribute('aria-label') ?? '').match(/(\d+) старт/)?.[1] ?? 0), 10)
      return { built, growing: svg.querySelectorAll('.island-grow').length }
    }),
  )
  await slow(page)
  await page.reload()
  await page.waitForTimeout(3000)
  const all = await snaps(page)
  expect(all.length).toBeGreaterThan(0)
  for (const s of all) expect(s).toEqual({ built: 9, growing: 0 })
})

test('фон и меню: днём сразу дневное небо и гряда с ориентирами, у Мира сразу точка «есть новое»', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date('2026-11-16T12:30:00') })
  await page.clock.resume()
  await returning(page)
  await page.goto('/app/chat')
  await record(
    page,
    String(() => {
      const bd = document.querySelector('[data-app-backdrop]')
      const nav = document.querySelector('nav a[href="/app/world"]')
      if (!bd || !nav) return null
      const layers = [...bd.children].filter((c) => c.tagName === 'DIV').slice(0, 4)
      const ridge = [...bd.querySelectorAll('svg')].find((s) => s.getAttribute('viewBox') === '0 0 400 80')
      return {
        day: Number(getComputedStyle(layers[2]).opacity),
        night: Number(getComputedStyle(layers[0]).opacity),
        ridge: !!ridge && getComputedStyle(ridge).display !== 'none',
        dot: [...nav.querySelectorAll('span')].some((s) => s.className.includes('bg-reward') && (s as HTMLElement).offsetParent !== null),
      }
    }),
  )
  await slow(page)
  await page.reload()
  await page.waitForTimeout(3500)
  const all = await snaps(page)
  expect(all.length).toBeGreaterThan(0)
  for (const s of all) expect(s).toEqual({ day: 1, night: 0, ridge: true, dot: true })
})

test('Дом: в HTML перед самим Домом нет тяжёлого скрытого фона (из-за него был кадр без Дома)', async ({ request }) => {
  const html = await (await request.get('/app')).text()
  const before = html.indexOf('<main') - html.indexOf('<body')
  // скрипт первого кадра (~5 КБ) и пустой корень фона; до 16.11 здесь было ~21 КБ, и на слабом телефоне браузер успевал
  // нарисовать кадр, где есть только фон
  expect(before).toBeGreaterThan(0)
  expect(before).toBeLessThan(9000)
})

test('переход по меню: новый экран сразу виден целиком, подсветка — под выбранной вкладкой в каждом кадре', async ({ page }) => {
  test.setTimeout(120_000)
  await returning(page)
  await page.goto('/app')
  await page.waitForTimeout(1500)
  await slow(page)
  for (const [tab, path] of [['Фокус', '/app/session'], ['Мир', '/app/world'], ['Дом', '/app']] as const) {
    await page.evaluate(() => {
      const w = window as unknown as { __nav: unknown[]; __navStop: boolean }
      w.__nav = []
      w.__navStop = false
      const loop = () => {
        const main = document.querySelector('main')
        const cur = document.querySelector('nav a[aria-current="page"]')
        const pills = [...document.querySelectorAll('nav a')].filter((a) => [...a.children].some((c) => c.tagName === 'SPAN' && c.getAttribute('aria-hidden') === 'true' && c.className.includes('rounded')))
        w.__nav.push({
          path: location.pathname,
          opacity: main ? Number(getComputedStyle(main).opacity) : null,
          pillOk: pills.length === 1 && pills[0] === cur,
        })
        if (!w.__navStop) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    })
    await page.getByRole('navigation').getByRole('link', { name: tab }).click()
    await page.waitForURL(`**${path}`)
    await page.waitForTimeout(1200)
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __nav: { path: string; opacity: number | null; pillOk: boolean }[]; __navStop: boolean }
      w.__navStop = true
      return w.__nav
    })
    const after = frames.filter((f) => f.path === path)
    expect(after.length).toBeGreaterThan(0)
    for (const f of after) expect(f).toEqual({ path, opacity: 1, pillOk: true })
  }
})
