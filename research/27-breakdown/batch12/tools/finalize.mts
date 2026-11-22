import { readFileSync, writeFileSync } from 'node:fs'
import { readyPlan, readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const S='/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12'
const miss = readFileSync(S+'/miss.tsv','utf8').split('\n').filter(Boolean).map(l=>l.split('\t')[1])
const dec = readFileSync(S+'/dec.txt','utf8').split('\n').filter(Boolean)
const known = (t: string) => { const h = readyPlan(t); return h && !h.typo && readyTitle(t) ? readyTitle(t)! : null }
const newT = new Set<string>(); const alias = new Map<string, Set<string>>(); const bad: string[] = []
const add = (title: string, phrase: string) => { if (phrase.toLowerCase() === title.toLowerCase()) return; if (!alias.has(title)) alias.set(title, new Set()); alias.get(title)!.add(phrase) }
for (const l of dec) {
  const m = l.match(/^(\d+)([=+])(.+)$/)!; const phrase = miss[+m[1]-1]; const t = m[3].trim()
  if (m[2] === '+') { const k = known(t); if (k) add(k, phrase), add(k, t); else { newT.add(t); add(t, phrase) } }
}
for (const l of dec) {
  const m = l.match(/^(\d+)([=+])(.+)$/)!; if (m[2] !== '=') continue; const phrase = miss[+m[1]-1]; const t = m[3].trim()
  if (newT.has(t)) { add(t, phrase); continue }
  const k = known(t); if (!k) { bad.push(`${t} ← ${phrase}`); continue }; add(k, phrase)
}
console.log('new', newT.size, 'alias targets', alias.size, 'pairs', [...alias.values()].reduce((a,s)=>a+s.size,0), 'bad', bad.length); bad.forEach(b=>console.log(' ', b))
writeFileSync(S+'/new-titles.txt', [...newT].join('\n'))
writeFileSync(S+'/aliases.json', JSON.stringify(Object.fromEntries([...alias].map(([k,v])=>[k,[...v]])), null, 1))
