import { readFileSync, writeFileSync } from 'node:fs'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
import { readyPlan, readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const S='/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12'
const miss = readFileSync(S+'/miss.tsv','utf8').split('\n').filter(Boolean).map(l=>l.split('\t')[1])
const dec = readFileSync(S+'/dec.txt','utf8').split('\n').filter(Boolean)
const newT = new Set<string>(); const syn: [string,string][] = []; const bad: string[] = []
for (const l of dec) { const m = l.match(/^(\d+)([=+])(.+)$/); if (!m) { bad.push('format '+l); continue }; const phrase = miss[+m[1]-1]; if (m[2]==='+') newT.add(m[3].trim()); syn.push([phrase, m[3].trim()]) }
// new titles already in base?
const already: string[] = []
for (const t of newT) { if (GOBLIN_PLANS[t]) { already.push(t+' (точное дело)'); newT.delete(t); continue } const h = readyPlan(t); if (h && !h.typo) { already.push(`${t} → ${readyTitle(t)}`) } }
for (const [p, t] of syn) if (!GOBLIN_PLANS[t] && !newT.has(t)) bad.push(`нет дела: ${t}  (для «${p}»)`)
console.log('new', newT.size, 'syn pairs', syn.length); console.log('BAD', bad.length); bad.forEach(x=>console.log('  ',x)); console.log('NEW ALREADY KNOWN', already.length); already.forEach(x=>console.log('  ',x))
writeFileSync(S+'/new-titles.txt', [...newT].join('\n'))
