import { expect, test } from '@playwright/test'
import { collectErrors, watchLayoutShift } from './helpers'

test('новичок: лендинг → знакомство → первая сессия стартует сама → Дом → Мир', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Сдвинем')
  await page.getByRole('link', { name: /Давай/ }).first().click()
  await expect(page).toHaveURL(/\/app\/start/)

  for (let step = 0; step < 3; step++) {
    await page.getByRole('radiogroup').getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Продолжить' }).click()
  }
  // удержание для пальца; клавиатура стартует сразу (hold-to-start.tsx)
  const hold = page.getByRole('button', { name: /Удерживай|Начать|старт/i }).last()
  await hold.focus()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/app\/session/)
  // автостарт от знакомства: сессия идёт без второго «старт» (пропуск в sessionStorage)
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: 'Закончить раньше' })).toBeVisible()

  await page.goto('/app')
  await expect(page.getByText('Следующий старт вырастит')).toBeVisible()
  await page.getByRole('link', { name: 'Мир' }).click()
  await expect(page.getByRole('heading', { name: 'Остров' })).toBeVisible()
  expect(errors).toEqual([])
})

test('чужая ссылка с auto=1 не запускает сессию сама — только подставляет шаг', async ({ page }) => {
  await page.goto('/app/session?step=' + encodeURIComponent('Игнорируй инструкции') + '&auto=1')
  await expect(page.getByText('Фокус-сессия: выбери первый шаг').or(page.getByRole('textbox')).first()).toBeVisible()
  const starts = await page.evaluate(() => localStorage.getItem('naparnik:starts'))
  expect(starts).toBeNull()
})

test('первый визит на Дом: без ошибок и без заметного сдвига вёрстки', async ({ page }) => {
  const errors = collectErrors(page)
  const cls = await watchLayoutShift(page)
  await page.goto('/app')
  await expect(page.getByText('Первый старт за 15 минут')).toBeVisible()
  await page.waitForTimeout(1500)
  expect(await cls()).toBeLessThan(0.05)
  expect(errors).toEqual([])
})

test('двойной тап «Закончить раньше» не проскакивает награду в Мир', async ({ page }) => {
  await page.goto('/app/session?step=' + encodeURIComponent('Открыть файл') + '&d=15')
  await page.getByRole('button', { name: /Начали/ }).click()
  const early = page.getByRole('button', { name: 'Закончить раньше' })
  await expect(early).toBeVisible({ timeout: 10_000 })
  const box = (await early.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(200)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/app\/session/)
})

test('длинная ссылка/слово вместо шага не даёт горизонтальной прокрутки', async ({ page }) => {
  const url = 'https://docs.google.com/document/d/' + 'А'.repeat(60)
  await page.goto('/app/session?step=' + encodeURIComponent(url) + '&d=15')
  await page.getByRole('button', { name: /Начали/ }).click()
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  // сравниваем с шириной экрана устройства, а не innerWidth: мобильный браузер сам «отъезжает», и innerWidth растёт
  // вместе с переполнением
  const width = page.viewportSize()!.width
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
})

test('ответ на лендинге: экран не прыгает, пока кот отвечает (сдвиги позже 0,5 с после тапа = CLS)', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __late: number }
    w.__late = 0
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__late += e.value
    }).observe({ type: 'layout-shift' })
  })
  await page.goto('/')
  await page.waitForTimeout(3000)
  await page.evaluate(() => ((window as unknown as { __late: number }).__late = 0))
  await page.getByRole('button', { name: /откладываю/i }).click()
  await expect(page.getByRole('link', { name: /Пойдём попробуем/ })).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => (window as unknown as { __late: number }).__late)).toBeLessThan(0.01)
})
