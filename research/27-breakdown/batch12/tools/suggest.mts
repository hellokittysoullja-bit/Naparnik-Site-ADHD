import { readFileSync, writeFileSync } from 'node:fs'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { TASK_ALIASES } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-aliases'
import { stepTokens } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/step-time'
import { readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const S='/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12'
type E = { t: string; toks: string[]; title: string }
const ents: E[] = []
for (const t of Object.keys(GOBLIN_PLANS)) ents.push({ t, toks: stepTokens(t), title: t })
for (const [title, al] of Object.entries(TASK_ALIASES)) for (const a of al) ents.push({ t: a, toks: stepTokens(a), title })
const df = new Map<string, number>(); for (const e of ents) for (const w of new Set(e.toks)) df.set(w, (df.get(w) ?? 0) + 1)
const idf = (w: string) => Math.log(1 + ents.length / (df.get(w) ?? 0.5))
const inv = new Map<string, number[]>(); ents.forEach((e, i) => e.toks.forEach((w) => inv.set(w, [...(inv.get(w) ?? []), i])))
const rows = readFileSync(S + '/miss.tsv', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))
const out: string[] = []
for (const [sp, t] of rows) {
  const q = stepTokens(t)
  const sc = new Map<number, number>()
  for (const w of q) for (const i of inv.get(w) ?? []) sc.set(i, (sc.get(i) ?? 0) + idf(w))
  const qn = Math.sqrt(q.reduce((a, w) => a + idf(w) ** 2, 0)) || 1
  const best = [...sc].map(([i, s]) => ({ i, s: s / (qn * Math.sqrt(ents[i].toks.reduce((a, w) => a + idf(w) ** 2, 0)) || 1) })).sort((a, b) => b.s - a.s)
  const seen = new Set<string>(); const sug: string[] = []
  for (const b of best) { const ti = readyTitle(ents[b.i].title) ?? ents[b.i].title; if (seen.has(ti)) continue; seen.add(ti); sug.push(`${ti} (${b.s.toFixed(2)})`); if (sug.length >= 3) break }
  out.push(`${sp}\t${t}\t${sug.join(' ; ')}`)
}
writeFileSync(S + '/suggest.tsv', out.join('\n'))
console.log(out.length)
