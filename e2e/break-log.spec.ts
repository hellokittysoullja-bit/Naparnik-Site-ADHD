import { expect, test } from '@playwright/test'

/**
 * «Полено» (владелец 16.11): после разбивки дело раскалывается на шаги поверх настоящего экрана Фокуса, потом праздник —
 * кот прыгает, конфетти на весь экран, квитанция в пузыре. Тап — сразу итог. «Уменьшить движение» — без сцены.
 * На сборке до 16.11 тест падает: сцены, штампов и квитанции не было.
 */
const url = '/app/session?step=' + encodeURIComponent('Написать курсовую') + '&break=1'

test('полено: сцена идёт поверх Фокуса, тап — сразу итог, потом конфетти и квитанция', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  // во время сцены шаги в DOM (диктор читает), но скрыты — их проявляет сцена; дело словами человека на карточке
  await expect(page.locator('[data-rv-source]')).toHaveText('Написать курсовую')
  expect(await page.locator('[data-rv-step]').first().evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  // тап в любом месте — сразу итог
  await page.mouse.click(195, 120)
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0)
  const first = page.locator('[data-rv-step]').first()
  await expect(first).toHaveText('Выбрать тему курсовой')
  expect(await first.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  // праздник: холст конфетти поверх всего экрана и квитанция — сколько шагов вышло
  await expect(page.locator('canvas[aria-hidden="true"]').last()).toBeAttached()
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible()
  // подаренный первый штамп
  await expect(page.getByRole('img', { name: /1 из \d+ уже есть/ })).toBeVisible()
  // слой сцены убран за собой
  await page.waitForTimeout(3500)
  expect(await page.evaluate(() => document.querySelectorAll('body > div[aria-hidden="true"][style*="z-index: 60"]').length)).toBe(0)
})

test('полено: сцена сама доходит до конца без касаний и становится короче с опытом', async ({ page }) => {
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  expect(await page.evaluate(() => localStorage.getItem('naparnik:breaks'))).toBe('1')
  // двенадцатая разбивка — сцена вдвое быстрее первой
  await page.evaluate(() => localStorage.setItem('naparnik:breaks', '11'))
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  const t0 = Date.now()
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  expect(Date.now() - t0).toBeLessThan(1700)
})

test('полено: при «уменьшить движение» сцены нет, шаги сразу', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(url)
  await expect(page.locator('[data-rv-step]').first()).toHaveText('Выбрать тему курсовой')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0)
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible()
  await ctx.close()
})

/**
 * Запись владельца 17.11 (iPhone, 393×664): пока кот разламывал дело, полторы секунды висел экран выбора шага; потом всё
 * перестраивалось под полено; в конце кнопка старта уезжала под меню; квитанция сдвигала экран; один кусок полена был
 * тёмным. Тесты ниже падают на сборке до 17.11.
 */
const steps6 = ['Решить, что хочется поесть', 'Приготовить еду', 'Выложить еду на тарелку', 'Сесть за стол', 'Поесть спокойно', 'Убрать посуду']
const slow = (page: import('@playwright/test').Page, ms = 1500) =>
  page.route('**/api/breakdown', async (r) => {
    await new Promise((x) => setTimeout(x, ms))
    await r.fulfill({ json: { steps: steps6, source: 'library', title: 'Покушать' } })
  })
const startBox = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Начали. Я рядом' }).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })

for (const [w, h] of [[393, 664], [360, 640], [390, 844]] as const) {
  test(`полено ${w}×${h}: пока кот разламывает — полено на месте поля, длительности нет, старт неактивен; кнопка старта всё время на своём месте и над меню`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/session')
    await expect(page.getByRole('textbox', { name: 'Первый шаг' })).toBeVisible()
    const plain = await startBox(page)
    await slow(page)
    await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
    // ожидание: экрана выбора шага нет — вместо поля ждёт полено со словами человека
    await expect(page.locator('[data-rv-waitlog] svg')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Первый шаг' })).toHaveCount(0)
    const durOpacity = () => page.getByText('Длительность').evaluate((el) => getComputedStyle(el.parentElement!).opacity)
    expect(await durOpacity()).toBe('0')
    await expect(page.getByRole('button', { name: 'Начали. Я рядом' })).toBeDisabled()
    expect(await startBox(page)).toEqual(plain)
    // раскол и итог: кнопка там же, пиксель в пиксель, на КАЖДОМ кадре (мгновенный рывок тоже ловится), и не под меню
    await page.evaluate(() => {
      const w = window as unknown as { __tops: number[] }
      w.__tops = []
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Начали'))!
      const tick = () => {
        w.__tops.push(Math.round(btn.getBoundingClientRect().top))
        if (w.__tops.length < 600) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.waitForSelector('[data-rv="playing"]')
    await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
    const tops = await page.evaluate(() => (window as unknown as { __tops: number[] }).__tops)
    expect(tops.length).toBeGreaterThan(10)
    expect([...new Set(tops)]).toEqual([plain.top])
    await expect(page.getByRole('button', { name: 'Начали. Я рядом' })).toBeEnabled()
    // шагов много — длительность спрятана и отдала место шагам (владелец 17.11); если она есть — проявилась
    if (await page.getByText('Длительность').count()) await expect.poll(durOpacity).toBe('1')
    // все остальные шаги — списком под карточкой, целиком и над кнопкой старта; «ещё N» нет
    await expect(page.getByText(/ждут в Делах/)).toHaveCount(0)
    const rows = await page.locator('[data-rv-list] > button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().bottom)))
    expect(rows.length).toBe(h >= 640 ? 5 : rows.length)
    for (const b of rows) expect(b).toBeLessThanOrEqual(plain.top)
    expect(await startBox(page)).toEqual(plain)
    const navTop = await page.locator('nav').evaluate((el) => el.getBoundingClientRect().top)
    expect(plain.bottom).toBeLessThanOrEqual(navTop)
  })
}

test('полено: квитанция в конце ничего не сдвигает; у каждого куска свой рисунок коры (не чёрный кусок)', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 600)
  await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
  await page.waitForSelector('[data-rv="playing"]')
  await page.waitForTimeout(400)
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id^="rvBark"]')].map((e) => e.id))
  expect(ids.length).toBeGreaterThan(1)
  expect(new Set(ids).size).toBe(ids.length)
  // после раскола карточка на своём месте; реплика-квитанция её не сдвигает
  await page.waitForSelector('[data-rv-card]')
  // место карточки (сама карточка во время сцены проявляется с лёгким масштабом — меряем её место в раскладке)
  const cardTop = () => page.locator('[data-rv-card]').evaluate((el) => Math.round(el.parentElement!.getBoundingClientRect().top))
  const during = await cardTop()
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible({ timeout: 4000 })
  expect(await cardTop()).toBe(during)
  // в пузыре одна реплика: «Сейчас расколю!» не остаётся рядом с квитанцией (скриншот владельца 17.11)
  await expect(page.locator('[data-rv-bubble]')).not.toContainText('расколю')
})

/**
 * Владелец 17.11: куски полена — слова шагов, и деревянные таблички остаются. Копия-табличка садится ровно на
 * настоящую — подмена в конце сцены незаметна. На сборке до 17.11 табличек не было (буквы выжигались в обычный текст).
 */
test('полено: каждое слово шага — деревянная табличка, кусок садится ровно на неё', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 300)
  // медленная сеть: файлы шрифтов приходят на 0,7 с позже. Без ожидания шрифтов сцена мерила слова в запасном шрифте, а
  // настоящий шире — заголовок переносился на вторую строку, и куски садились мимо (так падало в CI 17.11)
  await page.route(/\.woff2(\?|$)/, async (r) => {
    await new Promise((x) => setTimeout(x, 700))
    await r.continue()
  })
  await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
  await page.waitForSelector('[data-rv-card]')
  // куда сцена посадит каждую табличку-копию (место контейнера куска без сдвига анимацией) — и где после сцены стоит
  // настоящая табличка этого слова. Без перемотки анимаций: на медленной машине CI перемотка доходила не до всех кусков
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body > div[aria-hidden="true"] div.wood-word')].map((plate) => {
      const box = plate.parentElement!.parentElement as HTMLElement
      return { text: plate.textContent ?? '', x: parseFloat(box.style.left), y: parseFloat(box.style.top) }
    }),
  )
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  const real = await page.evaluate(() => {
    const lb = document.querySelector('[data-rv-list]')!.getBoundingClientRect().bottom
    return [...document.querySelectorAll<HTMLElement>('[data-rv-step] .wood-word')]
      .map((e) => ({ text: e.textContent ?? '', r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.bottom <= lb + 1)
      .map(({ text, r }) => ({ text, x: r.left, y: r.top }))
  })
  expect(real.length).toBeGreaterThan(5)
  const off = real
    .map((w) => {
      const d = Math.min(...targets.filter((t) => t.text === w.text).map((t) => Math.abs(t.x - w.x) + Math.abs(t.y - w.y)))
      return { ...w, d }
    })
    .filter((w) => !(w.d < 2))
  expect(off, 'таблички, на которые кусок сел не туда').toEqual([])
  // таблички остаются, слов столько же, сколько в шагах; подписи «первый шаг · дело» нет
  expect(await page.locator('[data-rv-step]').first().locator('.wood-word').count()).toBe(4)
  await expect(page.getByText(/первый шаг ·/i)).toHaveCount(0)
  // карточка-записка (вариант 4, владелец 17.11): печать «×N» по числу шагов, все три кнопки нажимаются — украшения их не
  // перекрывают
  await expect(page.locator('[data-rv-card] .note-seal')).toHaveText('×6')
  for (const name of ['Ещё мельче', 'Своими словами', 'Не то']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim(), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(hit).toBe(name)
  }
})

test('полено: «Разломать на шаг» с Дома — следующий кадр сразу полено, кот сидит на нём', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 1500)
  await page.goto('/app')
  await page.fill('#home-task', 'Покушать')
  await page.evaluate(() => {
    const w = window as unknown as { __kinds: string[] }
    w.__kinds = []
    const tick = () => {
      const home = !!document.querySelector('#home-task')
      const log = !!document.querySelector('[data-rv-waitlog] svg')
      w.__kinds.push(home ? 'H' : log ? 'L' : '?')
      if (!log) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await page.waitForSelector('[data-rv-waitlog] svg')
  const kinds = (await page.evaluate(() => (window as unknown as { __kinds: string[] }).__kinds)).join('')
  // только кадры Дома, потом полено — ни одного промежуточного (наплыва, пустого экрана)
  expect(kinds).toMatch(/^H+L$/)
  // кот сидит на полене: низ кота заходит на верх полена на несколько пикселей (лапы на коре), кот поверх полена
  const g = await page.evaluate(() => {
    const cat = document.querySelector('[data-stage] .vt-cat')!.getBoundingClientRect()
    const log = document.querySelector('[data-rv-slot]')!.getBoundingClientRect()
    return { overlap: cat.bottom - log.top }
  })
  expect(g.overlap).toBeGreaterThan(4)
  expect(g.overlap).toBeLessThan(24)
})

/**
 * CI 17.11 и скриншот владельца: на узком телефоне (360 px) заголовок записки переносится на вторую строку — строка была
 * ниже таблички, и вторая строка табличек обрезалась снизу на 8 px, а куски полена летели мимо. На 320 px кнопки
 * записки обрезались («Своими слов…»). Падает на сборке до исправления.
 */
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [393, 664],
] as const) {
  test(`полено ${w}×${h}: таблички заголовка целиком, кнопки записки без обрезки`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
    await page.waitForSelector('[data-rv-card]')
    await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 5000 })
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-rv-card]')!
      const title = card.querySelector('[data-rv-step]')!.getBoundingClientRect()
      return {
        clipped: [...card.querySelectorAll('[data-rv-step] .wood-word')].filter((e) => e.getBoundingClientRect().bottom > title.bottom + 0.5).map((e) => e.textContent),
        cut: [...card.querySelectorAll('.note-btn .truncate')].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
      }
    })
    expect(r).toEqual({ clipped: [], cut: [] })
  })
}
