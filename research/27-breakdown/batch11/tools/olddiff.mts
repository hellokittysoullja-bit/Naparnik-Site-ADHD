// старый и новый поиск на всех делах и синонимах базы, их опечатках и формах с уточнениями
import { buildMatcher as NEW } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-match'
import { buildMatcher as OLD } from './old/breakdown-match'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { TASK_ALIASES } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-aliases'
import { readFileSync } from 'node:fs'
const entries: [string, string][] = [...Object.keys(GOBLIN_PLANS).map((k) => [k, k] as [string, string]), ...Object.entries(TASK_ALIASES).flatMap(([k, v]) => v.map((a) => [a, k] as [string, string]))]
const A = OLD<string>(entries, { understand: true }), B = NEW<string>(entries, { understand: true })
const mut = (w: string) => { const out: string[] = []; for (let i = 0; i < w.length; i++) { out.push(w.slice(0, i) + w.slice(i + 1)); if (i < w.length - 1) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); out.push(w.slice(0, i) + 'о' + w.slice(i + 1)) } return out }
const STEP = Number(process.env.STEP ?? 3)
const extra = process.env.EXTRA ? readFileSync(process.env.EXTRA, 'utf8').split('\n').filter(Boolean) : []
let n = 0; const changed: string[] = []; const seen = new Set<string>(); let idx = 0
const qsAll: string[] = [...extra]
for (const [s] of entries) {
  if (idx++ % STEP) continue
  const ws = s.split(' ')
  qsAll.push(s, `${s} вечером`, `завтра ${s}`)
  ws.forEach((w, i) => { if (w.length >= 4) for (const x of mut(w)) qsAll.push([...ws.slice(0, i), x, ...ws.slice(i + 1)].join(' ')) })
}
for (const q of qsAll) {
  if (seen.has(q)) continue; seen.add(q); n++
  const a = A.find(q)?.value ?? null, b = B.find(q)?.value ?? null
  if (a !== b) changed.push(`${q}  |  было: ${a ?? '—'}  →  стало: ${b ?? '—'}`)
}
console.log({ n, changed: changed.length, lost: changed.filter((c) => c.endsWith('→  стало: —')).length })
console.log(changed.join('\n'))
