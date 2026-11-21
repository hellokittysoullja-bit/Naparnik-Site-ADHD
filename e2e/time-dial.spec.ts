import { expect, test, type Page } from '@playwright/test'

/**
 * Время первого шага в разбивке — любое от 1 до 60 минут (владелец 21.11, образец — круг таймера Tiimo). Ряда 5/15/25/45 в
 * разбивке нет: рядом со стартом кнопка с минутами (по умолчанию оценка шага), по ней — лист с кругом: тянешь конец дуги,
 * под кругом частые значения, «Готово». На сборке до 21.11 все падают: кнопки и круга не было, время только 5/15/25/45.
 */
async function openPlan(page: Page, h = 664) {
  await page.setViewportSize({ width: 393, height: h })
  await page.route('**/api/session-voice', (r) => r.fulfill({ json: { text: null } }))
  await page.route('**/api/breakdown', (r) =>
    r.fulfill({ json: { steps: ['Достать средство и губку', 'Побрызгать ванну', 'Протереть и смыть'], minutes: [2, 5, 10], source: 'library', title: 'Убрать ванную' } }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/app/session?step=' + encodeURIComponent('убрать ванную') + '&break=1')
  await expect(page.locator('[data-rv-step]').first()).toBeVisible()
}
const timeBtn = (page: Page) => page.getByRole('button', { name: /Время на первый шаг/ })

for (const h of [664, 844]) {
  test(`разбивка ${h}: рядом со стартом — оценка шага, ряда длительности нет; кнопки в одной строке`, async ({ page }) => {
    await openPlan(page, h)
    await expect(timeBtn(page)).toHaveText(/2 мин/)
    await expect(page.getByText('Длительность')).toHaveCount(0)
    const a = await page.getByRole('button', { name: 'Начали. Я рядом' }).boundingBox()
    const b = await timeBtn(page).boundingBox()
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2)
  })
}

test('круг: быстрое значение, стрелки и перетаскивание дают любое время, «Готово» ставит его на кнопку', async ({ page }) => {
  await openPlan(page)
  await timeBtn(page).click()
  const sheet = page.getByRole('dialog', { name: 'Сколько на первый шаг?' })
  await expect(sheet).toBeVisible()
  const dial = sheet.getByRole('slider', { name: 'Время на первый шаг' })
  await expect(dial).toHaveAttribute('aria-valuenow', '2')
  await sheet.getByRole('button', { name: '15', exact: true }).click()
  await expect(dial).toHaveAttribute('aria-valuenow', '15')
  await dial.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dial).toHaveAttribute('aria-valuenow', '16')
  await expect(sheet).toContainText('минут')
  // тянем по кругу: от «трёх часов» (15 мин) к «шести» (30 мин) — по дуге, без перескока через верх
  const box = (await dial.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const r = 104
  await page.mouse.move(cx + r, cy)
  await page.mouse.down()
  for (let a = 0; a <= 90; a += 10) await page.mouse.move(cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180))
  await page.mouse.up()
  await expect(dial).toHaveAttribute('aria-valuenow', '30')
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(sheet).toBeHidden()
  await expect(timeBtn(page)).toHaveText(/30 мин/)
})

test('круг не перескакивает через 12 часов: упирается в 1 и в 60 минут', async ({ page }) => {
  await openPlan(page)
  await timeBtn(page).click()
  const dial = page.getByRole('slider', { name: 'Время на первый шаг' })
  const box = (await dial.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  // от 2 минут влево через верх — не 59, а 1
  await page.mouse.move(cx + 20, cy - 104)
  await page.mouse.down()
  await page.mouse.move(cx - 30, cy - 100)
  await page.mouse.up()
  await expect(dial).toHaveAttribute('aria-valuenow', '1')
})
