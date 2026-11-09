/**
 * Тест /sdvg-test (план владельца 08.11, research/14-lead-magnets/owner-asrs-bridge.md).
 *
 * Приватность — главное: ответы ASRS живут ТОЛЬКО во фрагменте адреса (`#a=…`) — браузер не отправляет его на сервер
 * и в Referer; подсчёт только в браузере; балл, диапазон и имя никогда не уходят на сервер, в аналитику, в рассылки и в
 * ссылку для шеринга. В обычной части адреса — только шаг, ответы слоя 2 (типы), сфера, возраст и метки источника.
 */

export const TYPES = ['P', 'H', 'U', 'M'] as const
export type ProcType = (typeof TYPES)[number]
export const SPHERES = ['work', 'study', 'home', 'project', 'all'] as const
export type SdvgSphere = (typeof SPHERES)[number]
export type Band = 'low' | 'below' | 'above' | 'high'

/** Шаги по порядку: экран входа, возраст, вступление к ASRS, 6 пунктов, разделитель, 4 вопроса, сфера, имя, расчёт, результат */
export const STEPS = ['intro', 'age', 'pre', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'sep', 'q1', 'q2', 'q3', 'q4', 'sphere', 'name', 'calc', 'result'] as const
export type SdvgStep = (typeof STEPS)[number]

/** Штриховка бланка ASRS (только визуально): пункты 1–3 — с «Иногда», 4–6 — с «Часто» (индексы вариантов 0–4) */
export function shadedFrom(item: number): number {
  return item < 3 ? 2 : 3
}

/** Подсчёт Harvard (обновление 28.02.2024): 0–4 за пункт, сумма 0–24; ≥14 — положительный скрининг */
export function asrsScore(answers: number[]): number {
  return answers.reduce((s, a) => s + a, 0)
}

export function asrsBand(score: number): Band {
  if (score <= 9) return 'low'
  if (score <= 13) return 'below'
  if (score <= 17) return 'above'
  return 'high'
}

/** Тип = самый частый ответ слоя 2; при равенстве побеждает ответ на первый вопрос */
export function procType(l2: ProcType[]): ProcType | null {
  if (l2.length === 0) return null
  const count = new Map<ProcType, number>()
  for (const t of l2) count.set(t, (count.get(t) ?? 0) + 1)
  const max = Math.max(...count.values())
  const leaders = TYPES.filter((t) => count.get(t) === max)
  return leaders.length === 1 ? leaders[0] : leaders.includes(l2[0]) ? l2[0] : leaders[0]
}

export type SdvgState = {
  step: SdvgStep
  /** 18+: true / false / null — ещё не ответил */
  adult: boolean | null
  /** Ответы ASRS по пунктам (0–4), только из фрагмента адреса */
  asrs: number[]
  /** Ответы слоя 2 по порядку */
  l2: ProcType[]
  sphere: SdvgSphere | null
  /** Тип, который человек выбрал сам на «Не совсем про меня» (иначе — по ответам) */
  chosen?: ProcType | null
}

export const EMPTY: SdvgState = { step: 'intro', adult: null, asrs: [], l2: [], sphere: null, chosen: null }

/** Ключи состояния в обычной части адреса (метки источника и прочее не трогаем) */
export const QUERY_KEYS = ['step', 'adult', 'l', 's', 'o'] as const

export function readState(search: string, hash: string): SdvgState {
  const q = new URLSearchParams(search)
  const h = new URLSearchParams(hash.replace(/^#/, ''))
  const rawStep = q.get('step') as SdvgStep | null
  const adult = q.get('adult') === '1' ? true : q.get('adult') === '0' ? false : null
  const asrs = (h.get('a') ?? '')
    .split('')
    .filter((c) => /^[0-4]$/.test(c))
    .slice(0, 6)
    .map(Number)
  const l2 = (q.get('l') ?? '')
    .toUpperCase()
    .split('')
    .filter((c): c is ProcType => (TYPES as readonly string[]).includes(c))
    .slice(0, 4)
  const s = q.get('s')
  const sphere = s && (SPHERES as readonly string[]).includes(s) ? (s as SdvgSphere) : null
  const o = (q.get('o') ?? '').toUpperCase()
  const chosen = (TYPES as readonly string[]).includes(o) ? (o as ProcType) : null
  const state: SdvgState = { step: 'intro', adult, asrs, l2, sphere, chosen }
  // по ссылке нельзя «перепрыгнуть» дальше первого шага без ответа
  state.step = rawStep && (STEPS as readonly string[]).includes(rawStep) ? clampStep(rawStep, state) : 'intro'
  return state
}

export function firstMissing(state: SdvgState): SdvgStep {
  if (state.adult === null) return 'age'
  if (state.adult && state.asrs.length < 6) return `a${state.asrs.length + 1}` as SdvgStep
  if (state.l2.length < 4) return `q${state.l2.length + 1}` as SdvgStep
  if (!state.sphere) return 'sphere'
  return 'result'
}

export function clampStep(step: SdvgStep, state: SdvgState): SdvgStep {
  const want = STEPS.indexOf(step)
  const limit = STEPS.indexOf(firstMissing(state))
  // шаги без ответа (вступление, разделитель, имя, расчёт) доступны, если до них всё отвечено
  if (want <= limit) return step
  return firstMissing(state)
}

/** Обычная часть адреса для состояния + всё, что было в адресе кроме наших ключей (метки ролика) */
export function stateQuery(state: SdvgState, current: string): string {
  const keep = new URLSearchParams(current)
  for (const k of QUERY_KEYS) keep.delete(k)
  const out = new URLSearchParams({ step: state.step })
  if (state.adult !== null) out.set('adult', state.adult ? '1' : '0')
  if (state.l2.length) out.set('l', state.l2.join(''))
  if (state.sphere) out.set('s', state.sphere)
  if (state.chosen) out.set('o', state.chosen)
  keep.forEach((v, k) => out.append(k, v))
  return out.toString()
}

/** Фрагмент адреса: только ответы ASRS */
export function stateHash(state: SdvgState): string {
  return state.asrs.length ? `#a=${state.asrs.join('')}` : ''
}

/** Номер вопроса для «Продолжить с вопроса N» (1–10: 6 ASRS + 4 слоя 2) */
export function questionNumber(step: SdvgStep): number | null {
  const m = /^a([1-6])$/.exec(step)
  if (m) return Number(m[1])
  const n = /^q([1-4])$/.exec(step)
  if (n) return 6 + Number(n[1])
  return null
}

/** Типы в адресе страницы «тип друга» — латиницей */
export const TYPE_SLUG: Record<ProcType, string> = { P: 'perfekcionist', H: 'ohotnik', U: 'utopayushchij', M: 'poslednyaya-noch' }
export function typeFromSlug(slug: string): ProcType | null {
  return (Object.entries(TYPE_SLUG).find(([, s]) => s === slug)?.[0] as ProcType | undefined) ?? null
}

/** Тип на результате: выбранный человеком на «Не совсем про меня», иначе — по ответам */
export function effectiveType(state: SdvgState): ProcType | null {
  return state.chosen ?? procType(state.l2)
}

/** Второй по частоте тип среди ответов (без основного); при равенстве — тот, что встретился раньше */
export function secondType(l2: ProcType[], primary: ProcType): ProcType | null {
  const rest = l2.filter((t) => t !== primary)
  return rest.length ? procType(rest) : null
}
