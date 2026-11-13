import { expect, test } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Скриншоты владельца 13.11 (iPhone): лента чата «ездит вправо и налево, а не только вверх-вниз». Причина — иконка
 * «ответить» у пузыря человека (`-right-9`) торчала за правый край ленты на 17 px, а у ленты по умолчанию
 * overflow-x: auto (из-за overflow-y: auto). Проверяем и запрет, и отсутствие самого выступа: overflow-x: hidden
 * ещё позволяет сдвинуть ленту программно (Safari так доводит до поля ввода).
 */
test('лента чата не прокручивается вбок', async ({ page }) => {
  await seedStarts(page, 3)
  await page.addInitScript(() => {
    if (localStorage.getItem('naparnik:chat')) return
    localStorage.setItem(
      'naparnik:chat',
      JSON.stringify([
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Как побороть сдвг' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Если коротко: волей тут не вытянуть, нужен маленький вход.' }] },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Хз' }] },
      ]),
    )
  })
  await page.setViewportSize({ width: 390, height: 664 })
  await page.goto('/app')
  await expect(page.getByText('Как побороть сдвг', { exact: true })).toBeVisible()
  const r = await page.evaluate(() => {
    const feed = [...document.querySelectorAll<HTMLElement>('div')].find(
      (e) => getComputedStyle(e).overflowY === 'auto' && e.clientHeight > 150 && e.querySelector('.chat-bubble-user'),
    )
    if (!feed) return null
    feed.scrollLeft = 120
    return { scrollWidth: feed.scrollWidth, clientWidth: feed.clientWidth, scrollLeft: feed.scrollLeft, overflowX: getComputedStyle(feed).overflowX }
  })
  expect(r, 'лента чата найдена').not.toBeNull()
  expect(r!.scrollWidth).toBeLessThanOrEqual(r!.clientWidth)
  expect(r!.scrollLeft).toBe(0)
  expect(r!.overflowX).toBe('hidden')
  const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  expect(doc.sw).toBeLessThanOrEqual(doc.cw)
})

test('ИИ недоступен: «Даун» и «Как побороть сдвг» не превращаются в карточку «Начинаю»', async ({ page }) => {
  await seedStarts(page, 3)
  await page.route('**/api/companion', (route) => route.abort())
  await page.goto('/app')
  const box = page.getByRole('textbox').last()
  for (const text of ['Даун', 'Как побороть сдвг']) {
    await box.fill(text)
    await box.press('Enter')
    await expect(page.getByText(text, { exact: true })).toBeVisible()
    await page.waitForTimeout(1200)
  }
  await expect(page.getByRole('button', { name: /Начинаю/ })).toHaveCount(0)
})
