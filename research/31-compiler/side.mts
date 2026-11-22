import { readFileSync } from 'node:fs'
import { compile } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/compile'
const S='/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/comp'
const g = JSON.parse(readFileSync(S+'/gob-comp.json','utf8'))
const d = readFileSync('/home/user/Naparnik-Site-ADHD/research/31-compiler/dumps.txt','utf8').split('\n').filter(Boolean)
let i=0; for (const t of d) { i++; console.log(`${i}. ${t}\n   гоблин: ${(g[t]??[]).join(' | ')}\n   мы:     ${compile(t).join(' | ')}`) }
