import { Pose } from "./skeleton";
import type { PartState, RigData } from "./types";

export type RigExpression = "calm" | "happy" | "focused" | "sleepy" | "excited" | "listening";
export type RigAction = "idle" | "wave" | "think" | "celebrate";

const D2R = Math.PI / 180;
const sm = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** value-шум 1D: гладкий, неповторяющийся на периодах, не кратных друг другу */
function hash(n: number, seed: number) {
  let h = (Math.imul(n | 0, 374761393) + Math.imul(seed, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 32767.5 - 1;
}
function noise(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}
function fbm(x: number, seed: number) {
  return (noise(x, seed) + 0.5 * noise(x * 2.03, seed + 7) + 0.25 * noise(x * 4.1, seed + 13)) / 1.75;
}

/** Пружина с затуханием: цель двигается рывком, значение догоняет с перелётом */
class Spring {
  x = 0; v = 0; target = 0;
  constructor(private k: number, private c: number) {}
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.k * (this.target - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/** Ключевые кадры взмаха: подъём с anticipation и перелётом, кисть отстаёт (углы в градусах, как у MascotSvg) */
const WAVE = {
  duration: 2.8,
  times: [0, 0.09, 0.27, 0.39, 0.51, 0.63, 0.75, 0.86, 1],
  arm: [0, -7, 124, 110, 128, 110, 126, 116, 0],
  paw: [0, 6, -136, -104, -144, -104, -140, -122, 0],
};
function keyed(times: number[], vals: number[], u: number) {
  if (u <= times[0]) return vals[0];
  for (let i = 1; i < times.length; i++) {
    if (u <= times[i]) {
      const f = sm((u - times[i - 1]) / (times[i] - times[i - 1]));
      return vals[i - 1] + (vals[i] - vals[i - 1]) * f;
    }
  }
  return vals[vals.length - 1];
}

const PART_NAMES = ["tail", "flame", "body", "ear-l", "ear-r", "head", "eye-l", "eye-r", "pupil-l", "pupil-r", "mouth", "mouth-open", "mouth-o", "arc-l", "arc-r", "arm"];

export class MascotAnimator {
  readonly pose: Pose;
  readonly parts = new Map<string, PartState>();
  private B: Record<string, number> = {};
  private tail: number[] = [];
  expression: RigExpression = "calm";
  action: RigAction = "idle";
  /** нормированное смещение указателя относительно кота, -1..1 (null — не следит) */
  gaze: { x: number; y: number } | null = null;
  reduced = false;

  private t = 0;
  private last = -1;
  private gx = new Spring(150, 17);
  private gy = new Spring(150, 17);
  private tilt = new Spring(90, 14);
  private earL = new Spring(220, 12);
  private earR = new Spring(220, 12);
  private squash = new Spring(260, 15);
  private hop = new Spring(120, 11);
  private closed = 0;
  private closeTarget = 0;
  private blinkAt = 3 + Math.random() * 4;
  private blinkUntil = -1;
  private slowBlink = false;
  private twitchAt = 6 + Math.random() * 6;
  private twitchSide = Math.random() < 0.5;
  private glanceAt = 4 + Math.random() * 4;
  private glanceUntil = -1;
  private glanceSide = Math.random() < 0.5 ? -1 : 1;
  private sighAt = 20 + Math.random() * 8;
  private sighStart = -9;
  private yawnStart = -9;
  private lastPointer = -99;
  private waveStart = -9;
  private waveRounds = 0;
  private tapWaveUntil = -1;
  private bag: string[] = [];
  private lastReaction = "";
  private actionStart = 0;
  private pettingUntil = -1;
  private squintUntil = -1;

  constructor(private rig: RigData) {
    this.pose = new Pose(rig);
    rig.bones.forEach((b, i) => (this.B[b.name] = i));
    for (let i = 0; this.B[`tail${i}`] !== undefined; i++) this.tail.push(this.B[`tail${i}`]);
    for (const n of PART_NAMES) this.parts.set(n, { opacity: 1, dx: 0, dy: 0, sx: 1, sy: 1 });
    this.update(0);
  }

  setAction(a: RigAction) {
    if (a === this.action) return;
    this.action = a;
    this.actionStart = this.t;
    if (a === "wave") this.pendingWave = 2;
    if (a === "celebrate") this.pendingHop = true;
  }
  private hopStart = -9;
  private pendingWave = 0;
  private pendingHop = false;

  /** тап/касание по коту: squash, уши и каждый третий-четвёртый раз — машет в ответ */
  poke() {
    const r = this.nextReaction();
    this.squash.v = -34; // толчок вниз, пружина вернёт с перелётом
    this.earL.v += -260; this.earR.v += 260;
    if (r === "wave" && this.action === "idle" && this.t > this.tapWaveUntil) {
      this.pendingWave = 1; this.tapWaveUntil = this.t + WAVE.duration + 0.1;
    } else if (r === "slowblink") { this.slowBlink = true; this.blinkUntil = this.t + 0.56; }
    else this.squintUntil = this.t + 0.38;
  }
  private nextReaction() {
    if (this.bag.length === 0) {
      const all = ["squash", "ears", "wave", "squash", "slowblink"];
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      if (all[all.length - 1] === this.lastReaction) all.reverse();
      this.bag = all;
    }
    this.lastReaction = this.bag.pop() as string;
    return this.lastReaction;
  }
  petting(on: boolean) { this.pettingUntil = on ? Infinity : -1; }
  pointerMoved() { this.lastPointer = this.t; }

  /** Кадр анимации: t — секунды с произвольного начала */
  update(now: number) {
    const dt = this.last < 0 ? 0 : clamp(now - this.last, 0, 0.05);
    this.last = now;
    this.t = now;
    const t = now;
    const P = this.pose, B = this.B;
    P.reset();
    if (this.pendingWave) { this.waveStart = t; this.waveRounds = this.pendingWave; this.pendingWave = 0; }
    if (this.pendingHop) { this.hopStart = t; this.pendingHop = false; }
    const still = this.reduced;
    const act = this.action;
    const exp = this.expression;

    // ----- дыхание: короткий вдох, пауза, долгий выдох (период 4.6 с); раз в ~25 с большой вздох -----
    const u = (t / 4.6) % 1;
    const breath = still ? 0 : u < 0.35 ? sm(u / 0.35) : u < 0.5 ? 1 : 1 - sm((u - 0.5) / 0.5);
    let sigh = 0;
    if (!still && t > this.sighAt) { this.sighStart = t; this.sighAt = t + 21 + Math.random() * 9; }
    const su = (t - this.sighStart) / 2.2;
    if (su >= 0 && su < 1) sigh = su < 0.35 ? sm(su / 0.35) : su < 0.5 ? 1 : 1 - sm((su - 0.5) / 0.5);
    P.sy[B.hip] = 1 + 0.018 * breath + 0.03 * sigh;
    P.sx[B.hip] = 1 + 0.007 * breath + 0.012 * sigh;
    P.sy[B.chest] = 1 + 0.006 * breath;
    P.ty[B.head] = (still ? 0 : -1.6 * Math.sin(Math.PI * Math.min(1, u * 1.4))) * 0.6; // голова догоняет грудь с задержкой

    // ----- взгляд -----
    const sleepy = exp === "sleepy" || exp === "listening";
    let tx = 0, ty = 0, tilt = 0;
    if (!still && !sleepy) {
      if (act === "think") { tx = 3.8; ty = -4.4; tilt = 6; }
      else if (this.gaze) { tx = this.gaze.x * 22; ty = this.gaze.y * 18; }
      else if (t < this.glanceUntil) { tx = this.glanceSide * 3.6 * 4.55; ty = 0; }
      if (exp === "focused") { ty += 6; tilt = Math.min(tilt, -3); }
      if (act === "think") { tx *= 4.55; ty *= 4.55; }
    }
    if (!still && t > this.glanceAt && act === "idle" && t - this.lastPointer > 2.5) {
      this.glanceSide = -this.glanceSide;
      this.glanceUntil = t + 1.1 + Math.random() * 1.1;
      if (Math.random() < 0.45) tilt = this.glanceSide * 3.5;
      this.glanceAt = t + 3.8 + Math.random() * 4.4;
    }
    if (t < this.glanceUntil && act === "idle" && !this.gaze) tilt = this.glanceSide * 3.5 * (Math.random() < 0 ? 1 : 1);
    const petting = t < this.pettingUntil;
    if (petting) tilt = 7;
    // зевок от скуки: долго никто не двигает курсор
    if (!still && act === "idle" && t - this.lastPointer > 20 && t - this.yawnStart > 26 && Math.random() < 0.002) this.yawnStart = t;
    const yawnU = (t - this.yawnStart) / 1.7;
    const yawning = yawnU >= 0 && yawnU < 1;
    if (yawning) tilt = -6;
    this.gx.target = tx; this.gy.target = ty; this.tilt.target = tilt;
    const gxv = this.gx.step(dt), gyv = this.gy.step(dt), tl = this.tilt.step(dt);

    P.rot[B.head] = (tl + clamp(gxv, -22, 22) * 0.1) * D2R + (still ? 0 : 0.6 * D2R * fbm(t * 0.22, 3));
    P.tx[B.head] = clamp(gxv, -22, 22) * 0.12;

    // ----- уши: дёрнулось то левое, то правое; пружины дают перелёт -----
    if (!still && t > this.twitchAt) {
      this.twitchSide = !this.twitchSide;
      (this.twitchSide ? this.earL : this.earR).v += this.twitchSide ? -330 : 330;
      this.twitchAt = t + 7 + Math.random() * 8;
    }
    this.earL.target = (sleepy ? -8 : yawning ? -10 : 0) * D2R * 57.3; this.earR.target = (sleepy ? 8 : yawning ? 10 : 0);
    P.rot[B["ear-l"]] = this.earL.step(dt) * D2R;
    P.rot[B["ear-r"]] = this.earR.step(dt) * D2R;
    // уши запаздывают за поворотом головы (follow-through)
    P.rot[B["ear-l"]] += -tl * 0.18 * D2R;
    P.rot[B["ear-r"]] += -tl * 0.18 * D2R;

    // ----- хвост: волна бежит по цепочке сегментов, кончик ходит шире; период не кратен дыханию -----
    const n = this.tail.length;
    const lively = act === "celebrate" ? 1.8 : exp === "excited" ? 1.4 : sleepy ? 0.45 : 1;
    if (!still) {
      for (let i = 0; i < n; i++) {
        const amp = (0.5 + (i / (n - 1)) * 2.6) * lively;
        const wave = Math.sin((t / 3.1) * Math.PI * 2 - i * 0.42 * 1.4) * amp;
        const rnd = fbm(t * 0.3 + i * 0.35, 21) * amp * 0.8;
        P.rot[this.tail[i]] = (wave + rnd) * D2R;
      }
      P.rot[B.flame] = (6 * fbm(t * 2.3, 5) + 2 * Math.sin(t * 7)) * D2R;
      const fl = 1 + 0.07 * fbm(t * 5.1, 9);
      P.sx[B.flame] = fl * 0.98; P.sy[B.flame] = fl;
    }

    // ----- squash при тапе и прыжок радости -----
    this.squash.target = 0;
    const sq = this.squash.step(dt);
    P.sy[B.root] = 1 - sq * 0.0018; P.sx[B.root] = 1 + sq * 0.0014;
    let hopY = 0;
    if (act === "celebrate" && !still) {
      const hu = ((t - this.hopStart) % 1.4) / 1.15;
      if (hu < 1) {
        const k = [0, 0.16, 0.42, 0.62, 0.8, 1]; const y = [0, 11, -91, 0, -32, 0];
        const sY = [1, 0.88, 1.08, 0.9, 1.03, 1]; const sX = [1, 1.08, 0.95, 1.08, 0.99, 1];
        hopY = keyed(k, y, hu); P.sy[B.root] *= keyed(k, sY, hu); P.sx[B.root] *= keyed(k, sX, hu);
      }
    }
    P.ty[B.root] = hopY;

    // ----- рука: взмах (ключи), радость — поднятая лапа, иначе в покое -----
    let armDeg = 0, pawDeg = 0;
    if (still) { if (act === "wave" || act === "celebrate") { armDeg = 116; pawDeg = -122; } }
    else if (act === "celebrate") { armDeg = 124; pawDeg = -136; }
    else {
      // раунды взмаха: WAVE.duration движения и пауза между раундами
      const cycle = WAVE.duration + 1.6; const tt = t - this.waveStart;
      if (tt >= 0 && tt < this.waveRounds * cycle - 1.6) {
        const r = Math.floor(tt / cycle); const local = (tt - r * cycle) / WAVE.duration;
        if (local < 1) { armDeg = keyed(WAVE.times, WAVE.arm, local); pawDeg = keyed(WAVE.times, WAVE.paw, local); }
      }
    }
    P.rot[B.arm] = armDeg * D2R; P.rot[B.paw] = pawDeg * D2R;

    // ----- веки: моргание (иногда двойное и «медленное — кошачье доверие»), сон и радость закрывают глаза -----
    if (!still && !sleepy && t > this.blinkAt && this.blinkUntil < t) {
      const roll = Math.random(); this.slowBlink = roll < 0.1;
      this.blinkUntil = t + (this.slowBlink ? 0.56 : 0.12);
      this.blinkAt = t + (roll > 0.86 && !this.slowBlink ? 0.3 : 4 + Math.random() * 7);
    }
    const eyesShut = sleepy || exp === "happy" || exp === "excited" || act === "celebrate" || yawning || petting;
    this.closeTarget = eyesShut || t < this.blinkUntil || t < this.squintUntil ? 1 : 0;
    const speed = this.slowBlink && this.closeTarget ? 1 / 0.28 : 1 / 0.07;
    this.closed += clamp(this.closeTarget - this.closed, -speed * dt, speed * dt);
    if (this.reduced) this.closed = this.closeTarget;

    // ----- части: прозрачность, взгляд, форма рта -----
    const set = (name: string, p: Partial<PartState>) => Object.assign(this.parts.get(name)!, p);
    const open = 1 - this.closed;
    set("eye-l", { opacity: open }); set("eye-r", { opacity: open });
    const pupilScale = exp === "excited" ? 1.15 : 1;
    const lim = (v: number, m: number) => clamp(v, -m, m);
    set("pupil-l", { opacity: open, dx: lim(gxv, 23), dy: lim(gyv, 19), sx: pupilScale, sy: pupilScale });
    set("pupil-r", { opacity: open, dx: lim(gxv, 23), dy: lim(gyv, 19), sx: pupilScale, sy: pupilScale });
    set("arc-l", { opacity: this.closed }); set("arc-r", { opacity: this.closed });
    // рот
    const mouthKind = yawning || exp === "excited" || act === "celebrate" ? "open" : act === "think" ? "o" : act === "wave" ? "smile" : exp === "focused" ? "flat" : exp === "happy" ? "smile" : "w";
    set("mouth-open", { opacity: mouthKind === "open" ? 1 : 0 }); set("mouth-o", { opacity: mouthKind === "o" ? 1 : 0 });
    const native = mouthKind === "w" || mouthKind === "smile" || mouthKind === "flat";
    set("mouth", { opacity: native ? 1 : 0, sx: mouthKind === "smile" ? 1.32 : mouthKind === "flat" ? 0.8 : 1, sy: mouthKind === "smile" ? 1.55 : mouthKind === "flat" ? 0.55 : 1 });
    set("arm", { opacity: 1 });
    P.update();
  }
}
