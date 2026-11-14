import { expect, test } from '@playwright/test'

// Плавность на слабых телефонах (14.11): то, что двигается постоянно, должна двигать видеокарта, а не главный поток.
// Каждый тест здесь падает на сборке до 14.11.

test('существо у костра дышит целым <svg> (его ведёт видеокарта), а не узлом внутри SVG', async ({ page }) => {
  await page.goto('/app/world')
  await page.waitForTimeout(500)
  const tags = await page.evaluate(() =>
    document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'creature-breathe').map((a) => (a.effect as KeyframeEffect).target?.localName),
  )
  expect(tags.length).toBeGreaterThan(0)
  for (const t of tags) expect(t).toBe('svg')
})

test('Фокус: свечение дуги — фильтр её <svg>, а не <circle>, который перерисовывается каждый кадр', async ({ page }) => {
  await page.goto('/app/session?step=' + encodeURIComponent('Открыть тетрадь'))
  await page.getByRole('button', { name: /Начали/ }).click()
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  const r = await page.evaluate(() => {
    const arc = document.querySelector('svg.focus-ring-arc') as SVGSVGElement | null
    const circle = arc?.querySelector('circle')
    return { svg: arc ? getComputedStyle(arc).filter : null, circle: circle ? getComputedStyle(circle).filter : null }
  })
  expect(r.svg).toContain('drop-shadow')
  expect(r.circle).toBe('none')
})

test('Дом: нижнее меню без размытия поверх видео; на Мире размытие на месте', async ({ page }) => {
  const blur = () => page.evaluate(() => getComputedStyle(document.querySelector('nav[aria-label="Основная навигация"]')!).backdropFilter)
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  expect(await blur()).toBe('none')
  await page.goto('/app/world')
  await page.waitForTimeout(300)
  expect(await blur()).toContain('blur')
})

test('слои кота качаются один раз и раскодируются вне главного потока (fetch → ImageBitmap)', async ({ page }) => {
  const hits = new Map<string, string[]>()
  page.on('request', (r) => {
    const u = r.url()
    if (u.includes('/mascot/doll/') && u.includes('.webp')) hits.set(u, [...(hits.get(u) ?? []), r.resourceType()])
  })
  await page.goto('/app')
  await page.locator('[data-cat-ready]').first().waitFor({ timeout: 15_000 })
  await page.waitForTimeout(500)
  expect(hits.size).toBeGreaterThan(5)
  for (const [u, types] of hits) {
    expect(types.length, u).toBe(1)
    // предзагрузка Дома (as fetch) Playwright помечает как «other»; главное — не <img> (тот раскодировал в главном потоке)
    expect(['fetch', 'other'], u).toContain(types[0])
  }
})
