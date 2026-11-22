import { readFileSync, existsSync } from 'node:fs'
import { estimateTotal } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/estimate'
import { estimateTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/step-time'
import { readyPlan, readyTitle } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
const S = '/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/est'
const rows = readFileSync('/home/user/Naparnik-Site-ADHD/research/30-estimate/manual-set.tsv','utf8').split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('\t'))
const gob: Record<string,string> = existsSync(S+'/gob-est.json') ? JSON.parse(readFileSync(S+'/gob-est.json','utf8')) : {}
const UNIT: [RegExp, number][] = [[/^сек/,1/60],[/^мин/,1],[/^час/,60],[/^д(ень|ня|ней)/,1440],[/^сут/,1440],[/^недел/,10080],[/^месяц/,43200],[/^год|^лет/,525600]]
export function parseRange(t: string): number | null {
  const s = t.toLowerCase().replace(/[–—]/g,'-').replace(/,/g,'.')
  const nums: {n:number,u:number|null}[] = []
  const re = /(\d+(?:\.\d+)?)\s*([а-яё]+)?/g; let m
  while ((m = re.exec(s))) { let u: number|null = null; const w = m[2]||''; for (const [r,v] of UNIT) if (r.test(w)) u = v; nums.push({n:+m[1],u}) }
  if (!nums.length) return null
  for (let i = nums.length-2; i>=0; i--) if (nums[i].u===null) nums[i].u = nums[i+1].u
  const vals = nums.filter(x=>x.u!==null).map(x=>x.n*(x.u as number))
  if (!vals.length) return null
  const lo = Math.min(...vals), hi = Math.max(...vals)
  return Math.sqrt(Math.max(lo,0.1)*hi)
}
const ratio = (a:number,b:number)=> Math.max(a,b)/Math.max(0.1,Math.min(a,b))
const stat = (xs: number[]) => ({ w15: Math.round(100*xs.filter(r=>r<=1.5).length/xs.length), w2: Math.round(100*xs.filter(r=>r<=2).length/xs.length), w3: Math.round(100*xs.filter(r=>r<=3).length/xs.length), med: +[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)].toFixed(2), n: xs.length })
const R = { ours: [] as number[], blind: [] as number[], gob: [] as number[], oursKnown: [] as number[], oursUnknown: [] as number[] }
const out: string[] = []
for (const [sphere, task, man] of rows) {
  const m = +man
  const hit = readyPlan(task)
  const ours = estimateTotal({ task, steps: [] }).work
  const blind = estimateTitle(task, readyTitle(task) ?? undefined)
  const g = gob[task] ? parseRange(gob[task]) : null
  R.ours.push(ratio(ours,m)); R.blind.push(ratio(blind,m)); (hit ? R.oursKnown : R.oursUnknown).push(ratio(ours,m))
  if (g) R.gob.push(ratio(g,m))
  out.push([sphere, task, m, ours, hit ? 'база' : '—', blind, gob[task] ?? '', g ? Math.round(g) : ''].join('\t'))
}
if (process.argv[2] === 'rows') console.log(out.join('\n'))
console.log(JSON.stringify({ ours: stat(R.ours), oursKnown: stat(R.oursKnown), oursUnknown: stat(R.oursUnknown), blind: stat(R.blind), goblin: R.gob.length ? stat(R.gob) : null }, null, 0))
