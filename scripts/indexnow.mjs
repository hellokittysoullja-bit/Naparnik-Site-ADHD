// IndexNow: сообщить Яндексу и Bing (а через них Seznam, Naver и др.) об адресах сайта — страницы попадают в обход за
// минуты, а не ждут, пока робот сам придёт. Google протокол не поддерживает (ему — карта сайта и Search Console).
// Ключ — файл public/<ключ>.txt с тем же текстом внутри: он доказывает, что адреса шлёт владелец сайта.
// Запуск ПОСЛЕ выкладки на сайт: node scripts/indexnow.mjs            — все адреса из живой карты сайта
//                                 node scripts/indexnow.mjs /sdvg-test — только перечисленные
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// тот же адрес, что lib/site.ts: свой домен (CANONICAL_HOST) или старый
const SITE = `https://${process.env.CANONICAL_HOST?.trim().toLowerCase() || 'adhd-naparnik.vercel.app'}`
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const keyFile = fs.readdirSync(path.join(root, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) throw new Error('нет файла ключа public/<32 hex>.txt')
const key = keyFile.slice(0, -4)

let urls = process.argv.slice(2).map((p) => new URL(p, SITE).href)
if (!urls.length) {
  const r = await fetch(`${SITE}/sitemap.xml`)
  if (!r.ok) throw new Error(`карта сайта не открылась: ${r.status}`)
  urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  if (!urls.length) throw new Error('в карте сайта нет адресов')
}
const body = JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}/${keyFile}`, urlList: urls })
for (const endpoint of ['https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow']) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body })
  // 200/202 — принято; 403 — ключ ещё не на сайте (сначала выложить); 422 — адрес не с этого сайта
  console.log(endpoint, r.status, `${urls.length} адресов`)
}
