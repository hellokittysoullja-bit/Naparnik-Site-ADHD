// MSAA (antialias true) против false: одна и та же поза куклы (DollAnimator с фиксированным зерном) рисуется в два
// WebGL-холста настоящим RigRenderer, кадры читаются readPixels и сравниваются. Позы: покой, взгляд в крайние углы,
// радость, прыжки celebrate, сон, слушает, wave, касания; моргания приходят сами (каждый кадр проверяется на lid).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const BASE = process.argv[2] || 'http://localhost:3700';
const JS = path.join(path.dirname(new URL(import.meta.url).pathname), 'js');
const html = `<!doctype html><html><body style="margin:0;background:#000">
<script type="importmap">{"imports":{"@/":"/__h/"}}</script>
<script type="module">
import { DollAnimator } from '/__h/lib/rig/doll';
import { RigRenderer } from '/__h/lib/rig/renderer';
const rig = await (await fetch('/mascot/doll/rig.json')).json();
async function make(aa, px) {
  const c = document.createElement('canvas'); c.width = c.height = px; document.body.append(c);
  const orig = c.getContext.bind(c);
  c.getContext = (t, o) => orig(t, { ...o, antialias: aa, preserveDrawingBuffer: true });
  const texPx = 2 ** Math.ceil(Math.log2(px));
  const r = await RigRenderer.create(rig, '/mascot/doll/', c, texPx);
  return { r, gl: r.gl, px, samples: r.gl.getParameter(r.gl.SAMPLES), aa: r.gl.getContextAttributes().antialias };
}
window.run = async (px) => {
  const A = await make(true, px), B = await make(false, px);
  const a1 = new DollAnimator(rig, 42), a2 = new DollAnimator(rig, 42);
  const read = (X) => { const buf = new Uint8Array(px * px * 4); X.gl.readPixels(0, 0, px, px, X.gl.RGBA, X.gl.UNSIGNED_BYTE, buf); return buf; };
  const script = [
    [0, 'calm', 'idle', null], [2, 'calm', 'idle', { x: -1, y: -1 }], [3, 'calm', 'idle', { x: 1, y: 1 }],
    [4, 'happy', 'idle', null], [6, 'excited', 'idle', { x: 1, y: -1 }], [8, 'calm', 'celebrate', null],
    [11, 'sleepy', 'idle', null], [15, 'listening', 'idle', null], [17, 'calm', 'wave', null],
    [20, 'calm', 'think', { x: -1, y: 1 }], [22, 'focused', 'idle', null], [24, 'calm', 'idle', null],
  ];
  const out = []; let t = 0, si = 0, frame = 0;
  const dt = 1 / 30;
  while (t < 27) {
    while (si < script.length && t >= script[si][0]) {
      for (const a of [a1, a2]) { a.expression = script[si][1]; a.setAction(script[si][2]); a.gaze = script[si][3]; }
      si++;
    }
    if (frame % 75 === 40) { a1.poke(); a2.poke(); }
    a1.update(dt); a2.update(dt); t += dt; frame++;
    const lift = Math.max(0, -a1.pose.ty[0]);
    const lidNow = a1.lidNow ?? 0;
    // каждый 5-й кадр + все кадры моргания и прыжка
    if (frame % 5 !== 0 && lidNow < 0.3 && lift < 1) continue;
    A.r.draw(px, px, a1.pose.skin, a1.parts); B.r.draw(px, px, a2.pose.skin, a2.parts);
    const p = read(A), q = read(B);
    let sum = 0, max = 0, diffPx = 0, n = px * px;
    for (let i = 0; i < p.length; i += 4) {
      let any = false;
      for (let k = 0; k < 4; k++) { const d = Math.abs(p[i + k] - q[i + k]); sum += d; if (d > max) max = d; if (d) any = true; }
      if (any) diffPx++;
    }
    out.push({ t: +t.toFixed(2), expr: a1.expression, act: a1.action, lid: +lidNow.toFixed(2), lift: +lift.toFixed(1), mean: sum / (n * 4), max, pct: (100 * diffPx) / n });
  }
  return { meta: [A.aa, A.samples, B.aa, B.samples], out };
};
window.ready = true;
</script></body></html>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome' }).catch(() => chromium.launch());
const p = await b.newPage();
await p.route(/\/__aa\.html$/, (r) => r.fulfill({ contentType: 'text/html', body: html }));
await p.route(/\/__h\//, (r) => {
  let rel = new URL(r.request().url()).pathname.replace('/__h/', '');
  if (!rel.endsWith('.js')) rel += '.js';
  r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(JS, rel), 'utf8') });
});
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
await p.goto(BASE + '/__aa.html');
await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
const all = {};
for (const px of [120, 524, 788]) {
  const res = await p.evaluate((px) => window.run(px), px);
  const o = res.out;
  const mean = o.reduce((s, x) => s + x.mean, 0) / o.length;
  const worst = o.reduce((a, x) => (x.mean > a.mean ? x : a), o[0]);
  const max = Math.max(...o.map((x) => x.max));
  const pct = Math.max(...o.map((x) => x.pct));
  const blinks = o.filter((x) => x.lid > 0.9).length, jumps = o.filter((x) => x.lift > 5).length;
  console.log(`px ${px}: aa/samples ${res.meta.join('/')}, поз ${o.length} (моргание ${blinks}, прыжок ${jumps}), средняя разница ${mean.toFixed(4)}/255, худшая поза ${worst.mean.toFixed(4)}/255 (${worst.expr}/${worst.act} t=${worst.t} lid=${worst.lid} lift=${worst.lift}), максимум канала ${max}, доля отличающихся пикселей до ${pct.toFixed(2)}%`);
  all[px] = res;
}
fs.writeFileSync(path.join(path.dirname(JS), 'aa-poses.json'), JSON.stringify(all));
await b.close();
