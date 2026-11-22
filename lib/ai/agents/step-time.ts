import { GOBLIN_PLANS, goblinKey } from './breakdown-goblin'
import { GOBLIN_MINUTES } from './breakdown-minutes'
import { TASK_ALIASES } from './breakdown-aliases'
import { isWaitStep, LONG_WAIT, RESULT, splitMinutes } from './wait-steps'
export { isWaitStep, splitMinutes } from './wait-steps'

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
export function estimateDeal(title: string, steps: string[], known?: { steps: readonly string[]; minutes?: readonly (number | undefined)[] }): number[] {
  const ix = index()
  const p = ix.planByKey.get(goblinKey(title))
  const plan = p === undefined ? null : ix.plans[p]
  const own = new Map<string, number>()
  plan?.steps.forEach((s, i) => own.set(norm(s), plan.minutes[i]))
  // план, которым поиск узнал дело («Пойти к психиатру» → «Сходить к психиатру»): его шаги — с его минутами
  // и его минуты важнее сырых: у плана из поиска уже поправка суммы (calibratePlan)
  known?.steps.forEach((s, i) => {
    const m = known.minutes?.[i]
    if (typeof m === 'number' && m > 0) own.set(norm(s), m)
  })
  return steps.map((s) => own.get(norm(s)) ?? estimateStep(s, title))
}

/**
 * Поправка суммы (22.11, research/30-estimate): шаги базы оценены по сетке с запасом («мелкие накладные» у каждого), и
 * сумма плана выходит в среднем в 1,4 раза больше, чем дело занимает целиком. Сверка со 151 делом, оценённым целиком
 * вручную: время дела ≈ 0,94 × сумма^0,93 (проверка «без себя» — каждое дело оценено поправкой, подобранной без него:
 * в пределах ×2 — 79 % дел против 71 % без поправки, у Estimator goblin.tools — 70 %). Число шагов не влияет.
 * Поправка сжимает только работу; долгое ожидание (сохнет ночь, ждать решения) не трогается.
 */
/** шаг, где работает машина, а не руки: «Запустить программу стирки», «Поставить в духовку на 40 минут» */
const MACHINE = /^(?:запустить|включить)\s+(?:программу|стирк|стиральн|посудомо|цикл|сушк|мультиварк|хлебопечк)|(?:в духовку|в духовке|запекать|выпекать|варить)\s.*(?:минут|час)/i
const CAL_K = 0.94
const CAL_P = 0.93
const NICE = [1, 2, 3, 4, 5, 7, 10, 12, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720]
const nice = (m: number) => (m >= 720 ? Math.round(m / 60) * 60 : NICE.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), 1))

/** минуты шагов с поправкой суммы: работа сжимается, долгое ожидание как было, каждый шаг — не меньше минуты */
export function calibratePlan(steps: readonly string[], minutes: readonly number[]): number[] {
  const { work } = splitMinutes(steps, minutes)
  if (work <= 3) return [...minutes]
  const f = Math.min(1, (CAL_K * work ** CAL_P) / work)
  return minutes.map((m, i) => {
    const t = steps[i]?.trim() ?? ''
    // ожидание и работа машины (стирка, духовка, доставка) идут столько, сколько идут, — сжимаются только руки
    if (isWaitStep(t) || RESULT.test(t) || MACHINE.test(t)) return m
    return Math.max(1, nice(m * f))
  })
}

/**
 * Время всего дела по одному названию — для дела без шагов (владелец 22.11: «у любого дела оценивалось время»). Дело,
 * которого нет в базе, получает время самых похожих дел базы по словам названия: глагол и редкие слова весят больше,
 * без совпадения кроме глагола дело чужое («Покрасить забор» не «Покрасить волосы»). Медиана — по логарифму: у дел
 * от минут до дней середина считается в разах, а не в минутах. Нет похожих — медиана по глаголу, потом 30 минут.
 */
type TitleIx = { titles: { tokens: string[]; total: number; plan: number }[]; idf: Map<string, number>; inverted: Map<string, number[]> }
let titleBuilt: TitleIx | null = null
function titleIndex(): TitleIx {
  if (titleBuilt) return titleBuilt
  const ix = index()
  const titles = ix.plans.map((p, plan) => ({ tokens: p.tokens, total: splitMinutes(p.steps, calibratePlan(p.steps, p.minutes)).work, plan }))
  // синонимы дел — те же планы другими словами («Мытьё посуды», «Закинуть стирку»): больше слов, по которым узнать похожее
  for (const [title, aliases] of Object.entries(TASK_ALIASES)) {
    const p = ix.planByKey.get(goblinKey(title))
    if (p === undefined) continue
    for (const a of aliases) titles.push({ tokens: stepTokens(a), total: titles[p].total, plan: p })
  }
  const df = new Map<string, number>()
  const inverted = new Map<string, number[]>()
  titles.forEach((t, i) => {
    for (const w of t.tokens) {
      df.set(w, (df.get(w) ?? 0) + 1)
      inverted.set(w, [...(inverted.get(w) ?? []), i])
    }
  })
  const idf = new Map<string, number>()
  for (const [w, n] of df) idf.set(w, Math.log(1 + titles.length / n))
  titleBuilt = { titles, idf, inverted }
  return titleBuilt
}

const logMedian = (items: { minutes: number; w: number }[]) =>
  weightedMedian(items.map((x) => ({ minutes: Math.log(Math.max(1, x.minutes)), w: x.w })))

export function estimateTitle(title: string, skip?: string): number {
  const { titles, idf, inverted } = titleIndex()
  const q = stepTokens(title)
  if (!q.length) return 30
  // только для проверки точности: оценить дело, будто его плана (и синонимов) в базе нет
  const skipPlan = skip ? (index().planByKey.get(goblinKey(skip)) ?? -1) : -1
  const qw = sumIdf(q, idf)
  const scores = new Map<number, number>()
  const content = new Set<number>()
  q.forEach((w, k) => {
    const v = idf.get(w)
    if (!v) return
    for (const i of inverted.get(w) ?? []) {
      scores.set(i, (scores.get(i) ?? 0) + v)
      if (k > 0) content.add(i)
    }
  })
  const ranked: { minutes: number; w: number }[] = []
  for (const [i, shared] of scores) {
    const t = titles[i]
    if (t.plan === skipPlan) continue
    let s = shared / Math.sqrt(qw * sumIdf(t.tokens, idf))
    if (t.tokens[0] === q[0]) s *= 1.4
    if (q.length > 1 && !content.has(i)) continue
    if (s >= 0.35) ranked.push({ minutes: t.total, w: s * s })
  }
  if (ranked.length) {
    ranked.sort((a, b) => b.w - a.w)
    return Math.round(Math.exp(logMedian(ranked.slice(0, 7))))
  }
  const byVerb = (inverted.get(q[0]) ?? []).filter((i) => titles[i].tokens[0] === q[0] && titles[i].plan !== skipPlan).map((i) => ({ minutes: titles[i].total, w: 1 }))
  if (byVerb.length >= 3) return Math.round(Math.exp(logMedian(byVerb)))
  return 30
}

/** Минуты плана из базы по точному названию дела (как его записал поиск готовых планов) */
export const libraryMinutes = (title: string): readonly number[] | undefined => {
  const m = GOBLIN_MINUTES[title]
  const st = GOBLIN_PLANS[title]
  return m && st && m.length === st.length ? calibratePlan(st, m) : m
}
