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
/** типы моргания: обычное (80/40/175 мс), быстрое, двойное, длинное «понял» с кивком, половинное, сонное */
export type BlinkType = "normal" | "fast" | "double" | "long" | "half" | "sleepy";
/** события диалога, к которым привязывается моргание */
export type Cue = "speechEnd" | "userSubmitted" | "expressionChange";

type Part = { x: number; y: number; w: number; h: number; pivot: [number, number]; z: number };
type Rig = {
  canvas: { w: number; h: number };
  scale: number;
  parts: Record<string, Part>;
  tail_joints: [number, number][];
  eyes: Record<"L" | "R", { c: [number, number]; rx: number; ry: number; orx: number; ory: number }>;
};

/** кейформы глаза (design/mascot/eyecurves.py): по N колонкам — осевая y и толщина верхнего (up/tu)
 *  и нижнего (lo/tl) штрихов, o — открытость ключа (1 — открыт, 0 — дуга закрытого глаза) */
type EyeKey = { up: number[]; lo: number[]; tu: number[]; tl: number[]; o: number };
type EyeKeyforms = { N: number; eyes: Record<"L" | "R", { c: [number, number]; x0: number; x1: number; keys: Record<string, EyeKey> }> };

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
  /** моргнуть: тип или true = двойное */
  blink: (type?: boolean | BlinkType) => void;
  /** медленное моргание — жест доверия кошки (серия полу-морганий → прищур/закрытие > 0,5 с) */
  slowBlink: () => boolean;
  /** событие диалога: конец реплики, ввод отправлен, смена выражения — вероятностное моргание */
  cue: (c: Cue) => void;
  /** пользователь печатает — моргать в 3,3 раза реже */
  setAttentive: (on: boolean) => void;
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
  const [{ Application, Assets, Container, Sprite, MeshSimple, Graphics, Matrix, Texture: Tex }, { gsap }] = await Promise.all([
    import("pixi.js"),
    import("gsap"),
  ]);
  const base = opts.base ?? "/mascot/parts";
  const size = opts.fill ? Math.max(1, el.clientWidth || opts.size || 280) : (opts.size ?? 280);
  const preset: Preset = structuredClone(defaultPreset);
  if (opts.preset) deepMerge(preset as unknown as Record<string, unknown>, opts.preset as Record<string, unknown>);
  const rig: Rig = await (await fetch(`${base}/../rig.json`)).json();
  const eyeData: EyeKeyforms = await (await fetch(`${base}/../eyes.json`)).json();
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
  type Attached = { node: PixiContainer; bone: Bone; part: Part; offset: { x: number; y: number }; sx: number; sy: number };
  const attached: Attached[] = [];
  const texScale = 1 / rig.scale;
  const sprite = (name: string, b: Bone, parent: PixiContainer = world): PixiSprite => {
    const p = P(name);
    const s: PixiSprite = new Sprite(textures[name]);
    s.scale.set(texScale);
    parent.addChild(s);
    attached.push({ node: s, bone: b, part: p, offset: { x: 0, y: 0 }, sx: 1, sy: 1 });
    return s;
  };
  const placeAttached = () => {
    for (const a of attached) {
      tmp.copyFrom(a.bone.skin).translate(0, 0);
      // масштаб слоя — вокруг его центра (зрачок расширяется на месте), поверх трансформации кости
      const { sx, sy } = a;
      const m = tmp.clone().append(new Matrix(texScale * sx, 0, 0, texScale * sy, a.part.x + a.offset.x - (a.part.w * (sx - 1)) / 2, a.part.y + a.offset.y - (a.part.h * (sy - 1)) / 2));
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

  /* Глаза — кейформы-КРИВЫЕ (как в Live2D): верхний и нижний штрихи контура заданы осевой
     линией и толщиной по колонкам, снятыми с ключевых кадров (открыт → веко на 25/40/50 % →
     закрыт; грусть; «^ ^»). Рантайм интерполирует кривые между кейформами и рисует тушь ЛЕНТОЙ
     (полоса-сетка с 1-px мягкой кромкой); радужка, зрачок и блик — под маской между штрихами.
     Контур-рисунок стоит на месте, пока веко скользит внутри него, и растворяется, когда штрихи
     сходятся в дугу. Ни сплющивания текстуры, ни дисков, ни «срезов». */
  const NC = eyeData.N;
  // тушь: 1×32, альфа 0 → 1 по верхней половине и 1 → 0 по нижней — линейная кромка ленты
  const inkTexture: Texture = (() => {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 32;
    const g = c.getContext("2d")!;
    for (let y = 0; y < 32; y++) {
      const a = y < 16 ? (y + 0.5) / 16 : (31.5 - y) / 16;
      g.fillStyle = `rgba(12,15,5,${Math.min(1, a).toFixed(3)})`;
      g.fillRect(0, y, 1, 1);
    }
    return Tex.from(c);
  })();
  type Ribbon = { mesh: PixiMesh; v: Float32Array };
  const ribbon = (parent: PixiContainer): Ribbon => {
    const n = NC * 4;
    const uvs = new Float32Array(n * 2);
    const idx: number[] = [];
    const vv = [0, 0.5, 0.5, 1]; // внешняя кромка (прозрачно) → тело туши → внешняя кромка
    for (let i = 0; i < NC; i++) {
      for (let j = 0; j < 4; j++) { uvs[(i * 4 + j) * 2] = i / (NC - 1); uvs[(i * 4 + j) * 2 + 1] = vv[j]; }
      if (i < NC - 1) for (let j = 0; j < 3; j++) { const a0 = i * 4 + j, b0 = a0 + 1, c0 = a0 + 4, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
    }
    const mesh: PixiMesh = new MeshSimple({ texture: inkTexture, vertices: new Float32Array(n * 2), uvs, indices: new Uint32Array(idx) });
    parent.addChild(mesh);
    return { mesh, v: mesh.vertices as Float32Array };
  };
  type Eye = { group: PixiContainer; mask: PixiGraphics; ring: Skin; lid: Ribbon; low: Ribbon; pupil: PixiSprite; pupilAtt: Attached; irisAtt: Attached; shineAtt: Attached; shine: PixiSprite; c: [number, number]; rx: number; ry: number;
    up: Float32Array; lo: Float32Array; tu: Float32Array; tl: Float32Array; xs: Float32Array; squash: number; mapY: (x: number, y: number) => number; scratchT: Float32Array; scratchB: Float32Array };
  const eyes: Record<"L" | "R", Eye> = {} as Record<"L" | "R", Eye>;
  // цепочка моргания по открытости; закрытая форма — НЕЙТРАЛЬНАЯ ‿ («shut»); дуга ∩ из кадра «закрыт» —
  // отдельный параметр «улыбка глаз» (EyeSmile), «^ ^» — радость
  const CHAIN = ["shut", "half", "lids50", "lids25", "open"];
  for (const k of ["L", "R"] as const) {
    const e = rig.eyes[k];
    const d = eyeData.eyes[k];
    const group: PixiContainer = new Container();
    world.addChild(group);
    const mask: PixiGraphics = new Graphics();
    group.addChild(mask);
    group.mask = mask;
    sprite(`iris_${k}`, face, group);
    const irisAtt = attached[attached.length - 1];
    const pupil = sprite(`pupil_${k}`, face, group);
    const shine = sprite(`shine_${k}`, face, group);
    const shineAtt = attached[attached.length - 1];
    // контур-рисунок: сетка; при смыкании складывается между текущими верхней и нижней кривыми
    // (верх контура съезжает к веку, низ — к нижнему штриху, углы сжимаются к концам дуги)
    const ring = meshFor(`ring_${k}`, 16, 16, () => [face, 1, null]);
    const low = ribbon(world);
    const lid = ribbon(world);
    const xs = new Float32Array(NC);
    for (let i = 0; i < NC; i++) xs[i] = d.x0 + ((d.x1 - d.x0) * i) / (NC - 1);
    eyes[k] = { group, mask, ring, lid, low, pupil, pupilAtt: attached[attached.length - 2], irisAtt, shineAtt, shine, c: e.c, rx: e.rx, ry: e.ry,
      up: new Float32Array(NC), lo: new Float32Array(NC), tu: new Float32Array(NC), tl: new Float32Array(NC), xs, squash: 0, mapY: (_x, y) => y, scratchT: new Float32Array(NC), scratchB: new Float32Array(NC) };
    const O = d.keys.open;
    const at = (arr: ArrayLike<number>, u: number) => { const i = Math.floor(u), f = u - i; return i >= NC - 1 ? arr[NC - 1] : arr[i] * (1 - f) + arr[i + 1] * f; };
    // куда уезжает точка покоя (x, y) контура: верх контура съезжает к веку по мере смыкания, низ
    // ВСЕГДА совпадает с нижним штрихом (лента лежит на нём тушь в тушь — второй линии нет), бока
    // сжимаются между ними и чуть сходятся к центру — под толстые концы дуги
    const ringMapY = (x: number, y: number) => {
      const ey = eyes[k];
      const u = clamp(((x - d.x0) / (d.x1 - d.x0)) * (NC - 1), 0, NC - 1);
      const upT = at(O.up, u), loT = at(O.lo, u);
      const w = (y - upT) / Math.max(loT - upT, 1);
      // верх контура догоняет веко раньше, чем контур начнёт гаснуть (sq 0,75): гаснет уже под лентами
      const upR = upT + (at(ey.up, u) - upT) * smoothstep(ey.squash / 0.6);
      return upR + w * (at(ey.lo, u) - upR);
    };
    eyes[k].mapY = ringMapY;
    ring.deform = (_i, x, y, out) => {
      const sq = eyes[k].squash;
      const xx = e.c[0] + (x - e.c[0]) * (1 - 0.2 * sq);
      out.x = xx;
      out.y = ringMapY(xx, y);
    };
  }
  /** интерполяция кейформов: цепочка по открытости o, затем подмес грусти и «^ ^» */
  const evalEye = (k: "L" | "R", o: number, sadW: number, hapW: number, smileW: number) => {
    const e = eyes[k];
    const K = eyeData.eyes[k].keys;
    let A = K.shut, B = K.open;
    for (let i = 0; i < CHAIN.length - 1; i++) {
      if (o <= K[CHAIN[i + 1]].o) { A = K[CHAIN[i]]; B = K[CHAIN[i + 1]]; break; }
    }
    const t = clamp((o - A.o) / Math.max(B.o - A.o, 1e-4), 0, 1);
    // грусть действует, пока глаз открыт не меньше, чем в кадре грусти; при моргании уступает цепочке
    const ws = clamp(sadW, 0, 1) * clamp((o - 0.25) / (K.sad.o - 0.25), 0, 1);
    const wh = clamp(hapW, 0, 1), wm = clamp(smileW, 0, 1);
    const Sd = K.sad, Hp = K.happy, Sm = K.closed;
    for (let i = 0; i < NC; i++) {
      let up = lerp(A.up[i], B.up[i], t), lo = lerp(A.lo[i], B.lo[i], t), tu = lerp(A.tu[i], B.tu[i], t), tl = lerp(A.tl[i], B.tl[i], t);
      if (ws > 0) { up = lerp(up, Sd.up[i], ws); tu = lerp(tu, Sd.tu[i], ws); }
      if (wm > 0) { up = lerp(up, Sm.up[i], wm); lo = lerp(lo, Sm.lo[i], wm); tu = lerp(tu, Sm.tu[i], wm); tl = lerp(tl, Sm.tl[i], wm); }
      if (wh > 0) { up = lerp(up, Hp.up[i], wh); lo = lerp(lo, Hp.lo[i], wh); tu = lerp(tu, Hp.tu[i], wh); tl = lerp(tl, Hp.tl[i], wh); }
      e.up[i] = up; e.lo[i] = lo; e.tu[i] = tu; e.tl[i] = tl;
    }
  };
  /** лента по кривой: 4 вершины на колонку (мягкая кромка 1 px с каждой стороны), в мир через кость лица */
  const writeRibbon = (r: Ribbon, xs: Float32Array, ys: Float32Array, th: Float32Array, m: PixiMatrix) => {
    const v = r.v;
    for (let i = 0; i < NC; i++) {
      const x = xs[i], y = ys[i];
      const h = Math.max(th[i], 0) / 2;
      // кромка 1 px; у схода на нет (толщина < 1) лента стягивается в ноль — хвостов-волосков нет
      const outer = Math.min(h + 0.35, th[i]), inner = Math.max(h - 0.35, 0);
      const yy = [y - outer, y - inner, y + inner, y + outer];
      for (let j = 0; j < 4; j++) {
        v[(i * 4 + j) * 2] = m.a * x + m.c * yy[j] + m.tx;
        v[(i * 4 + j) * 2 + 1] = m.b * x + m.d * yy[j] + m.ty;
      }
    }
  };
  const drawEyes = (shrink: number) => {
    const m = face.skin;
    for (const k of ["L", "R"] as const) {
      const e = eyes[k];
      writeRibbon(e.lid, e.xs, e.up, e.tu, m);
      writeRibbon(e.low, e.xs, e.lo, e.tl, m);
      // маска радужки: внутренний эллипс контура, сложенный той же картой, что и контур, срезанный
      // сверху/снизу внутренними кромками штрихов (с запасом под тушь) — где нет просвета, нет и маски
      const g = e.mask.clear();
      // эллипс сжимается по x вместе с уголками контура — в углах не остаётся зелёного клина
      const rx = (e.rx + 2) * (1 - 0.2 * e.squash), ry = e.ry + 2;
      const top = e.scratchT, bot = e.scratchB;
      let first = -1, last = -1;
      for (let i = 0; i < NC; i++) {
        const x = e.xs[i];
        const nx = (x - e.c[0]) / rx;
        // за концами штрихов радужки нет (там контур или сомкнутые уголки)
        if (Math.abs(nx) >= 1 || e.tu[i] < 0.5 || e.tl[i] < 0.5) { top[i] = 1; bot[i] = 0; continue; }
        const dy = ry * Math.sqrt(1 - nx * nx);
        const eT = e.mapY(x, e.c[1] - dy), eB = e.mapY(x, e.c[1] + dy);
        top[i] = Math.max(e.up[i] + e.tu[i] / 2 + shrink, eT);
        bot[i] = Math.min(e.lo[i] - e.tl[i] / 2 - shrink, eB);
        if (bot[i] - top[i] > 1) { if (first < 0) first = i; last = i; }
      }
      if (first < 0) { g.rect(e.c[0], e.c[1], 0.01, 0.01).fill(0xffffff); e.group.tint = 0x0c0f05; continue; }
      // последние 6 px просвета: радужка ТЕМНЕЕТ В ТУШЬ (а не растворяется в мех — серая полоска
      // между веками читалась «двойным веком»): щель выглядит как сходящаяся линия
      let gap = 0;
      for (let i = first; i <= last; i++) gap = Math.max(gap, bot[i] - top[i]);
      const kInk = smoothstep(gap / 6);
      e.group.alpha = 1;
      const c = Math.round(255 * kInk);
      e.group.tint = (Math.max(c, 12) << 16) | (Math.max(c, 15) << 8) | Math.max(c, 5);
      for (let i = first; i <= last; i++) {
        const x = e.xs[i], y = Math.min(top[i], bot[i]);
        const wx = m.a * x + m.c * y + m.tx, wy = m.b * x + m.d * y + m.ty;
        if (i === first) g.moveTo(wx, wy); else g.lineTo(wx, wy);
      }
      for (let i = last; i >= first; i--) {
        const x = e.xs[i], y = Math.max(top[i], bot[i]);
        g.lineTo(m.a * x + m.c * y + m.tx, m.b * x + m.d * y + m.ty);
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
  type Pose = { headRot: number; headY: number; earL: number; earR: number; lidOpen: number; lidSad: number; tailAmp: number; breathMul: number; dilate: number; bodyRot: number };
  const POSES: Record<Mood, Pose> = {
    idle: { headRot: 0, headY: 0, earL: 0, earR: 0, lidOpen: 1 - preset.lids.idle.y, lidSad: 0, tailAmp: 1, breathMul: 1, dilate: 0.3, bodyRot: 0 },
    think: { headRot: 0.14, headY: 0, earL: 0.08, earR: -0.05, lidOpen: 1 - preset.lids.think.y, lidSad: 0, tailAmp: 0.7, breathMul: 1, dilate: 0.2, bodyRot: 0 },
    sad: { headRot: 0.05, headY: 10, earL: -0.6, earR: 0.6, lidOpen: 1 - preset.lids.sad.y, lidSad: 1, tailAmp: 0.4, breathMul: 1.4, dilate: 0.1, bodyRot: 0 },
    sleep: { headRot: 0.05, headY: 14, earL: -0.2, earR: 0.2, lidOpen: 0, lidSad: 0, tailAmp: 0.3, breathMul: 1.8, dilate: 0, bodyRot: 0 },
    focused: { headRot: 0, headY: 0, earL: 0.05, earR: -0.05, lidOpen: 1 - preset.lids.focused.y, lidSad: 0, tailAmp: 0.8, breathMul: 0.9, dilate: 0.5, bodyRot: 0 },
  };
  const pose: Pose = { ...POSES.idle };
  let moodNow: Mood = "idle";
  const MOUTH_FOR: Record<Mood, MouthShape> = { idle: "smile", think: "o", sad: "sad", sleep: "flat", focused: "flat" };
  const setMood = (m: Mood) => {
    const changed = m !== moodNow;
    moodNow = m;
    gsap.to(pose, { ...POSES[m], duration: preset.states.crossfade, ease: "sine.inOut", overwrite: true });
    // смена выражения — повод моргнуть (p 0,7); рот меняется под сомкнутым веком
    if (changed && m !== "sleep" && Math.random() < 0.7 && blink("normal")) gsap.delayedCall(preset.blink.types.normal.close * sched().durMul, () => setMouth(MOUTH_FOR[moodNow]));
    else setMouth(MOUTH_FOR[m]);
    scheduleBlink();
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
        gsap.delayedCall(0.3, () => blink("normal"));
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
        gsap.delayedCall(0.05, () => blink("fast"));
      }
    });

  /* ── моргание ──
     Кинематика по измерениям (Evinger 1991; Trutoiu 2011): закрытие ≈80 мс с ускорением, удержание
     ≈40 мс, открытие ≈175 мс с длинным хвостом (power3.out); полное закрытие в НЕЙТРАЛЬНУЮ форму ‿.
     Правый глаз отстаёт на 0–16 мс и чуть меньше по амплитуде (больше — читается как подмигивание).
     Планировщик: логнормальные интервалы (медиана 3,5 с), двойные ≈10 %, триггеры — смена взгляда,
     конец реплики, отправленный ввод (30 % — длинное «понял» с кивком), смена выражения; при внимании
     (пользователь печатает) в 3,3 раза реже; рефрактерный период 0,6 с; новое не стартует, пока идёт
     предыдущее. Медленное моргание кошки (Humphrey 2020) — отдельный жест доверия. */
  const bl = { L: 0, R: 0 }; // 0 — открыт, 1 — сомкнут, по каждому глазу
  const dil = { v: 0 }; // расширение зрачка 0..1 поверх позы (ширина ×(1 + 0,2·v)), только по горизонтали
  const smileSt = { v: 0 }; // «улыбка глаз» ∩ 0..1 — выражение, не моргание
  let blinkTl: gsap.core.Timeline | null = null;
  let blinkTimer: gsap.core.Tween | null = null;
  let lastBlinkAt = -1e9;
  let attentive = false;
  let slowBlinking = false;
  let slowBlinkReadyAt = 0;
  const secs = () => (nowMs() - t0) / 1000;
  const sched = () => preset.blink.sched[moodNow];
  const mkBlink = (type: BlinkType, mul: number) => {
    const T = preset.blink.types;
    const tl = gsap.timeline();
    const amp = 1 - rand(0, preset.blink.ampJitter);
    const lag = rand(0, preset.blink.lagR);
    let at = 0;
    const seg = (close: number, hold: number, open: number, depth = 1, openTo = 0, easeClose = "power2.in", easeOpen = "power3.out") => {
      tl.to(bl, { L: depth, duration: close * mul, ease: easeClose }, at);
      tl.to(bl, { R: depth * amp, duration: close * mul, ease: easeClose }, at + lag);
      const o = at + (close + hold) * mul;
      tl.to(bl, { L: openTo, duration: open * mul, ease: easeOpen }, o);
      tl.to(bl, { R: openTo * amp, duration: open * mul, ease: easeOpen }, o + lag);
      at = o + open * mul;
    };
    switch (type) {
      case "fast": seg(T.fast.close, T.fast.hold, T.fast.open, 1, 0, "power2.in", "power2.out"); break;
      case "double": seg(0.07, 0.016, 0.11, 1, 0.3); at += rand(0.12, 0.2); seg(T.normal.close, T.normal.hold, T.normal.open); break;
      case "long":
        seg(T.long.close, T.long.hold, T.long.open);
        // кивок «понял» ≈500 мс, начало совпадает с морганием (Hömke 2018)
        tl.to(ov, { headY: 14, duration: 0.25, ease: "sine.inOut" }, 0).to(ov, { headY: 0, duration: 0.25, ease: "sine.inOut" }, 0.25);
        break;
      case "half": seg(T.half.close, T.half.hold, T.half.open, 0.5, 0, "sine.in", "sine.out"); break;
      case "sleepy": seg(T.sleepy.close, rand(0.3, 0.6), T.sleepy.open, 1, rand(0.25, 0.4), "sine.in", "sine.out"); break;
      default: seg(T.normal.close, T.normal.hold, T.normal.open);
    }
    // после смыкания зрачок чуть расширяется и сужается с перелётом
    tl.to(dil, { v: 0.5, duration: 0.08 }, (T.normal.close + T.normal.hold) * mul).to(dil, { v: 0, duration: 0.4, ease: "back.out(2)" });
    return tl;
  };
  let afterTrigger = false; // моргание по событию «забирает» ближайшее плановое: следующий интервал длиннее
  const blink = (type: BlinkType = "normal", force = false, scheduled = false): boolean => {
    if (slowBlinking || (moodNow === "sleep" && type !== "sleepy") || reduce) return false;
    const now = secs();
    if (!force && now - lastBlinkAt < preset.blink.refractory) return false;
    if (blinkTl && blinkTl.isActive()) return false;
    lastBlinkAt = now;
    blinkTl = mkBlink(type, sched().durMul);
    afterTrigger = !scheduled;
    scheduleBlink(); // моргание по событию сбрасывает таймер
    return true;
  };
  const gaussian = () => { const u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const scheduleBlink = () => {
    blinkTimer?.kill();
    if (moodNow === "sleep") return;
    const sc = sched();
    let ibi = clamp(Math.exp(Math.log(sc.median * (afterTrigger ? 1.7 : 1)) + sc.sigma * gaussian()), 1, 10);
    if (attentive) ibi *= preset.blink.attentiveMul;
    blinkTimer = gsap.delayedCall(ibi, () => {
      if (!blink(Math.random() < sched().pDouble ? "double" : "normal", false, true)) scheduleBlink();
    });
  };
  const cue = (c: Cue) => {
    if (c === "speechEnd") { if (Math.random() < 0.6) gsap.delayedCall(rand(0.08, 0.2), () => blink("normal")); }
    else if (c === "userSubmitted") { if (Math.random() < 0.5) blink(Math.random() < 0.3 ? "long" : "normal"); }
    else if (Math.random() < 0.7) blink("normal");
  };
  const setAttentive = (on: boolean) => { attentive = on; scheduleBlink(); };
  /** смена взгляда: моргание стартует на 1–2 кадра раньше движения глаз (p 0,85 при крупной, 0,25 при малой) */
  const gazeTo = (x: number, y: number, minor = false) => {
    const m = Math.hypot(x - look.tx, y - look.ty);
    const G = preset.blink.gazeShift;
    const set = () => { look.tx = x; look.ty = y; };
    if (m > 0.08 && Math.random() < (m > G.threshold && !minor ? G.big : G.small) && blink("normal")) gsap.delayedCall(0.03, set);
    else set();
  };
  /** медленное моргание (Humphrey et al. 2020): взгляд в центр → полу-моргание (×1–2) → закрытие > 0,5 с
      с лёгким наклоном головы и улыбкой глаз (p 0,6) или прищур 1,2–1,8 с → медленный выход; 3–4,5 с */
  const slowBlink = (): boolean => {
    if (slowBlinking || moodNow !== "idle" || secs() < slowBlinkReadyAt || reduce) return false;
    slowBlinking = true;
    blinkTimer?.kill(); blinkTl?.kill();
    look.tx = 0; look.ty = 0;
    const SB = preset.blink.slowBlink;
    const tl = gsap.timeline({ onComplete: () => { slowBlinking = false; slowBlinkReadyAt = secs() + rand(SB.cooldownMin, SB.cooldownMax); lastBlinkAt = secs(); scheduleBlink(); } });
    tl.to(dil, { v: 0.6, duration: 0.4 }, 0);
    let at = 0.4;
    const both = (to: number, dur: number, ease: string) => { tl.to(bl, { L: to, R: to, duration: dur, ease }, at); at += dur; };
    both(0.45, 0.22, "sine.inOut"); both(0.15, 0.26, "sine.inOut"); // полу-моргание AU147
    if (Math.random() < 0.6) { both(0.55, 0.24, "sine.inOut"); both(0.25, 0.28, "sine.inOut"); }
    if (Math.random() < 0.6) {
      both(1, 0.35, "sine.inOut"); // закрытие AU143: дольше 0,5 с
      tl.to(ov, { headY: 8, duration: 0.5, ease: "sine.inOut" }, at - 0.35);
      tl.to(smileSt, { v: 0.2, duration: 0.4 }, at - 0.35);
      at += rand(0.9, 1.4);
    } else { both(0.6, 0.35, "sine.inOut"); at += rand(1.2, 1.8); } // прищур
    both(0.2, 0.55, "power2.out");
    tl.to(ov, { headY: 0, duration: 0.6, ease: "sine.inOut" }, at - 0.55);
    tl.to(smileSt, { v: 0, duration: 0.5 }, at - 0.55);
    at += rand(0.6, 1.0);
    both(0, 0.4, "sine.out");
    tl.to(dil, { v: 0.3, duration: 0.4 }, at - 0.4).to(dil, { v: 0, duration: 1.5 });
    blinkTl = tl;
    return true;
  };
  scheduleBlink();

  /* взгляд: цель → пружины; псевдо-3D параллакс по глубине */
  const lookAt = (x: number, y: number) => {
    gazeTo(clamp(x, -1, 1), clamp(y, -1, 1));
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
  let glanceAt = rand(6, 14);
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
      gazeTo(glanceSide * 0.6, rand(-0.3, 0.25));
      gsap.delayedCall(rand(1.1, 2.2), () => { if (!look.held) gazeTo(0, 0, true); }); // возврат взгляда — малое событие
      glanceAt = t + rand(6, 14);
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

    // глаза: кривые на кадр (до скиннинга — контур складывается между ними), по каждому глазу своя
    // открытость (правый отстаёт на 0–16 мс)
    const L = preset.look, RC = preset.react;
    for (const k of ["L", "R"] as const) {
      const e = eyes[k];
      // моргание идёт от ТЕКУЩЕГО уровня века (в прищуре/«думает» веко уже опущено): амплитуда
      // умножается, а не обрезается min'ом — иначе из полуприкрытого глаза видимое закрытие занимало
      // 24 мс вместо 80, а открытие 36 вместо 175
      const open = pose.lidOpen * (1 - bl[k]);
      const kk = 1 - clamp(open, 0, 1);
      const closedness = Math.max(kk, ov.closed, smileSt.v);
      // контур стоит, пока веко скользит внутри него (до полуприкрытого), затем складывается в дугу
      const squash = smoothstep((closedness - 0.5) / 0.5);
      evalEye(k, open, pose.lidSad, ov.closed, smileSt.v);
      // реакция глаза на смыкание: глаз чуть сжимается по вертикали (контур и радужка следуют за кривыми)
      const sq = 1 - RC.squash * kk;
      for (let i = 0; i < NC; i++) { e.up[i] = e.c[1] + (e.up[i] - e.c[1]) * sq; e.lo[i] = e.c[1] + (e.lo[i] - e.c[1]) * sq; }
      e.squash = squash;
      // зрачок: взгляд, при смыкании — вниз и к носу (глазное яблоко уходит под веко), расширение —
      // только по ширине; всё через привязку к кости (масштаб тела при прыжке сохраняется)
      const pw = P(`pupil_${k}`).w / 2, ph = P(`pupil_${k}`).h / 2;
      const nose = (k === "L" ? 1 : -1) * e.rx * RC.pupilNose * kk;
      const down = e.ry * RC.pupilDown * kk;
      e.pupilAtt.offset.x = clamp(gx * L.pupil + nose, -(e.rx - pw - 4), e.rx - pw - 4);
      e.pupilAtt.offset.y = clamp(gy * L.pupilY + down, -(e.ry - ph - 4), e.ry - ph - 4);
      e.shineAtt.offset.x = nose * 0.6; e.shineAtt.offset.y = down * 0.6;
      e.irisAtt.offset.x = nose * 0.3; e.irisAtt.offset.y = down * 0.3;
      e.pupilAtt.sx = 1 + RC.dilate * clamp(pose.dilate + dil.v, 0, 1);
      // блик: половинка белой точки на кромке века читается как глюк — гаснет, когда веко дошло до его середины
      {
        const sp = P(`shine_${k}`);
        const sx = sp.x + sp.w / 2 + e.shineAtt.offset.x, syc = sp.y + sp.h / 2 + e.shineAtt.offset.y;
        const u = clamp(((sx - e.xs[0]) / (e.xs[NC - 1] - e.xs[0])) * (NC - 1), 0, NC - 1);
        const i0 = Math.floor(u), fr = u - i0;
        const lidEdge = (i0 >= NC - 1 ? e.up[NC - 1] + e.tu[NC - 1] / 2 : (e.up[i0] + e.tu[i0] / 2) * (1 - fr) + (e.up[i0 + 1] + e.tu[i0 + 1] / 2) * fr);
        e.shine.alpha = 1 - smoothstep((lidEdge - (syc - sp.h * 0.25)) / (sp.h * 0.5));
      }
      // нижняя лента появляется поверх СВОЕГО же штриха контура (тушь на туши — невидимо) до того,
      // как контур начнёт складываться; верхняя — как только веко отходит от контура
      e.ring.mesh.alpha = 1 - smoothstep((squash - 0.6) / 0.3); // сложенный контур лежит под лентами — гаснет невидимо (видны только сжатые уголки)
      e.low.mesh.alpha = smoothstep((closedness - 0.25) / 0.2);
      e.lid.mesh.alpha = smoothstep(closedness / 0.06);
    }

    updateBones();
    skinMeshes();
    placeAttached();
    pawDrawOrder();

    // радужка видна до самого смыкания (как в жизни): маска — ровно до внутренних кромок штрихов,
    // запас 1 px под антиалиас; щели по углам срезает сложенный эллипс контура
    drawEyes(1);
    drawDebug();
  };
  let prevBodyY = 0;
  app.ticker.add(tick);

  /* ── события: тап, курсор, видимость, авто-сон ── */
  let lastTapAt = -1e9;
  const onDown = (ev: PointerEvent) => {
    ev.preventDefault();
    activity();
    void play("react");
    // медленный двойной клик (0,4–1,2 с) — «медленное моргание» пользователя: кот отвечает тем же через 0,8–1,6 с
    const now = secs();
    if (now - lastTapAt >= 0.4 && now - lastTapAt <= 1.2) gsap.delayedCall(rand(0.8, 1.6), () => slowBlink());
    lastTapAt = now;
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
    blink: (t) => { blink(t === true ? "double" : typeof t === "string" ? t : "normal", true); },
    slowBlink,
    cue,
    setAttentive,
    preset,
    debug,
    mood: () => moodNow,
    _internals: {
      ov, bones, attached, eyes, bl,
      blinkInfo: () => (blinkTl ? { dur: blinkTl.duration(), ts: blinkTl.timeScale(), gts: gsap.globalTimeline.timeScale(), mul: sched().durMul, T: preset.blink.types.normal, children: blinkTl.getChildren().map((c) => [c.duration(), c.startTime()]) } : null),
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
      blinkTl?.kill();
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
