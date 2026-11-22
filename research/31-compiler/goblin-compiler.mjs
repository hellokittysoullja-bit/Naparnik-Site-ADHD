import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const out = process.argv[2]
const res = existsSync(out) ? JSON.parse(readFileSync(out,'utf8')) : {}
const items = readFileSync('/home/user/Naparnik-Site-ADHD/research/31-compiler/dumps.txt','utf8').split('\n').filter(Boolean)
for (const t of items) {
  if (res[t]) continue
  for (let k=0;k<3;k++) {
    try {
      const r = await fetch('https://goblin.tools/api/Compiler?l=ru',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://goblin.tools',Referer:'https://goblin.tools/Compiler'},body:JSON.stringify({Text:t}),signal:AbortSignal.timeout(60000)})
      if (r.status===429){await new Promise(x=>setTimeout(x,60000));continue}
      res[t]=await r.json(); writeFileSync(out, JSON.stringify(res,null,1)); console.log(t.slice(0,40),'→',JSON.stringify(res[t])); break
    } catch(e){console.log('err',String(e).slice(0,60))}
  }
  await new Promise(x=>setTimeout(x,2500))
}
console.log('DONE', Object.keys(res).length)
