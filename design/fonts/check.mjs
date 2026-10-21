// Проверка перед build: все символы текста первого экрана покрыты вшитыми подмножествами шрифтов
// (app/hero-fonts.css). Если текст героя изменили, а шрифты не пересобрали (python3 design/fonts/build.py),
// сборка останавливается — иначе недостающие буквы ждали бы внешний файл и первый кадр стал бы неполным.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const hero = fs.readFileSync(path.join(root, "components", "landing", "hero.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "hero-fonts.css"), "utf8");
const PUNCT = " .,:;!?…—–-«»() 2";
const covered = (fam, w) => {
  const re = new RegExp(`font-family:\\s*"${fam}";[^}]*font-weight:\\s*${w};[^}]*unicode-range:\\s*([^;]+);`, "s");
  const m = css.match(re);
  if (!m) throw new Error(`hero-fonts.css: нет вшитого ${fam} ${w}`);
  const set = new Set();
  for (const r of m[1].split(",")) {
    const [a, b] = r.trim().replace("U+", "").split("-").map((x) => parseInt(x, 16));
    for (let c = a; c <= (b ?? a); c++) set.add(c);
  }
  return set;
};
const need = {
  "Manrope|500": [...new Set([...hero].filter((c) => c >= "Ѐ" && c <= "ӿ").concat([...PUNCT, ..."0123456789"]))],
  "Manrope|700": null,
  "Caveat|500": null,
};
need["Manrope|700"] = need["Manrope|500"];
const greet = (hero.match(/"(Привет[^"]*)"/) || [])[1];
const note = (hero.match(/font-hand[^>]*>\s*([^<]+)<br\s*\/>\s*([^<]+)<\/p>/s) || []).slice(1, 3).join("");
if (!greet || !note) throw new Error("check.mjs: не нашёл строки рукописи в hero.tsx — поправить извлечение и в build.py");
need["Caveat|500"] = [...new Set([...(greet + note.replace(/&nbsp;/g, " ")), ...PUNCT])];
let bad = [];
for (const [k, chars] of Object.entries(need)) {
  const [fam, w] = k.split("|");
  const set = covered(fam, w);
  const miss = chars.filter((c) => c !== "\n" && !set.has(c.codePointAt(0)));
  if (miss.length) bad.push(`${fam} ${w}: нет ${JSON.stringify(miss.join(""))}`);
}
if (bad.length) { console.error("Шрифты первого экрана не покрывают текст героя — запустите python3 design/fonts/build.py:\n  " + bad.join("\n  ")); process.exit(1); }
console.log("hero fonts ok: символы первого экрана покрыты вшитыми подмножествами");
