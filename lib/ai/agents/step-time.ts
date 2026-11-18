import { GOBLIN_PLANS, goblinKey } from './breakdown-goblin'
import { GOBLIN_MINUTES } from './breakdown-minutes'

/**
 * Автономная оценка времени шага (владелец 18.11: «правильная, настоящая, самая близкая — как база микрошагов, без
 * модели»). Основа — 15 606 шагов готовых планов с минутами, оценёнными вручную (breakdown-minutes.ts). Любой шаг —
 * из базы, от модели или написанный человеком — получает время самого похожего шага базы:
 *   1) тот же шаг в плане этого дела; 2) тот же шаг в любом плане; 3) самые близкие по словам шаги (вес редких слов
 *   выше, глагол важнее, план похожего дела важнее) — медиана их минут; 4) медиана по глаголу; 5) 10 минут.
 * Работает на сервере без сети и без модели, ответ мгновенный.
 */

type Entry = { tokens: string[]; minutes: number; plan: number }

const STOP = new Set(
  'или для при если что как это все всё его её их они она оно себя свой своя свои своё под над про без через после перед между также чтобы когда нужно нужные нужный необходимые необходимо необходимый каждый каждую каждое каждой весь всю всего этот эту эти том тот той так уже ещё еще можно лучше более очень только'.split(
    ' ',
  ),
)

/** «Помыть посуду под горячей водой» → основы слов: «помыт», «посуд», «горяч», «водой»→«вод» */
function stem(w: string): string {
  let s = w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ах|ях|ов|ев|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ую|юю|ом|ем|ам|ям|а|я|о|е|ы|и|у|ю|ь)$/u, '')
  if (s.length < 3) s = w
  return s.slice(0, 6)
}

export function stepTokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^a-zа-я0-9]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w))
  return [...new Set(words.map(stem))]
}

const norm = (t: string) => stepTokens(t).join(' ')

type Plan = { title: string; tokens: string[]; steps: readonly string[]; minutes: readonly number[] }
type Index = {
  entries: Entry[]
  idf: Map<string, number>
  inverted: Map<string, number[]>
  exact: Map<string, number[]>
  verb: Map<string, number[]>
  plans: Plan[]
  planByKey: Map<string, number>
}
let built: Index | null = null

function index(): Index {
  if (built) return built
  const entries: Entry[] = []
  const plans: Plan[] = []
  const planByKey = new Map<string, number>()
  for (const [title, steps] of Object.entries(GOBLIN_PLANS)) {
    const minutes = GOBLIN_MINUTES[title]
    if (!minutes || minutes.length !== steps.length) continue
    const p = plans.length
    plans.push({ title, tokens: stepTokens(title), steps, minutes })
    planByKey.set(goblinKey(title), p)
    steps.forEach((s, i) => entries.push({ tokens: stepTokens(s), minutes: minutes[i], plan: p }))
  }
  const df = new Map<string, number>()
  const inverted = new Map<string, number[]>()
  const exact = new Map<string, number[]>()
  const verb = new Map<string, number[]>()
  entries.forEach((e, i) => {
    for (const t of e.tokens) {
      df.set(t, (df.get(t) ?? 0) + 1)
      const list = inverted.get(t)
      if (list) list.push(i)
      else inverted.set(t, [i])
    }
    const key = e.tokens.join(' ')
    exact.set(key, [...(exact.get(key) ?? []), i])
    if (e.tokens[0]) verb.set(e.tokens[0], [...(verb.get(e.tokens[0]) ?? []), i])
  })
  const idf = new Map<string, number>()
  for (const [t, n] of df) idf.set(t, Math.log(1 + entries.length / n))
  built = { entries, idf, inverted, exact, verb, plans, planByKey }
  return built
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}

/** взвешенная медиана: минута, на которую приходится середина суммарного веса */
function weightedMedian(items: { minutes: number; w: number }[]): number {
  const s = [...items].sort((a, b) => a.minutes - b.minutes)
  const total = s.reduce((a, x) => a + x.w, 0)
  let acc = 0
  for (const x of s) {
    acc += x.w
    if (acc >= total / 2) return x.minutes
  }
  return s[s.length - 1].minutes
}

const sumIdf = (ts: string[], idf: Map<string, number>) => ts.reduce((a, t) => a + (idf.get(t) ?? Math.log(1 + 15000)), 0)

/**
 * Минуты одного шага; `deal` — название дела (план похожего дела весит больше). `skipPlan` — только для проверки
 * точности: оценить шаги дела, будто его плана в базе нет
 */
export function estimateStep(text: string, deal?: string, skipPlan?: string): number {
  const ix = index()
  const q = stepTokens(text)
  if (!q.length) return 5
  const skip = skipPlan === undefined ? -1 : (ix.planByKey.get(goblinKey(skipPlan)) ?? -1)
  const keep = (i: number) => ix.entries[i].plan !== skip
  const mins = (ids: number[] | undefined) => (ids ?? []).filter(keep).map((i) => ix.entries[i].minutes)
  const ex = mins(ix.exact.get(q.join(' ')))
  if (ex.length) return median(ex)

  const dealTokens = deal ? stepTokens(deal) : []
  const qw = sumIdf(q, ix.idf)
  const scores = new Map<number, number>()
  // совпало ли что-то кроме глагола: «Положить плитку» не должен брать время у «Положить ключи на место»
  const content = new Set<number>()
  q.forEach((t, k) => {
    const w = ix.idf.get(t)
    if (!w) return
    for (const i of ix.inverted.get(t) ?? []) {
      scores.set(i, (scores.get(i) ?? 0) + w)
      if (k > 0) content.add(i)
    }
  })
  const ranked: { minutes: number; w: number }[] = []
  for (const [i, shared] of scores) {
    if (!keep(i)) continue
    const e = ix.entries[i]
    let s = shared / Math.sqrt(qw * sumIdf(e.tokens, ix.idf))
    if (e.tokens[0] && e.tokens[0] === q[0]) s *= 1.5
    if (q.length > 1 && !content.has(i)) s *= 0.6
    if (dealTokens.length) {
      const pt = ix.plans[e.plan].tokens
      const overlap = dealTokens.filter((t) => pt.includes(t)).length
      if (overlap) s *= 1 + 3 * Math.min(1, overlap / Math.max(1, pt.length))
    }
    if (s >= 0.3) ranked.push({ minutes: e.minutes, w: s })
  }
  if (ranked.length) {
    ranked.sort((a, b) => b.w - a.w)
    return weightedMedian(ranked.slice(0, 9))
  }
  const byVerb = mins(q[0] ? ix.verb.get(q[0]) : undefined)
  if (byVerb.length >= 3) return median(byVerb)
  return 10
}

/** Минуты на каждый шаг дела: свой план из базы — его минуты; иначе каждый шаг — по самым похожим шагам базы */
export function estimateDeal(title: string, steps: string[]): number[] {
  const ix = index()
  const p = ix.planByKey.get(goblinKey(title))
  const plan = p === undefined ? null : ix.plans[p]
  const own = new Map<string, number>()
  plan?.steps.forEach((s, i) => own.set(norm(s), plan.minutes[i]))
  return steps.map((s) => own.get(norm(s)) ?? estimateStep(s, title))
}

/** Минуты плана из базы по точному названию дела (как его записал поиск готовых планов) */
export const libraryMinutes = (title: string): readonly number[] | undefined => GOBLIN_MINUTES[title]
