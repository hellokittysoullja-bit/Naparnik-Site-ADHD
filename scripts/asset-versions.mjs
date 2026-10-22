// Версии в адресах своей статики: шрифтов (public/fonts) и кота (public/mascot/poster, public/mascot/doll).
// Запускается в prebuild (и вручную после пересборки шрифтов или куклы): считает короткий хэш содержимого каждого файла,
// пишет lib/asset-versions.ts и проставляет ?v=хэш в url() шрифтов app/fonts.css. Адреса с ?v отдаются с годовым
// кэшем (next.config.mjs): изменился файл — изменилась ссылка, старая версия застрять не может; без ?v — как раньше.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const dirs = ["fonts", "mascot/poster", "mascot/doll"];
const versions = {};
for (const d of dirs) {
  for (const f of fs.readdirSync(path.join(pub, d)).sort()) {
    const full = path.join(pub, d, f);
    if (!fs.statSync(full).isFile() || !/\.(woff2|webp|json)$/.test(f)) continue;
    versions[`/${d}/${f}`] = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex").slice(0, 10);
  }
}
const ts = `// Сгенерировано scripts/asset-versions.mjs (prebuild) — не править руками.
export const ASSET_VERSIONS: Record<string, string> = ${JSON.stringify(versions, null, 2)};

/** Адрес своей статики с версией содержимого: такой адрес кэшируется на год (next.config.mjs). */
export function asset(p: string): string {
  const v = ASSET_VERSIONS[p];
  return v ? \`\${p}?v=\${v}\` : p;
}
`;
const tsPath = path.join(root, "lib", "asset-versions.ts");
if (!fs.existsSync(tsPath) || fs.readFileSync(tsPath, "utf8") !== ts) fs.writeFileSync(tsPath, ts);

const cssPath = path.join(root, "app", "fonts.css");
const css = fs.readFileSync(cssPath, "utf8");
let missing = [];
const out = css.replace(/url\("(\/fonts\/[^"?]+)(\?v=[0-9a-f]+)?"\)/g, (m, p) => {
  if (!versions[p]) { missing.push(p); return m; }
  return `url("${p}?v=${versions[p]}")`;
});
if (missing.length) { console.error("asset-versions: в app/fonts.css ссылки на несуществующие файлы: " + missing.join(", ")); process.exit(1); }
if (out !== css) fs.writeFileSync(cssPath, out);
console.log(`asset versions ok: ${Object.keys(versions).length} файлов`);
