import { expect, test, type Page } from '@playwright/test'

/**
 * Набор текста в переписке не перерисовывает ленту (15.11). Раньше текст поля жил в CompanionChat, и каждая буква
 * перерисовывала все пузыри с котами: при 30 репликах и CPU ×4 обработка буквы занимала ~30 мс против ~7 мс в пустом
 * чате. Поле вынесено в ChatComposer. Сравниваем с пустым чатом в том же прогоне — так тест не зависит от скорости
 * машины: длинная лента не должна делать букву заметно дороже.
 */
async function typingCost(page: Page, messages: number): Promise<number> {
  await page.goto('/app/chat', { waitUntil: 'domcontentloaded' })
  await page.evaluate((n) => {
    localStorage.clear()
    const msgs = []
    const times: Record<string, string> = {}
    const t0 = Date.now() - 3600e3
    for (let i = 0; i < n; i++) {
      const id = `m${i}`
      const user = i % 2 === 0
      msgs.push({
        id,
        role: user ? 'user' : 'assistant',
        parts: [{ type: 'text', text: user ? `Надо разобрать почту, письмо ${i}, но не могу начать` : `Давай откроем самое короткое письмо. Это шаг ${i}.` }],
      })
      times[id] = new Date(t0 + i * 60e3).toISOString()
    }
    localStorage.setItem('naparnik:chat', JSON.stringify(msgs))
    localStorage.setItem('naparnik:chatTimes', JSON.stringify(times))
  }, messages)
  await page.reload({ waitUntil: 'load' })
  const box = page.getByRole('textbox', { name: 'Сообщение напарнику' })
  await expect(box).toBeVisible()
  await page.waitForTimeout(1500)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.evaluate(() => {
    const w = window as unknown as { __proc: number[] }
    w.__proc = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceEventTiming[]) {
        if (e.name === 'keydown' || e.name === 'keypress' || e.name === 'input') w.__proc.push(e.processingEnd - e.processingStart)
      }
    }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)
  })
  await box.click()
  for (const ch of 'разобрать почту сегодня') {
    await page.keyboard.type(ch)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))))
  }
  await page.waitForTimeout(300)
  const proc = await page.evaluate(() => (window as unknown as { __proc: number[] }).__proc.slice().sort((a, b) => a - b))
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  expect(proc.length, 'события клавиатуры замерены').toBeGreaterThan(10)
  return proc[proc.length >> 1]
}

test('буква в поле переписки стоит одинаково при пустой ленте и при 30 репликах', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const empty = await typingCost(page, 0)
  const full = await typingCost(page, 30)
  // было: ~7 мс против ~30 мс (×4); стало: ~7 против ~7
  expect(full, `пустая лента ${empty.toFixed(1)} мс, 30 реплик ${full.toFixed(1)} мс`).toBeLessThan(empty * 2 + 2)
})
