// Попиксельно: кот героя и знакомства в reduced-motion (поза фиксирована) — две сборки.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [A, B] = [process.argv[2], process.argv[3]];
const b = await chromium.launch();
async function grab(base, path) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-08-01T18:02:00') });
  await p.goto(base + path, { waitUntil: 'load' });
  await p.waitForFunction(() => { const el = document.querySelector('.cat-doll'); return el && !el.querySelector('img') && el.querySelectorAll('canvas')[1]?.style.display === 'block'; }, null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const px = await p.evaluate(() => { const c = document.querySelectorAll('.cat-doll canvas')[1]; const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d'); x.drawImage(c, 0, 0); return Array.from(x.getImageData(0, 0, c.width, c.height).data); });
  await ctx.close();
  return px;
}
for (const path of ['/?intro=1', '/app/start']) {
  const p = await grab(A, path), q = await grab(B, path);
  let sum = 0, max = 0, n = 0;
  for (let i = 0; i < Math.min(p.length, q.length); i++) { const d = Math.abs(p[i] - q[i]); sum += d; if (d > max) max = d; if (d) n++; }
  console.log(path, `длины ${p.length}/${q.length}, средняя ${(sum / p.length).toFixed(4)}/255, максимум ${max}, отличающихся каналов ${n}`);
}
await b.close();
