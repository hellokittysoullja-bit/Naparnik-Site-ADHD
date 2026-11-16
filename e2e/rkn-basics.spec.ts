import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Чек-лист РКН 2026 (16.11): документы в один клик, согласие под кнопкой, отправляющей данные, плашка о cookie
 * с явной кнопкой и без метки посетителя до неё.
 */

test('метка посетителя и источник ставятся только после «Понятно»; источник не теряется при переходе', async ({ page, context }) => {
  let visits = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/visit')) visits++
  })
  await page.goto('/?src=reel-where&utm_source=tiktok')
  const notice = page.getByRole('region', { name: 'Cookie' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: 'Подробнее' })).toHaveAttribute('href', '/privacy')
  await page.waitForTimeout(1500)
  expect(visits).toBe(0)
  expect((await context.cookies()).map((c) => c.name)).not.toContain('nid')

  // ушёл читать политику (адрес уже без метки) и согласился там
  await notice.getByRole('link', { name: 'Подробнее' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  const visit = page.waitForResponse((r) => r.url().endsWith('/api/visit'))
  await page.getByRole('button', { name: 'Понятно' }).click()
  expect((await visit).status()).toBe(204)
  await expect(notice).toHaveCount(0)
  const names = (await context.cookies()).map((c) => c.name)
  expect(names).toEqual(expect.arrayContaining(['nid', 'n_ft', 'n_lt']))
  const ft = (await context.cookies()).find((c) => c.name === 'n_ft')!
  expect(decodeURIComponent(ft.value)).toContain('reel-where')

  // согласие запомнено: на новой странице плашки нет
  await page.goto('/')
  await page.waitForTimeout(800)
  await expect(page.getByRole('region', { name: 'Cookie' })).toHaveCount(0)
})

test('плашка не закрывает кнопки приложения: на /app её нет', async ({ page }) => {
  await seedStarts(page, 3)
  await page.goto('/app/world')
  await page.waitForTimeout(800)
  await expect(page.getByRole('region', { name: 'Cookie' })).toHaveCount(0)
})

test('плашка не закрывает «Назад» теста: она есть только на первом экране', async ({ page }) => {
  await page.goto('/sdvg-test')
  await expect(page.getByRole('region', { name: 'Cookie' })).toBeVisible()
  await page.getByRole('button', { name: 'Начать' }).click()
  await expect(page).toHaveURL(/step=/)
  await expect(page.getByRole('region', { name: 'Cookie' })).toHaveCount(0)
})

for (const [path, viewport] of [
  ['/?intro=1', { width: 360, height: 640 }],
  ['/?intro=1', { width: 1280, height: 800 }],
  ['/pomogaet', { width: 390, height: 844 }],
  ['/app/world', { width: 390, height: 844 }],
] as const) {
  test(`документы в один клик: ${path} ${viewport.width}px`, async ({ page }) => {
    await seedStarts(page, 3)
    await page.addInitScript(() => localStorage.setItem('naparnik:cookies', '1'))
    await page.setViewportSize(viewport)
    await page.goto(path)
    const docs = page.getByRole('navigation', { name: 'Документы' })
    await docs.scrollIntoViewIfNeeded()
    await expect(docs.getByRole('link', { name: 'Конфиденциальность' })).toHaveAttribute('href', '/privacy')
    await expect(docs.getByRole('link', { name: 'Условия' })).toHaveAttribute('href', '/terms')
    // шрифт не меньше 12 px, ссылки видимы и ничем не закрыты
    const link = docs.getByRole('link', { name: 'Конфиденциальность' })
    expect(await link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12)
    const box = (await link.boundingBox())!
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), [box.x + box.width / 2, box.y + box.height / 2])
    expect(hit).toBe('/privacy')
  })
}

test('лендинг 360×640: ссылки на документы не налезают на кота и кнопку', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('naparnik:cookies', '1'))
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/?intro=1')
  await page.waitForTimeout(1500)
  const docs = (await page.getByRole('navigation', { name: 'Документы' }).boundingBox())!
  const cat = (await page.locator('#hero-cta').boundingBox())!
  expect(docs.y + docs.height).toBeLessThanOrEqual(40)
  expect(cat.y).toBeGreaterThan(docs.y + docs.height)
})
