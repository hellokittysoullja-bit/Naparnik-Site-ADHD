import { expect, test, type Page } from '@playwright/test'
import { collectErrors } from './helpers'

/**
 * Дом «Привал» (13.11, research/22-chat-and-home/E-home-design.md, макеты согласованы владельцем): шаг, о котором
 * человек договорился сам, строка по двум ответам знакомства, одна кнопка «Разломать на шаг», чат за запиской.
 */
const today = (shift = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + shift)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function seed(page: Page, data: { plan?: object; onboarding?: object }) {
  await page.addInitScript((d) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    if (d.plan) localStorage.setItem('naparnik:plan', JSON.stringify(d.plan))
    if (d.onboarding) localStorage.setItem('naparnik:onboarding', JSON.stringify(d.onboarding))
  }, data)
}

test('план на сегодня: шаг словами человека, строка по ответам знакомства, «Разломать на шаг» дробит его в Фокусе', async ({ page }) => {
  const errors = collectErrors(page)
  await seed(page, {
    plan: { forDate: today(), task: 'Курсовая по логистике', firstStep: 'Открыть файл с курсовой', startTime: '00:00', createdAt: '' },
    onboarding: { sphere: 'study', blocker: 'fear', motive: 'rest' },
  })
  let asked = ''
  await page.route('**/api/breakdown', async (route) => {
    asked = (route.request().postDataJSON() as { task: string }).task
    await route.fulfill({ json: { steps: ['Открыть ноутбук', 'Найти файл курсовой', 'Прочитать последний абзац'], source: 'model' } })
  })
  await page.goto('/app')
  await expect(page.getByText('ПО ПЛАНУ · 0:00')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Открыть файл с курсовой' })).toBeVisible()
  await expect(page.getByText('Курсовая по логистике')).toBeVisible()
  // «боюсь, что выйдет плохо» × «смогу отдыхать без фона»
  await expect(page.getByText('Сделай криво, и вечер будет твоим')).toBeVisible()
  // фразы кота на Доме нет (решение владельца), чат — за запиской
  await expect(page.getByPlaceholder('Напиши напарнику…')).toHaveCount(0)

  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await expect(page).toHaveURL(/\/app\/session\?step=.+&plan=1$/)
  await expect(page.getByText('Найти файл курсовой')).toBeVisible()
  expect(asked).toBe('Открыть файл с курсовой')
  // дробление не запускается второй раз при перезагрузке: пометки break в адресе больше нет
  expect(page.url()).not.toContain('break=1')
  expect(errors).toEqual([])
})

test('ничего не положено: «Что сейчас висит?», сфера из знакомства подсвечена, своё дело уходит на дробление', async ({ page }) => {
  await seed(page, { onboarding: { sphere: 'study', blocker: 'tired', motive: 'safety' } })
  await page.route('**/api/breakdown', (route) => route.fulfill({ json: { steps: ['Открыть реферат', 'Найти тему', 'Написать одну фразу'], source: 'model' } }))
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  await expect(page.getByRole('button', { name: /Учёба/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /Работа/ })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('Только открыть, это уже шаг к спокойствию')).toBeVisible()
  // пример в поле — из выбранной сферы
  const field = page.getByLabel('Что сейчас висит')
  await expect(field).toHaveAttribute('placeholder', /реферат/)
  await field.fill('реферат по истории')
  await field.press('Enter')
  await expect(page).toHaveURL(/\/app\/session\?step=/)
  expect(new URL(page.url()).searchParams.get('step')).toBe('реферат по истории')
  await expect(page.getByText('Написать одну фразу')).toBeVisible()
})

test('первый визит без знакомства: поле и подсказки, плашки находок нет, ничего не подсвечено', async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  for (const name of [/Учёба/, /Работа/, /Дом$/]) await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText(/находк/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
})

test('«Поговорить с котом» открывает переписку, «Дом» в меню остаётся подсвеченным', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('link', { name: 'Поговорить с котом' }).click()
  await expect(page).toHaveURL(/\/app\/chat$/)
  await expect(page.getByPlaceholder('Напиши напарнику…')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Дом' })).toHaveAttribute('aria-current', 'page')
})

test('Дом не прокручивается ни вбок, ни вниз; невидимый общий фон /app под сценой не рисуется', async ({ page }) => {
  for (const [w, h] of [[390, 844], [360, 640]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app')
    await expect(page.getByRole('link', { name: 'Разломать на шаг' })).toBeVisible()
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      backdrop: getComputedStyle(document.querySelector('[data-app-backdrop]')!).display,
      chatBottom: document.querySelector('.btn-paper')!.getBoundingClientRect().bottom,
      navTop: document.querySelector('nav')!.getBoundingClientRect().top,
    }))
    expect(m.sw, `${w}×${h}`).toBeLessThanOrEqual(w)
    expect(m.sh, `${w}×${h}`).toBeLessThanOrEqual(h)
    expect(m.backdrop).toBe('none')
    // кнопка чата целиком над меню
    expect(m.chatBottom, `${w}×${h}`).toBeLessThanOrEqual(m.navTop)
  }
  // на других экранах общий фон на месте
  await page.getByRole('link', { name: 'Мир' }).click()
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('[data-app-backdrop]')!).display)).not.toBe('none')
})
