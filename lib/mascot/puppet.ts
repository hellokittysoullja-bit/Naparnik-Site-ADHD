/**
 * Мини-Rive для кота-напарника на PixiJS v8 + GSAP: скелет, скиннинг сеткой,
 * пружины (secondary motion), слоистая машина состояний, псевдо-3D взгляд,
 * процедурный шум. Слои — нарезка оригинального рисунка (design/mascot/parts.py →
 * public/mascot/parts + rig.json). API не зависит от движка: позже тот же
 * интерфейс можно подложить под Rive/Spine, не трогая код экранов.
 *
 * Координаты сцены — пиксели исходного рисунка 1264×848; показывается квадрат
 * VIEW (как viewBox у SVG-кота), поэтому кот встаёт на то же место.
 */
import type { Application as PixiApp, Container as PixiContainer, Matrix as PixiMatrix, Sprite as PixiSprite, MeshSimple as PixiMesh, Graphics as PixiGraphics, Texture } from "pixi.js";
import type { gsap as Gsap } from "gsap";
import defaultPreset from "./presets/default.json";
import { Spring, clamp, fbm, lerp, rand, smoothstep } from "./math";

export type Preset = typeof defaultPreset;
export type Mood = "idle" | "think" | "sad" | "sleep" | "focused";
export type OneShot = "wave" | "happy" | "react";
export type MouthShape = "smile" | "open" | "o" | "flat" | "sad";

type Part = { x: number; y: number; w: number; h: number; pivot: [number, number]; z: number };
type Rig = {
  canvas: { w: number; h: number };
  scale: number;
  parts: Record<string, Part>;
  tail_joints: [number, number][];
  eyes: Record<"L" | "R", { c: [number, number]; rx: number; ry: number; orx: number; ory: number }>;
};

export const VIEW = { x: 250, y: -85, size: 910 };

export type MascotOptions = {
  size?: number;
  /** заполнять контейнер (размер из CSS), а не фиксированный size */
  fill?: boolean;
  preset?: Partial<Preset>;
  /** base URL частей (по умолчанию /mascot/parts) */
  base?: string;
  interactive?: boolean;
  /** 30 с без событий → сон; 0 — выключить */
  sleepAfter?: number;
};

export type Mascot = {
  play: (name: OneShot) => Promise<void>;
  setMood: (mood: Mood) => void;
  lookAt: (x: number, y: number) => void;
  /** отпустить взгляд — возвращается к центру */
  lookRelease: () => void;
  blink: (double?: boolean) => void;
  preset: Preset;
  debug: { bones: boolean; mesh: boolean; pivots: boolean };
  mood: () => Mood;
  destroy: () => void;
  /** для лаборатории и тестов */
  _internals: {
    ov: Record<string, number>;
    bones: Record<string, { x: number; y: number; rotation: number }>;
    /** покадровый режим: остановить реальный тикер и двигать время руками */
    step: (dt: number) => void;
    /** только логика кадра без рендера — для замера бюджета CPU */
    tickOnly: (dt: number) => void;
  };
};

/* ── Кость: собственная (без Pixi-дерева), чтобы считать мир до рендера ── */
class Bone {
  x = 0; // смещение относительно опоры, в пикселях рисунка
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
  world!: PixiMatrix;
  bindInv!: PixiMatrix;
  skin!: PixiMatrix;
  prevWorldRot = 0;
  constructor(
    public name: string,
    public px: number,
    public py: number,
    public parent: Bone | null,
    M: typeof PixiMatrix,
  ) {
    this.world = new M();
    this.bindInv = new M();
    this.skin = new M();
  }
  worldRotation(): number {
    return Math.atan2(this.world.b, this.world.a);
  }
}

export async function createMascot(el: HTMLElement, opts: MascotOptions = {}): Promise<Mascot> {
  const [{ Application, Assets, Container, Sprite, MeshSimple, Graphics, Matrix }, { gsap }] = await Promise.all([
    import("pixi.js"),
    import("gsap"),
  ]);
  const base = opts.base ?? "/mascot/parts";
  const size = opts.fill ? Math.max(1, el.clientWidth || opts.size || 280) : (opts.size ?? 280);
  const preset: Preset = structuredClone(defaultPreset);
  if (opts.preset) deepMerge(preset as unknown as Record<string, unknown>, opts.preset as Record<string, unknown>);
  const rig: Rig = await (await fetch(`${base}/../rig.json`)).json();
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app: PixiApp = new Application();
  // бэкбуфер — под реальный размер на экране (не 910·DPR на 200-px кота)
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  await app.init({
    width: VIEW.size,
    height: VIEW.size,
    backgroundAlpha: 0,
    antialias: true,
    resolution: clamp((size * dpr) / VIEW.size, 0.25, 3),
    autoDensity: true,
  });
  el.appendChild(app.canvas);
  app.canvas.style.width = opts.fill ? "100%" : `${size}px`;
  app.canvas.style.height = opts.fill ? "100%" : `${size}px`;
  app.canvas.style.display = "block";
  app.canvas.style.touchAction = "manipulation";

  const world: PixiContainer = new Container();
  world.position.set(-VIEW.x, -VIEW.y);
  app.stage.addChild(world);

  /* ── текстуры ── */
  const names = Object.keys(rig.parts);
  const textures = Object.fromEntries(
    await Promise.all(names.map(async (n) => [n, await Assets.load(`${base}/${n}.webp`)] as const)),
  ) as unknown as Record<string, Texture>;
  const P = (n: string) => rig.parts[n];

  /* ── скелет ── */
  const bones: Record<string, Bone> = {};
  const bone = (name: string, px: number, py: number, parent: Bone | null) => (bones[name] = new Bone(name, px, py, parent, Matrix));
  const J = rig.tail_joints;
  const root = bone("root", 600, 768, null);
  const body = bone("body", 600, 768, root);
  const chest = bone("chest", 600, 640, body);
  const head = bone("head", 610, 590, chest);
  const headPar = bone("headPar", 610, 590, head); // параллакс контура головы
  const face = bone("face", 610, 440, headPar); // глаза/нос/рот: сдвиг сильнее
  const earL = bone("earL", 470, 255, headPar);
  const earR = bone("earR", 735, 245, headPar);
  const tails: Bone[] = [];
  for (let i = 0; i < J.length - 1; i++) tails.push(bone(`tail${i}`, J[i][0], J[i][1], i ? tails[i - 1] : body));
  const flame = bone("flame", 972, 415, tails[tails.length - 1]);
  const shoulderL = bone("shoulderL", 495, 600, chest);
  const pawR = bone("pawR", 745, 690, body);
  const order = Object.values(bones);
  for (const b of order) {
    // bind: мировая матрица покоя = перенос в опору
    b.world.set(1, 0, 0, 1, b.px, b.py);
    b.bindInv.copyFrom(b.world).invert();
  }
  const tmp = new Matrix();
  const updateBones = () => {
    for (const b of order) {
      const parentP = b.parent ? { x: b.parent.px, y: b.parent.py } : { x: 0, y: 0 };
      // local = T(opора − опора родителя + смещение) · R · S
      tmp.identity().translate(b.px - parentP.x + b.x, b.py - parentP.y + b.y);
      const c = Math.cos(b.rotation);
      const s = Math.sin(b.rotation);
      // tmp = T · (R·S)
      const rs = new Matrix(c * b.scaleX, s * b.scaleX, -s * b.scaleY, c * b.scaleY, 0, 0);
      tmp.append(rs);
      if (b.parent) b.world.copyFrom(b.parent.world).append(tmp);
      else b.world.copyFrom(tmp);
      b.skin.copyFrom(b.world).append(b.bindInv);
    }
  };
  updateBones();

  /* ── визуальные слои в z-порядке; каждый следует за своей костью ── */
  type Attached = { node: PixiContainer; bone: Bone; part: Part; offset: { x: number; y: number } };
  const attached: Attached[] = [];
  const texScale = 1 / rig.scale;
  const sprite = (name: string, b: Bone, parent: PixiContainer = world): PixiSprite => {
    const p = P(name);
    const s: PixiSprite = new Sprite(textures[name]);
    s.scale.set(texScale);
    parent.addChild(s);
    attached.push({ node: s, bone: b, part: p, offset: { x: 0, y: 0 } });
    return s;
  };
  const placeAttached = () => {
    for (const a of attached) {
      tmp.copyFrom(a.bone.skin).translate(0, 0);
      const m = tmp.clone().append(new Matrix(texScale, 0, 0, texScale, a.part.x + a.offset.x, a.part.y + a.offset.y));
      a.node.setFromMatrix(m);
    }
  };

  /* скиннинг сеткой: вершины в мире, веса к ≤2 костям */
  type Skin = { mesh: PixiMesh; rest: Float32Array; w: Float32Array; bi: Int16Array; deform?: (i: number, x: number, y: number, out: { x: number; y: number }) => void };
  const skins: Skin[] = [];
  const meshFor = (name: string, cols: number, rows: number, weight: (x: number, y: number) => [Bone, number, Bone | null]): Skin => {
    const p = P(name);
    const n = (cols + 1) * (rows + 1);
    const rest = new Float32Array(n * 2);
    const uvs = new Float32Array(n * 2);
    const indices: number[] = [];
    const w = new Float32Array(n);
    const bi = new Int16Array(n * 2);
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const i = r * (cols + 1) + c;
        const x = p.x + (p.w * c) / cols;
        const y = p.y + (p.h * r) / rows;
        rest[i * 2] = x;
        rest[i * 2 + 1] = y;
        uvs[i * 2] = c / cols;
        uvs[i * 2 + 1] = r / rows;
        const [b0, w0, b1] = weight(x, y);
        w[i] = w0;
        bi[i * 2] = order.indexOf(b0);
        bi[i * 2 + 1] = b1 ? order.indexOf(b1) : -1;
        if (r < rows && c < cols) {
          const a = i, b = i + 1, d = i + cols + 1;
          indices.push(a, b, d, b, d + 1, d);
        }
      }
    }
    const mesh: PixiMesh = new MeshSimple({ texture: textures[name], vertices: new Float32Array(rest), uvs, indices: new Uint32Array(indices) });
    world.addChild(mesh);
    const sk = { mesh, rest, w, bi };
    skins.push(sk);
    return sk;
  };
  const pt = { x: 0, y: 0 };
  const skinMeshes = () => {
    for (const sk of skins) {
      const v = sk.mesh.vertices as Float32Array;
      for (let i = 0; i < sk.w.length; i++) {
        let x = sk.rest[i * 2];
        let y = sk.rest[i * 2 + 1];
        if (sk.deform) {
          pt.x = x; pt.y = y;
          sk.deform(i, x, y, pt);
          x = pt.x; y = pt.y;
        }
        const b0 = order[sk.bi[i * 2]].skin;
        const w0 = sk.w[i];
        let ox = b0.a * x + b0.c * y + b0.tx;
        let oy = b0.b * x + b0.d * y + b0.ty;
        if (sk.bi[i * 2 + 1] >= 0 && w0 < 1) {
          const b1 = order[sk.bi[i * 2 + 1]].skin;
          const x1 = b1.a * x + b1.c * y + b1.tx;
          const y1 = b1.b * x + b1.d * y + b1.ty;
          ox = ox * w0 + x1 * (1 - w0);
          oy = oy * w0 + y1 * (1 - w0);
        }
        v[i * 2] = ox;
        v[i * 2 + 1] = oy;
      }
    }
  };

  // параметр вдоль цепочки хвоста
  const alongTail = (px: number, py: number) => {
    let best = { d: Infinity, s: 0 };
    for (let i = 0; i < J.length - 1; i++) {
      const [ax, ay] = J[i];
      const [bx, by] = J[i + 1];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      if (d < best.d) best = { d, s: i + t };
    }
    return best.s;
  };

  // 1-2. хвост (4×24 вдоль длины — сетка по коробке слоя) и огонёк
  meshFor("tail", 24, 24, (x, y) => {
    const s = alongTail(x, y); // 0..n-1
    const i = clamp(Math.floor(s + 0.5), 0, tails.length - 1); // ближайший сустав
    const f = s + 0.5 - i; // 0..1 между серединами
    if (i >= tails.length - 1) return [tails[tails.length - 1], 1, null];
    const w = 1 - smoothstep(f);
    return [tails[i], w, tails[i + 1]];
  });
  const flameSprite = sprite("flame", flame);
  // 3-4. уши: основание — голова, кончик — кость уха (гнётся, а не крутится куском)
  const earMesh = (name: string, b: Bone) =>
    meshFor(name, 6, 8, (x, y) => {
      const p = P(name);
      const reach = Math.hypot(p.w, p.h) * 0.7;
      const w = smoothstep(Math.hypot(x - b.px, y - b.py) / reach);
      return [b, w, headPar];
    });
  earMesh("ear_L", earL);
  earMesh("ear_R", earR);
  // 5. тело: сетка с деформером дыхания (грудь раздувается сильнее низа) и squash
  // 5. тело: сетка на кости тела; дыхание — масштаб кости от земли (грудка, голова и лапы
  // едут вместе с телом — швов нет), грудь поднимается сильнее низа сама собой
  meshFor("body", 8, 8, () => [body, 1, null]);
  // 6-8. лапы, грудка, голова
  sprite("paw_R", pawR);
  const pawLSprite = sprite("paw_L", shoulderL);
  const chestSprite = sprite("chest", chest);
  const headSprite = sprite("head", headPar);
  // порядок рисования меняется по ходу действия (как DrawRules в Rive): поднятая лапа —
  // перед щекой, опущенная — под грудкой
  let pawOnTop = false;
  const pawDrawOrder = () => {
    const up = Math.abs(shoulderL.rotation) > 0.5;
    if (up === pawOnTop) return;
    pawOnTop = up;
    world.setChildIndex(pawLSprite, up ? world.getChildIndex(headSprite) : world.getChildIndex(chestSprite));
  };

  /* глаза по схеме Live2D: контур — сетка, сплющивается к нижней дуге (закрытый глаз = контур,
     схлопнутый в дугу; «^ ^» — к верхней); заливка радужки, зрачок и блик — под маской ТОЙ ЖЕ
     формы, что и контур. Никаких век-дисков. */
  type Eye = { group: PixiContainer; mask: PixiGraphics; ring: Skin; pupil: PixiSprite; shine: PixiSprite; closed: PixiSprite; c: [number, number]; rx: number; ry: number; orx: number; ory: number };
  const eyes: Record<"L" | "R", Eye> = {} as Record<"L" | "R", Eye>;
  // состояние век на кадр: open 0..1, slant (наклон, внешний угол вниз при >0), happy — схлопывание к верхней дуге
  const lidState = { L: { open: 1, slant: 0, happy: 0 }, R: { open: 1, slant: 0, happy: 0 } };
  /* Сплющивание глаза с постоянным весом штриха: точка раскладывается на положение вдоль
     ОСЕВОЙ линии контура (угол) и отступ от неё (толщина). Осевая линия сжимается к линии
     закрытия (нижняя треть; для «^» — верхняя), отступ возвращается по нормали сжатой кривой —
     штрих не истончается, закрытый глаз = та же тушь одной толстой дугой. */
  const squash = (k: "L" | "R", x: number, y: number, out: { x: number; y: number }) => {
    const e = eyes[k];
    const st = lidState[k];
    const [cx, cy] = e.c;
    const am = (e.rx + e.orx) / 2; // полуоси осевой линии штриха
    const bm = (e.ry + e.ory) / 2;
    const nx = (x - cx) / am;
    const ny = (y - cy) / bm;
    const r = Math.hypot(nx, ny) || 1e-6;
    const th = Math.atan2(ny, nx);
    const d = (r - 1) * ((am + bm) / 2); // отступ от осевой линии, px рисунка
    const px = cx + Math.cos(th) * am;
    const py = cy + Math.sin(th) * bm;
    const sl = st.slant * (k === "L" ? 1 : -1); // грусть: внутренний угол выше, внешний ниже (у L внешний — слева)
    const happy = st.happy > 0.001;
    const open = happy ? 1 - st.happy : st.open;
    const kk = clamp(open, 0, 1);
    // линия закрытия — не горизонталь, а линия века: для грусти наклонена (прямая, как в
    // рисунке), для «^ ^» — «домик» с вершиной в центре; обе половины сходятся к ней без излома
    const t = (px - cx) / am;
    const yA = happy
      ? cy - 0.3 * bm - 0.4 * bm * (1 - Math.abs(t))
      : cy + 0.6 * bm + sl * bm * t;
    const moving = happy ? py > yA : py < yA; // половина, которая едет к линии закрытия
    const ks = 1 - 0.45 * (1 - kk); // «стоящая» половина чуть распрямляется, дуга остаётся
    const qy = moving ? yA + (py - yA) * kk : yA + (py - yA) * ks;
    const kEff = Math.max(moving ? kk : ks, 0.04);
    // нормаль сжатого эллипса: n ∝ (cos/a, sin/(b·k))
    const nnx = Math.cos(th) / am;
    const nny = Math.sin(th) / (bm * kEff);
    const nl = Math.hypot(nnx, nny) || 1e-6;
    // при смыкании два штриха ложатся друг на друга: толщину каждого слегка ужимаем, чтобы
    // закрытая линия была ~2 толщины штриха (как в нарисованных закрытых глазах), а не 4
    const dw = d * (0.55 + 0.45 * kEff);
    out.x = px + (dw * nnx) / nl;
    out.y = qy + (dw * nny) / nl;
  };
  /** та же деформация для маски: внутренний край штриха, при закрытии — пусто */
  const squashMask = (k: "L" | "R", x: number, y: number, out: { x: number; y: number }) => {
    // радужка прячется чуть раньше, чем штрихи сомкнутся: щели между веками не бывает
    const st = lidState[k];
    const open = st.happy > 0.001 ? 1 - st.happy : st.open;
    const saved = { open: st.open, happy: st.happy };
    const m = clamp((open - 0.2) / 0.8, 0, 1);
    if (st.happy > 0.001) st.happy = 1 - m; else st.open = m;
    squash(k, x, y, out);
    st.open = saved.open; st.happy = saved.happy;
    if (m <= 0) { out.x = eyes[k].c[0]; out.y = eyes[k].c[1]; } // вырожденный полигон — радужки не видно
  };
  for (const k of ["L", "R"] as const) {
    const e = rig.eyes[k];
    const group: PixiContainer = new Container();
    world.addChild(group);
    const mask: PixiGraphics = new Graphics();
    group.addChild(mask);
    group.mask = mask;
    sprite(`iris_${k}`, face, group);
    const pupil = sprite(`pupil_${k}`, face, group);
    const shine = sprite(`shine_${k}`, face, group);
    const ring = meshFor(`ring_${k}`, 12, 12, () => [face, 1, null]);
    ring.deform = (_i, x, y, out) => squash(k, x, y, out);
    // «^ ^» — дуги, сгенерированные по рисунку: подмешиваются в конце счастливого прищура
    const closed = rig.parts[`happy_${k}`] ? sprite(`happy_${k}`, face) : sprite(`closed_${k}`, face);
    closed.alpha = 0;
    eyes[k] = { group, mask, ring, pupil, shine, closed, c: e.c, rx: e.rx, ry: e.ry, orx: e.orx, ory: e.ory };
  }
  const maskPt = { x: 0, y: 0 };
  const drawMasks = () => {
    for (const k of ["L", "R"] as const) {
      const e = eyes[k];
      const m = face.skin;
      const g = e.mask.clear();
      // эллипс заливки, сплющенный той же функцией, что и контур, затем — в мир через кость лица
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const x = e.c[0] + Math.cos(a) * (e.rx + 2);
        const y = e.c[1] + Math.sin(a) * (e.ry + 2);
        squashMask(k, x, y, maskPt);
        const wx = m.a * maskPt.x + m.c * maskPt.y + m.tx;
        const wy = m.b * maskPt.x + m.d * maskPt.y + m.ty;
        if (i === 0) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      g.closePath().fill(0xffffff);
    }
  };
  /* рот: варианты, кроссфейд */
  const mouths: Record<MouthShape, PixiSprite> = {
    smile: sprite("mouth_smile", face),
    open: sprite("mouth_open", face),
    o: sprite("mouth_o", face),
    flat: sprite("mouth_flat", face),
    sad: sprite("mouth_sad", face),
  };
  for (const m of Object.values(mouths)) m.alpha = 0;
  mouths.smile.alpha = 1;
  let mouthNow: MouthShape = "smile";
  const setMouth = (m: MouthShape) => {
    if (m === mouthNow) return;
    gsap.to(mouths[mouthNow], { alpha: 0, duration: 0.12 });
    gsap.to(mouths[m], { alpha: 1, duration: 0.12 });
    mouthNow = m;
  };

  /* отладка: кости, сетки, шарниры */
  const dbg: PixiGraphics = new Graphics();
  world.addChild(dbg);
  const debug = { bones: false, mesh: false, pivots: false };
  const drawDebug = () => {
    dbg.clear();
    if (debug.mesh) {
      for (const sk of skins) {
        const v = sk.mesh.vertices as Float32Array;
        const idx = sk.mesh.geometry.indices;
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t], b = idx[t + 1], c = idx[t + 2];
          dbg.moveTo(v[a * 2], v[a * 2 + 1]).lineTo(v[b * 2], v[b * 2 + 1]).lineTo(v[c * 2], v[c * 2 + 1]).lineTo(v[a * 2], v[a * 2 + 1]);
        }
      }
      dbg.stroke({ color: 0x4fd1c5, width: 1, alpha: 0.6 });
    }
    if (debug.bones) {
      for (const b of order) {
        if (!b.parent) continue;
        dbg.moveTo(b.parent.world.tx, b.parent.world.ty).lineTo(b.world.tx, b.world.ty);
      }
      dbg.stroke({ color: 0xffd166, width: 3 });
      for (const b of order) dbg.circle(b.world.tx, b.world.ty, 7).fill({ color: 0xffd166 });
    }
    if (debug.pivots) {
      for (const n of names) {
        const [x, y] = P(n).pivot;
        dbg.circle(x, y, 6).fill({ color: 0xff3b30 });
      }
    }
  };

  /* ── часы: реальные или виртуальные (покадровая запись: step(dt) двигает и движок, и GSAP) ── */
  const clock = { virtual: null as number | null };
  const nowMs = () => clock.virtual ?? performance.now();
  /* ── анимационное состояние ── */
  const t0 = nowMs();
  let last = t0;
  const springs = {
    earL: new Spring(), earR: new Spring(), flame: new Spring(),
    tail: tails.map(() => new Spring()),
    headRot: new Spring(), gazeX: new Spring(), gazeY: new Spring(),
  };
  const look = { tx: 0, ty: 0, held: false };
  // поза настроения: все поля ключуются в каждом настроении — ничего не «залипает»
  type Pose = { headRot: number; headY: number; earL: number; earR: number; lidOpen: number; lidSlant: number; tailAmp: number; breathMul: number; pupil: number; bodyRot: number };
  const POSES: Record<Mood, Pose> = {
    idle: { headRot: 0, headY: 0, earL: 0, earR: 0, lidOpen: 1 - preset.lids.idle.y, lidSlant: 0, tailAmp: 1, breathMul: 1, pupil: 1, bodyRot: 0 },
    think: { headRot: 0.14, headY: 0, earL: 0.08, earR: -0.05, lidOpen: 1 - preset.lids.think.y, lidSlant: 0, tailAmp: 0.7, breathMul: 1, pupil: 1, bodyRot: 0 },
    sad: { headRot: 0.05, headY: 10, earL: -0.6, earR: 0.6, lidOpen: 1 - preset.lids.sad.y, lidSlant: preset.lids.sad.rot, tailAmp: 0.4, breathMul: 1.4, pupil: 0.95, bodyRot: 0 },
    sleep: { headRot: 0.1, headY: 14, earL: -0.2, earR: 0.2, lidOpen: 0, lidSlant: 0, tailAmp: 0.3, breathMul: 1.8, pupil: 1, bodyRot: 0 },
    focused: { headRot: 0, headY: 0, earL: 0.05, earR: -0.05, lidOpen: 1 - preset.lids.focused.y, lidSlant: 0, tailAmp: 0.8, breathMul: 0.9, pupil: 1, bodyRot: 0 },
  };
  const pose: Pose = { ...POSES.idle };
  let moodNow: Mood = "idle";
  const MOUTH_FOR: Record<Mood, MouthShape> = { idle: "smile", think: "o", sad: "sad", sleep: "flat", focused: "flat" };
  const setMood = (m: Mood) => {
    moodNow = m;
    gsap.to(pose, { ...POSES[m], duration: preset.states.crossfade, ease: "sine.inOut", overwrite: true });
    setMouth(MOUTH_FOR[m]);
  };
  // оверлей одноразовых действий — складывается с позой
  const ov = { bodyY: 0, bodySX: 1, bodySY: 1, headRot: 0, headY: 0, earL: 0, earR: 0, shoulder: 0, pawY: 0, closed: 0, chestY: 0 };
  let current: gsap.core.Timeline | null = null;
  const play = (name: OneShot) =>
    new Promise<void>((resolve) => {
      current?.kill();
      const tl = gsap.timeline({ onComplete: () => { current = null; resolve(); } });
      current = tl;
      if (reduce) { tl.to(ov, { duration: 0.01 }); return; }
      if (name === "wave") {
        const d = preset.states.waveDur;
        // антиципация (тело чуть назад, присел) → плечо выводит лапу из-под грудки → 3 взмаха → возврат
        tl.to(ov, { bodySY: 0.97, bodySX: 1.02, headRot: -0.05, duration: 0.18, ease: "sine.inOut" })
          .to(ov, { shoulder: 2.2, pawY: -8, bodySY: 1.0, bodySX: 1.0, headRot: 0.09, duration: 0.42, ease: "back.out(1.6)" }, 0.12)
          .to(ov, { shoulder: 1.85, duration: 0.22, ease: "sine.inOut" })
          .to(ov, { shoulder: 2.3, duration: 0.22, ease: "sine.inOut" })
          .to(ov, { shoulder: 1.85, duration: 0.22, ease: "sine.inOut" })
          .to(ov, { shoulder: 2.3, duration: 0.22, ease: "sine.inOut" })
          .to(ov, { shoulder: 1.9, duration: 0.22, ease: "sine.inOut" })
          .to(ov, { shoulder: 0, pawY: 0, headRot: 0, duration: Math.max(0.3, d - 1.9), ease: "power2.inOut" });
        setMouth("smile");
        tl.call(() => setMouth(MOUTH_FOR[moodNow]), [], d - 0.1);
        kickBlinkSoon(0.3);
      } else if (name === "happy") {
        // присел (антиципация) → прыжок с вытяжкой → приземление со сжатием → settle, два раза
        const jump = (at: number) =>
          tl.to(ov, { bodyY: 11, bodySY: 0.88, bodySX: 1.08, duration: 0.16, ease: "sine.in" }, at)
            .to(ov, { bodyY: -92, bodySY: 1.08, bodySX: 0.95, duration: 0.3, ease: "power2.out" })
            .to(ov, { bodyY: 0, bodySY: 0.9, bodySX: 1.08, duration: 0.24, ease: "power2.in" })
            .to(ov, { bodyY: -30, bodySY: 1.03, bodySX: 0.99, duration: 0.2, ease: "sine.out" })
            .to(ov, { bodyY: 0, bodySY: 1, bodySX: 1, duration: 0.25, ease: "sine.inOut" });
        jump(0);
        jump(preset.states.happyDur + 0.2);
        tl.to(ov, { closed: 1, duration: 0.1 }, 0.1).to(ov, { closed: 0, duration: 0.15 }, preset.states.happyDur * 2 + 0.1);
        setMouth("open");
        tl.call(() => setMouth(MOUTH_FOR[moodNow]), [], preset.states.happyDur * 2 + 0.3);
      } else {
        // тап: сжался → подпрыгнул → уши торчком и доболтались (пружины)
        tl.to(ov, { bodyY: 7, bodySY: 0.9, bodySX: 1.07, duration: 0.1, ease: "sine.in" })
          .to(ov, { bodyY: -22, bodySY: 1.05, bodySX: 0.97, duration: 0.16, ease: "power2.out" })
          .to(ov, { bodyY: 0, bodySY: 1, bodySX: 1, duration: 0.2, ease: "sine.inOut" });
        springs.earL.kick(-4.5);
        springs.earR.kick(4.5);
        kickBlinkSoon(0.05);
      }
    });

  /* моргание: веко вниз 70 мс, держать 40, вверх 110; случайный интервал, иногда двойное */
  const blinkState = { t: 0 };
  let blinkTimer: gsap.core.Tween | null = null;
  const doBlink = (dbl = false) => {
    const b = preset.blink;
    const tl = gsap.timeline();
    const one = () => tl.to(blinkState, { t: 1, duration: b.down, ease: "power2.in" }).to(blinkState, { t: 0, duration: b.up, ease: "power2.out" }, `+=${b.hold}`);
    one();
    if (dbl) one();
    // после смыкания зрачок чуть расширяется и сужается с перелётом
    tl.to(pupilDil, { v: 1.08, duration: 0.08 }, b.down + b.hold).to(pupilDil, { v: 1, duration: 0.35, ease: "back.out(2)" });
  };
  const pupilDil = { v: 1 };
  const scheduleBlink = () => {
    blinkTimer?.kill();
    blinkTimer = gsap.delayedCall(rand(preset.blink.min, preset.blink.max), () => {
      if (moodNow !== "sleep") doBlink(Math.random() < preset.blink.double);
      scheduleBlink();
    });
  };
  const kickBlinkSoon = (delay: number) => {
    blinkTimer?.kill();
    blinkTimer = gsap.delayedCall(delay, () => { doBlink(false); scheduleBlink(); });
  };
  scheduleBlink();

  /* взгляд: цель → пружины; псевдо-3D параллакс по глубине */
  const lookAt = (x: number, y: number) => {
    look.tx = clamp(x, -1, 1);
    look.ty = clamp(y, -1, 1);
    look.held = true;
    activity();
  };
  const lookRelease = () => { look.held = false; look.tx = 0; look.ty = 0; };

  /* авто-сон и пробуждение */
  let lastActivity = nowMs();
  let autoSleeping = false;
  const activity = () => {
    lastActivity = nowMs();
    if (autoSleeping) { autoSleeping = false; setMood("idle"); }
  };

  /* ── главный цикл ── */
  const nz = (seed: number, speed = preset.noise.speed) => fbm(((nowMs() - t0) / 1000) * speed, seed);
  let glanceAt = rand(4, 9);
  let glanceSide = 1;
  const tick = () => {
    const now = nowMs();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    const S = preset.springs;
    springs.earL.stiffness = S.earL.stiffness; springs.earL.damping = S.earL.damping;
    springs.earR.stiffness = S.earR.stiffness; springs.earR.damping = S.earR.damping;
    springs.flame.stiffness = S.flame.stiffness; springs.flame.damping = S.flame.damping;
    springs.headRot.stiffness = S.head.stiffness; springs.headRot.damping = S.head.damping;
    springs.gazeX.stiffness = S.gaze.stiffness; springs.gazeX.damping = S.gaze.damping;
    springs.gazeY.stiffness = S.gaze.stiffness; springs.gazeY.damping = S.gaze.damping;

    // дыхание: вдох короче выдоха, удержание на пике
    const period = preset.breath.period * pose.breathMul;
    const ph = (t / period) % 1;
    const breath = ph < 0.4 ? smoothstep(ph / 0.4) : ph < 0.4 + preset.breath.hold ? 1 : 1 - smoothstep((ph - 0.4 - preset.breath.hold) / (0.6 - preset.breath.hold));
    body.scaleY = 1 + breath * preset.breath.chest;
    body.scaleX = 1 + breath * preset.breath.bottom;
    const phR = ((t - 0.14) / period + 1) % 1;
    const breathR = phR < 0.4 ? smoothstep(phR / 0.4) : phR < 0.4 + preset.breath.hold ? 1 : 1 - smoothstep((phR - 0.4 - preset.breath.hold) / (0.6 - preset.breath.hold));

    // взгляд в сторону и обратно, когда никто не водит курсором
    if (!look.held && moodNow === "idle" && t > glanceAt && !reduce) {
      glanceSide = -glanceSide;
      look.tx = glanceSide * 0.6; look.ty = rand(-0.3, 0.25);
      gsap.delayedCall(rand(1.1, 2.2), () => { if (!look.held) { look.tx = 0; look.ty = 0; } });
      if (Math.random() < 0.5) doBlink(false);
      glanceAt = t + rand(4, 9);
    }
    const gx = springs.gazeX.step(dt, moodNow === "sleep" ? 0 : look.tx);
    const gy = springs.gazeY.step(dt, moodNow === "sleep" ? 0 : look.ty);
    const headTilt = springs.headRot.step(dt, pose.headRot + gx * preset.look.headRot + (reduce ? 0 : nz(1) * preset.noise.head));

    // тело / голова
    const noiseB = reduce ? 0 : nz(0) * preset.noise.body;
    root.y = ov.bodyY;
    root.scaleX = ov.bodySX;
    root.scaleY = ov.bodySY;
    body.rotation = noiseB + pose.bodyRot;
    chest.y = -breathR * preset.breath.headRide * 0.35;
    head.y = -breathR * preset.breath.headRide * 0.65 + pose.headY + ov.headY;
    head.rotation = headTilt + ov.headRot;
    // параллакс: контур головы сдвигается слабее лица
    headPar.x = gx * 18 * preset.look.head;
    headPar.y = gy * 10 * preset.look.head;
    face.x = gx * 18 * preset.look.face;
    face.y = gy * 10 * preset.look.face;
    // уши: поза + шум + пружина (инерция от поворота головы)
    const dHead = head.worldRotation() - head.prevWorldRot;
    head.prevWorldRot = head.worldRotation();
    springs.earL.kick(-dHead * S.earL.inertia * 60 * dt);
    springs.earR.kick(-dHead * S.earR.inertia * 60 * dt);
    const earNoise = reduce ? 0 : preset.noise.ears;
    earL.rotation = pose.earL + ov.earL + springs.earL.step(dt, 0) + nz(2) * earNoise + gx * 0.08 * (gx > 0 ? preset.look.earFar : preset.look.earNear);
    earR.rotation = pose.earR + ov.earR + springs.earR.step(dt, 0) + nz(3) * earNoise + gx * 0.08 * (gx < 0 ? preset.look.earFar : preset.look.earNear);
    // хвост: волна (амплитуда растёт к кончику, своя частота) + пружины с затуханием к кончику
    const tailAmp = (moodNow === "idle" && pose.tailAmp > 0.9 ? preset.tail.swayAmp : preset.tail.swayAmp * pose.tailAmp);
    const tailPeriod = preset.tail.swayPeriod;
    let parentRot = body.worldRotation();
    tails.forEach((b, i) => {
      const sp = springs.tail[i];
      sp.stiffness = S.tail.stiffness * Math.pow(S.tail.falloff, i);
      sp.damping = S.tail.damping * Math.pow(S.tail.falloff, i * 0.5);
      const target = (reduce ? 0 : Math.sin((t / tailPeriod) * Math.PI * 2 - i * 0.42) * tailAmp * (0.6 + i * 0.25) + nz(10 + i, 0.3) * 0.004);
      const wr = b.worldRotation();
      sp.kick(-(wr - parentRot - (b.prevWorldRot - parentRot)) * 0);
      b.prevWorldRot = wr;
      b.rotation = sp.step(dt, target);
      parentRot = wr;
    });
    // инерция хвоста от движения тела: прыжок/приседание дёргает основание
    springs.tail[0].kick(-(ov.bodyY - prevBodyY) * 0.0025 * S.tail.inertia);
    prevBodyY = ov.bodyY;
    // огонёк: пружина от хвоста + мерцание
    const fl = flame.parent!;
    const dFl = fl.worldRotation() - fl.prevWorldRot;
    fl.prevWorldRot = fl.worldRotation();
    springs.flame.kick(-dFl * S.flame.inertia * 60 * dt);
    flame.rotation = springs.flame.step(dt, 0) + (reduce ? 0 : nz(20, preset.flame.flickerSpeed) * 0.06);
    flame.scaleX = 1 + (reduce ? 0 : nz(21, preset.flame.flickerSpeed * 1.4) * preset.flame.flickerAmp);
    flame.scaleY = 1 - (reduce ? 0 : nz(22, preset.flame.flickerSpeed * 1.1) * preset.flame.flickerAmp);
    // лапа: плечо выводит ногу из-под грудки
    shoulderL.rotation = ov.shoulder;
    shoulderL.y = ov.pawY;
    pawR.rotation = reduce ? 0 : nz(30, 0.1) * 0.02;

    updateBones();
    skinMeshes();
    placeAttached();
    pawDrawOrder();
    drawMasks();

    // глаза: веки = сплющивание контура и маски (состояние на кадр), зрачок внутри радужки, блик на месте
    const L = preset.look;
    const open = Math.min(pose.lidOpen, 1 - blinkState.t);
    for (const k of ["L", "R"] as const) {
      const e = eyes[k];
      lidState[k].open = open;
      lidState[k].slant = pose.lidSlant;
      lidState[k].happy = ov.closed;
      // зрачок никогда не пересекает край радужки: запас = радиус радужки − полуразмер зрачка − 4
      const pw = P(`pupil_${k}`).w / 2, ph = P(`pupil_${k}`).h / 2;
      // счастливый прищур: контур схлопывается, в последней трети кроссфейд на нарисованные «^ ^»
      const hap = smoothstep((ov.closed - 0.6) / 0.35);
      e.closed.alpha = hap;
      e.ring.mesh.alpha = 1 - hap;
      const px = clamp(gx * L.pupil, -(e.rx - pw - 4), e.rx - pw - 4);
      const py = clamp(gy * L.pupilY, -(e.ry - ph - 4), e.ry - ph - 4);
      e.pupil.x += px; e.pupil.y += py;
      const dil = pupilDil.v * pose.pupil;
      e.pupil.scale.set(texScale * dil);
      e.pupil.x -= (P(`pupil_${k}`).w * (dil - 1)) / 2; e.pupil.y -= (P(`pupil_${k}`).h * (dil - 1)) / 2;
    }
    // контур и маска считаются после обновления состояния век
    skinMeshes();
    drawMasks();
    drawDebug();
  };
  let prevBodyY = 0;
  app.ticker.add(tick);

  /* ── события: тап, курсор, видимость, авто-сон ── */
  const onDown = (ev: PointerEvent) => {
    ev.preventDefault();
    activity();
    void play("react");
  };
  const onMove = (ev: PointerEvent) => {
    const r = app.canvas.getBoundingClientRect();
    const dx = (ev.clientX - (r.left + r.width / 2)) / (r.width * preset.look.range);
    const dy = (ev.clientY - (r.top + r.height * 0.45)) / (r.height * preset.look.range);
    look.tx = clamp(dx, -1, 1); look.ty = clamp(dy, -1, 1);
    look.held = true;
    activity();
    clearTimeout(releaseT);
    releaseT = setTimeout(() => { look.held = false; look.tx = 0; look.ty = 0; }, 2500);
  };
  let releaseT: ReturnType<typeof setTimeout>;
  if (opts.interactive !== false) {
    app.canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
  }
  const onVis = () => (document.hidden ? app.ticker.stop() : app.ticker.start());
  document.addEventListener("visibilitychange", onVis);
  const sleepAfter = opts.sleepAfter ?? preset.states.sleepAfter;
  const sleepCheck = sleepAfter
    ? setInterval(() => {
        if (!autoSleeping && moodNow === "idle" && nowMs() - lastActivity > sleepAfter * 1000) {
          autoSleeping = true;
          setMood("sleep");
        }
      }, 1000)
    : null;

  return {
    play,
    setMood,
    lookAt,
    lookRelease,
    blink: (d) => doBlink(!!d),
    preset,
    debug,
    mood: () => moodNow,
    _internals: {
      ov, bones, attached,
      step: (dt: number) => {
        if (clock.virtual === null) {
          clock.virtual = performance.now();
          app.ticker.stop();
          gsap.ticker.remove(gsap.updateRoot);
        }
        clock.virtual += dt * 1000;
        gsap.updateRoot(clock.virtual / 1000);
        tick();
        app.render();
      },
      tickOnly: (dt: number) => {
        if (clock.virtual === null) { clock.virtual = performance.now(); app.ticker.stop(); gsap.ticker.remove(gsap.updateRoot); }
        clock.virtual += dt * 1000;
        gsap.updateRoot(clock.virtual / 1000);
        tick();
      },
    } as unknown as Mascot["_internals"],
    destroy: () => {
      app.ticker.remove(tick);
      blinkTimer?.kill();
      current?.kill();
      if (sleepCheck) clearInterval(sleepCheck);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      app.destroy(true, { children: true });
    },
  };
}

function deepMerge(dst: Record<string, unknown>, src: Record<string, unknown>) {
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v) && typeof dst[k] === "object") deepMerge(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
    else dst[k] = v;
  }
}
