import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Постоянное движение сцены — только CSS-анимации и целые слои, без SMIL (15.11). SMIL (<animate>,
 * <animateTransform>) браузер считает в главном потоке и на каждом шаге перерисовывает весь SVG со стилями: в покое
 * при CPU ×6 лендинг тратил на это 1,5–2 с из 5 с (луна и тень под котом), Мир — 2,6–2,9 с (звёзды, блики,
 * деревья). С CSS — 0,1 и ~1 с; картинка та же (попиксельная сверка в одни и те же моменты анимации).
 */
for (const path of ['/?intro=1', '/app', '/app/world', '/app/session']) {
  test(`на ${path} нет SMIL-анимаций`, async ({ page }) => {
    await seedStarts(page, 14)
    await page.goto(path)
    await page.waitForLoadState('load')
    await page.waitForTimeout(800)
    const smil = await page.evaluate(() => document.querySelectorAll('animate, animateTransform, animateMotion, set').length)
    expect(smil).toBe(0)
  })
}

test('луна дышит целым слоем: размер и место прежние', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?intro=1')
  const moon = page.locator('.moon-halo-breathe').first()
  await expect(moon).toBeAttached()
  const r = await moon.evaluate((el) => {
    const halo = el.getBoundingClientRect()
    const disc = (el.nextElementSibling as Element).getBoundingClientRect()
    return { name: getComputedStyle(el).animationName, same: Math.abs(halo.x - disc.x) < 0.5 && Math.abs(halo.y - disc.y) < 0.5 && Math.abs(halo.width - disc.width) < 0.5 }
  })
  expect(r.name).toBe('moon-halo-breathe')
  expect(r.same, 'гало и диск в одной клетке').toBe(true)
})
