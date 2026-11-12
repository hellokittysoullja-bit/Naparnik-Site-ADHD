import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

/** Аудит 12.11 (research/21-agent-audit/report.md): чат в браузере */

test('реплика не теряется, если уйти с Дома, пока кот отвечает', async ({ page }) => {
  await seedStarts(page, 3)
  // ответ ИИ задержан: человек успевает уйти на другой экран
  await page.route('**/api/companion', async (route) => {
    await new Promise((r) => setTimeout(r, 4000))
    await route.abort()
  })
  await page.goto('/app')
  const box = page.getByRole('textbox').last()
  await box.fill('пишу диплом и не могу начать уже неделю')
  await box.press('Enter')
  await page.waitForTimeout(400)
  await page.getByRole('link', { name: 'Мир' }).click()
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  const saved = await page.evaluate(() => localStorage.getItem('naparnik:chat') ?? '')
  expect(saved).toContain('пишу диплом и не могу начать уже неделю')
  await page.getByRole('link', { name: 'Дом' }).click()
  await expect(page.getByText('пишу диплом и не могу начать уже неделю')).toBeVisible()
})

test('ИИ недоступен и человек пишет о кризисе: проверенный ответ с 112, без кнопки старта', async ({ page }) => {
  await page.route('**/api/companion', (route) => route.fulfill({ status: 429, body: '{}' }))
  await page.goto('/app')
  const box = page.getByRole('textbox').last()
  await box.fill('не хочу жить')
  await box.press('Enter')
  await expect(page.getByText('позвони 112')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Начинаю/ })).toHaveCount(0)
})

test('вторая вкладка не затирает переписку первой', async ({ context }) => {
  const a = await context.newPage()
  const b = await context.newPage()
  for (const p of [a, b]) await p.route('**/api/companion', (route) => route.fulfill({ status: 500, body: '{}' }))
  await a.goto('/app')
  await b.goto('/app')
  const say = async (p: typeof a, text: string) => {
    const box = p.getByRole('textbox').last()
    await box.fill(text)
    await box.press('Enter')
    await expect(p.getByText(text)).toBeVisible()
    // скриптовый ответ пришёл и переписка сохранена
    await expect.poll(() => p.evaluate((t) => (localStorage.getItem('naparnik:chat') ?? '').includes(t), text), { timeout: 15_000 }).toBe(true)
    await p.waitForTimeout(1500)
  }
  await say(a, 'первая вкладка: отчёт по продажам')
  await say(b, 'вторая вкладка: уборка на кухне')
  const saved = await b.evaluate(() => localStorage.getItem('naparnik:chat') ?? '')
  expect(saved).toContain('первая вкладка: отчёт по продажам')
  expect(saved).toContain('вторая вкладка: уборка на кухне')
})
