import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Чек-лист РКН 2026 (16.11): документы в один клик, согласие под кнопкой, отправляющей данные, плашка о cookie
 * с явной кнопкой и без метки посетителя до неё.
 */

test('метка посетителя и источник ставятся только после «Разрешить и закрыть»; источник не теряется при переходе', async ({ page, context }) => {
  let visits = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/visit')) visits++
  })
  await page.goto('/?src=reel-where&utm_source=tiktok')
  const notice = page.getByRole('region', { name: 'Cookie' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: 'политикой конфиденциальности' })).toHaveAttribute('href', '/privacy')
  await page.waitForTimeout(1500)
  expect(visits).toBe(0)
  expect((await context.cookies()).map((c) => c.name)).not.toContain('nid')

  // ушёл читать политику (адрес уже без метки) и согласился там
  await notice.getByRole('link', { name: 'политикой конфиденциальности' }).click()
  await expect(page).toHaveURL(/\/privacy$/)
  const visit = page.waitForResponse((r) => r.url().endsWith('/api/visit'))
  await page.getByRole('button', { name: 'Разрешить и закрыть' }).click()
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

for (const viewport of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`лендинг ${viewport.width}×${viewport.height}: согласие с документами под «Давай», кнопка на прежнем месте`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('naparnik:cookies', '1'))
    await page.setViewportSize(viewport)
    await page.goto('/?intro=1')
    await page.waitForTimeout(1500)
    const cta = page.locator('#hero-cta')
    const btn = (await cta.locator('a.btn-chunky').boundingBox())!
    // место кнопки как до подписи (замер старой сборки 16.11): низ кнопки 18 px от края на телефоне
    if (viewport.width < 1024) expect(Math.round(viewport.height - (btn.y + btn.height))).toBe(18)
    else expect(Math.round(btn.y)).toBe(426)
    await expect(cta.getByText('Нажимая, вы принимаете')).toBeVisible()
    for (const [name, href] of [['условия', '/terms'], ['политику', '/privacy']] as const) {
      const link = cta.getByRole('link', { name, exact: true })
      const box = (await link.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(btn.y + btn.height - 0.5)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      expect(await link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12)
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), [box.x + box.width / 2, box.y + box.height / 2])
      expect(hit).toBe(href)
    }
  })
}
