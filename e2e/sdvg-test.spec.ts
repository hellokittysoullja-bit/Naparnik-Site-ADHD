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
  await expect(page.getByRole('button', { name: 'Сдвинуть дело за 2 минуты' })).toBeVisible()
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
  await page.getByRole('button', { name: 'Сдвинуть дело за 2 минуты' }).click({ timeout: 6000 })
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
  // тип повторяется после сессии; условие человек может дописать своими словами; затем — время
  await expect(page.getByText('Для Мастера последней ночи это и есть свой маленький срок.')).toBeVisible()
  const cue = page.getByRole('textbox', { name: 'Когда именно — своими словами' })
  await expect(cue).toHaveValue('вечером')
  await cue.fill('вечером после ужина')
  await page.getByRole('radio', { name: '19:00' }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:ifThen') ?? '{}'))).toMatchObject({ when: 'вечером после ужина', time: '19:00' })
  // кнопка-обещание, бронь в календарь
  await page.getByRole('button', { name: 'Договорились' }).click()
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Добавить в календарь' }).click()])
  const ics = (await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'))
  expect(ics).toMatch(/DTSTART:\d{8}T190000/)
  expect(ics).toContain('SUMMARY:2 минуты с Напарником')
  // контакт в два шага: сначала «куда», согласие не показано и не отмечено заранее
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Почта' }).click()
  await expect(page.getByText('Сохранение на почту скоро появится')).toBeVisible()
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

test('полоса теста не пустая на первом вопросе; сначала «сделано», к концу «осталось»', async ({ page }) => {
  await page.goto('/sdvg-test')
  await page.getByRole('button', { name: 'Начать' }).click()
  await page.getByRole('radio', { name: 'Да' }).click()
  await page.getByRole('button', { name: 'Дальше' }).click()
  const bar = page.getByRole('progressbar')
  await expect(bar).toHaveAttribute('aria-valuenow', '1')
  await expect(page.getByText('уже начато: тест открыт')).toBeVisible()
  for (let i = 0; i < 3; i++) {
    await answer(page, 2)
    await expect(page).toHaveURL(new RegExp(`step=a${i + 2}`))
  }
  await expect(page.getByText('сделано 3 из 12')).toBeVisible()
  for (let i = 3; i < 6; i++) await answer(page, 2)
  await page.getByRole('button', { name: 'Дальше' }).click()
  await expect(page).toHaveURL(/step=q1/)
  await expect(page.getByText('осталось 6 — и результат')).toBeVisible()
  // полоса не обрывается перед последними экранами: сфера и имя тоже в счёте
  for (let i = 0; i < 4; i++) await answer(page, 0)
  await expect(page).toHaveURL(/step=sphere/)
  await expect(page.getByText('осталось 2 — и результат')).toBeVisible()
})

test('результат: бирки без балла, сильная сторона, свой шаг уходит в сессию', async ({ page }) => {
  await passToResult(page)
  const tags = page.getByRole('list', { name: 'Коротко' })
  await expect(tags).toHaveText(/Мастер последней ночи.*Учёба.*Шаг на 2 минуты/, { timeout: 6000 })
  await expect(tags).not.toContainText('24')
  await expect(page.getByText('Значит, срок можно поставить самому.')).toBeVisible()
  await expect(page.getByText('Подобран по твоему типу и сфере.')).toBeVisible()
  await page.getByRole('radio', { name: 'Станет спокойнее' }).click()
  await expect(page.getByText('«Станет спокойнее». Записал. С этого и начнём.')).toBeVisible()
  await expect(page.getByText('Откладывать — не лень.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Отправить другу в Telegram' })).toHaveAttribute('href', /t\.me\/share\/url\?url=.*poslednyaya-noch/)
  await page.getByRole('button', { name: 'Написать свой шаг' }).click()
  await page.getByRole('textbox', { name: 'Написать свой шаг' }).fill('Открыть лекцию 5')
  await page.getByRole('button', { name: 'Сдвинуть дело за 2 минуты' }).click()
  await expect(page.getByText('Открыть лекцию 5')).toBeVisible()
})

test('пересланный тип говорит о человеке, а не о тесте', async ({ page }) => {
  await page.goto('/sdvg-test/tip/poslednyaya-noch')
  await expect(page.getByText('«включаюсь, когда уже горит»')).toBeVisible()
})

test('первый экран: кот как на лендинге, засыпает и радуется нажатию; кнопка внизу, лишних строк нет', async ({ page }) => {
  await page.clock.install()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sdvg-test')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Тест на СДВГ')
  await expect(page.getByText('Что тебе мешает начинать дела?').first()).toBeVisible()
  await expect(page.getByText('Ответы считаются в твоём браузере')).toHaveCount(0)
  await expect(page.getByText('Это самопроверка, а не диагноз')).toHaveCount(0)
  await expect(page.getByText('Тест бесплатный')).toHaveCount(0)
  // кот — тот же размер, что на лендинге (clamp(141px, 33dvh, 262px)): на 844 px высоты это 262 px; и над заголовком по центру
  const cat = page.getByRole('button', { name: 'Погладить напарника' })
  const box = (await cat.boundingBox())!
  expect(Math.round(box.width)).toBe(262)
  expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThan(2)
  const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(h1.y + 1)
  // главная кнопка — в нижней части экрана (зона большого пальца), поля 16 px
  const cta = (await page.getByRole('button', { name: 'Начать' }).boundingBox())!
  expect(cta.y + cta.height).toBeGreaterThan(844 - 24)
  expect(cta.y + cta.height).toBeLessThanOrEqual(844 - 12)
  // нажатие — радость, потом снова спокойно; 7 с без действий — засыпает; движение — просыпается
  await cat.click()
  await expect(cat).toHaveAttribute('data-mood', 'excited')
  await page.clock.fastForward(2000)
  await expect(cat).toHaveAttribute('data-mood', 'calm')
  await page.clock.fastForward(8000)
  await expect(cat).toHaveAttribute('data-mood', 'sleepy')
  await page.mouse.move(100, 100)
  await expect(cat).toHaveAttribute('data-mood', 'calm')
})

test('первый экран на маленьком телефоне 360×640: кнопка «Начать» видна без прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/sdvg-test')
  const cta = (await page.getByRole('button', { name: 'Начать' }).boundingBox())!
  expect(cta.y + cta.height).toBeLessThanOrEqual(640)
  expect(cta.y).toBeGreaterThan(300)
})

test('вопрос: «Назад» слева от полосы, кот слева от текста вопроса; «Дальше» вступления — внизу экрана', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sdvg-test?step=pre&adult=1')
  const next = (await page.getByRole('button', { name: 'Дальше' }).boundingBox())!
  expect(next.y + next.height).toBeGreaterThan(844 - 24)
  expect(next.y + next.height).toBeLessThanOrEqual(844 - 12)
  // на шаге имени — исключение: «Дальше» и «Пропустить» остаются под полем, не прижаты к низу
  await page.goto('/sdvg-test?step=name&adult=1&l=MMHM&s=study#a=222222')
  const input = (await page.getByRole('textbox').boundingBox())!
  const nameNext = (await page.getByRole('button', { name: 'Дальше' }).boundingBox())!
  expect(nameNext.y).toBeGreaterThan(input.y)
  expect(nameNext.y).toBeLessThan(input.y + input.height + 80)
  await expect(page.getByRole('button', { name: 'Пропустить' })).toBeVisible()
  await page.goto('/sdvg-test?step=a1&adult=1')
  const back = (await page.getByRole('button', { name: /Назад/ }).boundingBox())!
  const bar = (await page.getByRole('progressbar').boundingBox())!
  const q = (await page.getByRole('heading', { level: 2 }).boundingBox())!
  const cat = (await page.getByRole('heading', { level: 2 }).locator('xpath=../preceding-sibling::div').boundingBox())!
  // «Назад» — у левого края и на одной линии с полосой, полоса правее «Назад»
  expect(back.x).toBeLessThan(24)
  expect(bar.x).toBeGreaterThan(back.x + back.width)
  expect(Math.abs(back.y + back.height / 2 - (bar.y + bar.height / 2))).toBeLessThan(4)
  // кот слева от текста вопроса, текст мельче прежних 20 px
  expect(cat.x + cat.width).toBeLessThanOrEqual(q.x + 1)
  expect(await page.getByRole('heading', { level: 2 }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeLessThan(20)
})
