// опечатки в названиях новых дел: доля, которая ведёт к своему делу
import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { readFileSync } from 'node:fs'
const c = JSON.parse(readFileSync('/home/user/Naparnik-Site-ADHD/research/27-breakdown/batch11/tools/curated-batch11.json', 'utf8'))
const mut = (w: string) => { const o: string[] = []; for (let i = 1; i < w.length; i++) { o.push(w.slice(0, i) + w.slice(i + 1)); if (i < w.length - 1) o.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)) } return o }
let n = 0, own = 0, other = 0; const bad: string[] = []
for (const t of Object.keys(c.plans)) { const p = JSON.stringify(readyPlan(t)?.value.steps); const ws = t.split(' ')
  ws.forEach((w, i) => { if (w.length < 5) return; for (const x of mut(w)) { const q = [...ws.slice(0, i), x, ...ws.slice(i + 1)].join(' '); n++; const r = readyPlan(q); if (!r) continue; if (JSON.stringify(r.value.steps) === p) own++; else { other++; if (bad.length < 25) bad.push(`${q} → ${r.title}`) } } }) }
console.log({ n, own, pct: (own / n * 100).toFixed(1), other }); console.log(bad.join('\n'))
