import { expect, test, type Page } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Привязка сайта к боту (13.11, components/tg-remind.tsx): под карточкой плана кнопка «Напоминать в Telegram».
 * Бота в тестовой сборке нет, поэтому ответы /api/tg/* подставляются.
 */
const PLAN = { task: 'Курсовая по логистике', firstStep: 'Открыть файл с черновиком', startTime: '10:00' }

async function seedPlanCard(page: Page) {
  await seedStarts(page, 3)
  await page.addInitScript((plan) => {
    if (localStorage.getItem('naparnik:chat')) return
    localStorage.setItem(
      'naparnik:chat',
      JSON.stringify([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'завтра в десять открою черновик курсовой' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'tool-savePlan', toolCallId: 'c1', state: 'output-available', input: plan, output: 'План сохранён.' }] },
      ]),
    )
  }, PLAN)
}

test('бота нет: под планом нет ни кнопки, ни обещания', async ({ page }) => {
  await seedPlanCard(page)
  await page.route('**/api/tg/status', (route) => route.fulfill({ json: { available: false, linked: false } }))
  await page.goto('/app')
  await expect(page.getByText('план положен')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.getByText('Напоминать в Telegram')).toHaveCount(0)
  await expect(page.getByText('Напомню в Telegram')).toHaveCount(0)
})

test('бот есть: кнопка ведёт в бота с одноразовым кодом, а сайту уходит план и часовой пояс', async ({ page }) => {
  await seedPlanCard(page)
  let linkBody: { plan?: Record<string, unknown> } = {}
  await page.route('**/api/tg/status', (route) => route.fulfill({ json: { available: true, linked: false } }))
  await page.route('**/api/tg/link', async (route) => {
    linkBody = route.request().postDataJSON() as typeof linkBody
    await route.fulfill({ json: { url: 'https://t.me/naparnik_test_bot?start=l_' + 'a'.repeat(22), token: 't'.repeat(43) } })
  })
  // сам Telegram в тесте не открываем
  await page.route('https://t.me/**', (route) => route.fulfill({ contentType: 'text/html', body: '<title>telegram</title>ok' }))
  await page.goto('/app')
  const button = page.getByRole('button', { name: 'Напоминать в Telegram' })
  await expect(button).toBeVisible()
  // зона нажатия не меньше 44 px по высоте (Apple HIG)
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await button.click()
  await page.waitForURL('https://t.me/naparnik_test_bot?start=l_*')
  expect(linkBody.plan).toMatchObject({ ...PLAN, tz: expect.any(Number) })
  // жетон устройства остался в браузере сайта
  await page.goBack()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:tg') ?? '{}').token)).toBe('t'.repeat(43))
})

test('браузер связан с ботом: вместо кнопки тихая строка, а коту уходит «напоминания подключены»', async ({ page }) => {
  await seedPlanCard(page)
  await page.addInitScript(() => localStorage.setItem('naparnik:tg', JSON.stringify({ token: 't'.repeat(43) })))
  await page.route('**/api/tg/status', (route) => route.fulfill({ json: { available: true, linked: true, active: true, hour: 10 } }))
  let reminders: unknown
  await page.route('**/api/companion', async (route) => {
    reminders = (route.request().postDataJSON() as { reminders?: unknown }).reminders
    await route.fulfill({ status: 500, body: '{}' })
  })
  await page.goto('/app')
  await expect(page.getByText('Напомню в Telegram')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Напоминать в Telegram' })).toHaveCount(0)
  const box = page.getByRole('textbox').last()
  await box.fill('спасибо')
  await box.press('Enter')
  await expect.poll(() => reminders).toBe('on')
})
