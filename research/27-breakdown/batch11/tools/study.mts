import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const V = ['', 'сделать', 'делать', 'решить', 'доделать', 'выполнить', 'написать', 'подготовить', 'надо сделать']
const H = ['дз', 'домашку', 'домашнее задание', 'домашнюю работу', 'уроки', 'задание', 'домашка']
const P = ['по', 'к', 'для', 'на']
const SU = ['истории', 'математике', 'англу', 'английскому', 'физике', 'алгебре', 'русскому', 'химии', 'литре', 'матеше', 'инфе', 'биологии', 'геометрии', 'обществознанию', 'общаге', 'русу', 'английскому языку']
const miss: Record<string, number> = {}; let n = 0, ok = 0
const byTitle: Record<string, number> = {}
for (const v of V) for (const h of H) for (const p of P) for (const s of SU) {
  const q = `${v} ${h} ${p} ${s}`.trim(); n++
  const r = readyPlan(q)
  if (r) { ok++; byTitle[r.title.split(' по ')[0]] = (byTitle[r.title.split(' по ')[0]] ?? 0) + 1 } else { const k = `${v}|${h}|${p}`; miss[k] = (miss[k] ?? 0) + 1 }
}
console.log({ n, ok })
console.log(Object.entries(byTitle).sort((a,b)=>b[1]-a[1]).slice(0,40))
console.log(Object.entries(miss).sort((a,b)=>b[1]-a[1]).slice(0,80).map(x=>x.join('=')).join('  '))
