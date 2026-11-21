import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { readFileSync } from 'node:fs'
const st = (t: string) => JSON.stringify(readyPlan(t)?.value.steps)
let own = 0
const other: string[] = []
for (const l of readFileSync(process.argv[2], 'utf8').split('\n')) { const [p, got, base] = l.split('\t'); if (got === '-' || !got) continue; if (st(got) === st(base)) own++; else other.push(`${p} → ${got}  (база: ${base})`) }
console.log('своё', own, 'чужое', other.length); console.log(other.slice(0, 80).join('\n'))
