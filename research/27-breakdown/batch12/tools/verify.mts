import { readFileSync } from 'node:fs'
import { readyPlan, readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const T = '/home/user/Naparnik-Site-ADHD/research/27-breakdown/batch12/tools'
const cur = JSON.parse(readFileSync(T + '/curated-batch12.json', 'utf8'))
const rows = readFileSync(T + '/../candidates.txt', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[1])
let hit = 0; for (const t of rows) if (readyPlan(t)) hit++
console.log('формулировок', rows.length, 'узнаётся', hit, `(${Math.round(100 * hit / rows.length)} %)`)
// каждая размеченная фраза — к своему делу
const want = new Map<string, string>()
for (const [t, v] of Object.entries<{ synonyms: string[] }>(cur.plans)) { want.set(t, t); for (const s of v.synonyms) want.set(s, t) }
for (const [t, names] of Object.entries<string[]>(cur.old_aliases)) for (const s of names) want.set(s, t)
const wrong: string[] = []
for (const [phrase, t] of want) { const got = readyTitle(phrase); const h = readyPlan(phrase); const tgt = readyPlan(t); if (!h || !tgt || JSON.stringify(h.value.steps) !== JSON.stringify(tgt.value.steps)) wrong.push(`${phrase} → ${got ?? '—'} (ждали ${t})`) }
console.log('размеченных фраз', want.size, 'не к своему делу', wrong.length); wrong.slice(0, 40).forEach((w) => console.log('  ', w))
// старые узнавания не поменялись
const before = readFileSync(T + '/hit-before.tsv', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
const changed: string[] = []
for (const [, t, was] of before) { const now = readyTitle(t); if (now !== was) changed.push(`${t}: было «${was}», стало «${now ?? '—'}»`) }
console.log('старых узнаваний', before.length, 'поменялось', changed.length); changed.slice(0, 60).forEach((c) => console.log('  ', c))
