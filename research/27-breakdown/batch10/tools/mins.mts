import { estimateDeal } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/step-time'
import { readFileSync, writeFileSync } from 'node:fs'
const D = process.argv[2]
const cur = JSON.parse(readFileSync(`${D}/curated-batch10.json`, 'utf8'))
const out: Record<string, number[]> = {}
for (const [t, v] of Object.entries<{ steps: string[]; m?: number[] }>(cur.plans)) out[t] = v.m ?? estimateDeal(t, v.steps)
writeFileSync(`${D}/mins.json`, JSON.stringify(out))
// печать для проверки глазами: дело, сумма, шаг=минуты
for (const [t, v] of Object.entries<{ steps: string[]; m?: number[] }>(cur.plans)) { if (v.m) continue; const m = out[t]; console.log(`${t} [${m.reduce((a, b) => a + b, 0)}] ` + v.steps.map((s: string, i: number) => `${s.slice(0, 38)}=${m[i]}`).join(' | ')) }
