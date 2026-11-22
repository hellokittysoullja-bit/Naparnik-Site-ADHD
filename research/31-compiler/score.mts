import { readFileSync } from 'node:fs'
import { compile } from '../../lib/ai/agents/compile'
const g: Record<string, string[]> = JSON.parse(readFileSync(new URL('./goblin-compiler-raw.json', import.meta.url), 'utf8'))
const n = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
let same = 0, sameCount = 0, items = 0, match = 0
for (const [t, gl] of Object.entries(g)) {
  const ours = compile(t)
  const a = ours.map(n), b = gl.map(n)
  if (a.join('|') === b.join('|')) same++
  if (a.length === b.length) sameCount++
  items += b.length; match += b.filter((x) => a.includes(x)).length
}
console.log({ dumps: Object.keys(g).length, identical: same, sameNumberOfItems: sameCount, goblinItems: items, wordForWord: match })
