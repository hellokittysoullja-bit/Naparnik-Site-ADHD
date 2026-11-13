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
const BUDGET_KB: Record<string, number> = {
  '/': 322, // 11.11: 299; 13.11: 318
  '/app/start': 322, // 11.11: 298; 13.11: 318
  '/app/session': 320, // 11.11: 297; 13.11: 316
  '/app': 326, // 11.11: 398; 13.11: 421 → 310 (новый Дом, чат на /app/chat)
  '/app/chat': 436, // прежний Дом с перепиской: 13.11 — 432 (421 на /app + та же перераскладка общих кусков)
  '/app/world': 297, // 11.11: 273; 13.11: 293
  '/sdvg-test': 285, // 11.11: 263; 13.11: 281
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
