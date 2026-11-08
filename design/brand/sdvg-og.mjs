// Карточки ссылки «Поделиться своим типом» (/sdvg-test/tip/<тип>): 1200×630, ТОЛЬКО тип — никогда балл и диапазон
// (research/14-lead-magnets/owner-asrs-bridge.md). Тот же кот (постер эталона) и ночь, что в design/brand/build.mjs.
// Запуск: node design/brand/sdvg-og.mjs → public/og/sdvg-<slug>.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const data = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(root, p)).toString("base64")}`;
const sky = data("public/scene/night-landscape.webp", "image/webp");
const cat = data("public/mascot/poster/neutral.webp", "image/webp");
const f = (w, s) => data(`public/fonts/manrope-${w}-${s}.woff2`, "font/woff2");
const copy = JSON.parse(fs.readFileSync(path.join(root, "content/sdvg-copy.ru.json"), "utf8"));
const SLUG = { P: "perfekcionist", H: "ohotnik", U: "utopayushchij", M: "poslednyaya-noch" };

const css = `
@font-face{font-family:M;src:url(${f(700, "cyr")}) format("woff2");font-weight:700}
@font-face{font-family:M;src:url(${f(700, "lat")}) format("woff2");font-weight:700;unicode-range:U+0000-00FF}
@font-face{font-family:M;src:url(${f(500, "cyr")}) format("woff2");font-weight:500}
@font-face{font-family:M;src:url(${f(500, "lat")}) format("woff2");font-weight:500;unicode-range:U+0000-00FF}
*{margin:0;box-sizing:border-box}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:url(${sky}) center 62%/cover;font-family:M}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,oklch(0.13 0.03 250/.85) 0%,oklch(0.13 0.03 250/.45) 55%,transparent 78%)}
.knoll{position:absolute;right:-60px;bottom:-250px;width:760px;height:380px;border-radius:50%;
 background:radial-gradient(ellipse at 50% 30%,oklch(0.24 0.03 150),oklch(0.16 0.02 160) 70%)}
.cat{position:absolute;right:46px;bottom:58px;width:420px}
.k{position:absolute;left:72px;top:150px;font:500 30px/1.2 M;color:oklch(0.85 0.02 250)}
h1{position:absolute;left:72px;top:200px;width:720px;font:700 76px/1.02 M;letter-spacing:-.025em;color:oklch(0.87 0.21 128)}
.q{position:absolute;left:72px;bottom:96px;font:500 32px/1.2 M;color:#fff}
.d{position:absolute;left:72px;bottom:52px;font:500 22px/1 M;color:oklch(0.75 0.02 250)}`;

const card = (title) => `<!doctype html><style>${css}</style><div class="c"><div class="shade"></div><div class="knoll"></div>
<img class="cat" src="${cat}"><p class="k">Мой тип прокрастинации</p><h1>${title}</h1>
<p class="q">А какой у тебя? Тест на 1–2 минуты</p><p class="d">adhd-naparnik.vercel.app/test</p></div>`;

const browser = await chromium.launch();
for (const [t, slug] of Object.entries(SLUG)) {
  const p = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(card(copy.types[t].title));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  const out = `public/og/sdvg-${slug}.png`;
  await p.screenshot({ path: path.join(root, out) });
  await p.close();
  console.log(out, (fs.statSync(path.join(root, out)).size / 1024).toFixed(0), "КБ");
}
await browser.close();
