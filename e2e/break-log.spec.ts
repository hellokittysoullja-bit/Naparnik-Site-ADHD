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
