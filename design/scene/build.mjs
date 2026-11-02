// Рендер ночного мира первого экрана в зацикленное видео и заставку (public/scene).
// Запуск: node design/scene/build.mjs (нужны Playwright/Chromium и ffmpeg с libx264 и libvpx-vp9).
// Сцена — design/scene/scene.mjs. После пересборки prebuild проставит ?v= (scripts/asset-versions.mjs).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { LOOP, sceneHtml } from "./scene.mjs";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = path.join(root, "public", "scene");
fs.mkdirSync(out, { recursive: true });
const FPS = 15;

// portrait — телефоны и планшеты стоя (раскладка до lg), landscape — компьютеры (раскладка lg)
const VARIANTS = [
  // H.264 level 4.0/4.2 — аппаратный декодер любого iPhone с 6s (у них потолок High@4.2); кадр ≤ 8192
  // макроблоков, поэтому landscape — 1728×1080, а не 1920×1200 (тот требовал level 5 и мог не заиграть)
  { name: "portrait", width: 420, height: 748, dpr: 2, level: "4.0" },
  { name: "landscape", width: 1600, height: 1000, dpr: 1.08, level: "4.2" },
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scene-"));
const htmlPath = path.join(tmp, "scene.html");
fs.writeFileSync(htmlPath, sceneHtml());
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });

const browser = await chromium.launch();
for (const v of VARIANTS) {
  const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr });
  await page.goto("file://" + htmlPath);
  const dir = path.join(tmp, v.name);
  fs.mkdirSync(dir);
  const frames = LOOP * FPS;
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.__setTime(t), i / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`) });
  }
  await page.close();
  const input = ["-framerate", String(FPS), "-i", path.join(dir, "f%04d.png")];
  // H.264 — Safari/iOS; faststart — играть до полной загрузки
  ff([...input, "-c:v", "libx264", "-preset", "veryslow", "-crf", "26", "-tune", "film", "-profile:v", "high", "-level:v", v.level, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", path.join(out, `night-${v.name}.mp4`)]);
  // VP9 — Chrome/Firefox/Android, мельче при том же качестве
  ff([...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "1", "-pix_fmt", "yuv420p", "-an", path.join(out, `night-${v.name}.webm`)]);
  // заставка = первый кадр видео: смена заставки на видео незаметна
  ff(["-i", path.join(dir, "f0000.png"), "-c:v", "libwebp", "-quality", "82", "-compression_level", "6", path.join(out, `night-${v.name}.webp`)]);
  for (const ext of ["mp4", "webm", "webp"]) {
    const f = path.join(out, `night-${v.name}.${ext}`);
    console.log(`${path.relative(root, f)}: ${(fs.statSync(f).size / 1024).toFixed(0)} КБ`);
  }
}
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
