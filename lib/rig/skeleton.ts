import type { RigData } from "./types";

/**
 * Поза скелета: у каждой кости локальные поворот, масштаб и сдвиг в системе родителя (опора — её точка в покое).
 * Матрица скиннинга кости = мировая(поза) · обратная(покой): вершина, посаженная на кость, едет вместе с ней,
 * вершина между костями — по взвешенной сумме (линейный скиннинг, как в Spine / Live2D).
 */
export class Pose {
  readonly n: number;
  rot: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  /** мировые матрицы позы (3x3, по столбцам) и итоговые матрицы скиннинга */
  private world: Float32Array;
  readonly skin: Float32Array;
  private rest: Float32Array;
  private parent: Int16Array;

  constructor(rig: RigData) {
    this.n = rig.bones.length;
    this.rot = new Float32Array(this.n);
    this.sx = new Float32Array(this.n).fill(1);
    this.sy = new Float32Array(this.n).fill(1);
    this.tx = new Float32Array(this.n);
    this.ty = new Float32Array(this.n);
    this.world = new Float32Array(this.n * 9);
    this.skin = new Float32Array(this.n * 9);
    this.rest = new Float32Array(this.n * 2);
    this.parent = new Int16Array(this.n);
    rig.bones.forEach((b, i) => {
      this.rest[i * 2] = b.pivot[0];
      this.rest[i * 2 + 1] = b.pivot[1];
      this.parent[i] = b.parent;
    });
  }

  reset() {
    this.rot.fill(0);
    this.sx.fill(1);
    this.sy.fill(1);
    this.tx.fill(0);
    this.ty.fill(0);
  }

  /** пересчёт: кости идут в порядке «родитель раньше ребёнка» (так их собирает rig_build.py) */
  update() {
    const w = this.world;
    for (let i = 0; i < this.n; i++) {
      const p = this.parent[i];
      const c = Math.cos(this.rot[i]);
      const s = Math.sin(this.rot[i]);
      // локальная: T(опора - опора родителя + сдвиг) · R · S
      const lx = this.rest[i * 2] - (p >= 0 ? this.rest[p * 2] : 0) + this.tx[i];
      const ly = this.rest[i * 2 + 1] - (p >= 0 ? this.rest[p * 2 + 1] : 0) + this.ty[i];
      const a = c * this.sx[i];
      const b = s * this.sx[i];
      const cc = -s * this.sy[i];
      const d = c * this.sy[i];
      const o = i * 9;
      if (p < 0) {
        w[o] = a; w[o + 1] = b; w[o + 2] = 0;
        w[o + 3] = cc; w[o + 4] = d; w[o + 5] = 0;
        w[o + 6] = lx; w[o + 7] = ly; w[o + 8] = 1;
      } else {
        const q = p * 9;
        const pa = w[q], pb = w[q + 1], pc = w[q + 3], pd = w[q + 4], ptx = w[q + 6], pty = w[q + 7];
        w[o] = pa * a + pc * b; w[o + 1] = pb * a + pd * b; w[o + 2] = 0;
        w[o + 3] = pa * cc + pc * d; w[o + 4] = pb * cc + pd * d; w[o + 5] = 0;
        w[o + 6] = pa * lx + pc * ly + ptx; w[o + 7] = pb * lx + pd * ly + pty; w[o + 8] = 1;
      }
      // скиннинг = мировая · T(-опора_покоя_мировая)
      const rx = this.rest[i * 2];
      const ry = this.rest[i * 2 + 1];
      const sk = this.skin;
      sk[o] = w[o]; sk[o + 1] = w[o + 1]; sk[o + 2] = 0;
      sk[o + 3] = w[o + 3]; sk[o + 4] = w[o + 4]; sk[o + 5] = 0;
      sk[o + 6] = w[o + 6] - (w[o] * rx + w[o + 3] * ry);
      sk[o + 7] = w[o + 7] - (w[o + 1] * rx + w[o + 4] * ry);
      sk[o + 8] = 1;
    }
  }
}
