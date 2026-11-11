import { expect, test } from '@playwright/test'

// Находки аудита 11.11 (research/20-audit-11-11): каждый тест на сборке до правки падает.

const stepOf = (url: string) => new URL(url).searchParams.get('step') ?? '1'

test('знакомство: после перезагрузки «Назад» доходит до первого вопроса, а не ходит между двумя', async ({ page }) => {
  await page.goto('/app/start')
  await page.getByRole('radiogroup').first().waitFor()
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500) // защита от двойного тапа 400 мс
    await page.getByRole('radiogroup').getByRole('radio').nth(1).click()
    await page.waitForTimeout(500)
    const before = stepOf(page.url())
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await expect.poll(() => stepOf(page.url())).not.toBe(before)
  }
  expect(stepOf(page.url())).toBe('5')
  await page.reload()
  await page.getByRole('radiogroup').first().waitFor()
  const seen: string[] = []
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500)
    const before = stepOf(page.url())
    await page.getByRole('button', { name: 'Назад' }).click()
    await expect.poll(() => stepOf(page.url())).not.toBe(before)
    seen.push(stepOf(page.url()))
  }
  expect(seen).toEqual(['4', '3', '2', '1'])
})

for (const path of ['/app/session', '/app/start']) {
  test(`${path}: постер кота объявлен в <head> — браузер качает его сразу, а не после загрузки кода`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const head = html.slice(0, html.indexOf('</head>'))
    expect(head).toMatch(/<link rel="preload"[^>]*href="\/mascot\/poster\/neutral\.webp\?v=[^"]+"[^>]*>/)
    // адрес тот же, что у <img> кота: иначе файл скачался бы дважды
    const preloaded = head.match(/href="(\/mascot\/poster\/neutral\.webp\?v=[^"]+)"/)![1]
    if (path === '/app/start') expect(html).toContain(`src="${preloaded}"`)
  })
}

test('тест СДВГ: после «продолжить с вопроса N» кнопка «Назад» возвращает на вход, а не остаётся на том же вопросе', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await expect.poll(() => stepOf(page.url())).toBe('age')
  // возраст, вступление и три вопроса: каждый раз первая кнопка экрана, кроме «Назад»
  for (const next of ['pre', 'a1', 'a2', 'a3', 'a4']) {
    await page.locator('main button:visible').filter({ hasNotText: /Назад/ }).first().click()
    await expect.poll(() => stepOf(page.url())).toBe(next)
  }
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: /продолжить с вопроса/i }).click()
  await expect.poll(() => stepOf(page.url())).toBe('a4')
  await page.getByRole('button', { name: /Назад/ }).click()
  await expect(page.getByRole('button', { name: 'Начать' })).toBeVisible()
})

test('заголовки защиты на странице и на API: CSP без лишних источников, запрет встраивания, без кэша у личных ответов', async ({ request }) => {
  const res = await request.get('/')
  const csp = res.headers()['content-security-policy']
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  // blob: не разрешён нигде, data: — только картинкам и шрифтам (вшитый постер кота, шум фона, шрифты первого экрана)
  expect(csp).not.toContain('blob:')
  for (const d of csp.split(';').map((x) => x.trim()))
    if (d.includes('data:')) expect(d.split(' ')[0]).toMatch(/^(img-src|font-src)$/)
  expect(res.headers()['x-frame-options']).toBe('DENY')
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  expect(res.headers()['x-powered-by']).toBeUndefined()
  const visit = await request.post('/api/visit', { data: { a: {} }, headers: { 'content-type': 'application/json' } })
  expect(visit.status()).toBe(204)
  expect(visit.headers()['cache-control']).toContain('no-store')
})
