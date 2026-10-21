import { Pose } from "./skeleton";
import type { PartState, RigData } from "./types";

/**
 * Кукла кота из эталонного PNG (design/mascot/doll_build.py): один рисунок, разобранный на слои, и движения кодом —
 * тот же принцип, что у куклы героя в роликах. Фон жизни идёт сам: моргание (иногда двойное), взгляд, наклон
 * головы, подёргивание ушей, хвост шумом, огонёк, дыхание. Эмоция — заплатка лица поверх живого кота:
 * веселый — рот с язычком (глаза продолжают моргать и смотреть) и звёздочки; сон — веки смыкаются, проявляются
 * дуги, голова опускается, дыхание глубже, поднимаются Z.
 */
export type DollExpression = "calm" | "happy" | "focused" | "sleepy" | "excited" | "listening";
export type DollAction = "idle" | "wave" | "think" | "celebrate";
export type DollFxItem = { kind: "stars" | "zzz"; k: number; t0: number };
export type DollFx = DollFxItem[];

const D2R = Math.PI / 180;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };

function hash(n: number, seed: number) {
  let h = (Math.imul(n | 0, 374761393) + Math.imul(seed, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 32767.5 - 1;
}
function noise(x: number, seed: number) {
  const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}
/** fBm: без периода, хвост и огонёк не повторяются */
export function fbm(x: number, seed: number) {
  return (noise(x, seed) + 0.5 * noise(x * 2.03, seed + 7) + 0.25 * noise(x * 4.1, seed + 13)) / 1.75 * 1.9;
}

/** Детерминированный генератор (mulberry32): с одним зерном кот двигается одинаково — проверка повторяема */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Spring {
  x = 0; v = 0; target = 0;
  constructor(private k: number, private c: number) {}
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008)); const h = dt / n;
    for (let i = 0; i < n; i++) { this.v += (this.k * (this.target - this.x) - this.c * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}

const PARTS = ["tail", "flame", "body", "eye-l", "eye-r", "pupil-l", "pupil-r", "hl-l", "hl-r", "lid-l", "lid-r", "happy", "sleep"];

export class DollAnimator {
  readonly pose: Pose;
  readonly parts = new Map<string, PartState>();
  private B: Record<string, number> = {};
  private tail: number[] = [];
  private eyeR: number;
  expression: DollExpression = "calm";
  action: DollAction = "idle";
  gaze: { x: number; y: number } | null = null;
  reduced = false;
  fx: DollFx = [];
  private rand: () => number;
  private lively = 1;
  private starsK = 0;
  private zzzK = 0;
  private starsT0 = 0;
  private zzzT0 = 0;
  private pokeAt = -9;
  private earSide = false;

  t = 0;
  private gx = new Spring(150, 17);
  private gy = new Spring(150, 17);
  private tilt = new Spring(70, 13);
  private earL = new Spring(240, 11);
  private earR = new Spring(240, 11);
  private squash = new Spring(260, 15);
  private hop = new Spring(140, 10);
  private happyK = 0;
  private sleepK = 0;
  private blinks: number[] = [];
  private nextBlink = 1.2;
  private earAt = 3;
  private glanceAt = 2;
  private glanceUntil = -1;
  private glance = 0;
  private hopAt = -9;
  private waveAt = -9;

  constructor(rig: RigData & { eyes?: number[][] }, seed = Math.floor(Math.random() * 2 ** 31)) {
    this.rand = rng(seed);
    this.nextBlink = 1.2 + this.rand() * 2; this.earAt = 3 + this.rand() * 4; this.glanceAt = 2 + this.rand() * 3;
    this.pose = new Pose(rig);
    rig.bones.forEach((b, i) => (this.B[b.name] = i));
    for (let i = 0; this.B[`tail${i}`] !== undefined; i++) this.tail.push(this.B[`tail${i}`]);
    this.eyeR = rig.eyes?.[0]?.[2] ?? 96;
    for (const n of PARTS) this.parts.set(n, { opacity: 1, dx: 0, dy: 0, sx: 1, sy: 1 });
    this.update(0);
  }

  setAction(a: DollAction) {
    if (a === this.action) return;
    this.action = a;
    if (a === "celebrate") this.hopAt = this.t;
    if (a === "wave") this.waveAt = this.t;
  }

  /** касание: присед с отскоком, уши, быстрое моргание */
  poke() {
    this.pokeAt = this.t;                      // присед: цель на 90 мс вниз, пружина возвращает с перелётом (без рывка за кадр)
    this.earL.v -= 260; this.earR.v += 260;
    this.blinks.push(this.t + 0.05);
  }

  private faceTargets() {
    const e = this.expression, a = this.action;
    const sleep = e === "sleepy" || e === "listening";
    const happy = !sleep && (e === "happy" || e === "excited" || a === "celebrate" || a === "wave");
    return { happy, sleep, z: e === "sleepy" };
  }

  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const t = this.t, P = this.pose, B = this.B;
    const still = this.reduced;
    P.reset();
    const f = this.faceTargets();

    // ----- лицо: переходы веселого 0.3 с, сна 0.7 с; в reduced motion — сразу
    const stepK = (k: number, on: boolean, dur: number) => (still ? (on ? 1 : 0) : clamp01(k + (on ? dt : -dt) / dur));
    this.happyK = stepK(this.happyK, f.happy, 0.3);
    this.sleepK = stepK(this.sleepK, f.sleep, 0.7);
    const hk = sm(this.happyK), sk = this.sleepK;

    // ----- моргание: вниз 80 мс, пауза 50, вверх 170 (как у куклы в роликах); иногда двойное
    if (!still && t >= this.nextBlink) {
      this.blinks.push(t);
      if (this.rand() < 0.15) this.blinks.push(t + 0.32);
      this.nextBlink = t + 2.5 + this.rand() * 3;
    }
    this.blinks = this.blinks.filter((b) => t - b < 0.4);
    let lid = 0;
    for (const b of this.blinks) {
      const d = t - b;
      if (d >= 0 && d < 0.08) lid = Math.max(lid, sm(d / 0.08));
      else if (d >= 0.08 && d < 0.13) lid = 1;
      else if (d >= 0.13 && d < 0.3) lid = Math.max(lid, 1 - sm((d - 0.13) / 0.17));
    }
    lid = Math.max(lid, sm(Math.min(1, sk * 2)));                 // в сон: веки смыкаются первыми
    // глаза уходят под дуги плавно: веко сомкнуто к sk 0.5, сплющенный глаз и штрих века гаснут на 0.45–0.66,
    // пока дуги проявляются (0.4–0.65) — ни на одном кадре нет ни «пустого» лица, ни скачка
    const eyeFade = 1 - sm((sk - 0.45) / 0.21);

    // ----- взгляд
    if (!still && !this.gaze && t > this.glanceAt) {
      this.glance = [-0.7, -0.4, 0.4, 0.7][Math.floor(this.rand() * 4)];
      this.glanceUntil = t + 1 + this.rand() * 1.2; this.glanceAt = this.glanceUntil + 2.5 + this.rand() * 3;
      if (Math.abs(this.glance) >= 0.6) this.blinks.push(t);   // большой перевод взгляда — под веком
    }
    const g = this.gaze ?? { x: t < this.glanceUntil ? this.glance : 0, y: 0 };
    this.gx.target = Math.max(-1, Math.min(1, g.x)); this.gy.target = Math.max(-1, Math.min(1, g.y));
    const lx = still ? 0 : this.gx.step(dt), ly = still ? 0 : this.gy.step(dt);

    // ----- голова: наклон к взгляду, вопрос «думает», сон — опущена
    this.tilt.target = (this.gaze ? -this.gaze.x * 3 : 0) + (this.action === "think" ? 6 : 0)
      + (this.action === "wave" && t - this.waveAt < 2.4 ? 5 * Math.sin((t - this.waveAt) * 5) * (1 - (t - this.waveAt) / 2.4) : 0);
    const tilt = still ? 0 : this.tilt.step(dt);
    P.rot[B.head] = (tilt - 3.4 * sm(sk)) * D2R;

    // ----- уши: подёргивание раз в 6–11 с (и на касание)
    // подёргивание ушей по очереди раз в 4–8 с; левое ухо загнутое и короткое — его ход больше, иначе его не видно
    if (!still && t > this.earAt) {
      this.earSide = !this.earSide;
      if (this.earSide) this.earL.v += this.rand() < 0.5 ? -330 : 330; else this.earR.v += this.rand() < 0.5 ? -230 : 230;
      this.earAt = t + 4 + this.rand() * 4;
    }
    const swayL = still ? 0 : 2.2 * fbm(t / 1.9, 71), swayR = still ? 0 : 1.4 * fbm(t / 2.3, 83);
    P.rot[B["ear-l"]] = ((still ? 0 : this.earL.step(dt)) * 0.75 + swayL) * D2R;
    P.rot[B["ear-r"]] = ((still ? 0 : this.earR.step(dt)) * 0.6 + swayR) * D2R;

    // ----- хвост: бегущая волна по цепочке, огонёк держится вертикально
    // амплитуда проверена крайними позами (после починки весов на суставах): до ~2.6° на звено чисто
    const livelyT = this.action === "celebrate" ? 1.35 : f.happy ? 1.15 : f.sleep ? 0.45 : 1;
    this.lively += (livelyT - this.lively) * Math.min(1, dt * 1.5);       // смена настроения — плавно, не скачком хвоста
    const lively = this.lively;
    let acc = 0;
    this.tail.forEach((bi, i) => {
      let a = still ? 0 : 1.9 * lively * Math.tanh(fbm(t / 2.6 - i * 0.2, 53)) * (0.45 + i / this.tail.length);
      if (a < 0) a *= 0.55;                 // к голове хвост ходит меньше: при −2.6° на звено огонёк заходил на щёку
      P.rot[bi] = a * D2R; acc += a;
    });
    P.rot[B.flame] = -acc * 0.5 * D2R;             // огонёк тянется вверх, но держится за кончик хвоста
    const fl = this.parts.get("flame")!;
    fl.sx = 1 + (still ? 0 : 0.05 * fbm(t * 3.7, 23)); fl.sy = 1 + (still ? 0 : 0.08 * fbm(t * 4.1, 37));
    fl.dx = still ? 0 : 2.5 * fbm(t * 2.3, 11);

    // ----- дыхание (сон — глубже и реже), прыжок радости, присед от касания
    const per = 2.6 + 1.0 * sm(sk), amp = 0.012 + 0.01 * sm(sk);
    P.sy[B.chest] = 1 + (still ? 0 : amp * Math.sin((2 * Math.PI * t) / per));
    const hopT = t - this.hopAt;
    this.hop.target = !still && hopT >= 0 && hopT < 0.32 ? -70 : 0;
    if (!still && this.action === "celebrate" && hopT > 2.2) this.hopAt = t;
    P.ty[B.root] = still ? 0 : this.hop.step(dt);
    this.squash.target = !still && t - this.pokeAt >= 0 && t - this.pokeAt < 0.09 ? -14 : 0;
    const sq = still ? 0 : this.squash.step(dt);
    P.sy[B.root] *= 1 + sq * 0.02; P.sx[B.root] *= 1 - sq * 0.01;

    // ----- глаза
    const R = this.eyeR;
    for (const s of ["l", "r"]) {
      const eyeOp = eyeFade;
      const sy = Math.max(0.03, 1 - lid * 0.97);
      for (const n of [`eye-${s}`, `hl-${s}`]) { const p = this.parts.get(n)!; p.opacity = eyeOp; p.sy = sy; p.dx = 0; p.dy = 0; }
      const pu = this.parts.get(`pupil-${s}`)!;
      pu.opacity = eyeOp; pu.sy = sy; pu.sx = 1;
      pu.dx = lx * R * 0.26; pu.dy = ly * R * 0.2 * sy;
      const ld = this.parts.get(`lid-${s}`)!;
      ld.opacity = eyeFade * sm((lid - 0.7) / 0.3);
    }
    this.parts.get("happy")!.opacity = hk * (1 - sm(sk * 3));
    this.parts.get("sleep")!.opacity = sm((sk - 0.4) / 0.25);

    // ----- эффекты: звёздочки у радости, Z у сна (у «слушает» глаза закрыты, но Z нет); появляются и гаснут
    // плавно (0.4 с), а не исчезают за кадр при смене настроения
    const wantStars = this.expression === "excited" || this.expression === "happy" || this.action === "celebrate";
    const wantZ = f.z;
    const ramp = (k: number, on: boolean) => (still ? (on ? 1 : 0) : clamp01(k + (on ? dt : -dt) / 0.4));
    if (this.starsK === 0 && wantStars) this.starsT0 = t;
    if (this.zzzK === 0 && wantZ) this.zzzT0 = t + 0.4;
    this.starsK = ramp(this.starsK, wantStars); this.zzzK = ramp(this.zzzK, wantZ);
    this.fx = [];
    if (this.starsK > 0) this.fx.push({ kind: "stars", k: sm(this.starsK), t0: this.starsT0 });
    if (this.zzzK > 0) this.fx.push({ kind: "zzz", k: sm(this.zzzK), t0: this.zzzT0 });

    P.update();
  }
}

/** Мягкая контактная тень под лапами (как у прежнего кота): рисуется ПОД котом, в прыжке меньше и светлее. */
export function drawDollShadow(ctx: CanvasRenderingContext2D, a: DollAnimator, cat: number[], view: number[], w: number, h: number) {
  const [vx, vy, vw, vh] = view;
  const lift = Math.max(0, -a.pose.ty[0]) / 90;
  const cx = (cat[0] + cat[2] * 0.62) / 1.62, cy = cat[3] - 8, rx = (cat[2] - cat[0]) * 0.36 * (1 - 0.25 * lift), ry = 26 * (1 - 0.25 * lift);
  ctx.save();
  ctx.globalCompositeOperation = "destination-over";
  ctx.setTransform(w / vw, 0, 0, h / vh, (-vx * w) / vw, (-vy * h) / vh);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${0.32 * (1 - 0.5 * lift)})`); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
  ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- звёздочки и Z (Canvas 2D, координаты рисунка)
let fxColor = "rgb(170, 220, 70)";
/** Цвет эффектов — тот же, что у прежнего кота (var(--color-primary)); компонент передаёт его из CSS. */
export function setDollFxColor(c: string) { if (c) fxColor = c; }

// Звёздочки прежнего кота (MascotSvg, PR #49): прямая четырёхлучевая искра «M0 -32 L8 -8 L32 0 …», три штуки,
// пульс 1.4 с (масштаб 0.5 → 1.15 → 0.5, прозрачность 0.4 → 1 → 0.4) со сдвигом 0.35 с. Места и размер пересчитаны из
// рисунка прежнего кота в координаты эталона по глазам (масштаб 1.554).
const OLD = (x: number, y: number) => [377 + (x - 505) * 1.554, 447 + (y - 405) * 1.554];
const STARS: [number, number, number][] = [[...OLD(300, 120), 0] as [number, number, number], [...OLD(900, 150), 0.35] as [number, number, number], [...OLD(830, 20), 0.7] as [number, number, number]];
const STAR_R = 32 * 1.554;
const ZS = { p0: [930, 110], p1: [1090, -250], s0: 44, s1: 104, period: 3.6, n: 3 };

function star(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
  const k = R / 32;
  const pts = [[0, -32], [8, -8], [32, 0], [8, 8], [0, 32], [-8, 8], [-32, 0], [-8, -8]];
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * k, y + py * k) : ctx.moveTo(x + px * k, y + py * k)));
  ctx.closePath(); ctx.fill();
}

/** easeInOut между ключами (как transition ease: "easeInOut" у framer-motion) */
function keys3(u: number, a: number, b: number) {
  return u < 0.5 ? a + (b - a) * sm(u / 0.5) : b + (a - b) * sm((u - 0.5) / 0.5);
}

/** Нарисовать звёздочки или Z поверх кота. view — окно рисунка (как у рига), w x h — пиксели холста. */
export function drawDollFx(ctx: CanvasRenderingContext2D, fx: DollFx, t: number, view: number[], w: number, h: number) {
  for (const f of fx) drawFxItem(ctx, f, t, view, w, h);
}

function drawFxItem(ctx: CanvasRenderingContext2D, fx: DollFxItem, t: number, view: number[], w: number, h: number) {
  const [vx, vy, vw, vh] = view;
  ctx.save();
  ctx.setTransform(w / vw, 0, 0, h / vh, (-vx * w) / vw, (-vy * h) / vh);
  ctx.fillStyle = fxColor; ctx.strokeStyle = fxColor; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const tt = t - fx.t0;
  if (fx.kind === "stars") {
    for (const [x, y, d] of STARS) {
      const u = (((tt - d) / 1.4) % 1 + 1) % 1;
      if (tt < d) continue;
      ctx.globalAlpha = keys3(u, 0.4, 1) * fx.k;
      star(ctx, x, y, STAR_R * keys3(u, 0.5, 1.15) * (0.6 + 0.4 * fx.k));
    }
    ctx.globalAlpha = 1;
  } else {
    for (let i = 0; i < ZS.n; i++) {
      let u = tt / ZS.period - i / ZS.n;
      if (u < 0) continue;
      u %= 1;
      const a = sm(u / 0.18) * (1 - sm((u - 0.72) / 0.28)) * fx.k;
      if (a <= 0.01) continue;
      const x = ZS.p0[0] + (ZS.p1[0] - ZS.p0[0]) * u + 10 * Math.sin(2 * Math.PI * u * 1.4 + i);
      const y = ZS.p0[1] + (ZS.p1[1] - ZS.p0[1]) * u;
      const s = ZS.s0 + (ZS.s1 - ZS.s0) * sm(u), hs = s / 2, sh = 0.18;
      ctx.globalAlpha = a; ctx.lineWidth = Math.max(4, s * 0.16);
      ctx.beginPath();
      ctx.moveTo(x + (-1 + sh) * hs, y - hs); ctx.lineTo(x + (1 + sh) * hs, y - hs);
      ctx.lineTo(x + (-1 - sh) * hs, y + hs); ctx.lineTo(x + (1 - sh) * hs, y + hs);
      ctx.stroke();
    }
  }
  ctx.restore();
}
