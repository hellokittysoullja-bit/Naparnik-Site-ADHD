// Превью ссылки (OG 1200×630) и иконки приложения из НАСТОЯЩЕГО кота (постер эталона) и ночной сцены лендинга.
// Запуск: node design/brand/build.mjs (нужен Playwright/Chromium). Пишет app/opengraph-image.png,
// app/apple-icon.png (180), public/images/app-icon.png (512; манифест берёт его для 192 и 512).
// Раньше превью и иконка манифеста были отдельным векторным котом — второй моделью кота (CLAUDE.md §10).
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
const m700 = data("public/fonts/manrope-700-cyr.woff2", "font/woff2");
const m700l = data("public/fonts/manrope-700-lat.woff2", "font/woff2");

const base = `
@font-face{font-family:M;src:url(${m700}) format("woff2");font-weight:700}
@font-face{font-family:M;src:url(${m700l}) format("woff2");font-weight:700;unicode-range:U+0000-00FF}
*{margin:0;box-sizing:border-box}
body{background:#0f1512}`;

// превью: та же ночь, кот на холме в пятне очага, заголовок героя — без нового текста
const og = `<!doctype html><style>${base}
.c{position:relative;width:1200px;height:630px;overflow:hidden;background:url(${sky}) center 62%/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,oklch(0.13 0.03 250/.78) 0%,oklch(0.13 0.03 250/.35) 52%,transparent 75%)}
.glow{position:absolute;right:120px;bottom:-40px;width:520px;height:300px;border-radius:50%;
 background:radial-gradient(ellipse at center,oklch(0.72 0.17 55/.34),oklch(0.72 0.17 55/.12) 45%,transparent 70%)}
.knoll{position:absolute;right:-60px;bottom:-250px;width:760px;height:380px;border-radius:50%;
 background:radial-gradient(ellipse at 50% 30%,oklch(0.24 0.03 150),oklch(0.16 0.02 160) 70%)}
.cat{position:absolute;right:46px;bottom:58px;width:440px}
h1{position:absolute;left:72px;top:206px;font:700 70px/1.05 M;letter-spacing:-.025em;color:#fff;width:780px;white-space:nowrap}
h1 b{color:oklch(0.87 0.21 128);position:relative;font-weight:700}
h1 b svg{position:absolute;left:0;right:0;bottom:-16px;width:100%;height:18px}
</style><div class="c"><div class="shade"></div><div class="glow"></div><div class="knoll"></div>
<img class="cat" src="${cat}"><h1>Сдвинем твоё<br>дело за <b>2&nbsp;минуты<svg viewBox="0 0 100 12" preserveAspectRatio="none"><path d="M2 8 Q 22 2 42 6 T 78 5 Q 90 5 98 7" fill="none" stroke="oklch(0.87 0.21 128)" stroke-width="3.2" stroke-linecap="round"/></svg></b>.</h1></div>`;

// иконка: кот на ночном небе с тёплым пятном снизу; квадрат без скругления — его даёт система
const icon = (s) => `<!doctype html><style>${base}
.c{position:relative;width:${s}px;height:${s}px;overflow:hidden;background:url(${sky}) 70% 55%/cover}
.d{position:absolute;inset:0;background:linear-gradient(180deg,oklch(0.13 0.03 250/.25),oklch(0.13 0.03 250/.05))}
.glow{position:absolute;left:8%;right:8%;bottom:-18%;height:52%;border-radius:50%;
 background:radial-gradient(ellipse at center,oklch(0.72 0.17 55/.42),oklch(0.72 0.17 55/.12) 50%,transparent 72%)}
.cat{position:absolute;left:50%;bottom:9%;width:94%;transform:translateX(-46%)}
</style><div class="c"><div class="d"></div><div class="glow"></div><img class="cat" src="${cat}"></div>`;

const browser = await chromium.launch();
async function shot(html, w, h, out) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(root, out), clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log(out, (fs.statSync(path.join(root, out)).size / 1024).toFixed(0), "КБ");
}
await shot(og, 1200, 630, "app/opengraph-image.png");
await shot(icon(180), 180, 180, "app/apple-icon.png");
await shot(icon(512), 512, 512, "public/images/app-icon.png");
await browser.close();
