import { estimateDeal } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/step-time'
import { readFileSync, writeFileSync } from 'node:fs'
const D = process.argv[2]
const cur = JSON.parse(readFileSync(`${D}/curated-batch12.json`, 'utf8'))
const out: Record<string, number[]> = {}
for (const [t, v] of Object.entries<{ steps: string[] }>(cur.plans)) out[t] = estimateDeal(t, v.steps)
writeFileSync(`${D}/mins.json`, JSON.stringify(out))
