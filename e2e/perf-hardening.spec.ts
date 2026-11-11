import { expect, test } from '@playwright/test'

// research/19 §5 (11.11): то, что ускорили, не должно тихо вернуться.

test('слои кота грузятся параллельно с rig.json, а не после него', async ({ page }) => {
  let rigAsked = 0
  const layerAt: number[] = []
  // rig.json задерживаем на 1,5 с: слои, которые ждут его, пошли бы только после
  await page.route(/\/mascot\/doll\/rig\.json/, async (route) => {
    rigAsked = Date.now()
    await new Promise((r) => setTimeout(r, 1500))
    await route.continue()
  })
  page.on('request', (r) => {
    if (/\/mascot\/doll\/.*\.webp/.test(r.url())) layerAt.push(Date.now())
  })
  await page.goto('/?intro=1')
  await expect(page.locator('.cat-doll canvas').nth(1)).toBeVisible({ timeout: 15_000 })
  expect(layerAt.length).toBeGreaterThanOrEqual(13)
  expect(rigAsked).toBeGreaterThan(0)
  // параллельно — первые слои ушли, пока rig.json ещё «в пути» (с запасом 0,5 с от его 1,5 с)
  expect(Math.min(...layerAt) - rigAsked).toBeLessThan(1000)
})

test('полевые Web Vitals уходят в аналитику только с путём без параметров', async ({ page }) => {
  await page.goto('/app/start?step=1&utm_source=tiktok#a=1,2')
  await page.getByRole('radio').first().click() // взаимодействие — для INP
  await page.waitForTimeout(1500)
  // вкладка уходит в фон — web-vitals отдаёт LCP/CLS/INP
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(300)
  const sent = await page.evaluate(() =>
    ((window as unknown as { vaq?: unknown[][] }).vaq ?? [])
      .filter((c) => c[0] === 'event')
      .map((c) => c[1] as { name: string; data: Record<string, unknown> })
      .filter((e) => e.name.startsWith('vital_')),
  )
  expect(sent.map((e) => e.name)).toEqual(expect.arrayContaining(['vital_TTFB', 'vital_FCP']))
  for (const e of sent) {
    expect(e.data.path).toBe('/app/start')
    expect(Object.keys(e.data).sort()).toEqual(['path', 'rating', 'value'])
  }
})
