import { gzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

// Бюджет веса кода по страницам (аудит архитектуры 11.11, §6): 37 КБ постера кота месяцами ехали в общем коде на все
// страницы, и никто не заметил — проверки веса не было. Считаем то, что страница грузит обязательно: скрипты из её HTML
// (`<script src>` в /_next/static), в gzip — так же, как «First Load JS» в отчёте сборки Next. Предел — замер 11.11
// + 5 %: вырос код страницы — тест красный, и рост либо оправдан (поднять предел в том же коммите), либо это утечка.
// 13.11, Дом «Привал»: чат ушёл с Дома на /app/chat — Дом легче на 112 КБ (421 → 310). Остальные страницы выросли на
// 4–10 КБ без нового кода в них: сборщик стал класть карту версий файлов (lib/asset-versions.ts — её теперь берут и сцена
// лендинга на Доме, и кот, и шрифты) в два общих куска сразу. Это перераскладка, а не утечка кода страниц; разобрать —
// отдельной задачей. Пределы — замер 13.11 + запас как раньше.
// 14.11, оптимизация скорости: постер героя ушёл из JS в CSS лендинга и теста (/ 316 → 286, /sdvg-test 280 → 250),
// библиотека анимаций — из первого пакета экранов /app, где она не нужна сразу (/app 307 → 266, /app/world 291 → 250).
const BUDGET_KB: Record<string, number> = {
  '/': 300, // 11.11: 299; 13.11: 318; 14.11: 286
  '/app/start': 322, // 11.11: 298; 13.11: 318
  '/app/session': 320, // 11.11: 297; 13.11: 316
  '/app': 280, // 11.11: 398; 13.11: 421 → 310 (новый Дом, чат на /app/chat); 14.11: 266
  '/app/chat': 436, // прежний Дом с перепиской: 13.11 — 432 (421 на /app + та же перераскладка общих кусков)
  '/app/world': 263, // 11.11: 273; 13.11: 293; 14.11: 250
  '/sdvg-test': 263, // 11.11: 263; 13.11: 281; 14.11: 250
  '/app/start/after': 325, // 11.11: 301; 13.11: 321
}

for (const [path, kb] of Object.entries(BUDGET_KB)) {
  test(`первая загрузка JS ${path} ≤ ${kb} КБ (gzip)`, async ({ request }) => {
    const html = await (await request.get(path)).text()
    const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]*\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))]
    expect(srcs.length).toBeGreaterThan(0)
    let bytes = 0
    for (const src of srcs) bytes += gzipSync(await (await request.get(src)).body(), { level: 9 }).length
    const got = Math.round(bytes / 1024)
    expect(got, `${path}: ${got} КБ в ${srcs.length} файлах`).toBeLessThanOrEqual(kb)
  })
}

async function firstLoadScripts(request: import('@playwright/test').APIRequestContext, path: string) {
  const html = await (await request.get(path)).text()
  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]*\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))]
  return { html, code: await Promise.all(srcs.map(async (s) => (await request.get(s)).text())) }
}

// 14.11: постер героя (data-URI ~38 КБ) ехал дважды — в HTML и в JS-пакете страницы. Теперь он только в CSS лендинга
// и теста (app/hero-poster.css); в коде страницы его быть не должно.
for (const path of ['/', '/sdvg-test']) {
  test(`постер героя ${path} не в JS и не в HTML — только в CSS страницы`, async ({ request }) => {
    const { html, code } = await firstLoadScripts(request, path)
    expect(code.some((c) => c.includes('data:image/webp;base64'))).toBe(false)
    expect(html.includes('data:image/webp;base64')).toBe(false)
    expect(html).toContain('cat-poster-inline')
  })
}

// 14.11: на Доме библиотека анимаций нужна только пилюле меню, и та грузит её отдельно после загрузки страницы
test('Дом: библиотеки анимаций нет в первом пакете кода', async ({ request }) => {
  const { code } = await firstLoadScripts(request, '/app')
  expect(code.some((c) => c.includes('framerAppearId'))).toBe(false)
})

// 14.11: слои кота на Доме объявлены в HTML (иначе начинали качаться после разбора всего кода, ~3 с на 3G); на
// лендинге и в знакомстве — нет: там они отнимали сеть у кода и главного текста
test('слои куклы предзагружаются только на Доме', async ({ request }) => {
  const head = async (p: string) => (await (await request.get(p)).text()).slice(0, 20000)
  expect(await head('/app')).toMatch(/<link[^>]+rel="preload"[^>]+mascot\/doll\/rig\.json/)
  expect(await head('/app')).toMatch(/<link[^>]+rel="preload"[^>]+mascot\/doll\/body\.webp/)
  for (const p of ['/?intro=1', '/app/start']) expect(await head(p)).not.toContain('mascot/doll/')
})

// 14.11: подпись «ЧТО СЕЙЧАС ВИСИТ?» набрана моноширинным; у Google «?» и пробел лежат в латинском файле (40 КБ) —
// знаки и цифры теперь отдельным маленьким файлом, латинский Дому не нужен
test('Дом: моноширинный без латинского файла', async ({ page }) => {
  const fonts: string[] = []
  page.on('request', (r) => { if (r.url().includes('/fonts/jetbrains-mono')) fonts.push(r.url()) })
  await page.goto('/app')
  await expect(page.getByText('ЧТО СЕЙЧАС ВИСИТ?')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => fonts.some((f) => f.includes('jetbrains-mono-common'))).toBe(true)
  expect(fonts.some((f) => f.includes('jetbrains-mono-cyrillic.'))).toBe(true)
  expect(fonts.some((f) => f.includes('jetbrains-mono-latin.'))).toBe(false)
})
