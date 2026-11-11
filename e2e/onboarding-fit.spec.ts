import { expect, test } from '@playwright/test'

// iPhone в Safari: видимая высота ≈ 650 px (844 минус панели). Раньше список вариантов прокручивался внутри себя и
// верхний/нижний вариант обрезался жёсткой линией под котом и над кнопкой (баг владельца, 10.11). Теперь на 650 px
// не прокручивается ничего — при тех же размерах кота, текста и вариантов (сжаты только отступы).

const SCREENS = [
  ['что висит', 'step=1&s=unsure'],
  ['сколько висит + пояснение', 'step=2&s=work&h=month'],
  ['что мешает (самая длинная реплика)', 'step=3&s=work&h=week&b=where'],
  ['ради чего', 'step=4&s=work&h=month&b=fear&m=rest'],
  ['сколько ест', 'step=5&s=work&h=month&b=fear&m=relief&c=allday'],
  ['твоя цифра', 'step=6&s=work&h=month&b=fear&m=relief&c=hour'],
  ['первый шаг, «не знаю, с чего»', 'step=7&s=message&h=week&b=where&m=relief&c=hour&f=0'],
  ['первый шаг, «нет сил»', 'step=7&s=message&h=week&b=tired&m=relief&c=hour&f=0'],
  ['план', 'step=8&s=message&h=month&b=fear&m=rest&c=hour&f=0'],
  ['договор', 'step=9&s=work&h=month&b=phone&m=relief&c=hour&f=1'],
] as const

for (const [name, query] of SCREENS) {
  test(`знакомство «${name}» на 390×650: ничего не прокручивается, всё над кнопкой`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 650 })
    await page.goto(`/app/start?${query}`)
    await expect(page.locator('section')).toBeVisible()
    await page.waitForTimeout(1300)
    const over = await page.evaluate(() => {
      const s = document.querySelector('section')!
      const groups = [...document.querySelectorAll('[role=radiogroup]')].map((g) => g.scrollHeight - g.clientHeight)
      return { section: s.scrollHeight - s.clientHeight, inner: Math.max(0, ...groups) }
    })
    expect(over.section).toBeLessThanOrEqual(0)
    expect(over.inner).toBeLessThanOrEqual(1)
  })
}

test('размеры не уменьшены на низком экране: кот 104 px, варианты от 56 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 650 })
  await page.goto('/app/start?step=3&s=work&h=week&b=where')
  await expect(page.getByRole('radiogroup', { name: 'Что мешает начать' })).toBeVisible()
  const sizes = await page.evaluate(() => ({
    cat: Math.round(document.querySelector('.vt-cat')!.getBoundingClientRect().width),
    option: Math.round(document.querySelector('[role=radio]')!.getBoundingClientRect().height),
  }))
  expect(sizes.cat).toBeGreaterThanOrEqual(104)
  expect(sizes.option).toBeGreaterThanOrEqual(56)
})

test('совсем низкий экран 390×568: если не помещается, прокручивается весь блок, а не список', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 })
  await page.goto('/app/start?step=4&s=work&h=month&b=fear&m=relief')
  await expect(page.getByRole('radiogroup', { name: 'Ради чего' })).toBeVisible()
  await page.waitForTimeout(1200)
  const inner = await page.getByRole('radiogroup', { name: 'Ради чего' }).evaluate((el) => el.scrollHeight - el.clientHeight)
  expect(inner).toBeLessThanOrEqual(1)
  await page.evaluate(() => {
    const s = document.querySelector('section')!
    s.scrollTop = s.scrollHeight
  })
  await page.waitForTimeout(200)
  const gap = await page.evaluate(() => {
    const last = [...document.querySelectorAll('[role=radio]')].pop()!.getBoundingClientRect()
    const cta = document.querySelector('.thumb-cta button')!.getBoundingClientRect()
    return cta.top - last.bottom
  })
  expect(gap).toBeGreaterThanOrEqual(4)
})

test('«сколько ест» без числа: экрана «твоя цифра» нет — кот отвечает прямо на вопросе, дальше сразу шаг', async ({ page }) => {
  await page.goto('/app/start?step=5&s=work&h=month&b=fear&m=relief')
  await page.waitForTimeout(800)
  await page.getByRole('radio', { name: 'Весь день фоном' }).click()
  await expect(page.getByText('Когда фоном весь день — это не часы, это силы.')).toBeVisible()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page).toHaveURL(/step=7/)
  await expect(page.getByRole('radiogroup', { name: 'Первый шаг' })).toBeVisible()
  // и по ссылке на «цифру» без числа — тоже сразу шаг, не пустой экран
  await page.goto('/app/start?step=6&s=work&h=month&b=fear&m=relief&c=unknown')
  await expect(page).toHaveURL(/step=7/)
})

test('кот откликается на каждый выбор: «сколько ест» с числом и выбор шага', async ({ page }) => {
  await page.goto('/app/start?step=5&s=work&h=month&b=fear&m=relief')
  await page.waitForTimeout(800)
  await page.getByRole('radio', { name: 'Около часа' }).click()
  await expect(page.getByText(/Записал\. Сейчас/)).toBeVisible()
  await page.goto('/app/start?step=7&s=work&h=week&b=fear&m=relief&c=hour&f=0')
  await page.waitForTimeout(800)
  await page.getByRole('radio', { name: 'Выписать первый шаг' }).click()
  await expect(page.getByText(/Беру: «Выписать первый шаг»/)).toBeVisible()
})

test('ссылка на середину знакомства (перезагрузка, «Открыть в Safari»): первый вопрос не мелькает ни на кадр', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __flash: number }
    w.__flash = 0
    const tick = () => {
      const g = document.querySelector('[role=radiogroup][aria-label="Что висит"]')
      if (g && getComputedStyle(g).visibility !== 'hidden' && g.getBoundingClientRect().height > 0) w.__flash += 1
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.goto('/app/start?step=3&s=work&h=week&b=where')
  await expect(page.getByRole('radiogroup', { name: 'Что мешает начать' })).toBeVisible()
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => (window as unknown as { __flash: number }).__flash)).toBe(0)
})

// На ночном небе-видео (лендинг, знакомство) стекло без backdrop-filter: под ним гладкое тёмное небо, кадр тот же
// (разница 0,00–0,03 из 255), а Safari размывал фон заново на каждом кадре видео и «выпрыгивания» пузыря (11.11)
test('лендинг и знакомство: стекло без размытия фона', async ({ page }) => {
  for (const url of ['/?intro=1', '/app/start?step=2&s=work&h=month', '/app/start?step=9&s=work&h=week&b=fear&m=relief&c=hour&f=0']) {
    await page.goto(url)
    await page.locator('.glass-hearthside').first().waitFor()
    const blurred = await page.evaluate(() =>
      [...document.querySelectorAll('*')].filter((e) => {
        const s = getComputedStyle(e)
        return (s.backdropFilter && s.backdropFilter !== 'none') || ((s as unknown as Record<string, string>).webkitBackdropFilter ?? 'none') !== 'none'
      }).length,
    )
    expect(blurred, url).toBe(0)
  }
})
