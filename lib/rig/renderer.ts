import { asset } from "@/lib/asset-versions";
import type { PartState, RigData } from "./types";

const MAX_BONES = 24;

const VERT = `#version 300 es
in vec2 aPos;
in vec2 aUV;
in vec4 aBones;
in vec4 aW;
in vec2 aOff;   // деформация формы (огонёк колышется языками); у остальных частей 0
uniform mat3 uBones[${MAX_BONES}];
uniform mat3 uView;
uniform vec4 uLocal;   // dx, dy, sx, sy: сдвиг и масштаб части вокруг её центра (взгляд, зрачок шире)
uniform vec2 uCenter;
out vec2 vUV;
void main() {
  vec2 p = uCenter + (aPos + aOff - uCenter) * uLocal.zw + uLocal.xy;
  vec3 q = vec3(p, 1.0);
  vec3 s = aW.x * (uBones[int(aBones.x)] * q)
         + aW.y * (uBones[int(aBones.y)] * q)
         + aW.z * (uBones[int(aBones.z)] * q)
         + aW.w * (uBones[int(aBones.w)] * q);
  vUV = aUV;
  vec3 c = uView * vec3(s.xy, 1.0);
  gl_Position = vec4(c.xy, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 vUV;
uniform sampler2D uTex;
uniform float uOp;
out vec4 o;
void main() { o = texture(uTex, vUV) * uOp; }`;

type GpuPart = {
  name: string;
  vao: WebGLVertexArrayObject;
  count: number;
  tex: WebGLTexture;
  center: [number, number];
  /** у частей с деформацией: координаты вершин в покое, буфер смещений и сам GPU-буфер */
  rest?: Float32Array;
  off?: Float32Array;
  offBuf?: WebGLBuffer;
};

/** Части, которые колышутся формой: квад заменяется сеткой (столбцы, строки), иначе деформировать нечего. */
const GRID: Record<string, [number, number]> = { flame: [8, 14] };

/** Сетка вместо квада из четырёх вершин (x, y, u, v, кости и веса — от первой вершины: у огонька они одинаковы). */
function gridOf(verts: number[], cols: number, rows: number) {
  const xs = [0, 1, 2, 3].map((i) => verts[i * 12]), ys = [0, 1, 2, 3].map((i) => verts[i * 12 + 1]);
  const us = [0, 1, 2, 3].map((i) => verts[i * 12 + 2]), vs = [0, 1, 2, 3].map((i) => verts[i * 12 + 3]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const tail = verts.slice(4, 12);
  const out: number[] = [], idx: number[] = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const a = i / cols, b = j / rows;
      out.push(x0 + (x1 - x0) * a, y0 + (y1 - y0) * b, u0 + (u1 - u0) * a, v0 + (v1 - v0) * b, ...tail);
    }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * (cols + 1) + i;
      idx.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1);
    }
  return { verts: out, idx };
}

/** Декодированные слои рига — один раз на страницу, общие для всех экземпляров (у каждого свой контекст). */
const imageCache = new Map<string, Promise<HTMLImageElement[]>>();
export function loadRigImages(rig: RigData, baseUrl: string): Promise<HTMLImageElement[]> {
  let p = imageCache.get(baseUrl);
  if (!p) {
    p = Promise.all(
      rig.parts.map(
        (part) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("texture " + part.tex));
            im.src = asset(baseUrl + part.tex);
          }),
      ),
    );
    p.catch(() => imageCache.delete(baseUrl));
    imageCache.set(baseUrl, p);
  }
  return p;
}

/**
 * Слой под размер кота на экране: текстура не детальнее, чем нужно холсту (с запасом ×1.5 на поворот и «касание»),
 * ступенями степени двойки — копии кэшируются и общие для всех котов этого размера. Аватару 30 px полноразмерные
 * слои не нужны: было ~6,6 МБ видеопамяти на каждый контекст, у аватара теперь ~0,05 МБ.
 * Уменьшение — пополам за шаг (одним шагом в 16 раз браузер даёт рябь).
 */
const scaledCache = new Map<string, TexImageSource>();
function scaledImage(img: HTMLImageElement, key: string, factor: number): TexImageSource {
  if (factor >= 1 || typeof document === "undefined") return img;
  const k = key + "@" + factor;
  const hit = scaledCache.get(k);
  if (hit) return hit;
  const tw = Math.max(1, Math.ceil(img.naturalWidth * factor)), th = Math.max(1, Math.ceil(img.naturalHeight * factor));
  let src: HTMLImageElement | HTMLCanvasElement = img, w = img.naturalWidth, h = img.naturalHeight;
  while (w > tw || h > th) {
    w = Math.max(tw, Math.ceil(w / 2)); h = Math.max(th, Math.ceil(h / 2));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return img;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    src = c;
  }
  scaledCache.set(k, src);
  return src;
}

/**
 * WebGL-контекст прямо на видимом холсте экземпляра: кадр рисуется в него и больше никуда не копируется.
 * Прежняя схема (один скрытый холст 1024² + drawImage в 2D-холст каждого кота) на каждом кадре гоняла
 * 1024² пикселей через readback там, где 2D-холст не ускорен (слабые Android, software GL) — 85 % кадра
 * уходило в drawImage. Слои кота ~5 МБ на контекст, котов на экране ≤ 6, лимит браузера 16; потерю
 * контекста обрабатывает компонент (пересоздаёт рендер на том же холсте).
 */
export class RigRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private gpu = new Map<string, GpuPart>();
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private order: string[] = [];
  private view: [number, number, number, number];

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, rig: RigData, prog: WebGLProgram) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.view = rig.view;
    for (const k of ["uBones", "uView", "uLocal", "uCenter", "uTex", "uOp"]) this.loc[k] = gl.getUniformLocation(prog, k);
  }

  /** targetPx — сторона холста в пикселях устройства: по ней подбирается детальность слоёв (0 — полная) */
  static async create(rig: RigData, baseUrl: string, canvas: HTMLCanvasElement, targetPx = 0): Promise<RigRenderer | null> {
    const images = await loadRigImages(rig, baseUrl);
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl || gl.isContextLost()) return null;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.bindAttribLocation(prog, 1, "aUV");
    gl.bindAttribLocation(prog, 2, "aBones");
    gl.bindAttribLocation(prog, 3, "aW");
    gl.bindAttribLocation(prog, 4, "aOff");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
    const r = new RigRenderer(canvas, gl, rig, prog);
    r.upload(rig, images, targetPx);
    return r;
  }

  /** Освободить GPU-ресурсы при размонтировании: иначе контексты копятся до лимита и браузер теряет старые. */
  dispose() {
    const gl = this.gl;
    for (const g of this.gpu.values()) { gl.deleteTexture(g.tex); gl.deleteVertexArray(g.vao); if (g.offBuf) gl.deleteBuffer(g.offBuf); }
    this.gpu.clear();
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private upload(rig: RigData, images: HTMLImageElement[], targetPx: number) {
    const gl = this.gl;
    gl.disableVertexAttribArray(4);
    gl.vertexAttrib2f(4, 0, 0);
    rig.parts.forEach((p0, i) => {
      const grid = GRID[p0.name] && p0.verts.length === 48 ? gridOf(p0.verts, ...GRID[p0.name]) : null;
      const p = grid ? { ...p0, verts: grid.verts, idx: grid.idx } : p0;
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const vb = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p.verts), gl.STATIC_DRAW);
      const stride = 12 * 4;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 32);
      let rest: Float32Array | undefined, off: Float32Array | undefined, offBuf: WebGLBuffer | undefined;
      if (grid) {
        const n = p.verts.length / 12;
        rest = new Float32Array(n * 2); off = new Float32Array(n * 2);
        for (let k = 0; k < n; k++) { rest[k * 2] = p.verts[k * 12]; rest[k * 2 + 1] = p.verts[k * 12 + 1]; }
        offBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, offBuf);
        gl.bufferData(gl.ARRAY_BUFFER, off, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, 8, 0);
      }
      const ib = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(p.idx), gl.STATIC_DRAW);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      // пикселей текстуры на единицу рисунка у слоя и сколько нужно холсту — отсюда степень уменьшения
      const img = images[i];
      const boxW = Math.max(1, p0.box[2] - p0.box[0]);
      const need = targetPx > 0 ? ((targetPx / rig.view[2]) * 1.5) / (img.naturalWidth / boxW) : 1;
      const factor = need >= 1 ? 1 : 2 ** Math.ceil(Math.log2(need));
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scaledImage(img, p0.tex, factor));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.gpu.set(p.name, { name: p.name, vao, count: p.idx.length, tex, center: [(p.box[0] + p.box[2]) / 2, (p.box[1] + p.box[3]) / 2], rest, off, offBuf });
      this.order.push(p.name);
    });
    gl.bindVertexArray(null);
  }

  /** Нарисовать позу в свой холст (его drawing buffer = w x h пикселей) */
  draw(w: number, h: number, skin: Float32Array, parts: Map<string, PartState>) {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    const [vx, vy, vw, vh] = this.view;
    // рисунок (px) -> клип: x' = (x - vx)/vw*2 - 1, y' = 1 - (y - vy)/vh*2
    const view = new Float32Array([2 / vw, 0, 0, 0, -2 / vh, 0, -2 * vx / vw - 1, 1 + 2 * vy / vh, 1]);
    gl.uniformMatrix3fv(this.loc.uView, false, view);
    gl.uniformMatrix3fv(this.loc.uBones, false, skin.subarray(0, Math.min(skin.length, MAX_BONES * 9)));
    gl.uniform1i(this.loc.uTex, 0);
    for (const name of this.order) {
      const st = parts.get(name);
      if (st && st.opacity <= 0.003) continue;
      const g = this.gpu.get(name)!;
      gl.bindVertexArray(g.vao);
      if (g.off && g.rest && g.offBuf) {
        const off = g.off, rest = g.rest;
        if (st?.warp) for (let k = 0; k < off.length; k += 2) st.warp(rest[k], rest[k + 1], off, k);
        else off.fill(0);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.offBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, off);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.tex);
      gl.uniform4f(this.loc.uLocal, st?.dx ?? 0, st?.dy ?? 0, st?.sx ?? 1, st?.sy ?? 1);
      gl.uniform2f(this.loc.uCenter, g.center[0], g.center[1]);
      gl.uniform1f(this.loc.uOp, st ? st.opacity : 1);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }
}
