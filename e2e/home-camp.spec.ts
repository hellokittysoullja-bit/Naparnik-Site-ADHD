import { expect, test, type Page } from '@playwright/test'
import { collectErrors } from './helpers'

/**
 * Дом «Привал» (13.11, research/22-chat-and-home/E-home-design.md, макеты согласованы владельцем): шаг, о котором
 * человек договорился сам, строка по двум ответам знакомства, одна кнопка «Разломать на шаг», чат за запиской.
 */
const today = (shift = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + shift)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function seed(page: Page, data: { plan?: object; onboarding?: object }) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    if (d.plan) localStorage.setItem('naparnik:plan', JSON.stringify(d.plan))
    if (d.onboarding) localStorage.setItem('naparnik:onboarding', JSON.stringify(d.onboarding))
  }, data)
}

test('план на сегодня: шаг словами человека, строка по ответам знакомства, «Разломать на шаг» дробит его в Фокусе', async ({ page }) => {
  const errors = collectErrors(page)
  await seed(page, {
    plan: { forDate: today(), task: 'Курсовая по логистике', firstStep: 'Открыть файл с курсовой', startTime: '00:00', createdAt: '' },
    onboarding: { sphere: 'study', blocker: 'fear', motive: 'rest' },
  })
  let asked = ''
  await page.route('**/api/breakdown', async (route) => {
    asked = (route.request().postDataJSON() as { task: string }).task
    await route.fulfill({ json: { steps: ['Открыть ноутбук', 'Найти файл курсовой', 'Прочитать последний абзац'], source: 'model' } })
  })
  await page.goto('/app')
  await expect(page.getByText('ПО ПЛАНУ · 0:00')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Открыть файл с курсовой' })).toBeVisible()
  await expect(page.getByText('Курсовая по логистике')).toBeVisible()
  // «боюсь, что выйдет плохо» × «смогу отдыхать без фона»
  await expect(page.getByText('Сделай криво, и вечер будет твоим')).toBeVisible()
  // фразы кота на Доме нет (решение владельца), чат — за запиской
  await expect(page.getByPlaceholder('Напиши напарнику…')).toHaveCount(0)

  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await expect(page).toHaveURL(/\/app\/session\?step=.+&plan=1$/)
  await expect(page.getByText('Найти файл курсовой')).toBeVisible()
  expect(asked).toBe('Открыть файл с курсовой')
  // дробление не запускается второй раз при перезагрузке: пометки break в адресе больше нет
  expect(page.url()).not.toContain('break=1')
  expect(errors).toEqual([])
})

test('ничего не положено: «Что сейчас висит?», сфера из знакомства подсвечена, своё дело уходит на дробление', async ({ page }) => {
  await seed(page, { onboarding: { sphere: 'study', blocker: 'tired', motive: 'safety' } })
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть реферат', 'Найти тему', 'Написать одну фразу'], source: 'model' } }))
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  await expect(page.getByRole('button', { name: /Учёба/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /Работа/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Только открыть, это уже шаг к спокойствию')).toBeVisible()
  // пример в поле — из выбранной сферы
  const field = page.getByLabel('Что сейчас висит')
  await expect(field).toHaveAttribute('placeholder', /реферат/)
  await field.fill('реферат по истории')
  await field.press('Enter')
  await expect(page).toHaveURL(/\/app\/session\?step=/)
  expect(new URL(page.url()).searchParams.get('step')).toBe('реферат по истории')
  await expect(page.getByText('Написать одну фразу')).toBeVisible()
})

test('первый визит без знакомства: поле и подсказки, плашки находок нет, ничего не подсвечено', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  for (const name of [/Учёба/, /Работа/, /Дом$/]) await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText(/находк/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
})

test('«Поговорить с котом» открывает переписку, «Дом» в меню остаётся подсвеченным', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('link', { name: 'Поговорить с котом' }).click()
  await expect(page).toHaveURL(/\/app\/chat$/)
  await expect(page.getByPlaceholder('Напиши напарнику…')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Дом' })).toHaveAttribute('aria-current', 'page')
})

test('Дом не прокручивается ни вбок, ни вниз; невидимый общий фон /app под сценой не рисуется', async ({ page }) => {
  for (const [w, h] of [[390, 844], [360, 640]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app')
    await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      backdrop: getComputedStyle(document.querySelector('[data-app-backdrop]')!).display,
      chatBottom: document.querySelector('.btn-paper')!.getBoundingClientRect().bottom,
      navTop: document.querySelector('nav')!.getBoundingClientRect().top,
    }))
    expect(m.sw, `${w}×${h}`).toBeLessThanOrEqual(w)
    expect(m.sh, `${w}×${h}`).toBeLessThanOrEqual(h)
    expect(m.backdrop).toBe('none')
    // кнопка чата целиком над меню
    expect(m.chatBottom, `${w}×${h}`).toBeLessThanOrEqual(m.navTop)
  }
  // на других экранах общий фон на месте
  await page.getByRole('link', { name: 'Мир' }).click()
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-app-backdrop]')!).display)).not.toBe('none')
})

// ---------- проверка 13.11: дыры, найденные независимым разбором ----------

test('дробление следующего шага не стирает остальную очередь дела', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:stepQueue', JSON.stringify({ task: 'Курсовая', steps: ['Найти файл курсовой', 'Написать план из трёх пунктов'] }))
  })
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть папку', 'Найти файл', 'Открыть его'], source: 'model' } }))
  await page.goto('/app')
  await expect(page.getByText('СЛЕДУЮЩИЙ ШАГ')).toBeVisible()
  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await page.getByRole('button', { name: 'Открыть папку' }).click()
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:stepQueue') ?? 'null'))
  // подшаги встали на место раздробленного шага, второй шаг дела на месте
  expect(q).toEqual({ task: 'Курсовая', steps: ['Найти файл', 'Открыть его', 'Написать план из трёх пунктов'] })
})

test('план из прошлых дней, начатый с Дома, закрывается и больше не возвращается', async ({ page }) => {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:plan', JSON.stringify({ forDate: d, task: 'Отчёт', firstStep: 'Открыть таблицу с отчётом', createdAt: '' }))
  }, today(-2))
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть ноутбук', 'Найти таблицу', 'Открыть её'], source: 'model' } }))
  await page.goto('/app')
  await expect(page.getByText('ПРОДОЛЖИМ')).toBeVisible()
  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await page.getByRole('button', { name: 'Открыть ноутбук' }).click()
  await page.getByRole('button', { name: /Начали/ }).click()
  await expect(page.getByRole('button', { name: 'Закончить раньше' })).toBeVisible({ timeout: 10_000 })
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:plan') ?? 'null')), { timeout: 5_000 }).toBeNull()
})

test('короткое дело с Дома не дробится с ошибкой сети — просто подставляется в поле', async ({ page }) => {
  let calls = 0
  await page.route('**/api/breakdown', (route) => {
    calls++
    return route.fulfill({ status: 400, body: '{}' })
  })
  await page.goto('/app')
  const field = page.getByLabel('Что сейчас висит')
  await field.fill('почта')
  await field.press('Enter')
  await expect(page).toHaveURL(/\/app\/session/)
  await page.waitForTimeout(1200)
  expect(calls).toBe(0)
  await expect(page.getByText(/сеть подвела/)).toHaveCount(0)
})

test('длинный шаг на маленьком экране: кот не прыгает при загрузке, кнопки над меню', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await seed(page, {
    plan: { forDate: today(), task: 'Курсовая по логистике и управлению цепями поставок для научного руководителя', firstStep: 'Открыть файл с курсовой, найти раздел про склад и написать в нём одно самое кривое предложение', startTime: 'в 9 вечера', createdAt: '' },
    onboarding: { sphere: 'study', blocker: 'boring', motive: 'relief' },
  })
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/app')
  await expect(page.getByText('ПО ПЛАНУ · 21:00')).toBeVisible()
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => ({
    cls: (window as unknown as { __cls: number }).__cls,
    chatBottom: document.querySelector('.btn-paper')!.getBoundingClientRect().bottom,
    navTop: document.querySelector('nav')!.getBoundingClientRect().top,
    sh: document.documentElement.scrollHeight,
  }))
  expect(m.cls).toBeLessThan(0.01)
  expect(m.chatBottom).toBeLessThanOrEqual(m.navTop)
  expect(m.sh).toBeLessThanOrEqual(640)
})

// ---------- 13.11, владелец: «костёр где-то там летает», «горит циклично, без багов» ----------

test('костёр стоит на склоне холма, а не висит над ним', async ({ page }) => {
  for (const [w, h] of [[390, 844], [360, 640], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app')
    await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
    const m = await page.evaluate(() => {
      const knoll = document.querySelector('svg[viewBox="0 0 800 500"]') as SVGSVGElement
      const hill = knoll.querySelector('path') as SVGPathElement
      const fire = document.querySelector('.campfire-flame')!.parentElement!
      const logs = [...fire.querySelectorAll('rect')].map((r) => r.getBoundingClientRect())
      const bottom = Math.max(...logs.map((r) => r.bottom))
      const x = (Math.min(...logs.map((r) => r.left)) + Math.max(...logs.map((r) => r.right))) / 2
      const inv = knoll.getScreenCTM()!.inverse()
      const inside = (y: number) => {
        const p = new DOMPoint(x, y).matrixTransform(inv)
        return hill.isPointInFill(p)
      }
      // чуть ниже поленьев — уже земля; заметно выше — ещё небо (поленья не утоплены в холм)
      return { under: inside(bottom + 3), above: inside(bottom - 12) }
    })
    expect(m, `${w}×${h}`).toEqual({ under: true, above: false })
  }
})

test('пламя качается без рывков: каждый язык — плавный маятник, стык циклов незаметен', async ({ page }) => {
  await page.goto('/app')
  await expect(page.locator('.campfire-flame').first()).toBeVisible()
  const res = await page.evaluate(
    () =>
      new Promise<{ range: number; maxStep: number }[]>((done) => {
        const els = [...document.querySelectorAll<HTMLElement>('.campfire-flame')]
        const series: number[][] = els.map(() => [])
        const t0 = performance.now()
        const tick = () => {
          els.forEach((e, i) => series[i].push(new DOMMatrix(getComputedStyle(e).transform).c))
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick)
          else
            done(
              series.map((s) => ({
                range: Math.max(...s) - Math.min(...s),
                maxStep: Math.max(...s.slice(1).map((v, i) => Math.abs(v - s[i]))),
              })),
            )
        }
        requestAnimationFrame(tick)
      }),
  )
  expect(res).toHaveLength(3)
  for (const s of res) {
    // за 2,5 с язык прошёл весь размах (несколько циклов) и ни разу не прыгнул больше чем на четверть размаха за кадр
    expect(s.range).toBeGreaterThan(0.08)
    expect(s.maxStep).toBeLessThan(s.range / 4)
  }
})

// ---------- 13.11, владелец: «везде, где кот, нужна тень; кот не должен летать» ----------

test('у кота есть тень под лапами на каждом экране, и пока кукла не ожила (постер)', async ({ page }) => {
  for (const url of ['/?intro=1', '/app', '/app/chat', '/app/session', '/app/start', '/sdvg-test', '/nope-404']) {
    await page.goto(url)
    const cat = page.locator('.cat-doll').first()
    await expect(cat, url).toBeVisible()
    const m = await cat.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const core = el.querySelector('.cat-shadow-core')
      if (!core) return null
      const s = core.getBoundingClientRect()
      return {
        // пятно — под лапами: в нижних 6 % кота, по центру тела (левее середины — справа хвост)
        top: (s.top - r.top) / r.height,
        bottom: (s.bottom - r.top) / r.height,
        cx: (s.left + s.width / 2 - r.left) / r.width,
        // тень — первым слоем, под постером и холстом куклы
        first: el.firstElementChild?.classList.contains('cat-shadow') ?? false,
        visible: getComputedStyle(core).backgroundImage.includes('radial-gradient'),
      }
    })
    expect(m, url).not.toBeNull()
    expect(m!.first, url).toBe(true)
    expect(m!.visible, url).toBe(true)
    expect(m!.top, url).toBeGreaterThan(0.93)
    expect(m!.bottom, url).toBeLessThan(1)
    expect(m!.cx, url).toBeGreaterThan(0.38)
    expect(m!.cx, url).toBeLessThan(0.46)
  }
})

test('Дом выглядит одинаково при любом шаге и ответах знакомства: кот прямо над блоком, блок одной высоты, без сдвигов', async ({ page }) => {
  // владелец, 13.11: «в независимости от модели телефона картинка выглядит одинаково, строчки меняются по онбордингу»
  const states: Record<string, { plan?: object; onboarding?: object }> = {
    empty: { onboarding: { sphere: 'study', blocker: 'fear' } },
    long: {
      plan: { forDate: today(), task: 'Курсовая по логистике и управлению цепями поставок для руководителя', firstStep: 'Открыть файл с курсовой, найти раздел про склад и написать в нём одно самое кривое предложение', startTime: '09:00', createdAt: '' },
      onboarding: { sphere: 'study', blocker: 'boring', motive: 'proof' },
    },
    short: { plan: { forDate: today(), task: 'Н', firstStep: 'Н', createdAt: '' } },
  }
  for (const [w, h] of [[390, 844], [390, 664], [360, 640], [430, 932]]) {
    const seen: Record<string, number[]> = {}
    for (const [name, st] of Object.entries(states)) {
      const p = await page.context().newPage()
      await p.setViewportSize({ width: w, height: h })
      await p.addInitScript((d) => {
        if (d.plan) localStorage.setItem('naparnik:plan', JSON.stringify(d.plan))
        if (d.onboarding) localStorage.setItem('naparnik:onboarding', JSON.stringify(d.onboarding))
        ;(window as unknown as { __cls: number }).__cls = 0
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
        }).observe({ type: 'layout-shift', buffered: true })
      }, st)
      await p.goto('/app')
      await expect(p.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
      await p.waitForTimeout(500)
      const m = await p.evaluate(() => {
        const c = document.querySelector('.cat-doll')!.getBoundingClientRect()
        const label = document.querySelector('section[aria-label="Шаг на сейчас"] p')!.getBoundingClientRect()
        const cta = document.querySelector('.btn-chunky')!.getBoundingClientRect()
        const nav = document.querySelector('nav')!.getBoundingClientRect()
        const paws = c.top + c.height * 0.9716
        return { catTop: c.top, ctaTop: cta.top, gap: label.top - paws, catOverNav: cta.bottom <= nav.top, cls: (window as unknown as { __cls: number }).__cls, sh: document.documentElement.scrollHeight }
      })
      const tag = `${w}×${h} ${name}`
      // подпись — сразу под лапами, между ними виден холм
      expect(m.gap, tag).toBeGreaterThan(15)
      expect(m.gap, tag).toBeLessThan(35)
      expect(m.cls, tag).toBeLessThan(0.01)
      expect(m.catOverNav, tag).toBe(true)
      expect(m.sh, tag).toBeLessThanOrEqual(h)
      seen[name] = [m.catTop, m.ctaTop]
      await p.close()
    }
    // кот и кнопка стоят на тех же местах при любом состоянии
    expect(seen.long, `${w}×${h}`).toEqual(seen.empty)
    expect(seen.short, `${w}×${h}`).toEqual(seen.empty)
  }
})
