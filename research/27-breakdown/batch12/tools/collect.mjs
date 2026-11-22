import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const dir = '/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/b12'
const [part, parts] = [Number(process.argv[2]), Number(process.argv[3])]
const file = `${dir}/raw${part}.json`
const out = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
const all = readFileSync(`${dir}/new-titles.txt`, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
const tasks = all.filter((t, i) => i % parts === part && !out[t])
console.log('to fetch', tasks.length)
for (const t of tasks) {
  for (let tryN = 0; tryN < 3; tryN++) {
    try {
      const r = await fetch('https://goblin.tools/api/todo/?l=ru', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://goblin.tools', Referer: 'https://goblin.tools/ToDo' }, body: JSON.stringify({ Text: t, Spiciness: 1, Ancestors: [] }), signal: AbortSignal.timeout(60000) })
      if (r.status === 429) { console.log('429 wait'); await new Promise((x) => setTimeout(x, 60000)); continue }
      const j = await r.json()
      if (Array.isArray(j) && j.length) { out[t] = j; writeFileSync(file, JSON.stringify(out, null, 1)); console.log('ok', t, j.length); break }
      console.log('bad', t, JSON.stringify(j).slice(0, 80))
    } catch (e) { console.log('err', t, String(e).slice(0, 80)) }
  }
  await new Promise((r) => setTimeout(r, 2500))
}
console.log('DONE', Object.keys(out).length)
