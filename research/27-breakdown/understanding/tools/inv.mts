// Запуск из корня: npx tsx research/27-breakdown/understanding/tools/inv.mts <файл с названиями дел>. Дело + время → своё дело или более узкое
import { readyPlan } from '../../../../lib/ai/agents/breakdown'
import { readFileSync } from 'node:fs'
const names = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)
const D = ['вечером', 'в субботу', 'после ужина', 'в 7', 'завтра утром']
let n = 0, own = 0, none = 0; const bad: string[] = []
for (const t of names) {
  const p = JSON.stringify(readyPlan(t)?.value.steps)
  for (const d of D) for (const q of [`${t} ${d}`, `${d} ${t}`]) {
    n++
    const r = readyPlan(q)
    if (!r) { none++; bad.push("НЕТ: " + q); continue }
    if (JSON.stringify(r.value.steps) === p) { own++; continue }
    bad.push(`${q} → ${r.title}`)
  }
}
console.log({ n, own, none, other: bad.length })
console.log(bad.join('\n'))
