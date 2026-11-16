import { expect, test } from '@playwright/test'

/**
 * Экран выбора шага в Фокусе (владелец 16.11, скриншоты с iPhone): фон — ночная сцена, как на Доме; чипов «Открыть
 * документ / Убрать одну вещь / Ответить на одно сообщение» и подписи «Первый шаг» нет; «Раздробить» на экране всегда,
 * и она, как «Готовые шаги», — круглая нажимная кнопка. На сборке до 16.11 тест падает на каждом пункте.
 */
test('Фокус: ночная сцена, без чипов, «Раздробить» всегда и обе кнопки нажимные', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/session')
  const field = page.getByRole('textbox', { name: 'Первый шаг' })
  await expect(field).toBeVisible()

  for (const chip of ['Открыть документ', 'Убрать одну вещь', 'Ответить на одно сообщение'])
    await expect(page.getByRole('button', { name: chip })).toHaveCount(0)
  await expect(page.getByText('Первый шаг', { exact: true })).toHaveCount(0)

  // фон — ночная сцена Дома, общий фон /app скрыт
  const bg = await page.evaluate(() => ({
    scene: !!document.querySelector('.nw-depth, [data-night-scene], picture'),
    own: document.body.hasAttribute('data-own-scene'),
    backdrop: getComputedStyle(document.querySelector('[data-app-backdrop]')!).display,
  }))
  expect(bg).toEqual({ scene: true, own: true, backdrop: 'none' })

  // «Раздробить» есть и при пустом поле, и при коротком; обе кнопки — нажимные (губа снизу, лицо уходит вниз)
  const breakBtn = page.getByRole('button', { name: 'Раздробить' })
  const ready = page.getByRole('button', { name: 'Готовые шаги' })
  await expect(breakBtn).toBeVisible()
  await field.fill('Hh')
  await expect(breakBtn).toBeVisible()
  for (const b of [breakBtn, ready]) {
    await expect(b).toHaveClass(/btn-chunky/)
    await expect(b).toHaveClass(/rounded-full/)
    const lip = await b.locator('.btn-face').evaluate((el) => getComputedStyle(el).boxShadow)
    expect(lip).toMatch(/0px 4px 0px/)
  }

  // нечего разламывать — кот просит слова, а не шлёт запрос
  let asked = false
  await page.route('**/api/breakdown', (r) => {
    asked = true
    return r.fulfill({ json: { steps: null } })
  })
  await breakBtn.click()
  await page.waitForTimeout(300)
  expect(asked).toBe(false)

  // «Готовые шаги» открывают лист с тем же названием
  await ready.click()
  await expect(page.getByRole('dialog', { name: 'Готовые шаги' })).toBeVisible()
})

test('при переходе с Фокуса на Мир общий фон возвращается', async ({ page }) => {
  await page.goto('/app/session')
  await expect(page.getByRole('button', { name: 'Раздробить' })).toBeVisible()
  await page.getByRole('link', { name: 'Мир' }).click()
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-app-backdrop]')!).display)).not.toBe('none')
})
