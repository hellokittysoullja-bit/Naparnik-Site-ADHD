import { gzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

// Бюджет веса кода по страницам (аудит архитектуры 11.11, §6): 37 КБ постера кота месяцами ехали в общем коде на все
// страницы, и никто не заметил — проверки веса не было. Считаем то, что страница грузит обязательно: скрипты из её HTML
// (`<script src>` в /_next/static), в gzip — так же, как «First Load JS» в отчёте сборки Next. Предел — замер 11.11
// + 5 %: вырос код страницы — тест красный, и рост либо оправдан (поднять предел в том же коммите), либо это утечка.
const BUDGET_KB: Record<string, number> = {
  '/': 314, // 11.11: 299
  '/app/start': 313, // 11.11: 298
  '/app/session': 312, // 11.11: 297
  '/app': 418, // 11.11: 398
  '/app/world': 287, // 11.11: 273
  '/sdvg-test': 277, // 11.11: 263
  '/app/start/after': 317, // 11.11: 301
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
