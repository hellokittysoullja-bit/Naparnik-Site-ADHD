// «Кот ожил»: время от начала навигации до момента, когда у первого кота на странице нарисован WebGL-кадр
// (постер убран, холст виден). CPU ×N, 3G как в perfwalk.mjs; холодный кэш (новый контекст на прогон).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const BASE = process.argv[2] || 'http://localhost:3700';
const CPU = Number(process.argv[3] || 4);
const RUNS = Number(process.argv[4] || 3);
const PATHS = (process.argv[5] || '/,/app/start').split(',');
const b = await chromium.launch();
const net = { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 };
for (const path of PATHS) {
  const res = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      const check = () => {
        if (window.__alive) return;
        const el = document.querySelector('.cat-doll');
        if (!el) return;
        const cv = el.querySelectorAll('canvas')[1];
        if (cv && cv.style.display === 'block' && !el.querySelector('img')) window.__alive = performance.now();
      };
      new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
    });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
    await p.goto(BASE + path + (path === '/' ? '?intro=1' : ''), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__alive, null, { timeout: 60000, polling: 100 }).catch(() => {});
    res.push(Math.round(await p.evaluate(() => window.__alive || -1)));
    await ctx.close();
  }
  res.sort((a, b) => a - b);
  console.log(`${path}: кот ожил ${res.join(', ')} мс; медиана ${res[Math.floor(res.length / 2)]}`);
}
await b.close();
