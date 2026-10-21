/** Данные скелетного рига кота (public/mascot/rig/rig.json, собирает design/mascot/rig_build.py) */
export type RigBone = { name: string; parent: number; pivot: [number, number] };
export type RigPart = {
  name: string;
  tex: string;
  box: [number, number, number, number];
  /** вершины подряд по 12 чисел: x, y, u, v, 4 индекса костей, 4 веса */
  verts: number[];
  idx: number[];
};
export type RigData = {
  scale: number;
  bones: RigBone[];
  parts: RigPart[];
  /** окно рисунка, которое попадает в холст: x, y, w, h (как viewBox у MascotSvg) */
  view: [number, number, number, number];
};

/** Состояние одного кадра для рендера: матрицы скиннинга и параметры частей */
export type PartState = {
  opacity: number; dx: number; dy: number; sx: number; sy: number;
  /** деформация формы части (огонёк): смещение вершины (x, y в покое) пишется в out[o], out[o + 1] */
  warp?: (x: number, y: number, out: Float32Array, o: number) => void;
};
