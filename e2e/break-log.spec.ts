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
  // двенадцатая разбивка — короткая сцена (0,6 с)
  await page.evaluate(() => localStorage.setItem('naparnik:breaks', '11'))
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  const t0 = Date.now()
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  expect(Date.now() - t0).toBeLessThan(1200)
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
    await expect.poll(durOpacity).toBe('1')
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
  const ids = await page.evaluate(() => [...document.querySelectorAll('body > div[aria-hidden="true"] [id^="rvBark"]')].map((e) => e.id))
  expect(ids.length).toBeGreaterThan(1)
  expect(new Set(ids).size).toBe(ids.length)
  const slotTop = () => page.locator('[data-rv-slot]').evaluate((el) => Math.round(el.getBoundingClientRect().top))
  const during = await slotTop()
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible({ timeout: 4000 })
  expect(await slotTop()).toBe(during)
})

test('полено: буквы шага загораются ровно на своей строке', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 300)
  await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
  await page.waitForSelector('[data-rv="playing"]')
  // заморозить сцену в момент «выжигания» второй строки и сравнить букву-уголёк с настоящей буквой
  const diff = await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      a.pause()
      a.currentTime = 1000
    }
    const row = document.querySelectorAll('[data-rv-step]')[1]
    const range = document.createRange()
    range.setStart(row.firstChild!, 0)
    range.setEnd(row.firstChild!, 1)
    const real = range.getBoundingClientRect()
    const ghosts = [...document.querySelectorAll<HTMLElement>('body > div[aria-hidden="true"] span')].filter((s) => s.textContent === row.textContent![0])
    return Math.min(...ghosts.map((g) => Math.abs(parseFloat(g.style.top) - real.top) + Math.abs(parseFloat(g.style.left) - real.left)))
  })
  expect(diff).toBeLessThan(2)
})
