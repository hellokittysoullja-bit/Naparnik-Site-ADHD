import { expect, test } from '@playwright/test'

// Знакомство v2 (документ владельца 10.11): ветвления, цена бездействия только из слов человека, экраны после сессии.

test('знакомство начинается сразу с первого вопроса: экрана-приветствия нет, «Что висит» — без «Деньги и документы»', async ({ page }) => {
  await page.goto('/app/start')
  await expect(page).toHaveURL(/step=1/)
  await expect(page.getByText('Привет. Я не буду тебя торопить')).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Работа / проекты' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Деньги и документы' })).toHaveCount(0)
})

test('«сколько висит»: вставка про механизм только для «месяц и дольше» и «не помню»', async ({ page }) => {
  await page.goto('/app/start?step=2&s=work')
  const insert = page.getByText('Это не лень. У людей с СДВГ мозг сильнее обычного не любит ждать награды')
  await page.getByRole('radio', { name: 'Пару дней' }).click()
  await expect(insert).toHaveCount(0)
  await page.getByRole('radio', { name: 'Месяц или дольше' }).click()
  await expect(insert).toBeVisible()
  // с пояснением остальные варианты уходят (экран помещается без прокрутки); «Другой ответ» возвращает список
  await expect(page.getByRole('radio')).toHaveCount(1)
  await page.getByRole('button', { name: 'Другой ответ' }).click()
  await page.getByRole('radio', { name: 'Не помню — давно' }).click()
  await expect(insert).toBeVisible()
})

test('«твоя цифра»: число умножает слова человека; без числа — без часов; пример документа слово в слово', async ({ page }) => {
  await page.goto('/app/start?step=6&s=work&h=month&b=fear&m=relief&c=hour')
  await expect(page.getByText('около 30 часов в месяц').first()).toBeVisible()
  await expect(page.getByText('Это твоя оценка, не наша. Я просто умножил на 30.')).toBeVisible()
  await expect(
    page.getByText(
      'Рабочая задача висит уже месяц. По твоей оценке, она забирает около часа в день — примерно 30 часов только за этот месяц. Если ничего не менять, следующий месяц возьмёт ещё столько же. Мы предлагаем вместо этого 2 минуты — прямо сейчас.',
    ),
  ).toBeVisible()
  // без числа экрана «цифра» нет: кот говорит это прямо на вопросе «сколько ест»
  await page.goto('/app/start?step=5&s=work&h=month&b=fear&m=relief&c=allday')
  await expect(page.getByText('Когда фоном весь день — это не часы, это силы.')).toBeVisible()
  await expect(page.getByText('Я просто умножил на 30.')).toHaveCount(0)
  await expect(page.getByText(/часов в месяц/)).toHaveCount(0)
})

test('шаги: «не знаю, с чего» — первым «Выписать первый шаг»; «боюсь, что плохо» — предвыбран черновик; «нет сил» — «Можно ещё меньше»', async ({ page }) => {
  await page.goto('/app/start?step=6&s=work&h=week&b=where&m=relief&c=hour')
  await expect(page.getByText('Это твоя оценка, не наша.')).toBeVisible()
  await page.waitForTimeout(600) // экран догидратирован, защита от двойного тапа не съест клик
  await page.getByRole('button', { name: 'Продолжить' }).click()
  const first = page.getByRole('radiogroup', { name: 'Первый шаг' }).getByRole('radio').first()
  await expect(first).toHaveText('Выписать первый шаг')
  await expect(first).toHaveAttribute('aria-checked', 'true')
  await page.goto('/app/start?step=6&s=message&h=week&b=fear&m=relief&c=hour')
  await expect(page.getByText('Это твоя оценка, не наша.')).toBeVisible()
  await page.waitForTimeout(600) // экран догидратирован, защита от двойного тапа не съест клик
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByRole('radio', { name: 'Написать черновик ответа (не отправлять)' })).toHaveAttribute('aria-checked', 'true')
  await page.goto('/app/start?step=6&s=home&h=week&b=tired&m=relief&c=hour')
  await expect(page.getByText('Это твоя оценка, не наша.')).toBeVisible()
  await page.waitForTimeout(600) // экран догидратирован, защита от двойного тапа не съест клик
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByText(/Можно ещё меньше\./)).toBeVisible()
  // «Подскажи» — под полем «Своё…»: подставляет шаг из списка
  await page.getByRole('radio', { name: 'Своё дело…' }).click()
  await page.getByRole('button', { name: 'Подскажи' }).click()
  await expect(page.getByRole('textbox', { name: 'Свой первый шаг' })).toHaveValue('Собрать 10 вещей на место')
})

test('после первой сессии: «Как было?» → сохранить остров (честно) → «Когда завтра?» → прогноз → календарь → Дом', async ({ page }) => {
  await page.goto('/app/start/after?m=relief&b=fear&s=work')
  await expect(page.getByText('Ты начал(а). Это самое трудное — и это уже позади. Как было?')).toBeVisible()
  await page.getByRole('radio', { name: 'Не получилось' }).click()
  await expect(page.getByText('Ты сел(а) рядом и попробовал(а). Это тоже шаг. Завтра — шаг ещё меньше.')).toBeVisible()
  await expect(page.getByText('Ты — человек, который начинает.')).toBeVisible()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  // сохранение: бота пока нет — кот не изображает сохранение
  await page.getByRole('radio', { name: 'Сохранить через Telegram' }).click()
  await expect(page.getByText('Сохранение в Telegram скоро появится. Пока остров хранится на этом устройстве.')).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()
  await page.getByRole('radio', { name: /Вечером/ }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByText('Получится завтра вечером?')).toBeVisible()
  await page.getByRole('radio', { name: 'Попробую' }).click()
  await expect(page.getByText('Попробовать — уже план.')).toBeVisible()
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Добавить в календарь' }).click()])
  const ics = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8')
  expect(ics).toMatch(/DTSTART:\d{8}T190000/)
  await page.getByRole('button', { name: 'В мой дом' }).click()
  await expect(page).toHaveURL(/\/app(\?|$)/)
})

test('финал первой сессии из знакомства ведёт на «Как было?», а не сразу домой', async ({ page }) => {
  await page.goto('/app/start?step=9&s=work&h=week&b=fear&m=relief&c=hour&f=1')
  const hold = page.getByRole('button', { name: 'Начать первую сессию' })
  await hold.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/app\/session\?.*from=onb/)
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Закончить раньше' }).click()
  await expect(page.getByRole('link', { name: 'Дальше', exact: true })).toHaveAttribute('href', /\/app\/start\/after\?m=relief&b=fear&s=work/, { timeout: 15000 })
})

// iPhone владельца (11.11): после удержания кнопка навсегда оставалась на «Поехали» — знакомство синхронизировало
// свой адрес (replaceState) посреди перехода, и Next молча отменял router.push. Держим пальцем, как человек.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`удержание «Начать» открывает сессию за секунду (${reducedMotion})`, async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion, viewport: { width: 390, height: 844 }, hasTouch: true })
    const page = await ctx.newPage()
    await page.goto('/app/start?step=7&s=home&h=month&b=fear&m=relief&c=q15')
    await page.getByRole('radiogroup', { name: 'Первый шаг' }).getByRole('radio').first().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await page.getByRole('button', { name: /Начать первые/ }).click({ timeout: 8000 })
    const hold = page.getByRole('button', { name: 'Начать первую сессию' })
    await hold.waitFor()
    await page.waitForTimeout(500)
    const box = (await hold.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1100)
    await page.mouse.up()
    await expect(page).toHaveURL(/\/app\/session\?.*from=onb/, { timeout: 1500 })
    await ctx.close()
  })
}
