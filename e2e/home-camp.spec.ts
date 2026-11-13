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
  // строка над кнопкой есть и без знакомства — общая из утверждённых (владелец 13.11)
  await expect(page.getByText('Можно криво. Сначала просто начнём')).toBeVisible()
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

test('Фокус: дробление следующего шага не стирает остальную очередь дела', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:stepQueue', JSON.stringify({ task: 'Курсовая', steps: ['Найти файл курсовой', 'Написать план из трёх пунктов'] }))
  })
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть папку', 'Найти файл', 'Открыть его'], source: 'model' } }))
  await page.goto('/app/session?step=' + encodeURIComponent('Найти файл курсовой') + '&break=1')
  await page.getByRole('button', { name: 'Открыть папку' }).click()
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:stepQueue') ?? 'null'))
  // подшаги встали на место раздробленного шага, второй шаг дела на месте
  expect(q).toEqual({ task: 'Курсовая', steps: ['Найти файл', 'Открыть его', 'Написать план из трёх пунктов'] })
})

test('Фокус: план из прошлых дней, начатый по плану, закрывается и больше не возвращается', async ({ page }) => {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:plan', JSON.stringify({ forDate: d, task: 'Отчёт', firstStep: 'Открыть таблицу с отчётом', createdAt: '' }))
  }, today(-2))
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть ноутбук', 'Найти таблицу', 'Открыть её'], source: 'model' } }))
  await page.goto('/app/session?step=' + encodeURIComponent('Открыть таблицу с отчётом') + '&break=1&plan=1')
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

test('холодная загрузка: ничего не прыгает — кнопки и кот на своих местах с первого кадра', async ({ page }) => {
  // блок одной высоты при любых данных: кот и кнопки не двигаются, когда память прочитана. Скрипты задерживаем и
  // замедляем процессор, чтобы первый кадр до гидратации успел отрисоваться; дальше — каждый кадр.
  await page.setViewportSize({ width: 390, height: 664 })
  await seed(page, {
    plan: { forDate: today(), task: 'Курсовая по логистике', firstStep: 'Открыть файл с курсовой, найти раздел про склад и написать в нём одно предложение', startTime: '09:00', createdAt: '' },
    onboarding: { sphere: 'study', blocker: 'boring', motive: 'proof' },
  })
  await page.route('**/_next/static/chunks/**/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 600))
    await route.continue()
  })
  await page.addInitScript(() => {
    const w = window as unknown as { __f: { cta: number | null; cat: number | null; catVisible: boolean }[] }
    w.__f = []
    const tick = () => {
      const cta = document.querySelector('.btn-chunky')
      const cat = document.querySelector('.cat-doll')
      w.__f.push({
        cta: cta ? cta.getBoundingClientRect().top : null,
        cat: cat ? cat.getBoundingClientRect().top : null,
        catVisible: cat ? getComputedStyle(cat).visibility === 'visible' : false,
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Две минуты, и ещё одно доказательство')).toBeVisible()
  await page.waitForTimeout(800)
  const frames = await page.evaluate(() => (window as unknown as { __f: { cta: number | null; cat: number | null; catVisible: boolean }[] }).__f)
  const cta = frames.map((f) => f.cta).filter((v): v is number => v !== null)
  const cat = frames.filter((f) => f.catVisible && f.cat !== null).map((f) => f.cat as number)
  expect(cta.length).toBeGreaterThan(5)
  expect(cat.length).toBeGreaterThan(5)
  expect(Math.max(...cta) - Math.min(...cta), 'кнопка «Разломать на шаг» двигалась').toBeLessThanOrEqual(1)
  expect(Math.max(...cat) - Math.min(...cat), 'видимый кот двигался').toBeLessThanOrEqual(1)
})

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

test('на компьютере поле и кнопки — колонкой, как в Фокусе, а не на всю ширину экрана', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/app')
  await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
  const m = await page.evaluate(() => ({
    cta: document.querySelector('.btn-chunky')!.getBoundingClientRect().width,
    field: document.querySelector('#home-task')!.getBoundingClientRect().width,
    sw: document.documentElement.scrollWidth,
  }))
  expect(m.cta).toBeLessThanOrEqual(448)
  expect(m.field).toBeLessThanOrEqual(448)
  expect(m.sw).toBeLessThanOrEqual(1280)
})

test('тень кота не висит на холме, пока самого кота ещё нет', async ({ page }) => {
  // постер кота держим в сети: тень должна ждать его, а не рисоваться пятном на пустом холме (3G, 13.11)
  let release!: () => void
  const held = new Promise<void>((r) => (release = r))
  await page.route('**/mascot/poster/neutral.webp*', async (route) => {
    await held
    await route.continue()
  })
  await page.route('**/mascot/doll/**', (route) => route.abort())
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
  const shadow = page.locator('.cat-doll .cat-shadow')
  await expect(shadow).toHaveCSS('visibility', 'hidden')
  release()
  await expect(shadow).toHaveCSS('visibility', 'visible')
})

// ---------- 13.11, владелец: «всегда, у всех, при любых обстоятельствах — как на примере; отличается только строка
// над кнопкой (а позже и сама кнопка) в зависимости от ответов знакомства» ----------

test('план, очередь и старты в памяти не меняют Дом: всегда «Что сейчас висит?», поле, три сферы, строка', async ({ page }) => {
  const sets: Record<string, Record<string, unknown>> = {
    'пусто': {},
    'план «Н»': { plan: { forDate: today(), task: 'Н', firstStep: 'Н', createdAt: '' } },
    'длинный план': { plan: { forDate: today(), task: 'Курсовая по логистике', firstStep: 'Открыть файл с курсовой, найти раздел про склад и написать в нём одно предложение', startTime: '09:00', createdAt: '' } },
    'очередь': { stepQueue: { task: 'Курсовая', steps: ['Написать план из трёх пунктов'] } },
    'план на завтра': { plan: { forDate: today(1), task: 'Отчёт', firstStep: 'Открыть таблицу', startTime: '9:00', createdAt: '' } },
  }
  for (const [w, h] of [[390, 664], [390, 844], [360, 640]]) {
    const where: Record<string, number[]> = {}
    for (const [name, data] of Object.entries(sets)) {
      const p = await page.context().newPage()
      await p.setViewportSize({ width: w, height: h })
      await p.addInitScript((d) => {
        for (const [k, v] of Object.entries(d)) localStorage.setItem('naparnik:' + k, JSON.stringify(v))
        localStorage.setItem('naparnik:onboarding', JSON.stringify({ sphere: 'work', blocker: 'phone', motive: 'rest' }))
      }, data)
      await p.goto('/app')
      const tag = `${w}×${h} ${name}`
      await expect(p.getByText('ЧТО СЕЙЧАС ВИСИТ?'), tag).toBeVisible()
      await expect(p.getByLabel('Что сейчас висит'), tag).toBeVisible()
      await expect(p.getByRole('button', { name: /Работа/ }), tag).toHaveAttribute('aria-pressed', 'true')
      await expect(p.getByText('Две минуты без ленты, и вечер твой'), tag).toBeVisible()
      await expect(p.getByRole('heading', { level: 2 }), tag).toHaveCount(0)
      await expect(p.getByText(/^(ПО ПЛАНУ|ЗАВТРА|СЛЕДУЮЩИЙ ШАГ|ПРОДОЛЖИМ|СЕГОДНЯ СТАРТ)/), tag).toHaveCount(0)
      const m = await p.evaluate(() => {
        const c = document.querySelector('.cat-doll')!.getBoundingClientRect()
        const label = document.querySelector('section[aria-label="Дело на сейчас"] p')!.getBoundingClientRect()
        const cta = document.querySelector('.btn-chunky')!.getBoundingClientRect()
        const paper = document.querySelector('.btn-paper')!.getBoundingClientRect()
        const nav = document.querySelector('nav')!.getBoundingClientRect()
        return { cat: Math.round(c.top), cta: Math.round(cta.top), below: label.top - (c.top + c.height * 0.9716), overNav: paper.bottom <= nav.top, sh: document.documentElement.scrollHeight }
      })
      expect(m.below, tag).toBeGreaterThan(15)
      expect(m.below, tag).toBeLessThan(40)
      expect(m.overNav, tag).toBe(true)
      expect(m.sh, tag).toBeLessThanOrEqual(h)
      where[name] = [m.cat, m.cta]
      await p.close()
    }
    // экран один и тот же: кот и кнопка на тех же местах при любых данных
    for (const name of Object.keys(sets)) expect(where[name], `${w}×${h} ${name}`).toEqual(where['пусто'])
  }
})

test('знакомство с конкретными ответами → Дом помнит их: своя сфера подсвечена, своя строка над кнопкой', async ({ page }) => {
  const errors = collectErrors(page)
  // проходим знакомство как человек: «Работа / проекты», «Неделю-две», «тянется к телефону», «отдыхать без фона»
  const pause = () => page.waitForTimeout(500)
  await page.goto('/app/start')
  for (const answer of ['Работа / проекты', 'Неделю-две', 'Рука сама тянется к телефону', /Смогу отдыхать/, 'Около часа']) {
    await page.getByRole('radiogroup').getByRole('radio', { name: answer }).click()
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await pause()
  }
  await page.getByRole('button', { name: 'Продолжить' }).click() // «твоя цифра»
  await pause()
  await page.getByRole('radiogroup', { name: 'Первый шаг' }).waitFor()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByRole('button', { name: /Начать первые/ }).waitFor({ timeout: 6000 })
  // ответы в памяти устройства
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:onboarding') ?? 'null'))
  expect(saved).toMatchObject({ sphere: 'work', hanging: 'week', blocker: 'phone', motive: 'rest' })
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  await expect(page.getByRole('button', { name: /Работа/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /Учёба/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Две минуты без ленты, и вечер твой')).toBeVisible()
  await expect(page.getByLabel('Что сейчас висит')).toHaveAttribute('placeholder', /презентац|отчёт|письмо|проект/i)
  expect(errors).toEqual([])
})

test('после «Забудь всё» в чате новые ответы знакомства снова помнятся', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:profileForgotten', 'true')
    localStorage.setItem('naparnik:onboarding', JSON.stringify({ sphere: 'study', blocker: 'fear', motive: 'proof' }))
  })
  await page.goto('/app')
  // забытое не показывается: общая строка и ничего не подсвечено
  await expect(page.getByText('Можно криво. Сначала просто начнём')).toBeVisible()
  await expect(page.getByRole('button', { name: /Учёба/ })).toHaveAttribute('aria-pressed', 'false')
  // человек снова отвечает в знакомстве — метка «забыто» снимается
  await page.goto('/app/start')
  await page.getByRole('radiogroup').getByRole('radio', { name: 'Учёба' }).click()
  expect(await page.evaluate(() => localStorage.getItem('naparnik:profileForgotten'))).toBeNull()
  await page.goto('/app')
  await expect(page.getByRole('button', { name: /Учёба/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Криво тоже считается. Это и есть доказательство')).toBeVisible()
})

test('пустое поле: «Разломать на шаг» дробит дело из ответов знакомства, а не ведёт в никуда', async ({ page }) => {
  await seed(page, { onboarding: { sphere: 'study', blocker: 'where', motive: 'relief' } })
  let asked = ''
  await page.route('**/api/breakdown', async (route) => {
    asked = (route.request().postDataJSON() as { task: string }).task
    await route.fulfill({ json: { steps: ['Открыть ноутбук', 'Найти файл', 'Прочитать абзац'], source: 'model' } })
  })
  await page.goto('/app')
  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await expect(page).toHaveURL(/\/app\/session\?step=/)
  await expect(page.getByText('Найти файл')).toBeVisible()
  expect(asked.length).toBeGreaterThan(5)
})
