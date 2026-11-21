import { expect, test } from '@playwright/test'

/**
 * «Полено» (владелец 16.11): после разбивки дело раскалывается на шаги поверх настоящего экрана Фокуса, потом праздник —
 * кот прыгает, конфетти на весь экран, квитанция в пузыре. Тап — сразу итог. «Уменьшить движение» — без сцены.
 * На сборке до 16.11 тест падает: сцены, штампов и квитанции не было.
 */
const url = '/app/session?step=' + encodeURIComponent('Написать курсовую') + '&break=1'

test('полено: сцена идёт поверх Фокуса, тап — сразу итог, потом конфетти и квитанция', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  // во время сцены шаги в DOM (диктор читает), но скрыты — их проявляет сцена; дело словами человека на карточке
  await expect(page.locator('[data-rv-source]')).toHaveText('Написать курсовую')
  // строка шага может быть уже видна (раскол), но её таблички — только с посадки своих кусков
  expect(await page.locator('[data-rv-step]').first().evaluate((el) => getComputedStyle(el).opacity === '0' || [...el.querySelectorAll('.wood-word')].every((w) => getComputedStyle(w).opacity === '0'))).toBe(true)
  // тап в любом месте — сразу итог
  await page.mouse.click(195, 120)
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0)
  const first = page.locator('[data-rv-step]').first()
  await expect(first).toHaveText('Выбрать тему курсовой')
  expect(await first.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
  // праздник: холст конфетти поверх всего экрана и квитанция — сколько шагов вышло
  await expect(page.locator('canvas[aria-hidden="true"]').last()).toBeAttached()
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible()
  // подаренный первый штамп
  await expect(page.getByRole('img', { name: /1 из \d+ уже есть/ })).toBeVisible()
  // слой сцены убран за собой
  await page.waitForTimeout(3500)
  expect(await page.evaluate(() => document.querySelectorAll('body > div[aria-hidden="true"][style*="z-index: 60"]').length)).toBe(0)
})

test('полено: сцена сама доходит до конца без касаний и становится короче с опытом', async ({ page }) => {
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  expect(await page.evaluate(() => localStorage.getItem('naparnik:breaks'))).toBe('1')
  // двенадцатая разбивка — сцена вдвое быстрее первой
  await page.evaluate(() => localStorage.setItem('naparnik:breaks', '11'))
  // длину сцены меряет сама страница: опрос expect идёт с шагом до 1 с, и его задержка попадала в замер
  // (на GitHub выходило 1702–1796 мс при сцене ~1,2 с)
  await page.addInitScript(() => {
    const w = window as unknown as { __rv: { on?: number; off?: number } }
    w.__rv = {}
    new MutationObserver(() => {
      const on = !!document.querySelector('[data-rv="playing"]')
      if (on && w.__rv.on === undefined) w.__rv.on = performance.now()
      if (!on && w.__rv.on !== undefined && w.__rv.off === undefined) w.__rv.off = performance.now()
    }).observe(document, { childList: true, subtree: true, attributes: true })
  })
  await page.goto(url)
  await page.waitForSelector('[data-rv="playing"]')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  const rv = await page.evaluate(() => (window as unknown as { __rv: { on: number; off: number } }).__rv)
  expect(rv.off - rv.on).toBeLessThan(1700)
})

test('полено: при «уменьшить движение» сцены нет, шаги сразу', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(url)
  await expect(page.locator('[data-rv-step]').first()).toHaveText('Выбрать тему курсовой')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0)
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible()
  await ctx.close()
})

/**
 * Запись владельца 17.11 (iPhone, 393×664): пока кот разламывал дело, полторы секунды висел экран выбора шага; потом всё
 * перестраивалось под полено; в конце кнопка старта уезжала под меню; квитанция сдвигала экран; один кусок полена был
 * тёмным. Тесты ниже падают на сборке до 17.11.
 */
const steps6 = ['Решить, что хочется поесть', 'Приготовить еду', 'Выложить еду на тарелку', 'Сесть за стол', 'Поесть спокойно', 'Убрать посуду']
const slow = (page: import('@playwright/test').Page, ms = 1500) =>
  page.route('**/api/breakdown', async (r) => {
    await new Promise((x) => setTimeout(x, ms))
    await r.fulfill({ json: { steps: steps6, source: 'library', title: 'Покушать' } })
  })
const startBox = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Начали. Я рядом' }).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })

for (const [w, h] of [[393, 664], [360, 640], [390, 844]] as const) {
  test(`полено ${w}×${h}: пока кот разламывает — полено на месте поля, длительности нет, старт неактивен; кнопка старта всё время на своём месте и над меню`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/session')
    await expect(page.getByRole('textbox', { name: 'Первый шаг' })).toBeVisible()
    const plain = await startBox(page)
    await slow(page)
    await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
    // ожидание: экрана выбора шага нет — вместо поля ждёт полено со словами человека
    await expect(page.locator('[data-rv-waitlog] svg')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Первый шаг' })).toHaveCount(0)
    const durOpacity = () => page.getByText('Длительность').evaluate((el) => getComputedStyle(el.parentElement!).opacity)
    expect(await durOpacity()).toBe('0')
    await expect(page.getByRole('button', { name: 'Начали. Я рядом' })).toBeDisabled()
    expect(await startBox(page)).toEqual(plain)
    // раскол и итог: кнопка там же, пиксель в пиксель, на КАЖДОМ кадре (мгновенный рывок тоже ловится), и не под меню
    await page.evaluate(() => {
      const w = window as unknown as { __tops: number[] }
      w.__tops = []
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Начали'))!
      const tick = () => {
        w.__tops.push(Math.round(btn.getBoundingClientRect().top))
        if (w.__tops.length < 600) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await page.waitForSelector('[data-rv="playing"]')
    await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
    const tops = await page.evaluate(() => (window as unknown as { __tops: number[] }).__tops)
    expect(tops.length).toBeGreaterThan(10)
    expect([...new Set(tops)]).toEqual([plain.top])
    await expect(page.getByRole('button', { name: 'Начали. Я рядом' })).toBeEnabled()
    // шагов много — длительность спрятана и отдала место шагам (владелец 17.11); если она есть — проявилась
    if (await page.getByText('Длительность').count()) await expect.poll(durOpacity).toBe('1')
    // все остальные шаги — списком под карточкой, целиком и над кнопкой старта; «ещё N» нет
    await expect(page.getByText(/ждут в Делах/)).toHaveCount(0)
    const rows = await page.locator('[data-rv-list] > button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().bottom)))
    expect(rows.length).toBe(h >= 640 ? 5 : rows.length)
    for (const b of rows) expect(b).toBeLessThanOrEqual(plain.top)
    expect(await startBox(page)).toEqual(plain)
    const navTop = await page.locator('nav').evaluate((el) => el.getBoundingClientRect().top)
    expect(plain.bottom).toBeLessThanOrEqual(navTop)
  })
}

test('полено: квитанция в конце ничего не сдвигает; у каждого куска свой рисунок коры (не чёрный кусок)', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 600)
  await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
  await page.waitForSelector('[data-rv="playing"]')
  await page.waitForTimeout(400)
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id^="rvBark"]')].map((e) => e.id))
  expect(ids.length).toBeGreaterThan(1)
  expect(new Set(ids).size).toBe(ids.length)
  // после раскола карточка на своём месте; реплика-квитанция её не сдвигает
  await page.waitForSelector('[data-rv-card]')
  // место карточки (сама карточка во время сцены проявляется с лёгким масштабом — меряем её место в раскладке)
  const cardTop = () => page.locator('[data-rv-card]').evaluate((el) => Math.round(el.parentElement!.getBoundingClientRect().top))
  const during = await cardTop()
  await expect(page.getByText(/Разломал на \d+ шаг/)).toBeVisible({ timeout: 4000 })
  expect(await cardTop()).toBe(during)
  // в пузыре одна реплика: «Сейчас расколю!» не остаётся рядом с квитанцией (скриншот владельца 17.11)
  await expect(page.locator('[data-rv-bubble]')).not.toContainText('расколю')
})

/**
 * Владелец 17.11: куски полена — слова шагов, и деревянные таблички остаются. Копия-табличка садится ровно на
 * настоящую — подмена в конце сцены незаметна. На сборке до 17.11 табличек не было (буквы выжигались в обычный текст).
 */
test('полено: каждое слово шага — деревянная табличка, кусок садится ровно на неё', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 300)
  // медленная сеть: файлы шрифтов приходят на 0,7 с позже. Без ожидания шрифтов сцена мерила слова в запасном шрифте, а
  // настоящий шире — заголовок переносился на вторую строку, и куски садились мимо (так падало в CI 17.11)
  await page.route(/\.woff2(\?|$)/, async (r) => {
    await new Promise((x) => setTimeout(x, 700))
    await r.continue()
  })
  await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
  await page.waitForSelector('[data-rv-card]')
  // куда сцена посадит каждую табличку-копию (место контейнера куска без сдвига анимацией) — и где после сцены стоит
  // настоящая табличка этого слова. Без перемотки анимаций: на медленной машине CI перемотка доходила не до всех кусков
  const targets = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('body > div[aria-hidden="true"] div.wood-word')].map((plate) => {
      const box = plate.parentElement!.parentElement as HTMLElement
      return { text: plate.textContent ?? '', x: parseFloat(box.style.left), y: parseFloat(box.style.top) }
    }),
  )
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 4000 })
  const real = await page.evaluate(() => {
    const lb = document.querySelector('[data-rv-list]')!.getBoundingClientRect().bottom
    return [...document.querySelectorAll<HTMLElement>('[data-rv-step] .wood-word')]
      .map((e) => ({ text: e.textContent ?? '', r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.bottom <= lb + 1)
      .map(({ text, r }) => ({ text, x: r.left, y: r.top }))
  })
  expect(real.length).toBeGreaterThan(5)
  const off = real
    .map((w) => {
      const d = Math.min(...targets.filter((t) => t.text === w.text).map((t) => Math.abs(t.x - w.x) + Math.abs(t.y - w.y)))
      return { ...w, d }
    })
    .filter((w) => !(w.d < 2))
  expect(off, 'таблички, на которые кусок сел не туда').toEqual([])
  // таблички остаются, слов столько же, сколько в шагах; подписи «первый шаг · дело» нет
  expect(await page.locator('[data-rv-step]').first().locator('.wood-word').count()).toBe(4)
  await expect(page.getByText(/первый шаг ·/i)).toHaveCount(0)
  // карточка-записка (вариант 4, владелец 17.11): печать «×N» по числу шагов, все три кнопки нажимаются — украшения их не
  // перекрывают
  await expect(page.locator('[data-rv-card] .note-seal')).toHaveText('×6')
  for (const name of ['Ещё мельче', 'Своими словами', 'Не то']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim(), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    expect(hit).toBe(name)
  }
})

test('полено: «Разломать на шаг» с Дома — следующий кадр сразу полено, кот сидит на нём', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await slow(page, 1500)
  await page.goto('/app')
  await page.fill('#home-task', 'Покушать')
  await page.evaluate(() => {
    const w = window as unknown as { __kinds: string[] }
    w.__kinds = []
    const tick = () => {
      const home = !!document.querySelector('#home-task')
      const log = !!document.querySelector('[data-rv-waitlog] svg')
      w.__kinds.push(home ? 'H' : log ? 'L' : '?')
      if (!log) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.getByRole('link', { name: 'Разломать на шаг' }).click()
  await page.waitForSelector('[data-rv-waitlog] svg')
  const kinds = (await page.evaluate(() => (window as unknown as { __kinds: string[] }).__kinds)).join('')
  // только кадры Дома, потом полено — ни одного промежуточного (наплыва, пустого экрана)
  expect(kinds).toMatch(/^H+L$/)
  // кот сидит на полене: низ кота заходит на верх полена на несколько пикселей (лапы на коре), кот поверх полена
  const g = await page.evaluate(() => {
    const cat = document.querySelector('[data-stage] .vt-cat')!.getBoundingClientRect()
    const log = document.querySelector('[data-rv-slot]')!.getBoundingClientRect()
    return { overlap: cat.bottom - log.top }
  })
  expect(g.overlap).toBeGreaterThan(4)
  expect(g.overlap).toBeLessThan(24)
})

/**
 * CI 17.11 и скриншот владельца: на узком телефоне (360 px) заголовок записки переносится на вторую строку — строка была
 * ниже таблички, и вторая строка табличек обрезалась снизу на 8 px, а куски полена летели мимо. На 320 px кнопки
 * записки обрезались («Своими слов…»). Падает на сборке до исправления.
 */
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [393, 664],
] as const) {
  test(`полено ${w}×${h}: таблички заголовка целиком, кнопки записки без обрезки`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    await page.goto('/app/session?step=' + encodeURIComponent('Покушать') + '&break=1')
    await page.waitForSelector('[data-rv-card]')
    await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 5000 })
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-rv-card]')!
      const title = card.querySelector('[data-rv-step]')!.getBoundingClientRect()
      return {
        clipped: [...card.querySelectorAll('[data-rv-step] .wood-word')].filter((e) => e.getBoundingClientRect().bottom > title.bottom + 0.5).map((e) => e.textContent),
        cut: [...card.querySelectorAll('.note-btn .truncate')].filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
      }
    })
    expect(r).toEqual({ clipped: [], cut: [] })
  })
}

/**
 * Скриншот владельца 17.11 (iPhone 393 px): шаг «Зайти в туалет и закрыть дверь» в две строки — кнопки записки уезжали
 * за пунктирную строчку на 5 px (верхний отступ ряда кнопок не помещался в карточку постоянной высоты). Падает на сборке
 * до исправления.
 */
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [393, 664],
] as const) {
  test(`полено ${w}×${h}: шаг в две строки — кнопки записки внутри строчки`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    // план из базы, но без похода на сервер: в этом файле и так много разбивок, а у /api/breakdown лимит 10 в минуту
    const steps = ['Зайти в туалет и закрыть дверь', 'Поднять крышку унитаза', 'Сделать свои дела', 'Вымыть руки с мылом и вытереть', 'Выйти из туалета']
    await page.route('**/api/breakdown', (r) => r.fulfill({ json: { steps, source: 'library', title: 'Сходить в туалет' } }))
    await page.goto('/app/session?step=' + encodeURIComponent('Сходить в туалет') + '&break=1')
    await page.waitForSelector('[data-rv-card]')
    await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 5000 })
    const r = await page.evaluate(() => {
      const card = document.querySelector('[data-rv-card]')!
      const stitch = card.getBoundingClientRect().bottom - 3 - 6 // обводка 3 px, строчка на 6 px внутри
      const two = card.querySelector('[data-rv-step]')!.getBoundingClientRect().height > 40
      // нижний край кнопки с её бортиком (4 px) не заходит на строчку
      const out = [...card.querySelectorAll('.note-btn')].filter((e) => e.getBoundingClientRect().bottom + 4 > stitch).map((e) => e.textContent)
      return { two, out }
    })
    expect(r).toEqual({ two: true, out: [] })
  })
}

/**
 * Скриншот владельца 17.11 (iPhone, Safari): «Сдела…», «Дойти д… туалета» — line-clamp у строки шага в WebKit режет
 * многоточием каждую табличку внутри неё. Line-clamp у табличек больше нет: длинный шаг переносится на вторую строку
 * табличек, слово видно целиком или не видно совсем. В стенде нет WebKit — проверяем само правило: ни у одного
 * контейнера табличек нет -webkit-line-clamp, и ни одна видимая табличка не обрезана.
 */
test('таблички шагов без line-clamp: слова целиком, длинный шаг — в две строки', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await page.goto('/app/session?step=' + encodeURIComponent('Поесть нормально') + '&break=1')
  await page.waitForSelector('[data-rv-card]')
  await expect(page.locator('[data-rv="playing"]')).toHaveCount(0, { timeout: 5000 })
  const r = await page.evaluate(() => {
    const clamped = [...document.querySelectorAll('.wood-word')].map((w) => w.parentElement!).filter((p, i, a) => a.indexOf(p) === i)
      .filter((p) => { const c = getComputedStyle(p).getPropertyValue('-webkit-line-clamp'); return c && c !== 'none' })
    const cut = [...document.querySelectorAll<HTMLElement>('.wood-word')].filter((w) => w.offsetParent && w.scrollWidth > w.clientWidth + 0.5)
    const two = [...document.querySelectorAll<HTMLElement>('[data-rv-list] [data-rv-step]')].some((s) => s.getBoundingClientRect().height > 30)
    return { clamped: clamped.length, cut: cut.length, two }
  })
  expect(r).toEqual({ clamped: 0, cut: 0, two: true })
})

/**
 * Скриншоты владельца 19.11: часть табличек вставала позже соседей («и пепельниц», «решении» полупрозрачная), вся строка
 * подменялась разом, когда садилось её последнее слово. Теперь у каждого видимого слова свой кусок, и настоящая табличка
 * показывается в кадр посадки своего куска — по порядку чтения, ровным шагом. Короткий, средний и очень длинный план.
 */
const plans: Record<string, string[]> = {
  короткий: ['Открыть', 'Начать'],
  средний: ['Выбросить сигареты и зажигалки из дома', 'Назначить конкретную дату отказа от курения', 'Запастись жвачкой или мятными конфетами против тяги', 'Избавиться от всех сигарет, зажигалок и пепельниц', 'Сообщить близким о своем решении', 'Пережить первые три дня'],
  длинный: Array.from({ length: 8 }, (_, i) => `Очень длинный шаг номер ${i + 1} про то, как спокойно разобрать все бумаги на столе и сложить их в папки по темам`),
}
for (const [name, steps] of Object.entries(plans)) {
  test(`таблички: ${name} план — каждое видимое слово встаёт в свой черёд, без отстающих`, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    await page.route('**/api/breakdown', async (r) => {
      await new Promise((x) => setTimeout(x, 600))
      await r.fulfill({ json: { steps, source: 'library', title: 'Дело' } })
    })
    await page.goto('/app/session?step=' + encodeURIComponent('Дело') + '&break=1')
    await page.waitForSelector('[data-rv="playing"]')
    await page.waitForSelector('[data-rv-card]')
    const res = await page.evaluate(() => {
      const at = (el: Element) =>
        el.getAnimations().filter((a) => a.id.startsWith('rv:')).map((a) => {
          const k = (a.effect as KeyframeEffect).getKeyframes()
          return k[0].opacity === '0' && k.at(-1)!.opacity === '1' ? +a.id.slice(3) + Number(a.effect!.getTiming().delay) : null
        }).find((x) => x !== null)
      const words = [...document.querySelectorAll('[data-rv-card] .wood-word, [data-rv-list] [data-rv-step] .wood-word')].filter((s) => {
        const r = s.getBoundingClientRect()
        const e = s.parentElement!.getBoundingClientRect()
        const l = document.querySelector('[data-rv-list]')!.getBoundingClientRect()
        return r.width > 0 && r.bottom <= e.bottom + 1 && r.right <= e.right + 1 && r.bottom <= l.bottom + 1
      })
      return words.map((w) => [w.textContent, at(w) ?? null] as const)
    })
    expect(res.length).toBeGreaterThan(1)
    // у каждого видимого слова — своя посадка
    expect(res.filter(([, t]) => t === null)).toEqual([])
    const ts = res.map(([, t]) => t as number)
    const steps2 = ts.slice(1).map((t, i) => t - ts[i])
    // по порядку чтения и ровным шагом: ни одно слово не встаёт раньше предыдущего и не отстаёт больше чем на шаг каскада
    expect(Math.min(...steps2)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...steps2) - Math.min(...steps2)).toBeLessThanOrEqual(2)
  })
}

/** Владелец 19.11: дело с опечаткой («Поемть»), которое база узнала, на полене и дальше — правильным названием («Поесть») */
test('полено: дело с опечаткой показывается правильным названием из базы', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 664 })
  await page.route('**/api/breakdown', async (r) => {
    await new Promise((x) => setTimeout(x, 400))
    await r.fulfill({ json: { steps: ['Решить, что съесть', 'Приготовить', 'Поесть спокойно'], source: 'library', title: 'Поесть' } })
  })
  await page.goto('/app/session?step=' + encodeURIComponent('Поемть') + '&break=1')
  await page.waitForSelector('[data-rv="playing"]')
  await expect(page.locator('[data-rv-source]')).toHaveText('Поесть')
  await expect(page.locator('[data-rv-carve]').first()).toHaveText('Поесть')
})
