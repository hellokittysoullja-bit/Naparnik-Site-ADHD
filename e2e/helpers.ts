import type { Page } from '@playwright/test'

/** Ошибки страницы и консоли за весь тест. Шум, которого нет в проде, отфильтрован. */
export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // Vercel Analytics существует только на Vercel; локально его скрипт — 404
    if (t.includes('_vercel/insights') || (t.includes('404') && t.includes('Failed to load resource'))) return
    // AI-ключа в CI нет: /api/companion отвечает ошибкой, и чат по задумке уходит в скриптовый ответ
    if (t.includes('status of 500') || t.includes('status of 502')) return
    // headless без GPU: WebGL идёт программно, Chromium предупреждает об этом
    if (t.includes('GPU stall') || t.includes('WebGL')) return
    errors.push(`console: ${t}`)
  })
  return errors
}

/** Сумма сдвигов вёрстки без недавнего ввода — та же формула, что у CLS. */
export async function watchLayoutShift(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { __cls: number }).__cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  return () => page.evaluate(() => (window as unknown as { __cls: number }).__cls)
}

/** Реалистичная история: N стартов в последние дни (CLAUDE.md §5.2 — не тестировать на пустом сиде). */
export async function seedStarts(page: Page, n: number) {
  await page.addInitScript((n) => {
    if (localStorage.getItem('naparnik:starts')) return
    const starts = []
    for (let i = 0; i < n; i++) {
      const d = new Date(Date.now() - (n - i) * 864e5)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      starts.push({ id: `s${i}`, date: key, startedAt: d.toISOString(), label: `Шаг ${i + 1}`, fromPlan: false, minutes: 15 })
    }
    localStorage.setItem('naparnik:starts', JSON.stringify(starts))
    localStorage.setItem('naparnik:companionName', JSON.stringify('Тень'))
  }, n)
}
