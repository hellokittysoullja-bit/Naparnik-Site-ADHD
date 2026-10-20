import type { PartState, RigData } from "./types";

const MAX_BONES = 24;

const VERT = `#version 300 es
in vec2 aPos;
in vec2 aUV;
in vec4 aBones;
in vec4 aW;
uniform mat3 uBones[${MAX_BONES}];
uniform mat3 uView;
uniform vec4 uLocal;   // dx, dy, sx, sy: сдвиг и масштаб части вокруг её центра (взгляд, зрачок шире)
uniform vec2 uCenter;
out vec2 vUV;
void main() {
  vec2 p = uCenter + (aPos - uCenter) * uLocal.zw + uLocal.xy;
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
};

/**
 * Один общий WebGL-контекст на страницу: на лендинге несколько котов, а контекстов у браузера ограниченное число.
 * Кот рисуется в общий холст, затем копируется в 2D-холст своего экземпляра.
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

  static async create(rig: RigData, baseUrl: string): Promise<RigRenderer | null> {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: true, preserveDrawingBuffer: false });
    if (!gl) return null;
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
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
    const r = new RigRenderer(canvas, gl, rig, prog);
    await r.upload(rig, baseUrl);
    return r;
  }

  private async upload(rig: RigData, baseUrl: string) {
    const gl = this.gl;
    const images = await Promise.all(
      rig.parts.map(
        (p) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => rej(new Error("texture " + p.tex));
            im.src = baseUrl + p.tex;
          }),
      ),
    );
    rig.parts.forEach((p, i) => {
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
      const ib = gl.createBuffer()!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(p.idx), gl.STATIC_DRAW);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, images[i]);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.gpu.set(p.name, { name: p.name, vao, count: p.idx.length, tex, center: [(p.box[0] + p.box[2]) / 2, (p.box[1] + p.box[3]) / 2] });
      this.order.push(p.name);
    });
    gl.bindVertexArray(null);
  }

  /** Нарисовать позу в общий холст размером w x h (<= 1024) и скопировать в ctx экземпляра */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, skin: Float32Array, parts: Map<string, PartState>) {
    const gl = this.gl;
    const W = Math.min(w, 1024);
    const H = Math.min(h, 1024);
    gl.viewport(0, 0, W, H);
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
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, g.tex);
      gl.uniform4f(this.loc.uLocal, st?.dx ?? 0, st?.dy ?? 0, st?.sx ?? 1, st?.sy ?? 1);
      gl.uniform2f(this.loc.uCenter, g.center[0], g.center[1]);
      gl.uniform1f(this.loc.uOp, st ? st.opacity : 1);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // WebGL-холст снизу вверх: берём нижние H строк
    ctx.drawImage(this.canvas, 0, this.canvas.height - H, W, H, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
