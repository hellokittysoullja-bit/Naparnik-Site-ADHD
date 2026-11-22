import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const out = process.argv[2], src = process.argv[3]
const res = existsSync(out) ? JSON.parse(readFileSync(out,'utf8')) : {}
const items = readFileSync(src,'utf8').split('\n').filter(l=>l && !l.startsWith('#')).map(l=>l.split('\t')[1])
for (const t of items) {
  if (res[t]) continue
  for (let k=0;k<3;k++) {
    try {
      const r = await fetch('https://goblin.tools/api/Estimator?l=ru',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://goblin.tools',Referer:'https://goblin.tools/Estimator'},body:JSON.stringify({Text:t,Spiciness:2}),signal:AbortSignal.timeout(60000)})
      if (r.status===429){await new Promise(x=>setTimeout(x,60000));continue}
      const j = await r.text(); res[t]=j.trim().replace(/^"|"$/g,''); writeFileSync(out, JSON.stringify(res,null,1)); console.log(t,'→',res[t]); break
    } catch(e){console.log('err',t,String(e).slice(0,60))}
  }
  await new Promise(x=>setTimeout(x,2000))
}
console.log('DONE', Object.keys(res).length)
