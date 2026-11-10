import { expect, test } from '@playwright/test'

// iPhone в Safari: видимая высота ≈ 650 px (844 минус панели). Раньше список вариантов прокручивался внутри себя и
// верхний/нижний вариант обрезался жёсткой линией под котом и над кнопкой (баг владельца, 10.11).

const STEPS = [
  ['что мешает', '/app/start?step=3&s=work&h=month&b=phone'],
  ['ради чего', '/app/start?step=4&s=work&h=month&b=fear&m=relief'],
  ['сколько ест', '/app/start?step=5&s=work&h=month&b=fear&m=relief&c=allday'],
] as const

for (const [name, url] of STEPS) {
  test(`знакомство «${name}» на 390×650: список не прокручивается внутри себя, последний вариант над кнопкой`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 650 })
    await page.goto(url)
    const group = page.getByRole('radiogroup')
    await expect(group).toBeVisible()
    await page.waitForTimeout(1200)
    const inner = await group.evaluate((el) => ({ overflowY: getComputedStyle(el).overflowY, over: el.scrollHeight - el.clientHeight }))
    expect(inner.overflowY).toBe('visible')
    expect(inner.over).toBeLessThanOrEqual(1)
    const gap = await page.evaluate(() => {
      const last = [...document.querySelectorAll('[role=radio]')].pop()!.getBoundingClientRect()
      const cta = document.querySelector('.thumb-cta button')!.getBoundingClientRect()
      return cta.top - last.bottom
    })
    expect(gap).toBeGreaterThanOrEqual(4)
  })
}

test('знакомство на очень низком экране 390×568: прокручивается весь блок целиком, последний вариант выходит выше кнопки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 })
  await page.goto('/app/start?step=4&s=work&h=month&b=fear&m=relief')
  await expect(page.getByRole('radiogroup')).toBeVisible()
  await page.waitForTimeout(1200)
  const section = await page.evaluate(() => {
    const s = document.querySelector('section')!
    return { scrolls: s.scrollHeight > s.clientHeight }
  })
  expect(section.scrolls).toBe(true)
  await page.evaluate(() => {
    const s = document.querySelector('section')!
    s.scrollTop = s.scrollHeight
  })
  await page.waitForTimeout(200)
  const gap = await page.evaluate(() => {
    const last = [...document.querySelectorAll('[role=radio]')].pop()!.getBoundingClientRect()
    const cta = document.querySelector('.thumb-cta button')!.getBoundingClientRect()
    return cta.top - last.bottom
  })
  expect(gap).toBeGreaterThanOrEqual(8)
})
