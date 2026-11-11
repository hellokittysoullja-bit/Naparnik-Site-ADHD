// Путь лендинг → знакомство → договор → сессия на «слабом телефоне»: CPU ×N, 3G.
// Пишет: INP-подобные задержки взаимодействий (event timing), длинные кадры (LoAF) с виновными скриптами, время кадров.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:3500';
const CPU = Number(process.argv[3] || 4);
const NET = process.argv[4] || '3g';
const OUT = process.argv[5] || 'perf.json';
const b = await chromium.launch({ args: ['--enable-features=LongAnimationFrameTiming'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
await ctx.addInitScript(() => {
  const w = window;
  w.__perf = { events: [], loaf: [], frames: [] };
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__perf.events.push({ name: e.name, t: e.startTime, dur: e.duration, input: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart, target: e.target?.textContent?.slice(0, 30) || e.target?.tagName })))
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__perf.loaf.push({ t: e.startTime, dur: e.duration, block: e.blockingDuration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, style: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0, url: location.pathname + location.search.slice(0, 20), scripts: e.scripts.map((s) => ({ d: Math.round(s.duration), inv: s.invoker?.slice(0, 60), src: (s.sourceURL || '').split('/').pop() + ':' + s.sourceFunctionName, fl: Math.round(s.forcedStyleAndLayoutDuration) })) })))
      .observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  let last = 0;
  const loop = (t) => { if (last) w.__perf.frames.push([Math.round(t), Math.round(t - last)]); last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
});
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
const nets = { '3g': { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }, '4g': { latency: 40, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 }, none: null };
await cdp.send('Network.enable');
if (nets[NET]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...nets[NET] });
const marks = [];
const t0 = Date.now();
const mark = async (m) => { marks.push({ m, wall: Date.now() - t0, pt: await p.evaluate(() => performance.now()).catch(() => null), url: p.url().replace(BASE, '') }); };
const collect = async () => p.evaluate(() => { const r = JSON.parse(JSON.stringify(window.__perf)); window.__perf.events = []; window.__perf.loaf = []; window.__perf.frames = []; return { ...r, url: location.pathname + location.search }; });
const pages = [];

await p.goto(BASE + '/', { waitUntil: 'load' });
await mark('landing load');
await p.waitForTimeout(4000);
await mark('landing idle');
await p.getByRole('link', { name: /Давай/ }).or(p.getByRole('button', { name: /Давай/ })).first().click();
await p.waitForURL(/\/app\/start/, { timeout: 30000 });
await mark('start url');
await p.getByRole('radiogroup').first().waitFor({ timeout: 30000 });
await mark('start radios');
pages.push({ seg: 'landing', ...(await collect()) });
await p.waitForTimeout(1500);
for (let i = 0; i < 5; i++) {
  await p.getByRole('radiogroup').getByRole('radio').first().click();
  await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Продолжить' }).click();
  await p.waitForTimeout(1400);
  await mark('q' + (i + 1));
}
await p.getByRole('button', { name: 'Продолжить' }).click(); // цифра
await p.waitForTimeout(1400);
await p.getByRole('radiogroup', { name: 'Первый шаг' }).waitFor();
await p.getByRole('button', { name: 'Продолжить' }).click();
const startBtn = p.getByRole('button', { name: /Начать первые/ });
await startBtn.waitFor({ timeout: 15000 });
await p.waitForTimeout(800);
await mark('plan');
await startBtn.click();
const hold = p.getByRole('button', { name: 'Начать первую сессию' });
await hold.waitFor({ timeout: 15000 });
await p.waitForTimeout(1500);
await mark('contract');
pages.push({ seg: 'onboarding', ...(await collect()) });
const box = await hold.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up();
const rel = Date.now();
await p.waitForURL(/\/app\/session/, { timeout: 30000 }).catch(() => {});
await mark('session url (' + (Date.now() - rel) + 'ms after release)');
await p.getByRole('timer').waitFor({ timeout: 30000 }).catch(() => {});
await mark('session timer (' + (Date.now() - rel) + 'ms after release)');
await p.waitForTimeout(4000);
pages.push({ seg: 'session', ...(await collect()) });
fs.writeFileSync(OUT, JSON.stringify({ CPU, NET, marks, pages }, null, 1));
// сводка
for (const pg of pages) {
  const fr = pg.frames.map((f) => f[1]);
  const long = fr.filter((d) => d > 34).length;
  const p95 = fr.slice().sort((a, b) => a - b)[Math.floor(fr.length * 0.95)] || 0;
  console.log(`\n== ${pg.seg}: кадров ${fr.length}, >34мс ${long}, p95 ${p95}мс, LoAF ${pg.loaf.length}, суммарно блок ${Math.round(pg.loaf.reduce((s, l) => s + l.block, 0))}мс`);
  const ev = pg.events.filter((e) => ['pointerup', 'click', 'pointerdown', 'keydown'].includes(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 8);
  ev.forEach((e) => console.log(`  event ${e.name} ${Math.round(e.dur)}мс (вход ${Math.round(e.input)}, обраб ${Math.round(e.proc)}) «${e.target}»`));
  pg.loaf.sort((a, b) => b.dur - a.dur).slice(0, 8).forEach((l) => console.log(`  LoAF ${Math.round(l.dur)}мс block ${Math.round(l.block)} style/layout ${Math.round(l.style)} ${l.url} ← ${l.scripts.slice(0, 3).map((s) => `${s.d}мс ${s.src} [${s.inv}] fl${s.fl}`).join(' | ')}`));
}
console.log('\nmarks:'); marks.forEach((m) => console.log(`  ${(m.wall / 1000).toFixed(2)}s ${m.m} ${m.url.slice(0, 50)}`));
await b.close();
