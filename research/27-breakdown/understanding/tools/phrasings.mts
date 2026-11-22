import { readyPlan } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown'
import { GOBLIN_PLANS } from '/home/user/Naparnik-Site-ADHD/lib/ai/agents/breakdown-goblin'
const names = Object.keys(GOBLIN_PLANS).filter((_, i) => i % 5 === 0)
const P = ['я должен', 'я должна', 'помоги', 'помоги мне', 'не могу', 'никак не могу', 'боюсь', 'лень', 'мне лень', 'как заставить себя', 'не получается', 'с чего начать', 'не хочу', 'бля надо', 'капец надо', 'вообще надо', 'хорошо бы', 'стоит', 'планирую', 'собираюсь', 'думаю', 'попробую', 'надо', 'мне нужно', 'хочу', 'короче надо', 'реально надо', 'наверное надо', 'не знаю как', 'страшно']
const S = [' пж', ' уже давно', ' хоть как-то', ' немного', ' чуть-чуть', ' пожалуйста', ' блин', ' сегодня вечером', ' плз', ' !!!']
const stat: Record<string, [number, number, number]> = {}
const bad: Record<string, string[]> = {}
const own = (t: string) => JSON.stringify(readyPlan(t)?.value.steps)
for (const t of names) {
  const p = own(t)
  const low = t.toLowerCase()
  for (const [k, q] of [...P.map((x) => [x + ' _', `${x} ${low}`]), ...S.map((x) => ['_' + x, low + x])] as [string, string][]) {
    const s = (stat[k] ??= [0, 0, 0])
    const r = readyPlan(q)
    if (!r) { s[1]++; (bad[k] ??= []).push('НЕТ ' + q) } else if (JSON.stringify(r.value.steps) === p) s[0]++
    else { s[2]++; (bad[k] ??= []).push(`${q} → ${r.title}`) }
  }
}
console.log('names', names.length)
for (const [k, [o, n, x]] of Object.entries(stat)) console.log(k.padEnd(16), 'own', o, 'none', n, 'other', x)
for (const [k, v] of Object.entries(bad)) console.log('\n##', k, '\n' + v.slice(0, 8).join('\n'))
