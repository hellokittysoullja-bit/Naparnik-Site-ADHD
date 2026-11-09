import { expect, test, type Page } from '@playwright/test'

// Тест «Что мешает тебе начинать дела?» (/sdvg-test, research/14-lead-magnets/owner-asrs-bridge.md)

// Ответ отмечается сразу, экран сменяется через ~320 мс (кот черкает в блокноте) — ждём новый шаг в адресе
async function answer(page: Page, nth: number) {
  const before = new URL(page.url()).searchParams.get('step')
  await page.getByRole('radio').nth(nth).click()
  await page.waitForFunction((b) => new URLSearchParams(location.search).get('step') !== b, before)
}

async function passToResult(page: Page) {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Да' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  for (let i = 0; i < 6; i++) await answer(page, 4) // «очень часто» — 4 балла
  await page.getByRole('button', { name: 'Дальше' }).click()
  for (let i = 0; i < 4; i++) await answer(page, 3) // «Мастер последней ночи»
  await page.getByRole('radio', { name: 'Учёба' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click()
}

test('/test ведёт на /sdvg-test', async ({ page }) => {
  const r = await page.request.get('/test?src=reel-1', { maxRedirects: 0 })
  expect(r.status()).toBe(308)
  expect(r.headers().location).toBe('/sdvg-test?src=reel-1')
})

test('весь путь: возраст → 6 вопросов ВОЗ → 4 вопроса → сфера → расчёт → диапазон, тип и шаг', async ({ page }) => {
  await passToResult(page)
  await expect(page.getByText('Считаю 6 ответов')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Много совпадений, выше порога' })).toBeVisible({ timeout: 6000 })
  await expect(page.getByText('24 из 24').first()).toBeVisible()
  await expect(page.getByText('Это скрининг, а не диагноз.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Мастер последней ночи' })).toBeVisible()
  await expect(page.getByText('первая задача из домашки')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сделать первый шаг вместе с Напарником' })).toBeVisible()
})

test('ответы ВОЗ только во фрагменте адреса — на сервер не уходят', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => seen.push(r.url()))
  await passToResult(page)
  await expect(page.getByRole('heading', { name: 'Мастер последней ночи' })).toBeVisible({ timeout: 6000 })
  const u = new URL(page.url())
  // ответы ВОЗ — во фрагменте (браузер не отправляет его на сервер), в обычной части адреса их нет
  expect(u.hash).toBe('#a=444444')
  expect(u.search).not.toContain('444444')
  expect(u.searchParams.get('l')).toBe('MMMM')
  expect(seen.some((s) => /444444/.test(s))).toBe(false)
})

test('не взрослому — без опросника ВОЗ и без балла', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Нет' }).click()
  await expect(page.getByText('Опросник ВОЗ рассчитан на взрослых')).toBeVisible()
  for (let i = 0; i < 4; i++) await answer(page, 0)
  await page.getByRole('radio', { name: 'Работа' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click()
  await expect(page.getByRole('heading', { name: 'Перфекционист' })).toBeVisible({ timeout: 6000 })
  await expect(page.getByText('из 24')).toHaveCount(0)
})

test('«Назад» браузера — предыдущий вопрос; перезагрузка — тот же вопрос с ответом', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Да' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  await answer(page, 2)
  await expect(page).toHaveURL(/step=a2/)
  await page.goBack()
  await expect(page).toHaveURL(/step=a1/)
  await expect(page.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
  await page.reload()
  await expect(page).toHaveURL(/step=a1.*#a=2/)
  await expect(page.locator('[role=radio][aria-checked=true]')).toHaveCount(1)
})

test('незаконченный тест: «Продолжить с вопроса N»', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Да' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  await answer(page, 1)
  await answer(page, 1)
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Продолжить с вопроса 3' }).click()
  await expect(page).toHaveURL(/step=a3/)
})

test('кнопка ведёт в 2-минутную сессию, после неё — «Когда повторим завтра?»', async ({ page }) => {
  test.slow() // весь тест + сессия + финал острова; ответы теперь сменяются с паузой ~320 мс
  await passToResult(page)
  await page.getByRole('button', { name: 'Сделать первый шаг вместе с Напарником' }).click({ timeout: 6000 })
  // сессия на 2 минуты с шагом под тип и сферу; после автостарта шаг из адреса убирается, источник остаётся
  await expect(page.getByText('первая задача из домашки')).toBeVisible()
  await expect(page.getByRole('timer')).toContainText(/0[12]:\d\d/)
  await expect(page).toHaveURL(/\/app\/session\?.*from=sdvg/)
  // финал первой сессии ведёт на «Когда повторим завтра?», а не сразу домой
  await page.getByRole('button', { name: 'Закончить раньше' }).click()
  await expect(page.getByRole('link', { name: 'Дальше', exact: true })).toHaveAttribute('href', /\/sdvg-test\/dalshe\?t=M&s=study/, { timeout: 15000 })
  const next = await page.request.get('/sdvg-test/dalshe?t=M&s=study')
  expect(next.status()).toBe(200)
  await page.goto('/sdvg-test/dalshe?t=M&s=study')
  await expect(page.getByText('Когда повторим завтра?')).toBeVisible()
  await page.getByRole('radio', { name: 'вечером' }).click()
  await expect(page.getByText('Когда вечером, я открываю Напарника на 2 минуты.')).toBeVisible()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
})

test('пересланный тип: только тип, карточка ссылки — картинка типа', async ({ page }) => {
  await page.goto('/sdvg-test/tip/poslednyaya-noch')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Мастер последней ночи')
  await expect(page.getByText('из 24')).toHaveCount(0)
  const og = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(og).toContain('/og/sdvg-poslednyaya-noch.png')
  expect((await page.request.get('/og/sdvg-poslednyaya-noch.png')).status()).toBe(200)
})

test('страница метода и «Где пройти очную диагностику»', async ({ page }) => {
  await page.goto('/sdvg-test/metod#vrach')
  await expect(page.getByRole('heading', { name: 'Где пройти очную диагностику' })).toBeVisible()
})

test('обязательная ссылка на авторов из лицензии NYU — на тесте и на странице метода', async ({ page }) => {
  const required = 'The ASRS v1.1 Screener was created by Dr. Lenard Adler of NYU and Dr. Ronald Kessler of Harvard.'
  await page.goto('/sdvg-test')
  await expect(page.getByText(required)).toBeVisible()
  await page.goto('/sdvg-test/metod')
  await expect(page.getByText(required)).toBeVisible()
})

test('блокнот на вопросах ВОЗ одинаковый при любом ответе — кот не подсказывает «хороший» ответ', async ({ page }) => {
  async function notebookAfterFirst(nth: number) {
    await page.goto('/sdvg-test')
    await page.evaluate(() => window.localStorage.clear())
    await page.goto('/sdvg-test')
    await page.getByRole('button', { name: 'Начать' }).click()
    await page.getByRole('radio', { name: 'Да' }).click()
    await page.getByRole('button', { name: 'Дальше' }).click()
    await answer(page, nth)
    return page.getByRole('img', { name: 'Блокнот Напарника' }).innerHTML()
  }
  const never = await notebookAfterFirst(0)
  const veryOften = await notebookAfterFirst(4)
  expect(never).toBe(veryOften)
  expect(never).not.toMatch(/Никогда|Очень часто|[0-4] из/)
})

test('результат: сначала «Что я записал» словами человека, потом листок ВОЗ; «Не совсем про меня» даёт выбрать', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Да' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  for (let i = 0; i < 6; i++) await answer(page, 1)
  await page.getByRole('button', { name: 'Дальше' }).click()
  await answer(page, 3) // M
  await expect(page.getByText('Тяну, пока не загорится')).toBeVisible() // записано в блокноте
  await answer(page, 3) // M
  await answer(page, 1) // H
  await answer(page, 1) // H
  await page.getByRole('radio', { name: 'Работа' }).click()
  await page.getByRole('button', { name: 'Пропустить' }).click()
  const notebook = page.getByRole('region', { name: 'Что я записал' })
  await expect(notebook).toBeVisible({ timeout: 6000 })
  await expect(notebook.getByText('«Тяну, пока не загорится»', { exact: true })).toBeVisible()
  await expect(notebook.getByText('Сильнее всего мешает: работа')).toBeVisible()
  await expect(notebook.getByText('2 из 4 ответов — про это')).toBeVisible()
  // «Что я записал» — выше листка ВОЗ
  const nbBox = await notebook.boundingBox()
  const sheetBox = await page.getByText('Листок ВОЗ').boundingBox()
  expect(nbBox!.y).toBeLessThan(sheetBox!.y)
  await expect(page.getByRole('heading', { name: 'Мастер последней ночи' })).toBeVisible()
  await page.getByRole('button', { name: 'Не совсем про меня' }).click()
  await page.getByRole('button', { name: /Охотник за интересным/ }).click()
  await expect(page.getByRole('heading', { name: 'Охотник за интересным' })).toBeVisible()
  await expect(page).toHaveURL(/[?&]o=H/)
  await expect(page.getByText('успей за 2 минуты разобрать 5 писем')).toBeVisible()
})
