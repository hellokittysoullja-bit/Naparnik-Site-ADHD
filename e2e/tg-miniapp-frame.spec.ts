import { expect, test } from '@playwright/test'

/**
 * Мини-апп в Telegram в браузере (21.11): web.telegram.org показывает мини-апп во фрейме, поэтому сайт разрешает
 * встраивание только ему (frame-ancestors в next.config.ts). Чужой сайт встроить нас по-прежнему не может.
 * Стенд отдаёт сайт с localhost, а публичной странице Chrome встраивать localhost не даёт (Local Network Access) —
 * поэтому сайт отдаётся «как в бою» по https с публичного адреса: запросы к нему пересылаются на стенд, заголовки
 * (CSP) — настоящие, со стенда.
 */
const SITE = 'https://naparnik.test'

const HASH = '#' + new URLSearchParams({ tgWebAppData: 'query_id=1', tgWebAppVersion: '8.0', tgWebAppPlatform: 'weba' }).toString()

test('Telegram в браузере (web.telegram.org) может показать сайт во фрейме, чужой сайт — нет', async ({ page, baseURL }) => {
  const frameHtml = (src: string) => `<!doctype html><html><body style="margin:0"><iframe id="f" src="${src}" style="width:390px;height:700px;border:0"></iframe>
    <script>window.__msgs=[];addEventListener('message',e=>{try{__msgs.push(JSON.parse(e.data).eventType)}catch{}})</script></body></html>`
  await page.context().route(`${SITE}/**`, async (r) => {
    const resp = await r.fetch({ url: r.request().url().replace(SITE, baseURL!) })
    await r.fulfill({ response: resp })
  })
  const src = `${SITE}/${HASH}`
  await page.route('https://web.telegram.org/k/', (r) => r.fulfill({ contentType: 'text/html', body: frameHtml(src) }))
  await page.route('https://evil.example/', (r) => r.fulfill({ contentType: 'text/html', body: frameHtml(src) }))
  await page.goto('https://web.telegram.org/k/')
  const f = page.frameLocator('#f')
  await expect(f.getByRole('link', { name: /Давай/ }).first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __msgs: string[] }).__msgs)).toEqual(expect.arrayContaining(['iframe_ready', 'web_app_expand', 'web_app_ready']))

  await page.goto('https://evil.example/')
  await page.waitForTimeout(1500)
  const inner = page.frames().find((fr) => fr.url().startsWith(SITE))
  const shown = inner ? await inner.evaluate(() => !!document.querySelector('a[href*="/app/start"]')).catch(() => false) : false
  expect(shown).toBe(false)
})
