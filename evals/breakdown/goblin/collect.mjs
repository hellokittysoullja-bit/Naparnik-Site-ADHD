import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const dir = process.env.GOBLIN_DIR ?? 'evals/breakdown/goblin'
const have = new Set(JSON.parse(process.argv[2]).map((s) => s.toLowerCase().replace(/ё/g, 'е')))
const out = existsSync(`${dir}/raw.json`) ? JSON.parse(readFileSync(`${dir}/raw.json`, 'utf8')) : {}
const tasks = [...new Set(readFileSync(`${dir}/tasks.txt`, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))]
  .filter((t) => !have.has(t.toLowerCase().replace(/ё/g, 'е')) && !out[t])
console.log('to fetch', tasks.length)
for (const t of tasks) {
  try {
    const r = await fetch('https://goblin.tools/api/todo/?l=ru', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://goblin.tools', Referer: 'https://goblin.tools/ToDo' }, body: JSON.stringify({ Text: t, Spiciness: 1, Ancestors: [] }), signal: AbortSignal.timeout(45000) })
    if (r.status === 429) { console.log('429, stop'); break }
    const j = await r.json()
    if (Array.isArray(j) && j.length) { out[t] = j; writeFileSync(`${dir}/raw.json`, JSON.stringify(out, null, 1)); console.log('ok', t, j.length) }
    else console.log('bad', t, JSON.stringify(j).slice(0, 80))
  } catch (e) { console.log('err', t, String(e).slice(0, 80)) }
  await new Promise((r) => setTimeout(r, 4000))
}
console.log('DONE', Object.keys(out).length)
