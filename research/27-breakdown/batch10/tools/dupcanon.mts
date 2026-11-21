import { readFileSync } from 'node:fs'
import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { TASK_ALIASES } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-aliases'
import { ALL_TEMPLATES } from '/home/user/Naparnik-Site-ADHD/lib/templates'
const names = new Set([...Object.keys(GOBLIN_PLANS), ...ALL_TEMPLATES.map((t) => t.title)])
const byPlan = new Map<string, string>()
for (const n of names) { const r = readyPlan(n); if (r) byPlan.set(JSON.stringify(r.value.steps), n) }
for (const l of readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)) {
  const [a, t] = l.split('='); const r = readyPlan(a); if (!r) continue
  const canon = byPlan.get(JSON.stringify(r.value.steps)) ?? `?${r.title}`
  console.log(`MERGE[${JSON.stringify(t)}] = ${JSON.stringify(canon)}  # ${a}`)
}
