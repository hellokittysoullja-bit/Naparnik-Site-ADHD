import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { normalize } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-match'
const ws = new Set<string>()
for (const s of Object.values(GOBLIN_PLANS).flat()) for (const w of normalize(s).split(' ')) if (w.length >= 4) ws.add(w)
const out: string[] = []
for (const w of ws) { const r = readyPlan(w); if (r && r.corrected && !normalize(r.title).split(' ').includes(w)) out.push(`${w} → ${r.title}`) }
console.log(ws.size, out.length); console.log(out.join('\n'))
