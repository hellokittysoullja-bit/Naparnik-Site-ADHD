import { expect, test } from '@playwright/test'
import { collectErrors, seedStarts } from './helpers'

/** Отметка на каждом документе: был ли лендинг/знакомство видим хоть в одном кадре до ухода домой */
async function watchPaint(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const path = location.pathname
    if (path === '/app') return
    // «мелькнул» = в каком-то кадре до ухода был виден сам экран (его <main>), а не только фон сайта
    let frames = 0
    const tick = () => {
      const visible = getComputedStyle(document.documentElement).visibility !== 'hidden'
      if (visible && document.querySelector('main')) sessionStorage.setItem('painted:' + path, 'true')
      if (++frames < 120) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

test('вернувшийся открывает лендинг — сразу дома, лендинг не мелькает, «назад» не возвращает на него', async ({ page }) => {
  await seedStarts(page, 5)
  await watchPaint(page)
  const errors = collectErrors(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('Следующий старт вырастит')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('painted:/'))).not.toBe('true')
  expect(errors).toEqual([])
})

test('вернувшийся открывает знакомство — сразу дома, первый вопрос не мелькает', async ({ page }) => {
  await seedStarts(page, 2)
  await watchPaint(page)
  await page.goto('/app/start')
  await expect(page).toHaveURL(/\/app$/)
  expect(await page.evaluate(() => sessionStorage.getItem('painted:/app/start'))).not.toBe('true')
})

test('новичок остаётся на лендинге; ?intro=1 показывает лендинг и вернувшемуся', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Сдвинем')
  await expect(page).toHaveURL(/\/$/)

  const other = await context.newPage()
  await seedStarts(other, 3)
  await other.goto('/?intro=1')
  await expect(other.getByRole('heading', { level: 1 })).toContainText('Сдвинем')
})

test('после визита в /app сервер сам уводит с лендинга и знакомства домой (без загрузки лендинга)', async ({ page, context }) => {
  await seedStarts(page, 3)
  await page.goto('/app')
  await expect(page.getByText('Следующий старт вырастит')).toBeVisible()
  const cookie = (await context.cookies()).find((c) => c.name === 'naparnik_home')
  expect(cookie?.value).toBe('1')
  for (const path of ['/', '/app/start']) {
    const res = await page.request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(307)
    expect(res.headers()['location'], path).toBe('/app')
  }
  expect((await page.request.get('/?intro=1', { maxRedirects: 0 })).status()).toBe(200)
})

test('без стартов метки нет — сервер лендинг не трогает', async ({ page, context }) => {
  await page.goto('/app')
  await expect(page.getByText('Первый старт за 15 минут')).toBeVisible()
  expect((await context.cookies()).find((c) => c.name === 'naparnik_home')).toBeUndefined()
  expect((await page.request.get('/', { maxRedirects: 0 })).status()).toBe(200)
})
