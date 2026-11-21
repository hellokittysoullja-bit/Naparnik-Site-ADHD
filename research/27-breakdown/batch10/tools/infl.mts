import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { readFileSync, writeFileSync } from 'node:fs'
const titles = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)
const out: string[] = []
const END = ['а', 'у', 'ы', 'е', 'и', 'о', 'ю', 'я']
for (const t of titles) {
  const ws = t.toLowerCase().split(' ')
  ws.forEach((w, i) => {
    if (i === 0 || w.length < 4) return
    for (const e of END) {
      const x = /[аеиоуыюя]$/.test(w) ? w.slice(0, -1) + e : w + e
      if (x === w) continue
      const p = [...ws.slice(0, i), x, ...ws.slice(i + 1)].join(' ')
      out.push(`${p}\t${readyPlan(p)?.title ?? "-"}\t${t}`)
    }
  })
}
writeFileSync(process.argv[3], out.join('\n'))
