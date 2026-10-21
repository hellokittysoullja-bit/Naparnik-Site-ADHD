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
export type DollFx = { kind: "stars" | "zzz"; k: number; t0: number } | null;

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
  fx: DollFx = null;

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
  private faceStart = { happy: -9, sleep: -9 };
  private blinks: number[] = [];
  private nextBlink = 1.2 + Math.random() * 2;
  private earAt = 3 + Math.random() * 4;
  private glanceAt = 2 + Math.random() * 3;
  private glanceUntil = -1;
  private glance = 0;
  private hopAt = -9;
  private waveAt = -9;

  constructor(rig: RigData & { eyes?: number[][] }) {
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
    this.squash.v = -30;
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
    const hk0 = this.happyK, sk0 = this.sleepK;
    this.happyK = stepK(this.happyK, f.happy, 0.3);
    this.sleepK = stepK(this.sleepK, f.sleep, 0.7);
    if (hk0 === 0 && this.happyK > 0) this.faceStart.happy = t;
    if (sk0 === 0 && this.sleepK > 0) this.faceStart.sleep = t;
    const hk = sm(this.happyK), sk = this.sleepK;

    // ----- моргание: вниз 80 мс, пауза 50, вверх 170 (как у куклы в роликах); иногда двойное
    if (!still && t >= this.nextBlink) {
      this.blinks.push(t);
      if (Math.random() < 0.15) this.blinks.push(t + 0.32);
      this.nextBlink = t + 2.5 + Math.random() * 3;
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
    const eyesGone = sk > 0.66;

    // ----- взгляд
    if (!still && !this.gaze && t > this.glanceAt) {
      this.glance = [-0.7, -0.4, 0.4, 0.7][Math.floor(Math.random() * 4)];
      this.glanceUntil = t + 1 + Math.random() * 1.2; this.glanceAt = this.glanceUntil + 2.5 + Math.random() * 3;
      if (Math.abs(this.glance) >= 0.6) this.blinks.push(t - 0.02);   // большой перевод взгляда — под веком
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
    if (!still && t > this.earAt) { (Math.random() < 0.5 ? this.earL : this.earR).v += Math.random() < 0.5 ? -230 : 230; this.earAt = t + 6 + Math.random() * 5; }
    P.rot[B["ear-l"]] = (still ? 0 : this.earL.step(dt)) * D2R * 0.6;
    P.rot[B["ear-r"]] = (still ? 0 : this.earR.step(dt)) * D2R * 0.6;

    // ----- хвост: бегущая волна по цепочке, огонёк держится вертикально
    const lively = this.action === "celebrate" ? 1.8 : f.happy ? 1.3 : f.sleep ? 0.45 : 1;
    let acc = 0;
    this.tail.forEach((bi, i) => {
      const a = still ? 0 : 1.6 * lively * Math.tanh(fbm(t / 3.1 - i * 0.18, 53)) * (0.4 + i / this.tail.length);
      P.rot[bi] = a * D2R; acc += a;
    });
    P.rot[B.flame] = -acc * 0.8 * D2R;
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
    const sq = still ? 0 : this.squash.step(dt);
    P.sy[B.root] *= 1 + sq * 0.02; P.sx[B.root] *= 1 - sq * 0.01;

    // ----- глаза
    const R = this.eyeR;
    for (const s of ["l", "r"]) {
      const eyeOp = eyesGone ? 0 : 1;
      const sy = Math.max(0.03, 1 - lid * 0.97);
      for (const n of [`eye-${s}`, `hl-${s}`]) { const p = this.parts.get(n)!; p.opacity = eyeOp; p.sy = sy; p.dx = 0; p.dy = 0; }
      const pu = this.parts.get(`pupil-${s}`)!;
      pu.opacity = eyeOp; pu.sy = sy; pu.sx = 1;
      pu.dx = lx * R * 0.26; pu.dy = ly * R * 0.2 * sy;
      const ld = this.parts.get(`lid-${s}`)!;
      ld.opacity = eyesGone ? 0 : sm((lid - 0.7) / 0.3);
    }
    this.parts.get("happy")!.opacity = hk * (1 - sm(sk * 3));
    this.parts.get("sleep")!.opacity = sm((sk - 0.4) / 0.25);

    // ----- эффекты: звёздочки у радости, Z у сна (у «слушает» глаза закрыты, но Z нет)
    if (this.sleepK > 0.02 && f.z) this.fx = { kind: "zzz", k: sm(this.sleepK), t0: this.faceStart.sleep + 0.4 };
    else if (this.happyK > 0.02 && (this.expression === "excited" || this.expression === "happy" || this.action === "celebrate"))
      this.fx = { kind: "stars", k: hk, t0: this.faceStart.happy };
    else this.fx = null;

    P.update();
  }
}

// ---------------------------------------------------------------- звёздочки и Z (Canvas 2D, координаты рисунка)
const FX_COLOR = "rgb(122, 190, 46)";
const STARS: [number, number, number, number, number, number][] = [   // x, y, радиус, фаза, период, фаза дрейфа
  [110, 150, 58, 0, 1.9, 0], [1010, 60, 28, 0.35, 1.5, 0.4], [1150, 200, 20, 0.7, 1.7, 0.8], [40, 430, 18, 0.55, 1.4, 0.2],
];
const ZS = { p0: [930, 110], p1: [1090, -250], s0: 44, s1: 104, period: 3.6, n: 3 };

function easeBack(u: number) {
  const c1 = 1.70158, c3 = c1 + 1, x = clamp01(u) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, rot: number) {
  // четырёхлучевая искра с вогнутыми сторонами: от кончика к кончику — кривая через точку у центра
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const a = rot + (i * Math.PI) / 2 - Math.PI / 2;
    const px = x + R * Math.cos(a), py = y + R * Math.sin(a);
    if (i === 0) { ctx.moveTo(px, py); continue; }
    const m = a - Math.PI / 4;
    ctx.quadraticCurveTo(x + R * 0.14 * Math.cos(m), y + R * 0.14 * Math.sin(m), px, py);
  }
  ctx.closePath(); ctx.fill();
}

/** Нарисовать звёздочки или Z поверх кота. view — окно рисунка (как у рига), w x h — пиксели холста. */
export function drawDollFx(ctx: CanvasRenderingContext2D, fx: DollFx, t: number, view: number[], w: number, h: number) {
  if (!fx) return;
  const [vx, vy, vw, vh] = view;
  ctx.save();
  ctx.setTransform(w / vw, 0, 0, h / vh, (-vx * w) / vw, (-vy * h) / vh);
  ctx.fillStyle = FX_COLOR; ctx.strokeStyle = FX_COLOR; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const tt = t - fx.t0;
  if (fx.kind === "stars") {
    const pop = easeBack(fx.k * 1.15);
    for (const [x, y, R, ph, per, dph] of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(Math.PI * (tt / per + ph)) ** 2;
      const dy = 6 * Math.sin(2 * Math.PI * (tt / 3.1 + dph)), dx = 4 * Math.sin(2 * Math.PI * (tt / 4.3 + dph));
      star(ctx, x + dx, y + dy, Math.max(0.5, R * tw * pop), 0.22 * Math.sin(2 * Math.PI * (tt / 5 + ph)));
    }
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
