// Запуск: STEP=8 npx tsx research/27-breakdown/understanding/tools/diff.mts. Поиск без понимания и с ним на делах базы и их опечатках
// все дела и синонимы базы + их опечатки: сравнить поиск без понимания и с ним; вывести каждое расхождение
import { buildMatcher } from '../../../../lib/ai/agents/breakdown-match'
import { GOBLIN_PLANS } from '../../../../lib/ai/agents/breakdown-goblin'
import { TASK_ALIASES } from '../../../../lib/ai/agents/breakdown-aliases'
const entries: [string, string][] = [...Object.keys(GOBLIN_PLANS).map((k) => [k, k] as [string, string]), ...Object.entries(TASK_ALIASES).flatMap(([k, v]) => v.map((a) => [a, k] as [string, string]))]
const A = buildMatcher<string>(entries), B = buildMatcher<string>(entries, { understand: true })
const mut = (w: string) => { const out: string[] = []; for (let i = 0; i < w.length; i++) { out.push(w.slice(0, i) + w.slice(i + 1)); if (i < w.length - 1) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); out.push(w.slice(0, i) + 'о' + w.slice(i + 1)); out.push(w.slice(0, i) + 'а' + w.slice(i + 1)) } return out }
let n = 0, gain = 0, lost = 0; const changed: string[] = []
const seen = new Set<string>()
let idx = 0
const STEP = Number(process.env.STEP ?? 5)
const tA = { a: 0, b: 0 }
for (const [s] of entries) {
  if (idx++ % STEP) continue
  const ws = s.split(' ')
  const qs = [s]; ws.forEach((w, i) => { if (w.length >= 4) for (const x of mut(w)) qs.push([...ws.slice(0, i), x, ...ws.slice(i + 1)].join(' ')) })
  for (const q of qs) {
    if (seen.has(q)) continue; seen.add(q); n++
    let t0 = performance.now(); const a = A.find(q)?.value ?? null; tA.a += performance.now() - t0; t0 = performance.now(); const b = B.find(q)?.value ?? null; tA.b += performance.now() - t0
    if (a === b) continue
    if (a === null) gain++; else if (b === null) lost++
    changed.push(`${q}  |  было: ${a ?? '—'}  →  стало: ${b ?? '—'}`)
  }
}
console.log({ n, changed: changed.length, gain, lost, msA: (tA.a / n).toFixed(3), msB: (tA.b / n).toFixed(3) })
console.log(changed.join('\n'))
