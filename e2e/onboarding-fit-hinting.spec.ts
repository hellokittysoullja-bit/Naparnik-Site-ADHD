import { expect, test } from '@playwright/test'
import { SCREENS } from './onboarding-screens'

// CI на GitHub красный с 11.11: там буквы подгоняются к пикселям (hinting, как на Windows и многих Android), и
// «Рука сама тянется к телефону» переносилась на вторую строку — экран «что мешает» вылезал на 12 px. Промежутки
// в карточке 12 → 10 px и поля 16 → 14 px (размеры те же) — помещается при любой отрисовке.
test.use({ launchOptions: { args: ['--font-render-hinting=full'] } })

for (const [name, query] of SCREENS) {
  test(`«${name}» на 390×650 не прокручивается`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 650 })
    await page.goto(`/app/start?${query}`)
    await expect(page.locator('section')).toBeVisible()
    await page.waitForTimeout(1300)
    const over = await page.evaluate(() => {
      const s = document.querySelector('section')!
      return s.scrollHeight - s.clientHeight
    })
    expect(over).toBeLessThanOrEqual(0)
  })
}
