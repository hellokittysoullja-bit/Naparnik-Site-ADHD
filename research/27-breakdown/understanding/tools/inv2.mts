// Запуск: npx tsx research/27-breakdown/understanding/tools/inv2.mts <файл с названиями>. Глагол в другом виде или форме → своё дело
import { readyPlan } from '../../../../lib/ai/agents/breakdown'
import { ASPECT, VERB_SAME, NOUN_SAME } from '../../../../lib/ai/agents/breakdown-understand'
import { readFileSync } from 'node:fs'
const names = readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)
const inv = (m: Record<string, string>) => { const r: Record<string, string[]> = {}; for (const [a, b] of Object.entries(m)) (r[b] ??= []).push(a); return r }
const IA = inv(ASPECT), IV = inv(VERB_SAME), IN = inv(NOUN_SAME)
// формы от неопределённой: прошедшее и повелительное (грубо, только частые окончания)
const forms = (v: string): string[] => {
  const out: string[] = []
  if (v.endsWith('ться')) out.push(v.slice(0, -4) + 'лся', v.slice(0, -4) + 'лась')
  else if (v.endsWith('ть')) out.push(v.slice(0, -2) + 'л', v.slice(0, -2) + 'ла', v.slice(0, -2) + 'ли')
  if (v.endsWith('ить')) out.push(v.slice(0, -3) + 'и')
  if (v.endsWith('ать')) out.push(v.slice(0, -3) + 'ай')
  if (v.endsWith('ыть')) out.push(v.slice(0, -3) + 'ой')
  return out
}
let n = 0, own = 0, none = 0; const bad: string[] = []
for (const t of names) {
  const p = JSON.stringify(readyPlan(t)?.value.steps)
  const ws = t.split(' '); const v = ws[0].toLowerCase()
  const qs = new Set<string>()
  for (const a of [...(IA[v] ?? []), ...(IV[v] ?? []), ...forms(v)]) qs.add([a, ...ws.slice(1)].join(' '))
  ws.forEach((w, i) => { for (const a of IN[w.toLowerCase()] ?? []) qs.add([...ws.slice(0, i), a, ...ws.slice(i + 1)].join(' ')) })
  for (const q of qs) { n++; const r = readyPlan(q); if (!r) { none++; continue } if (JSON.stringify(r.value.steps) === p) own++; else bad.push(`${q} → ${r.title}   (из «${t}»)`) }
}
console.log({ n, own, none, other: bad.length }); console.log(bad.join('\n'))
