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
  // подпись под стартом снята навсегда (владелец 16.11)
  await expect(page.getByText(/засчитывается сразу/i)).toHaveCount(0)

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
  // 17.11 (владелец): «Раздробить» — 1 в 1 «Ещё мельче» из записки, «Готовые шаги» — 1 в 1 «Своими словами»: цвет, обводка,
  // нажимной бортик; размер прежний. Текст «Готовых шагов» тёмный на кремовом (цвет записки задан и вне записки)
  await expect(breakBtn).toHaveClass(/note-btn-go/)
  await expect(ready).toHaveClass(/note-btn/)
  for (const b of [breakBtn, ready]) {
    const st = await b.evaluate((el) => { const c = getComputedStyle(el); return { lip: c.boxShadow, color: c.color, h: el.getBoundingClientRect().height } })
    expect(st.lip).toMatch(/0px 4px 0px/)
    expect(st.color).toBe('rgb(42, 31, 23)')
    expect(st.h).toBeGreaterThanOrEqual(44)
  }
  await expect(page.getByText(/рекомендуем/i)).toHaveCount(0)
  // тень кота видна (владелец 17.11, «как на полене», без земли): под лапами лунный отсвет, тень куклы лежит на нём
  const glow = await page.evaluate(() => {
    const g = document.querySelector('.focus-cat-glow')
    const sh = document.querySelector('.vt-cat .cat-shadow-soft')
    if (!g || !sh) return null
    const a = g.getBoundingClientRect(), b = sh.getBoundingClientRect()
    return a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom
  })
  expect(glow).toBe(true)

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
