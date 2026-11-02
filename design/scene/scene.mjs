// Ночной мир первого экрана как HTML-страница для рендера в видео (design/scene/build.mjs).
// На сайте этой разметки нет: там только готовые видео и заставка (public/scene) — браузер
// проигрывает их видеочипом, без сотен SVG-фигур, масок и размытий (принцип cofounder.co,
// 02.11: при «краш-тесте» на iPhone наша живая SVG-сцена давала артефакты слоёв Safari).
//
// Образцы (research/02): Jonnie Hallman — ночные горы с месяцем; Amie/Endel — небо как
// фон-состояние; §4.1 — сцена занимает кадр. Всё детерминировано (свой ГПСЧ), все циклы
// кратны LOOP — видео зациклено без шва.

export const LOOP = 12; // с

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Силуэт гряды: сумма синусов, сглаженная квадратичными кривыми через середины точек */
function ridge(seed, base, amp, peaks) {
  const W = 1600;
  const H = 900;
  const r = rng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const y =
      base -
      amp *
        (0.55 * Math.abs(Math.sin(t * peaks * 0.5 + ph[0])) +
          0.3 * Math.sin(t * peaks * 1.3 + ph[1]) +
          0.15 * Math.sin(t * peaks * 3.1 + ph[2]));
    pts.push([(i / N) * W, y]);
  }
  let d = `M0 ${H}V${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += `Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  d += `L${W} ${pts[pts.length - 1][1].toFixed(1)}V${H}Z`;
  return { d, pts };
}

function yAt(pts, x) {
  const step = pts[1][0] - pts[0][0];
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(x / step)));
  const k = (x - pts[i][0]) / step;
  return pts[i][1] * (1 - k) + pts[i + 1][1] * k;
}

/** Ель силуэтом: три яруса и ствол */
function pine(cx, base, h, w) {
  const p = [
    [0, -h], [0.55 * w, -0.5 * h], [0.3 * w, -0.5 * h], [0.8 * w, -0.12 * h], [0.15 * w, -0.12 * h],
    [0.15 * w, 0], [-0.15 * w, 0], [-0.15 * w, -0.12 * h], [-0.8 * w, -0.12 * h], [-0.3 * w, -0.5 * h],
    [-0.55 * w, -0.5 * h],
  ];
  return "M" + p.map(([x, y]) => `${(cx + x).toFixed(1)} ${(base + y).toFixed(1)}`).join("L") + "Z";
}

const FAR = ridge(7, 230, 150, 3);
const MID = ridge(19, 250, 95, 5);
const NEAR = ridge(31, 230, 60, 4);
const FRONT = ridge(43, 200, 34, 3);

const MID_PINES = (() => {
  const r = rng(91);
  const out = [];
  for (let x = 10; x < 1600; x += 9 + r() * 18) {
    if (r() > 0.55) continue;
    const h = 14 + r() * 22;
    out.push(pine(x, yAt(MID.pts, x) + 4, h, h * 0.34));
  }
  return out.join("");
})();

// ближний лес гуще и выше к краям: центр кадра остаётся коту и тексту
const NEAR_PINES = (() => {
  const r = rng(77);
  const out = [];
  for (let x = 20; x < 1600; x += 14 + r() * 26) {
    const edge = Math.abs(x - 800) / 800;
    if (r() > 0.25 + edge * 0.7) continue;
    const h = 26 + r() * 46 * (0.6 + edge);
    out.push(pine(x, yAt(NEAR.pts, x) + 6, h, h * 0.36));
  }
  return out.join("");
})();

// крупные ели переднего плана обрамляют кадр по краям (на телефоне за кадром)
const FRONT_PINES = (() => {
  const r = rng(123);
  const out = [];
  for (const [from, to] of [
    [0, 330],
    [1270, 1600],
  ]) {
    for (let x = from; x < to; x += 22 + r() * 30) {
      const edge = x < 800 ? 1 - x / 330 : (x - 1270) / 330;
      const h = 90 + r() * 70 + edge * 140;
      out.push(pine(x, yAt(FRONT.pts, x) + 10, h, h * 0.34));
    }
  }
  return out.join("");
})();

// общий рассев (часть мерцает; периоды — делители LOOP) + плотная полоса Млечного Пути
const PERIODS = [3, 4, 6, 12];
const STARS = (() => {
  const r = rng(5);
  const s = [];
  for (let i = 0; i < 70; i++)
    s.push({
      x: r() * 1000,
      y: r() * 620,
      r: 0.6 + r() * 1.3,
      a: 0.25 + r() * 0.55,
      tw: r() < 0.3 ? PERIODS[Math.floor(r() * PERIODS.length)] : 0,
      ph: r(),
    });
  for (let i = 0; i < 220; i++) {
    const t = r();
    const off = (r() + r() + r() - 1.5) * 70;
    s.push({ x: t * 1000 + off * 0.45, y: 190 + (t - 0.42) * -404 + off, r: 0.35 + r() * 0.8, a: 0.15 + r() * 0.45, tw: 0 });
  }
  return s;
})();

const SKY = (u) => `calc(${u} * max(0.1vw, 0.1vh))`;

export function sceneHtml() {
  const stars = STARS.map((s) =>
    s.tw
      ? `<circle class="tw" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" style="--lo:${(s.a * 0.35).toFixed(2)};--hi:${s.a.toFixed(2)};animation-duration:${s.tw}s;animation-delay:-${(s.ph * s.tw).toFixed(2)}s"/>`
      : `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${s.r.toFixed(2)}" opacity="${s.a.toFixed(2)}"/>`,
  ).join("");
  const ridgeSvg = (cls, body) => `<svg class="ridge ${cls}" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin meet">${body}</svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:#000}
.scene{position:fixed;inset:0;overflow:hidden;background:linear-gradient(to bottom,oklch(0.15 0.04 265) 0%,oklch(0.19 0.05 250) 30%,oklch(0.25 0.055 228) 52%,oklch(0.3 0.05 205) 64%,oklch(0.22 0.03 190) 80%,oklch(0.15 0.02 170) 100%)}
.sky{position:absolute;inset:0;width:100%;height:100%}
.tw{animation:tw ease-in-out infinite}
@keyframes tw{0%,100%{opacity:var(--lo)}50%{opacity:var(--hi)}}
.meteor{position:absolute;left:calc(50% - ${SKY(120)});top:${SKY(80)};width:${SKY(69)};height:1.6px;border-radius:9999px;
  background:linear-gradient(to right,oklch(0.95 0.015 240/0),oklch(0.95 0.015 240));transform-origin:0 50%;opacity:0;animation:meteor ${LOOP}s linear infinite}
@keyframes meteor{0%,60%{opacity:0;transform:translate(0,0) rotate(150.5deg)}63%{opacity:.8}68%,100%{opacity:0;transform:translate(${SKY(-180)},${SKY(102)}) rotate(150.5deg)}}
.ridge{position:absolute;width:max(108vw,1150px);left:calc(50% - max(54vw,575px))}
.r-far{top:calc(48vh - 230px)}.r-mid{top:calc(55vh - 240px)}.r-near{top:calc(63vh - 230px)}.r-front{top:calc(74vh - 200px)}
.mist{position:absolute;left:-20%;right:-20%;filter:blur(24px);animation:mist ${LOOP}s ease-in-out infinite}
.m1{top:calc(56vh - 60px);height:120px;background:radial-gradient(ellipse at center,oklch(0.7 0.04 210/0.13),transparent 70%)}
.m2{top:calc(64vh - 50px);height:100px;background:radial-gradient(ellipse at center,oklch(0.7 0.04 200/0.1),transparent 70%);animation-delay:-${LOOP / 2}s}
@keyframes mist{0%,100%{transform:translateX(-2%)}50%{transform:translateX(2%)}}
@media (min-width:1024px){.r-far{top:calc(55vh - 230px)}.r-mid{top:calc(64vh - 240px)}.r-near{top:calc(74vh - 230px)}.r-front{top:calc(88vh - 200px)}
  .m1{top:calc(64vh - 60px)}.m2{top:calc(74vh - 50px)}}
</style></head><body><div class="scene">
<svg class="sky" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMin slice">
<defs><radialGradient id="milky" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="oklch(0.8 0.06 280)" stop-opacity="0.16"/><stop offset="45%" stop-color="oklch(0.75 0.06 230)" stop-opacity="0.07"/><stop offset="100%" stop-color="oklch(0.7 0.05 230)" stop-opacity="0"/></radialGradient></defs>
<g transform="rotate(-22 420 190)"><ellipse cx="420" cy="190" rx="700" ry="110" fill="url(#milky)"/><ellipse cx="470" cy="170" rx="420" ry="46" fill="url(#milky)"/></g>
<g fill="oklch(0.95 0.015 240)">${stars}</g></svg>
<span class="meteor"></span>
${ridgeSvg("r-far", `<defs><linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="oklch(0.29 0.045 232)"/><stop offset="35%" stop-color="oklch(0.24 0.04 225)"/></linearGradient></defs><path d="${FAR.d}" fill="url(#far)"/>`)}
<div class="mist m1"></div>
${ridgeSvg("r-mid", `<path d="${MID.d}" fill="oklch(0.205 0.036 215)"/><path d="${MID_PINES}" fill="oklch(0.205 0.036 215)"/>`)}
<div class="mist m2"></div>
${ridgeSvg("r-near", `<path d="${NEAR.d}" fill="oklch(0.17 0.03 195)"/><path d="${NEAR_PINES}" fill="oklch(0.17 0.03 195)"/>`)}
${ridgeSvg("r-front", `<path d="${FRONT.d}" fill="oklch(0.135 0.022 170)"/><path d="${FRONT_PINES}" fill="oklch(0.12 0.02 170)"/>`)}
</div>
<script>
// кадр t (с): все CSS-анимации на паузе в нужной точке — рендер детерминирован
window.__setTime = (t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; } };
</script></body></html>`;
}
