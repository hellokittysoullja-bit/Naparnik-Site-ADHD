import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

// План «школа 1», фазы 0–2: анонимный ID, источник, адреса и правила, вернувшийся, заголовок под ролик.

test('первый визит — HTML без функции и без cookie; nid ставит сервер после отрисовки: httpOnly, на год', async ({
  page,
  context,
}) => {
  // research/19 §1.3: ответ на саму страницу больше не идёт через proxy — прямой статический HTML из CDN
  const first = await page.request.get('/', { maxRedirects: 0 })
  expect(first.status()).toBe(200)
  expect(first.headers()['set-cookie']).toBeUndefined()
  const variant = await page.request.get('/?src=reel-phone', { maxRedirects: 0 })
  expect(variant.headers()['set-cookie']).toBeUndefined()

  const visit = page.waitForResponse((r) => r.url().endsWith('/api/visit'))
  await page.goto('/')
  const res = await visit
  expect(res.status()).toBe(204)
  const set = (await res.headerValue('set-cookie')) ?? ''
  expect(set).toMatch(/nid=[A-Za-z0-9_-]{22};/)
  expect(set).toMatch(/HttpOnly/i)
  expect(set).toMatch(/Max-Age=31536000/)
  const nid = (await context.cookies()).find((c) => c.name === 'nid')
  expect(nid?.httpOnly).toBe(true)
  await page.goto('/app/start')
  await page.waitForTimeout(1500)
  expect((await context.cookies()).find((c) => c.name === 'nid')?.value).toBe(nid?.value)
})

test('заголовок под ролик: ?src= известного ролика меняет только заголовок, чужой — по умолчанию', async ({ page }) => {
  await page.goto('/?src=reel-phone')
  await expect(page.locator('h1')).toContainText('Без ленты')
  await expect(page).toHaveURL(/\/\?src=reel-phone$/)
  await page.goto('/?src=REEL-FEAR')
  await expect(page.locator('h1')).toContainText('Можно криво')
  await page.goto('/?src=reel-unknown')
  await expect(page.locator('h1')).toContainText('Сдвинем твоё')
})

test('метка ролика доходит до знакомства и запоминается первым и последним входом', async ({ page, context }) => {
  const visit = page.waitForResponse((r) => r.url().endsWith('/api/visit'))
  await page.goto('/?src=reel-where&utm_source=tiktok')
  await visit
  const cta = page.getByRole('link', { name: /Давай/ }).first()
  await expect(cta).toHaveAttribute('href', /\/app\/start\?utm_source=tiktok&src=reel-where/)
  const names = (await context.cookies()).map((c) => c.name)
  expect(names).toEqual(expect.arrayContaining(['n_ft', 'n_lt']))
})

test('знакомство в адресе: «Назад» браузера, перезагрузка и ссылка в чистом браузере открывают тот же вопрос', async ({
  page,
  browser,
}) => {
  await page.goto('/app/start')
  await expect(page).toHaveURL(/step=1/)
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(/step=2&s=study/)
  await page.waitForTimeout(500) // защита от двойного тапа (400 мс)
  await page.getByRole('radio').nth(1).click()
  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(/step=3&s=study&h=week/)
  await page.goBack()
  await expect(page).toHaveURL(/step=2&s=study&h=week/)
  await expect(page.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
  await page.reload()
  await expect(page).toHaveURL(/step=2/)
  await expect(page.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
  // «Открыть в Safari» из встроенного браузера: переносится только адрес
  const other = await browser.newContext()
  const fresh = await other.newPage()
  await fresh.goto(page.url())
  await expect(fresh).toHaveURL(/step=2&s=study&h=week/)
  await expect(fresh.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
  await other.close()
})

test('свой текст шага в адрес не попадает', async ({ page }) => {
  await page.goto('/app/start?step=7&s=study&h=week&b=phone&m=relief&c=hour')
  await page.getByText('Своё дело').click()
  await page.getByRole('textbox').fill('Позвонить в деканат')
  await page.getByRole('button', { name: /Продолжить/ }).click()
  await expect(page).toHaveURL(/f=own/)
  expect(decodeURIComponent(page.url())).not.toContain('деканат')
})

test('приложение и воронка — noindex, лендинг — в поиске', async ({ page }) => {
  for (const path of ['/app', '/app/start', '/app/session', '/app/world']) {
    const res = await page.request.get(path, { maxRedirects: 0 })
    expect(res.headers()['x-robots-tag'], path).toBe('noindex')
  }
  expect((await page.request.get('/')).headers()['x-robots-tag']).toBeUndefined()
})

test('короткие ссылки /test и /razbit — 308 с сохранением метки', async ({ page }) => {
  const t = await page.request.get('/test?src=reel-12', { maxRedirects: 0 })
  expect(t.status()).toBe(308)
  expect(t.headers().location).toBe('/sdvg-test?src=reel-12')
  const r = await page.request.get('/razbit', { maxRedirects: 0 })
  expect(r.status()).toBe(308)
  expect(r.headers().location).toBe('/app/session')
})

test('/privacy и /terms открываются и говорят, что это не диагноз', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Политика конфиденциальности')
  await page.goto('/terms')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Условия использования')
  await expect(page.getByText(/не ставит диагнозы/)).toBeVisible()
})

test('метку «свой» ставит сервер: после визита домой cookie выдана ответом сервера', async ({ page }) => {
  await seedStarts(page, 3)
  const homeSet = page.waitForResponse((r) => r.url().endsWith('/api/home') && r.request().method() === 'POST')
  await page.goto('/app')
  const res = await homeSet
  expect(res.status()).toBe(204)
  expect(await res.headerValue('set-cookie')).toMatch(/naparnik_home=1;.*Max-Age=34560000/)
  // и уводит с лендинга до его загрузки, с той же меткой ролика
  const r = await page.request.get('/?src=reel-phone', { maxRedirects: 0 })
  expect(r.status()).toBe(307)
  expect(r.headers().location).toBe('/app?src=reel-phone')
})

test('чужая ссылка с ?_nid=&_home=1 не подставляет ID: параметры убираются, cookie не ставятся', async ({ page }) => {
  // security-audit §2.2: раньше любой мог разослать ссылку со своим ID — у каждого нового посетителя он жил год.
  // Перенос при переезде домена — только подписанным жетоном (lib/handoff.ts, tests/unit/handoff.test.ts).
  const res = await page.request.get('/app?_nid=BBBBBBBBBBBBBBBBBBBBBB&_home=1&src=x', { maxRedirects: 0 })
  expect(res.status()).toBe(307)
  expect(res.headers().location).toBe('/app?src=x')
  expect(res.headers()['set-cookie']).toBeUndefined()
})
