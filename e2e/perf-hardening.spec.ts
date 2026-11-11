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
