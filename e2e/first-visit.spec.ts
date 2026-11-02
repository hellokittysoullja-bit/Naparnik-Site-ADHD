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
  // кот договорил — главная кнопка теплеет (отдельной «Пойдём попробуем» больше нет)
  await expect(page.locator('#hero-cta a[data-warm]')).toBeVisible({ timeout: 8000 })
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => (window as unknown as { __late: number }).__late)).toBeLessThan(0.01)
})

test('лендинг на медленном телефоне: кот появляется сразу на своём месте и не прыгает', async ({ page, context }) => {
  // медленная сеть + CPU ×4: HTML приходит порциями — раньше в кадр попадала половина колонки, и кот стоял посередине
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.12e6, uploadThroughput: 94e3 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    const w = window as unknown as { __ys: number[] }
    w.__ys = []
    const tick = () => {
      const sec = document.querySelector('.grain-hero')
      const cat = document.querySelector('.cat-doll')
      if (sec && cat && getComputedStyle(sec).visibility === 'visible') w.__ys.push(Math.round(cat.getBoundingClientRect().y))
      if (performance.now() < 3500) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto('/')
  await page.waitForTimeout(3600)
  const ys = await page.evaluate(() => (window as unknown as { __ys: number[] }).__ys)
  expect(ys.length).toBeGreaterThan(0)
  expect(new Set(ys).size, `позиции кота по кадрам: ${[...new Set(ys)].join(', ')}`).toBe(1)
})

test('холм под котом не закрывает заголовок и диалог в любом движке (порядок — z-index, не order флекса)', async ({ page }) => {
  // Safari рисует слои по порядку в коде, а не по `order` флекса: заголовок стоит в коде раньше колонки кота,
  // и на iPhone холм закрывал его целиком (02.11). Chrome это не воспроизводит — проверяем само правило:
  // всё, что холм перекрывает, поднято явным z-index выше холма.
  await page.setViewportSize({ width: 390, height: 664 })
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const result = await page.evaluate(() => {
    const zOf = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.zIndex !== 'auto' && cs.position !== 'static') return Number(cs.zIndex)
      }
      return 0
    }
    const knoll = document.querySelector('svg[viewBox="0 0 800 500"]')!
    const k = knoll.getBoundingClientRect()
    const overlaps = (r: DOMRect) => r.left < k.right && r.right > k.left && r.top < k.bottom && r.bottom > k.top
    const h1 = document.querySelector('h1')!
    const chat = document.querySelector('.glass-hearthside')!
    return {
      knollZ: zOf(knoll),
      h1: { z: zOf(h1), overlaps: overlaps(h1.getBoundingClientRect()) },
      chat: { z: zOf(chat), overlaps: overlaps(chat.getBoundingClientRect()) },
    }
  })
  for (const part of [result.h1, result.chat]) {
    expect(part.overlaps).toBe(true)
    expect(part.z).toBeGreaterThan(result.knollZ)
  }
})

test('фон-видео: в разметке только ролик своей раскладки (Safari не учитывает media у <source> видео)', async ({ page }) => {
  // На iPhone Safari брал первый <source> — широкий компьютерный кадр — и растягивал его на телефон (02.11).
  for (const [width, height, variant] of [[390, 844, 'portrait'], [1440, 900, 'landscape']] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const video = page.locator('video')
    await expect(video).toHaveCount(1, { timeout: 10_000 })
    const srcs = await video.locator('source').evaluateAll((els) => els.map((e) => e.getAttribute('src') ?? ''))
    expect(srcs.length).toBeGreaterThan(0)
    for (const s of srcs) expect(s).toContain(`night-${variant}.`)
  }
})

test('переходы знакомства без чужих кадров: нет нижнего меню и нет экрана выбора шага перед автостартом', async ({ page }) => {
  // каждый кадр: видно ли нижнее меню и не мелькнул ли экран выбора шага Фокуса (было: ~0,15 с «Шаг уже выбран»
  // и полный сетап перед хореографией старта; меню «Дом/Фокус/Мир» в первом кадре знакомства)
  await page.addInitScript(() => {
    const w = window as unknown as { __seen: string[] }
    w.__seen = []
    const tick = () => {
      const nav = document.querySelector('nav[aria-label="Основная навигация"]')
      if (nav) {
        const r = nav.getBoundingClientRect()
        const s = getComputedStyle(nav)
        if (s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.top < window.innerHeight - 4) w.__seen.push('nav ' + location.pathname)
      }
      if (location.pathname === '/app/session' && document.body.innerText.includes('выбери первый шаг')) w.__seen.push('setup')
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto('/?intro=1')
  await page.getByRole('link', { name: /Давай/ }).first().click()
  await expect(page).toHaveURL(/\/app\/start/)
  for (let step = 0; step < 3; step++) {
    await page.getByRole('radiogroup').getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Продолжить' }).click()
  }
  const hold = page.getByRole('button', { name: /Удерживай|Начать|старт/i }).last()
  await hold.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('timer')).toBeVisible({ timeout: 10_000 })
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen)
  expect([...new Set(seen)]).toEqual([])
})

test('знакомство без JS: нижнего меню нет уже в HTML', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.goto('/app/start')
  await expect(page.locator('nav[aria-label="Основная навигация"]')).toHaveCount(0)
  await ctx.close()
})

// Переходы экранов (lib/view-transition.ts): кот перелетает, фон перетекает, «Иду…» — только на медленной сети
function recordTransitions() {
  const w = window as unknown as { __vt: { start: number; updated?: number; finished?: number }[]; __idu: boolean }
  w.__vt = []
  w.__idu = false
  const d = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { updateCallbackDone: Promise<void>; finished: Promise<void> } }
  const orig = d.startViewTransition?.bind(document)
  if (orig) {
    d.startViewTransition = (cb) => {
      const rec: { start: number; updated?: number; finished?: number } = { start: performance.now() }
      w.__vt.push(rec)
      const vt = orig(cb)
      vt.updateCallbackDone.then(() => (rec.updated = performance.now() - rec.start))
      vt.finished.then(() => (rec.finished = performance.now() - rec.start))
      return vt
    }
  }
  const tick = () => {
    if (document.querySelector('#hero-cta')?.textContent?.includes('Иду')) w.__idu = true
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

test('«Давай» → знакомство: один переход с полётом кота, кадр не застывает, «Иду…» не мелькает', async ({ page }) => {
  await page.addInitScript(recordTransitions)
  await page.goto('/?intro=1', { waitUntil: 'load' })
  await page.waitForTimeout(1500) // маршрут знакомства предзагружен ссылкой
  await page.getByRole('link', { name: /Давай/ }).first().click()
  await expect(page).toHaveURL(/\/app\/start/)
  await page.waitForTimeout(1200)
  const { vt, idu } = await page.evaluate(() => {
    const w = window as unknown as { __vt: { updated?: number; finished?: number }[]; __idu: boolean }
    return { vt: w.__vt, idu: w.__idu }
  })
  expect(vt).toHaveLength(1)
  // потолок заморозки 0,6 с (lib/view-transition.ts) + запас на загруженную машину CI; обычно ~0,07 с
  expect(vt[0].updated).toBeLessThanOrEqual(700)
  expect(vt[0].finished).toBeLessThan(1600)
  expect(idu).toBe(false)
  // ночное небо осталось фоном знакомства
  await expect(page.locator('main[data-vt-arrived="onb"]')).toBeVisible()
})

test('знакомство: кот — один и тот же на всех шагах (не пересоздаётся), имя перехода у одного элемента', async ({ page }) => {
  await page.goto('/app/start')
  await expect(page.getByRole('radiogroup')).toBeVisible()
  await page.evaluate(() => ((window as unknown as { __cat: Element | null }).__cat = document.querySelector('.vt-cat')))
  for (let step = 0; step < 3; step++) {
    await page.getByRole('radiogroup').getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await page.waitForTimeout(900) // уход/въезд ответов и переезд кота
    const same = await page.evaluate(() => {
      const cats = document.querySelectorAll('.vt-cat')
      return cats.length === 1 && cats[0] === (window as unknown as { __cat: Element | null }).__cat
    })
    expect(same, `шаг ${step + 2}`).toBe(true)
  }
  await expect(page.getByRole('button', { name: 'Начать первую сессию' })).toBeVisible()
})

test('reduced-motion: без анимации перехода, но «Давай» ведёт в знакомство', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await page.addInitScript(recordTransitions)
  await page.goto('/?intro=1', { waitUntil: 'load' })
  await page.getByRole('link', { name: /Давай/ }).first().click()
  await expect(page).toHaveURL(/\/app\/start/)
  expect(await page.evaluate(() => (window as unknown as { __vt: unknown[] }).__vt.length)).toBe(0)
  await ctx.close()
})

for (const [w, h] of [[360, 640], [390, 844], [1280, 720]] as const) {
  test(`ответ на лендинге ${w}×${h}: ничего не уходит под «Давай» и за верх экрана`, async ({ browser }) => {
    // раньше ответ добавлял ~220 px: кот уходил за верх (уши обрезаны), пометка и «Пойдём попробуем» — под кнопку
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const page = await ctx.newPage()
    await page.goto('/?intro=1')
    await page.waitForTimeout(2500)
    await page.getByRole('button', { name: /откладываю/i }).click()
    await expect(page.locator('#hero-cta a[data-warm]')).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(600)
    const r = await page.evaluate(() => {
      const cta = document.querySelector('#hero-cta')!.getBoundingClientRect()
      const fixed = getComputedStyle(document.querySelector('#hero-cta')!).position === 'fixed'
      const cat = document.querySelector('button[aria-label="Погладить напарника"]')!.getBoundingClientRect()
      const h1 = document.querySelector('h1')!.getBoundingClientRect()
      // весь видимый текст диалога (реплики, пометки) — по его нижнему краю
      const live = document.querySelector('#hero [aria-live="polite"]')!
      const bottoms = [...live.querySelectorAll('p, span, a, button')]
        .filter((e) => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && e.getBoundingClientRect().height > 0 && !e.closest('[aria-hidden="true"]') })
        .map((e) => e.getBoundingClientRect().bottom)
      return { fixed, ctaTop: cta.top, catTop: cat.top, h1Top: h1.top, chatBottom: Math.max(...bottoms) }
    })
    expect(r.catTop, 'кот за верхом экрана').toBeGreaterThanOrEqual(0)
    expect(r.h1Top).toBeGreaterThanOrEqual(0)
    if (r.fixed) expect(r.chatBottom, 'текст диалога под кнопкой').toBeLessThanOrEqual(r.ctaTop)
    await ctx.close()
  })
}

test('превью ссылки и иконка «Домой»: свой адрес, настоящий кот, без 404', async ({ page, request }) => {
  await page.goto('/?intro=1')
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content')
  expect(og).toMatch(/^https:\/\/adhd-naparnik\.vercel\.app\//)
  const apple = await page.locator('link[rel="apple-touch-icon"]').first().getAttribute('href')
  expect(apple).toBeTruthy()
  expect((await request.get(apple!)).status()).toBe(200)
  expect((await request.get(new URL(og!).pathname + new URL(og!).search)).status()).toBe(200)
})

test('знакомство: шрифты карточки договора загружены заранее, до неё', async ({ page }) => {
  // раньше моноширинный надзаголовок и рукопись 400 начинали грузиться только на договоре — строки пустые 0,3 с+
  await page.goto('/app/start')
  await expect(page.getByRole('radiogroup')).toBeVisible()
  await page.waitForTimeout(1500)
  const ok = await page.evaluate(() => {
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-jetbrains-mono').split(',')[0].trim()
    return document.fonts.check(`600 11px ${mono}`, 'Твои') && document.fonts.check('400 19px Caveat', 'Тогда')
  })
  expect(ok).toBe(true)
})
