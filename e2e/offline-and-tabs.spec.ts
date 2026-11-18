import { expect, test } from '@playwright/test'

/**
 * Без сети таймер открывается: страницы /app «сначала сеть», а без сети — последняя копия (public/sw.js).
 * Две вкладки — одна память: изменение в одной сразу видно в другой (components/app-scroll.tsx, событие storage).
 * Обе проверки падают на сборке без этих правок.
 */
test('без сети Фокус открывается из сохранённой копии, таймер запускается', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/app')
  // воркер встал и управляет страницей
  await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === 'activated', null, { timeout: 15_000 })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 })
  // онлайн-визит Фокуса кладёт его страницу и код в кэш
  await page.goto('/app/session')
  await expect(page.getByPlaceholder('Открыть файл презентации')).toBeVisible()
  await page.waitForLoadState('networkidle')

  await ctx.setOffline(true)
  await page.reload()
  await expect(page.getByPlaceholder('Открыть файл презентации')).toBeVisible({ timeout: 10_000 })
  await page.getByPlaceholder('Открыть файл презентации').fill('Открыть файл')
  await page.getByRole('button', { name: /Начали/ }).click()
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  await ctx.close()
})

test('две вкладки: шаг, отмеченный в одной, сразу отмечен в другой', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const a = await ctx.newPage()
  await a.addInitScript(() => {
    if (localStorage.getItem('naparnik:deals')) return
    localStorage.setItem('naparnik:deals', JSON.stringify([{ id: 'd1', title: 'Записаться к врачу', createdAt: 1, steps: [{ text: 'Открыть запись', minutes: 1 }, { text: 'Выбрать время', minutes: 2 }] }]))
  })
  await a.goto('/app/deals')
  const b = await ctx.newPage()
  await b.goto('/app/deals')
  await b.getByRole('button', { name: /^Записаться к врачу/ }).click()
  await expect(b.getByRole('checkbox', { name: 'Сделано: Открыть запись' })).toBeVisible()
  // отмечаем в первой вкладке
  await a.getByRole('button', { name: /^Записаться к врачу/ }).click()
  await a.getByRole('checkbox', { name: 'Сделано: Открыть запись' }).click()
  // вторая вкладка узнаёт без перезагрузки
  await expect(b.getByRole('checkbox', { name: 'Снять отметку: Открыть запись' })).toBeVisible({ timeout: 5_000 })
  await ctx.close()
})
