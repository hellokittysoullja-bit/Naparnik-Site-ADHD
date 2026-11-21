import { readFileSync } from 'node:fs'
import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
let fresh = 0, same = 0, other = 0; const outF: string[] = [], outO: string[] = []
for (const [f, t] of rows) {
  const r = readyPlan(f), p = readyPlan(t)
  if (!r) { fresh++; outF.push(`${f}\t${t}`); continue }
  if (JSON.stringify(r.value.steps) === JSON.stringify(p?.value.steps)) same++; else { other++; outO.push(`${f} → ${r.title}   (дело: ${t})`) }
}
console.log({ fresh, same, other })
import('node:fs').then((fs) => { fs.writeFileSync(process.argv[3], outF.join('\n') + '\n'); fs.writeFileSync(process.argv[3] + '.other', outO.join('\n') + '\n') })
