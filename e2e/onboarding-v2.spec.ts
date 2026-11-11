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

test('«Подскажи» со своим делом — первый шаг от обвязки; без ответа — подсказка сферы', async ({ page }) => {
  const calls: unknown[] = []
  let answer: object = { steps: ['Открыть файл диплома', 'Написать заголовок главы', 'Сохранить'], source: 'model' }
  await page.route('**/api/breakdown', async (route) => {
    calls.push(route.request().postDataJSON())
    await route.fulfill({ json: answer })
  })
  await page.goto('/app/start?step=6&s=study&h=week&b=where&m=relief&c=hour')
  await expect(page.getByText('Это твоя оценка, не наша.')).toBeVisible()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await page.getByRole('radio', { name: 'Своё дело…' }).click()
  const field = page.getByRole('textbox', { name: 'Свой первый шаг' })
  await field.fill('написать диплом')
  await page.getByRole('button', { name: 'Подскажи' }).click()
  await expect(field).toHaveValue('Открыть файл диплома')
  // дело человека и контекст знакомства ушли в обвязку (сфера и помеха — подписи ответов, не ключи)
  expect(calls[0]).toMatchObject({ task: 'написать диплом', context: { sphere: expect.any(String), blocker: expect.any(String) } })
  // обвязка вернула заготовку — экран берёт свою подсказку сферы, а не «Открыть то, что нужно для дела»
  answer = { steps: ['Открыть то, что нужно для дела', 'x', 'y'], source: 'fallback' }
  await field.fill('сдать курсовую')
  await page.getByRole('button', { name: 'Подскажи' }).click()
  await expect(field).not.toHaveValue('сдать курсовую')
  await expect(field).not.toHaveValue('Открыть то, что нужно для дела')
  // поздний ответ не перезаписывает то, что человек успел поменять (находка независимой проверки)
  let release: () => void = () => {}
  await page.unroute('**/api/breakdown')
  await page.route('**/api/breakdown', async (route) => {
    await new Promise<void>((r) => (release = r))
    await route.fulfill({ json: { steps: ['Открыть файл курсовой', 'b', 'c'], source: 'model' } }).catch(() => {})
  })
  await field.fill('сдать курсовую')
  await page.getByRole('button', { name: 'Подскажи' }).click()
  await expect(page.getByRole('button', { name: 'Думаю…' })).toBeVisible()
  await field.fill('моё своё')
  release()
  await page.waitForTimeout(400)
  await expect(field).toHaveValue('моё своё')
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

// iPhone владельца (11.11): во время сессии фон приложения (fixed, без z-index) рисовался поверх названия дела,
// таймера и переключателей — на экране была пустота; кольцо было меньше кота; страница прокручивалась.
for (const height of [650, 844]) {
  test(`сессия из знакомства: таймер виден, кольцо вокруг кота, без прокрутки (390×${height})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height } })
    const page = await ctx.newPage()
    await page.goto('/app/start?step=9&s=home&h=month&b=fear&m=relief&c=q15&f=0')
    const hold = page.getByRole('button', { name: 'Начать первую сессию' })
    await hold.focus()
    await page.keyboard.press('Enter')
    const timer = page.getByText(/^\d\d:\d\d$/)
    await timer.waitFor({ timeout: 15000 })
    await page.waitForTimeout(1500) // въезд экрана (opacity 0 → 1)
    // текст таймера светлый: в его прямоугольнике должны быть яркие пиксели, а не тёмный фон
    const shot = (await timer.screenshot()).toString('base64')
    const bright = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) n++
      return n
    }, shot)
    expect(bright, 'светлые пиксели таймера').toBeGreaterThan(200)
    const geo = await page.evaluate(() => {
      const ring = document.querySelector('svg circle[r="72"]')!.closest('svg')!.getBoundingClientRect()
      const cat = document.querySelector('[aria-label="Напарник работает рядом"]')!.getBoundingClientRect()
      return { ring: ring.width, cat: cat.width, scroll: document.scrollingElement!.scrollHeight - innerHeight }
    })
    expect(geo.ring).toBeGreaterThanOrEqual(geo.cat + 25)
    expect(geo.scroll).toBeLessThanOrEqual(0)
    await ctx.close()
  })
}

// Владелец 11.11: «идеально симметричное с котом кольцо». Кот стоит низко в своём квадрате (запас окна рисунка под уши
// и прыжки): кольцо по центру квадрата давало зазор сверху 46,5 px, снизу 10,5. Рамка силуэта в квадрате 130 — по альфе
// эталона (x 0,042–0,958, y 0,305–0,971). Без «дыхания» (reduced-motion) верх и низ различаются на сдвиг дыхания (±2 px).
test('кольцо сессии симметрично вокруг кота', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 650 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('/app/start?step=9&s=home&h=month&b=fear&m=relief&c=q15&f=0')
  await page.getByRole('button', { name: 'Начать первую сессию' }).focus()
  await page.keyboard.press('Enter')
  await page.getByText(/^\d\d:\d\d$/).waitFor({ timeout: 15000 })
  await page.waitForTimeout(800)
  const g = await page.evaluate(() => {
    const svg = document.querySelector('svg circle[r="72"]')!.closest('svg')!.getBoundingClientRect()
    const cat = document.querySelector('[aria-label="Напарник работает рядом"]')!.getBoundingClientRect()
    const R = (svg.width * 72) / 156 - (svg.width * 5) / 156 / 2
    const cx = svg.x + svg.width / 2
    const cy = svg.y + svg.height / 2
    const box = { l: cat.x + 0.042 * cat.width, r: cat.x + 0.958 * cat.width, t: cat.y + 0.305 * cat.height, b: cat.y + 0.971 * cat.height }
    return { top: box.t - (cy - R), bottom: cy + R - box.b, left: box.l - (cx - R), right: cx + R - box.r, ringTop: svg.y }
  })
  expect(Math.abs(g.top - g.bottom), JSON.stringify(g)).toBeLessThanOrEqual(6)
  expect(Math.abs(g.left - g.right), JSON.stringify(g)).toBeLessThanOrEqual(3)
  expect(Math.min(g.top, g.bottom, g.left, g.right)).toBeGreaterThan(8)
  expect(g.ringTop, 'кольцо не упирается в верх экрана').toBeGreaterThanOrEqual(12)
  await ctx.close()
})
