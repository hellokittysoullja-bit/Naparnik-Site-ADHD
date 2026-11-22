import { readFileSync, writeFileSync } from 'node:fs'
import { readyPlan, readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const S='/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12'
const rows = readFileSync(S+'/candidates.txt','utf8').split('\n').filter(Boolean).map(l=>l.split('\t'))
const hit: string[] = [], miss: string[] = []
for (const [sp, t] of rows) { if (!t) continue; const h = readyPlan(t); if (h) hit.push(`${sp}\t${t}\t${readyTitle(t)}\t${h.typo?'опечатка':''}`); else miss.push(`${sp}\t${t}`) }
writeFileSync(S+'/hit.tsv', hit.join('\n')); writeFileSync(S+'/miss.tsv', miss.join('\n'))
console.log('total', rows.length, 'hit', hit.length, 'miss', miss.length)
const by = new Map<string,[number,number]>(); for (const l of hit) { const s=l.split('\t')[0]; const v=by.get(s)??[0,0]; v[0]++; by.set(s,v) } for (const l of miss) { const s=l.split('\t')[0]; const v=by.get(s)??[0,0]; v[1]++; by.set(s,v) }
for (const [s,[h,m]] of [...by].sort((a,b)=>b[1][1]-a[1][1])) console.log(s, 'знает', h, 'нет', m)
