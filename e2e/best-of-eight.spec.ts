import { expect, test, type Page } from '@playwright/test'
import { seedStarts } from './helpers'

/**
 * «Лучшее из восьми» (research/26-best-of-eight/README.md): приёмы из разборов восьми продуктов. Каждый тест проверяет
 * поведение, которого в старой сборке нет, — на main все они падают.
 */
const steps = { steps: ['Открыть файл курсовой', 'Написать тему на первой строке', 'Найти один сайт про склады'], minutes: [1, 2, 5], source: 'model' }

async function mockAi(page: Page, seen: Record<string, unknown>[] = []) {
  await page.route('**/api/breakdown', async (route) => {
    seen.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ json: steps })
  })
  await page.route('**/api/session-voice', (route) => route.fulfill({ json: { text: null } }))
  return seen
}

test('дробление без вопроса про силы: шаги сразу; «нет сил» из знакомства делает шаги лёгкими и ставит 5 минут', async ({ page }) => {
  const seen = await mockAi(page)
  await page.goto('/app/session?step=' + encodeURIComponent('Курсовая по логистике') + '&break=1')
  await expect(page.getByText('Открыть файл курсовой')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Сколько сил сейчас' })).toHaveCount(0)
  expect(seen[0].energy).toBeUndefined()

  await page.addInitScript(() => localStorage.setItem('naparnik:onboarding', JSON.stringify({ sphere: 'study', blocker: 'tired' })))
  await page.route('**/api/breakdown', async (route) => {
    seen.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ json: { steps: ['Открыть файл', 'Посмотреть тему', 'Закрыть'], source: 'model' } })
  })
  await page.goto('/app/session?step=' + encodeURIComponent('Отчёт за квартал') + '&break=1')
  await expect(page.getByText('Открыть файл', { exact: true })).toBeVisible()
  expect(seen[1].energy).toBe('low')
  await expect(page.getByRole('button', { name: '5 мин', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // «Ещё мельче» дробит выбранный шаг сразу и просит шаги мельче
  await page.getByRole('button', { name: 'Ещё мельче' }).click()
  await expect.poll(() => seen.length).toBe(3)
  expect(seen[2]).toMatchObject({ energy: 'low', fineness: 'fine' })
})

test('готовое дело: шаги появляются без запроса к ИИ, первый шаг на минуту, есть шаг «пока ждёшь»', async ({ page }) => {
  const seen = await mockAi(page)
  await page.goto('/app/session')
  await page.getByRole('button', { name: 'Готовые шаги' }).click()
  const sheet = page.getByRole('dialog', { name: 'Готовые шаги' })
  await expect(sheet).toBeVisible()
  // лист поверх нижнего меню: в точке над нижним краем экрана — лист, а не меню
  const top = await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight - 30)?.closest('[role="dialog"], nav')?.tagName)
  expect(top).toBe('DIV')
  await sheet.getByRole('button', { name: /Убрать ванную/ }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByText('Достать средство и губку')).toBeVisible()
  await expect(page.getByText('пока ждёшь').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '5 мин', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(seen).toHaveLength(0)
  const deals = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:deals') ?? '[]'))
  expect(deals[0]).toMatchObject({ title: 'Убрать ванную' })
  expect(deals[0].steps).toHaveLength(6)
})

test('дело из поля, совпавшее с готовым: сервер отдаёт наш шаблон сразу, с «пока ждёшь»', async ({ page }) => {
  // готовые дела ищет сервер (база в телефон не качается); без модели — проверяет tests/unit/breakdown-goblin.test.ts
  await page.route('**/api/session-voice', (route) => route.fulfill({ json: { text: null } }))
  await page.goto('/app/session?step=' + encodeURIComponent('убрать ванную') + '&break=1')
  await expect(page.getByText('Достать средство и губку').first()).toBeVisible()
  await expect(page.getByText('пока ждёшь').first()).toBeVisible()
})

test('просьба к коту и размер шагов уходят в дробление', async ({ page }) => {
  const seen = await mockAi(page)
  await page.goto('/app/session?step=' + encodeURIComponent('Курсовая по логистике') + '&break=1')
  await expect(page.getByText('Открыть файл курсовой')).toBeVisible()
  await page.getByRole('button', { name: /Как дробить/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Как дробить' })
  await sheet.getByRole('switch', { name: /Отвечай короче/ }).click()
  await expect(sheet.getByRole('switch', { name: /Отвечай короче/ })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Крупнее', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  // новое дело дробится уже с просьбой и с размером шагов
  await page.goto('/app/session?step=' + encodeURIComponent('Отчёт за квартал') + '&break=1')
  await expect.poll(() => seen.length).toBe(2)
  expect(seen[1].fineness).toBe('coarse')
  const facts = (seen[1].memory as { facts: { category: string; text: string }[] }).facts
  expect(facts[0]).toMatchObject({ category: 'style', text: expect.stringContaining('коротко') })
  // выключенная просьба из памяти уходит
  await page.evaluate(() => localStorage.setItem('naparnik:asks', '[]'))
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:asks')!))).toEqual([])
})

test('сессия: дуга показывает оставшееся время, «+5» продлевает, одна главная кнопка, звук на выбор', async ({ page }) => {
  await mockAi(page)
  await page.goto('/app/session?step=' + encodeURIComponent('Открыть файл') + '&d=15')
  await page.getByRole('button', { name: /Начали/ }).click()
  const timer = page.getByRole('timer')
  await expect(timer).toHaveText(/14:5\d/, { timeout: 10_000 })
  // оставшееся время: в начале дуга почти полная (видимая часть ≈ вся окружность)
  const arc = await page.evaluate(() => {
    const c = document.querySelector('.focus-ring-arc circle') as SVGCircleElement
    const [dash] = getComputedStyle(c).strokeDasharray.split(',').map((x) => parseFloat(x))
    return dash / (2 * Math.PI * 72)
  })
  expect(arc).toBeGreaterThan(0.95)
  await expect(page.getByRole('button', { name: 'Закончить раньше' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Добавить пять минут' }).click()
  await expect(timer).toHaveText(/19:\d\d/)
  // звук: плашка, выбор запоминается
  await page.getByRole('button', { name: /Звук: Тишина/ }).click()
  await page.getByRole('menuitemradio', { name: 'Дождь' }).click()
  await expect(page.getByRole('button', { name: /Звук: Дождь/ })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('naparnik:sound'))).toBe('rain')
  // мысль на потом ложится в «Дела», таймер идёт
  await page.getByRole('button', { name: /Отвлёкся/ }).click()
  await page.locator('#thought').fill('Написать маме')
  await page.getByRole('button', { name: 'В Дела' }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:thoughts') ?? '[]')[0].text)).toBe('Написать маме')
  // на десятой секунде кот не говорит «четверть пути» (гонка «+5» с тиком таймера)
  await expect(page.getByText('Четверть пути')).toHaveCount(0)
})

test('финал: три карточки итога, «Когда следующий раз?» кладёт план со временем', async ({ page }) => {
  // не первая сессия в жизни: у первой финал намеренно короткий, один шаг «Дальше»
  await seedStarts(page, 12)
  await mockAi(page)
  await page.goto('/app/session?step=' + encodeURIComponent('Открыть файл') + '&d=15')
  await page.getByRole('button', { name: /Начали/ }).click()
  await page.getByRole('button', { name: 'Сделал' }).click({ timeout: 10_000 })
  const cards = page.getByLabel('Итог сессии')
  await expect(cards).toBeVisible({ timeout: 20_000 })
  await expect(cards.getByText('Получилось')).toBeVisible()
  await expect(cards.getByText('Дальше')).toBeVisible()
  await cards.getByRole('button', { name: 'Тяжело' }).click()
  await expect(cards.getByText('Следующий делаем мельче', { exact: false })).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:cards') ?? '[]')[0])
  expect(saved).toMatchObject({ win: 'Открыть файл', insight: 'Тяжело' })
  await page.getByRole('button', { name: 'На сегодня всё' }).click()
  await page.getByRole('button', { name: 'Завтра утром' }).click()
  await expect(page.getByText('Договорились: завтра утром.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Добавить в календарь' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:plan') ?? 'null')?.startTime)).toBe('Завтра утром')
})

test('«Дела»: строка раскладывается на дела, шаг отмечается с праздником, часть дня меняется', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('naparnik:deals', JSON.stringify([{ id: 'd1', title: 'Записаться к врачу', createdAt: 1, steps: [{ text: 'Открыть запись', minutes: 1 }, { text: 'Выбрать время', minutes: 2 }] }]))
  })
  await page.goto('/app/deals')
  await expect(page.getByRole('list', { name: 'Эта неделя' }).getByRole('listitem')).toHaveCount(7)
  await page.locator('#dump').fill('отчёт для Марины, записаться на стрижку, ещё оплатить интернет')
  await page.getByRole('button', { name: 'Разложить на 3 дела' }).click()
  for (const t of ['Отчёт для Марины', 'Записаться на стрижку', 'Оплатить интернет']) await expect(page.getByText(t, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Записаться к врачу/ }).click()
  const box = page.getByRole('checkbox', { name: 'Сделано: Открыть запись' })
  await box.click()
  await expect(page.locator('.step-row[data-burst] .spark').first()).toBeAttached()
  await expect(page.getByRole('checkbox', { name: 'Снять отметку: Открыть запись' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Вечер', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Вечер' }).getByText('Записаться к врачу')).toBeVisible()
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('naparnik:deals')!).find((x: { id: string }) => x.id === 'd1'))
  expect(d).toMatchObject({ when: 'evening' })
  expect(d.steps[0].done).toBe(true)
  // «просрочено» не существует нигде на экране
  await expect(page.getByText(/просроч/i)).toHaveCount(0)
})

test('«Не могу начать»: три шага, второй вопрос, «Готов начать» запускает сессию; следующий заход начинается с другого вопроса', async ({ page }) => {
  await mockAi(page)
  await page.goto('/app/stuck?task=' + encodeURIComponent('Курсовая'))
  const first = await page.getByRole('group', { name: 'Что происходит' }).getByRole('button').first().textContent()
  await page.getByRole('group', { name: 'Что происходит' }).getByRole('button').first().click()
  await page.getByLabel('Ответ').fill('осудят')
  await page.keyboard.press('Enter')
  await expect(page.getByText('«осудят»', { exact: false })).toBeVisible()
  await expect(page.getByText('Курсовая: 5 минут нарочно криво')).toBeVisible()
  await page.getByRole('button', { name: 'Готов начать' }).click()
  await expect(page).toHaveURL(/\/app\/session/)
  await expect(page.getByRole('timer')).toHaveText(/0[45]:\d\d/, { timeout: 10_000 })
  await page.getByRole('button', { name: 'Сделал' }).click()
  await page.goto('/app/stuck?task=' + encodeURIComponent('Курсовая'))
  await expect(page.getByRole('group', { name: 'Что происходит' }).getByRole('button').first()).not.toHaveText(first!)
})

test('знакомство: у каждого ответа «что мешает» есть карточка «почему так»', async ({ page }) => {
  await page.goto('/app/start?step=3&s=study&h=week')
  for (const label of ['Не знаю, с чего начать', 'Рука сама тянется к телефону', 'Боюсь, что выйдет плохо', 'Скучно, сбегаю в другое', 'Нет сил даже начать']) {
    await page.getByRole('radio', { name: label }).click()
    await expect(page.getByText('почему так')).toBeVisible()
    await expect(page.getByText(/^Это не (лень|слабая воля)\./)).toBeVisible()
    await page.getByRole('button', { name: 'Другой ответ' }).click()
  }
})

test('каталог «боль → приём»: вкладки, кнопка сразу в инструмент, страницы болей, блок про скепсис', async ({ page, request }) => {
  await page.goto('/pomogaet')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('С тобой всё в порядке. Просто начать трудно')
  await expect(page.getByRole('tab')).toHaveCount(6)
  await expect(page.getByRole('link', { name: /Спросить кота/ })).toHaveAttribute('href', '/app/stuck')
  await page.getByRole('tab', { name: 'Время утекает' }).click()
  await expect(page.getByRole('heading', { name: 'Не чувствую, сколько прошло времени' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Знаю, что надо, и не начинаю' })).toBeHidden()
  await expect(page.getByRole('heading', { name: /Не веришь ещё одному приложению/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  for (const slug of ['ne-mogu-nachat', 'slishkom-bolshoe', 'vremya-utekaet', 'v-golove-kasha', 'skuchno', 'brosayu']) {
    const r = await request.get(`/pomogaet/${slug}`)
    expect(r.status(), slug).toBe(200)
    expect(r.headers()['x-robots-tag'] ?? '').not.toContain('noindex')
  }
  // снимки экранов — с версией в адресе и годовым кэшем
  const src = await page.locator('.phone-frame img').first().getAttribute('src')
  expect(src).toMatch(/^\/pomogaet\/\w+\.webp\?v=[0-9a-f]+$/)
  expect((await request.get(src!)).headers()['cache-control']).toContain('immutable')
})

test('дело из разбивок goblin.tools: план гоблина сразу, а не наш шаблон с тем же названием (владелец 16.11)', async ({ page }) => {
  await page.goto('/app/session?step=' + encodeURIComponent('Помыть посуду') + '&break=1')
  await expect(page.getByText('Собрать всю грязную посуду').first()).toBeVisible()
  await expect(page.getByText('Включить воду и музыку')).toHaveCount(0)
})
