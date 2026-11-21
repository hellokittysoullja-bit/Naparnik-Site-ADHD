import { expect, test, type Page } from '@playwright/test'

/**
 * У разбивки свой адрес и выход (владелец 21.11: «разбил задачу, не хочу фокус — куда мне?» и «обновил страницу —
 * остался тот же экран, без анимации»). Разбивка — шаг вглубь вкладки Фокус, как чат в Telegram:
 *  - стрелка ‹ слева сверху → первый экран Фокуса, дело остаётся в поле;
 *  - нажатие на «Фокус» в меню, когда ты уже в Фокусе, → то же;
 *  - «назад» браузера (свайп iPhone) → то же, а не уход с вкладки;
 *  - обновление страницы → та же разбивка и тот же шаг, без полена и конфетти. В адресе только метка, не шаги.
 * На сборке до 21.11 все падают: выхода с разбивки не было, после обновления она пропадала.
 */
const DEAL = 'убрать ванную'
const FIRST = 'Достать средство и губку'

async function openPlan(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/session-voice', (r) => r.fulfill({ json: { text: null } }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/app/session?step=' + encodeURIComponent(DEAL) + '&break=1')
  await expect(page.locator('[data-rv-step]').first()).toBeVisible()
  await expect(page).toHaveURL(/view=plan/)
}

const firstScreen = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Раздробить' })).toBeVisible()
  await expect(page.locator('[data-rv-step]')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Первый шаг' })).toHaveValue(new RegExp(DEAL, 'i'))
  await expect(page).not.toHaveURL(/view=plan/)
}

test('стрелка ‹ на разбивке ведёт на первый экран Фокуса, дело остаётся в поле', async ({ page }) => {
  await openPlan(page)
  await page.getByRole('button', { name: 'Назад к выбору шага' }).click()
  await firstScreen(page)
})

test('нажатие на «Фокус» в меню, когда ты на разбивке, — первый экран Фокуса', async ({ page }) => {
  await openPlan(page)
  await page.getByRole('navigation').getByRole('link', { name: /Фокус/ }).click()
  await firstScreen(page)
})

test('«назад» браузера с разбивки — первый экран Фокуса, а не другая вкладка', async ({ page }) => {
  await openPlan(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/app\/session/)
  await firstScreen(page)
})

test('обновление страницы: та же разбивка и тот же шаг, без полена и конфетти; шагов в адресе нет', async ({ page }) => {
  await openPlan(page)
  const steps = await page.locator('[data-rv-step]').allTextContents()
  expect(page.url()).not.toContain(encodeURIComponent(FIRST))
  // сцену полена ловим с самого начала загрузки: её не должно быть ни в одном кадре
  await page.addInitScript(() => {
    const w = window as unknown as { __rv: boolean }
    w.__rv = false
    new MutationObserver(() => {
      if (document.querySelector('[data-rv="playing"]')) w.__rv = true
    }).observe(document, { childList: true, subtree: true, attributes: true })
  })
  await page.reload()
  await expect(page.locator('[data-rv-step]').first()).toBeVisible()
  expect(await page.locator('[data-rv-step]').allTextContents()).toEqual(steps)
  await expect(page.locator('[data-rv-card]')).toContainText(FIRST.split(' ')[0])
  await page.waitForTimeout(1200)
  expect(await page.evaluate(() => (window as unknown as { __rv: boolean }).__rv)).toBe(false)
  // после обновления стрелка тоже выводит на первый экран
  await page.getByRole('button', { name: 'Назад к выбору шага' }).click()
  await firstScreen(page)
  // и разбивка забыта: новое обновление открывает обычный Фокус
  await page.reload()
  await expect(page.getByRole('button', { name: 'Раздробить' })).toBeVisible()
})

test('ссылка с меткой, а разбивки на устройстве нет — обычный Фокус, метка убирается', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/session?view=plan')
  await expect(page.getByRole('button', { name: 'Раздробить' })).toBeVisible()
  await expect(page).not.toHaveURL(/view=plan/)
})
