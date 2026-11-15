import { expect, test, type Page } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * Экран не должен показывать «пустую» версию и через миг подменять её прочитанной из памяти (запись экрана владельца,
 * 16.11: в Фокусе кот говорил реплику новичка, а потом менял её на «Погнали… <имя> рядом», пузырь из двух строк
 * становился одной и экран дёргался). Пишем все тексты узла с первого кадра; текст должен быть один.
 */
async function recordTexts(page: Page, selector: string) {
  await page.addInitScript((sel) => {
    const seen: string[] = []
    ;(window as unknown as { __seen: string[] }).__seen = seen
    const grab = () => {
      const el = document.querySelector(sel)
      const t = el?.textContent?.trim()
      if (t && seen[seen.length - 1] !== t) seen.push(t)
    }
    new MutationObserver(grab).observe(document, { subtree: true, childList: true, characterData: true })
    const tick = () => {
      grab()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, selector)
  return () => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)
}

test('Фокус: реплика кота с первого кадра своя (имя и прошлые сессии), без подмены', async ({ page }) => {
  await seedStarts(page, 9)
  await page.addInitScript(() => {
    localStorage.setItem('naparnik:companionName', JSON.stringify('Уголёк'))
    localStorage.setItem('naparnik:hideDigits', '1')
    localStorage.setItem('naparnik:sound', 'rain')
  })
  const texts = await recordTexts(page, 'p.glass')
  await page.goto('/app/session')
  await expect(page.getByText(/Уголёк рядом/)).toBeVisible()
  await page.waitForTimeout(1200)
  const seen = await texts()
  expect(seen.some((t) => /Назови/.test(t)), JSON.stringify(seen)).toBe(false)
  expect(seen.filter((t) => /фокусе/.test(t))).toHaveLength(1)
  // выбранный звук и спрятанные цифры — тоже сразу: начинаем сессию и смотрим первый кадр
  await page.getByPlaceholder('Открыть файл презентации').fill('Открыть файл')
  await page.getByRole('button', { name: /Начали/ }).click()
  await expect(page.getByRole('button', { name: /Звук: Дождь/ })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('timer')).toHaveCount(0)
})

test('«Не могу начать»: первый вопрос с первого кадра тот, что положен этому заходу, без подмены', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem('naparnik:stuckOpener', '0')
    }
  })
  const texts = await recordTexts(page, 'main p.glass')
  await page.goto('/app/stuck?task=' + encodeURIComponent('Курсовая'))
  await expect(page.getByRole('group', { name: 'Что происходит' })).toBeVisible()
  await page.waitForTimeout(1200)
  const seen = await texts()
  // прошлый заход был №0 — этот начинается со второго вопроса и только с него
  expect(seen, JSON.stringify(seen)).toEqual([expect.stringMatching(/чувствуешь/)])
})
