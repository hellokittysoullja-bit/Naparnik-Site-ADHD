import { expect, test, type Page } from '@playwright/test'
import { seedStarts, walkOnboarding } from './helpers'

/**
 * Каждый экран — с первого видимого кадра готовый (владелец 16.11: «чтобы с первой миллисекунды сразу было то, что
 * нужно: не было других экранов, ничего не пропадало, ничего не появлялось потом»).
 *
 * Тест запоминает, что видно на экране, в ПЕРВОМ кадре, когда страница вообще показана (body не скрыт), и через 2,5 с.
 * Видно = текст элемента, у которого суммарная прозрачность с предками ≥ 0,95 и который не скрыт. Наборы должны
 * совпасть: ничего не проявилось, не въехало и не подменилось после показа. Цифры убраны (идущий таймер Фокуса).
 * Процессор замедлен вчетверо. На сборке до 16.11 тест падает: лендинг проявлялся по частям, приветствие переписки и
 * подсказки въезжали, «Дела» приходили кадром позже, кнопка в поле переписки менялась со стрелки на микрофон.
 */

const SNAP = () => {
  const w = window as unknown as { __first?: string[]; __shown?: boolean }
  const visible = () => {
    const out = new Set<string>()
    const op = (el: Element) => {
      let o = 1
      for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
      return o
    }
    for (const el of document.body.querySelectorAll('*')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('')
      const label = el.getAttribute('aria-label') ?? ''
      // текст из CSS (content: var(--…)) — так скрипт первого кадра рисует личное до загрузки кода (lib/app-prepaint.ts)
      const pseudo = ['::before', '::after']
        .map((p) => getComputedStyle(el, p).content)
        .filter((c) => c && c !== 'none' && c !== 'normal' && c.startsWith('"'))
        .map((c) => c.slice(1, -1))
        .join(' ')
      const text = (own + ' ' + pseudo + (el.tagName === 'BUTTON' ? ' ' + label : '')).replace(/\d/g, '').replace(/\s+/g, ' ').trim()
      if (!text) continue
      const r = el.getBoundingClientRect()
      // 1×1 — текст только для экранного диктора (sr-only), глазом не виден
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue
      if (getComputedStyle(el).visibility === 'hidden' || op(el) < 0.95) continue
      out.add(text)
    }
    return [...out].sort()
  }
  ;(w as unknown as { __visible: () => string[] }).__visible = visible
  const tick = () => {
    if (!w.__shown && document.body && getComputedStyle(document.body).visibility === 'visible') {
      w.__shown = true
      w.__first = visible()
      return
    }
    if (performance.now() < 6000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function firstVsFinal(page: Page, url: string) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(url)
  await page.waitForTimeout(2500)
  const res = await page.evaluate(() => {
    const w = window as unknown as { __first?: string[]; __visible: () => string[] }
    return { first: w.__first ?? null, final: w.__visible() }
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  expect(res.first, `${url}: страница так и не показалась`).not.toBeNull()
  const late = res.final.filter((t) => !res.first!.includes(t))
  const gone = res.first!.filter((t) => !res.final.includes(t))
  expect({ url, late, gone }).toEqual({ url, late: [], gone: [] })
}

test('лендинг: первый видимый кадр — весь экран, без проявления по частям', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(SNAP)
  await firstVsFinal(page, '/')
  await firstVsFinal(page, '/?intro=1')
})

test('экраны /app у вернувшегося: первый видимый кадр после обновления — готовый экран', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/start')
  await walkOnboarding(page, { toPlan: true })
  await seedStarts(page, 9)
  await page.evaluate(() => localStorage.setItem('naparnik:cookies', '1'))
  await page.addInitScript(SNAP)
  for (const r of ['/app', '/app/chat', '/app/session', '/app/world', '/app/deals', '/app/stuck']) await firstVsFinal(page, r)
})

test('новый человек: переписка и Фокус с первого видимого кадра готовые', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => localStorage.setItem('naparnik:cookies', '1'))
  await page.addInitScript(SNAP)
  for (const r of ['/app/chat', '/app/session']) await firstVsFinal(page, r)
})
