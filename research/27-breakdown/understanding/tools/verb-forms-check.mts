import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { readFileSync, writeFileSync } from 'node:fs'
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
const st: Record<string, number[]> = {}
const bad: string[] = []
const cache = new Map<string, string>()
for (const [k, t, q] of rows) {
  if (!cache.has(t)) cache.set(t, JSON.stringify(readyPlan(t)?.value.steps))
  const s = (st[k] ??= [0, 0, 0])
  const r = readyPlan(q)
  if (!r) { s[1]++; bad.push(`${k}\tНЕТ\t${q}\t${t}`) } else if (JSON.stringify(r.value.steps) === cache.get(t)) s[0]++
  else { s[2]++; bad.push(`${k}\tЧУЖОЕ\t${q}\t${t}\t→ ${r.title}`) }
}
console.log(st)
writeFileSync(process.argv[3], bad.join('\n'))
