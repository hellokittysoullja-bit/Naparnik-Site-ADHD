import { expect, test } from '@playwright/test'
import { collectErrors, seedStarts } from './helpers'

test('хранилище заблокировано (Safari «Блокировать все cookie»): Дом работает как первый визит', async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    Storage.prototype.getItem = deny
    Storage.prototype.setItem = deny
    Storage.prototype.removeItem = deny
  })
  const errors = collectErrors(page)
  await page.goto('/app')
  await expect(page.getByText('Первый старт за 15 минут')).toBeVisible()
  await expect(page.getByText('Я споткнулся')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('испорченная память не роняет ни один экран', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('naparnik:starts', '{"a":1}')
    localStorage.setItem('naparnik:plan', '[]')
    localStorage.setItem('naparnik:finds', '"x"')
    localStorage.setItem('naparnik:stepQueue', '{"steps":5}')
    // реплика старого формата AI SDK (без parts) — раньше Дом навсегда открывался страницей ошибки
    localStorage.setItem('naparnik:chat', '[{"role":"user","content":"привет"}]')
    localStorage.setItem('naparnik:activeSession', '{"startedAt":"вчера"}')
    localStorage.setItem('naparnik:onboarding', '{"step":"abc"}')
  })
  const errors = collectErrors(page)
  // не только «нет страницы ошибки», но и «экран дорисовался», а не завис на скелетоне
  const ready: Record<string, string> = {
    '/app': 'Следующий старт вырастит',
    '/app/session': 'Фокус-сессия: выбери первый шаг',
    '/app/world': 'Каждый старт — новый кусочек',
    '/app/start': 'Продолжить',
  }
  for (const [path, text] of Object.entries(ready)) {
    await page.goto(path)
    await expect(page.getByText(text).first(), path).toBeVisible()
    await expect(page.getByText('Я споткнулся'), path).toHaveCount(0)
  }
  expect(errors).toEqual([])
})

test('переход по табу на Дом: готовый экран с первого кадра, без скелетона', async ({ page }) => {
  await seedStarts(page, 4)
  await page.goto('/app/world')
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  await page.evaluate(() => {
    const w = window as unknown as { __sk: number[] }
    w.__sk = []
    const tick = () => {
      w.__sk.push(document.querySelectorAll('.skeleton-pulse').length)
      if (w.__sk.length < 40) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.getByRole('link', { name: 'Дом' }).click()
  await expect(page.getByText('Следующий старт вырастит')).toBeVisible()
  await page.waitForTimeout(600)
  const frames = await page.evaluate(() => (window as unknown as { __sk: number[] }).__sk)
  expect(Math.max(...frames)).toBe(0)
})

test('чат без ключа ИИ: напарник отвечает скриптом, а не молчит', async ({ page }) => {
  await page.goto('/app')
  const box = page.getByRole('textbox').last()
  await box.fill('не могу начать отчёт')
  await box.press('Enter')
  await expect(page.locator('.chat-bubble-cat')).toHaveCount(2, { timeout: 15_000 })
})
