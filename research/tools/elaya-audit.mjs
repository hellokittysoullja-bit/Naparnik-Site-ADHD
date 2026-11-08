// Замер страницы по правилам пака elayadesign (research/05-elaya-design-skills.md, раздел 10).
// Запуск: node research/tools/elaya-audit.mjs <url> [ширина=390] [высота=844] [--json]
// Меряет только то, что меряется автоматически; вкусовые пункты (асимметрия, «AI-шаблон») — глазами.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const [url, w = "390", h = "844"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const asJson = process.argv.includes("--json");
if (!url) { console.error("usage: node elaya-audit.mjs <url> [width] [height] [--json]"); process.exit(1); }

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // дать отыграть появлению

const r = await page.evaluate(() => {
  const TYPE = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128];
  const SPACE = [0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96];
  const RADIUS = [0, 2, 4, 6, 8, 12, 16, 24, 9999];
  const DARK_BG = ["rgb(0, 0, 0)", "rgb(24, 24, 24)", "rgb(31, 31, 31)", "rgb(39, 39, 39)", "rgb(49, 49, 49)", "rgb(19, 18, 9)"];
  const BANNED_FONTS = /\b(Inter|Roboto|Arial|Open Sans|Helvetica)\b/i;
  const BANNED_WORDS = /(revolutioni[sz]e|supercharge|cutting edge|effortless|transform your workflow|next level|harness the power|world class)/i;
  const DEFAULT_EASE = /(^|,\s*)(ease|linear|ease-in-out)(\s*,|$)/;
  const near = (v, set) => set.some((s) => Math.abs(v - s) < 0.51);
  const label = (el) => {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = (el) => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const all = [...document.querySelectorAll("body *")].filter(visible);
  const textEls = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const out = { offScaleFont: {}, families: {}, bannedFont: [], italic: [], ultraBold: [], offScaleSpacing: {}, offScaleRadius: {},
    bgGradients: [], darkBgOffPalette: {}, oneSideBorder: [], defaultEasing: {}, animatesLayout: [], hyphens: [], orphans: [],
    bannedWords: [], smallTargets: [], noAltImg: [], overflowX: 0, landmarks: {}, meta: {}, ctaCount: 0, focusRingless: [] };
  for (const el of textEls) {
    const s = getComputedStyle(el);
    const fs = parseFloat(s.fontSize);
    if (!near(fs, TYPE)) out.offScaleFont[fs + "px"] = (out.offScaleFont[fs + "px"] || 0) + 1;
    const fam = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    out.families[fam] = (out.families[fam] || 0) + 1;
    if (BANNED_FONTS.test(fam)) out.bannedFont.push(label(el));
    if (s.fontStyle === "italic") out.italic.push(label(el));
    if (+s.fontWeight >= 800) out.ultraBold.push(label(el) + " " + s.fontWeight);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
    if (/\S-\S|\s[-–—]\s/.test(own)) out.hyphens.push(own.trim().slice(0, 60));
    if (BANNED_WORDS.test(own)) out.bannedWords.push(own.trim().slice(0, 60));
    // висячее слово: последняя строка блока из одного слова
    const words = el.textContent.trim().split(/\s+/);
    if (words.length > 3 && el.children.length === 0) {
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      if (rects.length > 1) {
        const lastTop = Math.round(rects[rects.length - 1].top);
        const lastLine = rects.filter((q) => Math.abs(Math.round(q.top) - lastTop) < 3);
        const lastWidth = lastLine.reduce((a, q) => a + q.width, 0);
        const lastWord = words[words.length - 1];
        if (lastWidth < fs * (lastWord.length * 0.75 + 0.5)) out.orphans.push(el.textContent.trim().slice(-40));
      }
    }
  }
  for (const el of all) {
    const s = getComputedStyle(el);
    for (const p of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "rowGap", "columnGap", "marginTop", "marginBottom"]) {
      const v = parseFloat(s[p]);
      if (!isNaN(v) && v > 0 && !near(Math.abs(v), SPACE)) out.offScaleSpacing[p + ":" + v] = (out.offScaleSpacing[p + ":" + v] || 0) + 1;
    }
    const rad = parseFloat(s.borderTopLeftRadius);
    if (rad > 0 && !near(rad, RADIUS) && rad < Math.min(el.offsetWidth, el.offsetHeight) / 2) out.offScaleRadius[rad + "px"] = (out.offScaleRadius[rad + "px"] || 0) + 1;
    if (/gradient/.test(s.backgroundImage) && el.offsetWidth * el.offsetHeight > 40000) out.bgGradients.push(label(el));
    const bg = s.backgroundColor;
    const m = bg.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
    if (m && (m[4] === undefined || +m[4] > 0.9) && (+m[1] + +m[2] + +m[3]) < 160 && !DARK_BG.includes(`rgb(${m[1]}, ${m[2]}, ${m[3]})`) && el.offsetWidth * el.offsetHeight > 40000)
      out.darkBgOffPalette[bg] = (out.darkBgOffPalette[bg] || 0) + 1;
    const sides = ["Top", "Right", "Bottom", "Left"].map((d) => parseFloat(s["border" + d + "Width"]) > 0 && s["border" + d + "Style"] !== "none");
    const n = sides.filter(Boolean).length;
    if (n > 0 && n < 4 && el.offsetHeight > 40) out.oneSideBorder.push(label(el));
    if (s.transitionDuration !== "0s" && DEFAULT_EASE.test(s.transitionTimingFunction)) out.defaultEasing["transition " + s.transitionTimingFunction] = (out.defaultEasing["transition " + s.transitionTimingFunction] || 0) + 1;
    if (s.animationName !== "none" && DEFAULT_EASE.test(s.animationTimingFunction)) out.defaultEasing["animation " + s.animationTimingFunction] = (out.defaultEasing["animation " + s.animationTimingFunction] || 0) + 1;
    if (/(^|,\s*)(top|left|width|height)(,|$)/.test(s.transitionProperty)) out.animatesLayout.push(label(el) + " " + s.transitionProperty);
    if (el.matches("a,button,[role=button],input,select,textarea")) {
      const b = el.getBoundingClientRect();
      if (b.width < 44 || b.height < 44) out.smallTargets.push(label(el) + ` ${Math.round(b.width)}×${Math.round(b.height)}`);
    }
  }
  for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) out.noAltImg.push(img.src.slice(0, 60));
  out.overflowX = document.documentElement.scrollWidth - innerWidth;
  for (const t of ["nav", "main", "header", "footer", "section", "article", "aside"]) out.landmarks[t] = document.querySelectorAll(t).length;
  out.meta = { title: document.title, description: !!document.querySelector('meta[name=description]'), ogImage: !!document.querySelector('meta[property="og:image"]'),
    favicon: !!document.querySelector('link[rel*=icon]'), skipLink: !![...document.querySelectorAll('a[href^="#"]')].find((a) => /skip|пропустить|к содержимому/i.test(a.textContent)),
    legalLinks: [...document.querySelectorAll("a")].filter((a) => /privacy|terms|конфиденц|услови/i.test(a.textContent + a.href)).length,
    reducedMotionRules: [...document.styleSheets].reduce((n, sh) => { try { return n + [...sh.cssRules].filter((r) => /prefers-reduced-motion/.test(r.conditionText || r.media?.mediaText || "")).length; } catch { return n; } }, 0) };
  out.ctaCount = [...document.querySelectorAll("a,button")].filter((el) => visible(el) && el.getBoundingClientRect().top < innerHeight && el.getBoundingClientRect().height >= 40).length;
  return out;
});
await browser.close();
if (asJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
const top = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`).join(", ") || "—";
const list = (a, n = 6) => (a.length ? `${a.length}: ` + [...new Set(a)].slice(0, n).join(" | ") : "0");
console.log(`Страница ${url} @ ${w}×${h}
B1  шрифты по семействам ....... ${top(r.families)}
B1  запрещённые шрифты ......... ${list(r.bannedFont)}
B1  курсив / ≥800 .............. ${list(r.italic)} / ${list(r.ultraBold)}
B1  размеры вне шкалы Tailwind . ${top(r.offScaleFont)}
B1  дефисы/тире в тексте ....... ${list(r.hyphens, 4)}
B1  висячие слова (оценка) ..... ${list(r.orphans, 4)}
B2  отступы вне шкалы .......... ${top(r.offScaleSpacing)}
B3  радиусы вне шкалы .......... ${top(r.offScaleRadius)}
B4  градиент-фоны (крупные) .... ${list(r.bgGradients, 4)}
B4  тёмный фон вне палитры ..... ${top(r.darkBgOffPalette)}
B4  рамка с одной стороны ...... ${list(r.oneSideBorder, 4)}
B7  кривые по умолчанию ........ ${top(r.defaultEasing)}
B7  анимация top/left/w/h ...... ${list(r.animatesLayout, 4)}
B8  слова-штампы ............... ${list(r.bannedWords)}
A4  кнопок/ссылок в 1-м экране . ${r.ctaCount}
Fig цели касания < 44×44 ....... ${list(r.smallTargets, 5)}
B10 гориз. переполнение ........ ${r.overflowX}px
B10 img без alt ................ ${list(r.noAltImg)}
B10 ориентиры .................. ${JSON.stringify(r.landmarks)}
B10 мета ....................... ${JSON.stringify(r.meta)}`);
