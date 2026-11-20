/**
 * Узнать готовое дело, как бы человек его ни написал (владелец 16.11: «самые частые опечатки должны сразу
 * распознаваться, и дело записано правильно»). Порядок, от надёжного к менее надёжному:
 *  1. как есть: регистр, «ё», знаки и лишние пробелы не важны;
 *  2. без слов-паразитов: «надо срочно помыть посуду» → «помыть посуду»;
 *  3. английская раскладка вместо русской: «ghjgsktcjcbnm» → «пропылесосить»;
 *  4. опечатки в словах: «сдклать», «пазвонить», «убратся», «помыть посду»;
 *  5. другой порядок слов: «посуду помыть».
 * Исправленное слово принимается, ТОЛЬКО если после исправления вся фраза совпала с готовым делом. Поэтому
 * «покакать» не станет «поплакать»: исправляем не слова вообще, а запрос под конкретное дело из базы, иначе
 * дело уходит модели как написано. Опечатки уровня одной буквы (замена, пропуск, лишняя, перестановка соседних)
 * для слов от 4 букв, двух букв — для слов от 9. Если два дела одинаково близки, не угадываем.
 */

/** слова, которые не меняют дело: их выкидываем перед сравнением */
const FILLER = new Set([
  'надо', 'нужно', 'необходимо', 'мне', 'хочу', 'хотелось', 'бы', 'пора', 'сегодня', 'завтра', 'сейчас', 'срочно', 'наконец',
  'уже', 'еще', 'просто', 'пожалуйста', 'плиз', 'давай', 'давайте', 'короче', 'ну', 'блин', 'типа', 'вот', 'как', 'нибудь',
  'быстро', 'быстренько', 'по', 'быстрому', 'щас', 'ща', 'тупо', 'хоть', 'наконецто', 'опять', 'снова', 'все', 'таки', 'же',
])

/** QWERTY → ЙЦУКЕН: человек забыл переключить раскладку */
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`"
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё'
const LAYOUT = new Map([...EN].map((c, i) => [c, RU[i]]))

export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function fromLatinLayout(text: string): string | null {
  const t = text.toLowerCase()
  if (!/[a-z]/.test(t) || /[а-яё]/.test(t)) return null
  // знаки «[ ] ; ' , . `» — это буквы русской раскладки, поэтому меняем их до чистки
  return [...t].map((c) => LAYOUT.get(c) ?? c).join('')
}

const words = (s: string) => normalize(s).split(' ').filter(Boolean)
const meaningful = (ws: string[]) => ws.filter((w) => !FILLER.has(w))

/** Дамерау-Левенштейн с ограничением: больше max — сразу max + 1 */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      rowMin = Math.min(rowMin, d[i][j])
    }
    if (rowMin > max) return max + 1
  }
  return d[a.length][b.length]
}

const allowed = (w: string) => (w.length >= 9 ? 2 : w.length >= 4 ? 1 : 0)

/**
 * Слова, в которые опечатку НЕ исправляем — только дословно. Короткие глаголы отличаются от них одной буквой:
 * «поспать» и «пожрать» превращались в «Посрать» (16.11). Интимное и туалетное узнаём только как написано.
 */
const EXACT_ONLY = new Set([
  'посрать', 'поссать', 'покакать', 'пописать', 'подрочить', 'потрахаться', 'трахнуться', 'переспать',
  // частые ошибки в написании этих слов — тоже только дословно (17.11): иначе опечатки других дел уходили бы в них
  'пописять', 'пописат', 'поссат', 'пасрать', 'посрат', 'пакакать', 'покакат', 'подрачить', 'падрочить', 'подрочит',
  'потрахатся', 'потрахаца', 'переспат', 'отлить',
])

import { ASPECT, NOUN_SAME, STUDY_HEADS, SUBJECTS, SUBJECT_TAIL, TIME_DETAILS, TIME_NUMBER, TIME_TAIL, VERB_SAME, verbCandidates } from './breakdown-understand'

export type Matcher<T> = { find: (text: string) => { title: string; value: T; corrected: boolean } | null }

/**
 * Указатель по готовым делам. entries — [название, значение]; название — как его покажем человеку.
 * Возвращает дело и флаг «исправили» (было не дословно), чтобы экран записал дело правильно.
 */
export function buildMatcher<T>(entries: [string, T][], opts: { understand?: boolean } = {}): Matcher<T> {
  type E = { title: string; value: T; ws: string[] }
  const list: E[] = entries.map(([title, value]) => ({ title, value, ws: meaningful(words(title)) }))
  const exact = new Map<string, E>()
  const bag = new Map<string, E | null>()
  for (const e of list) {
    const key = e.ws.join(' ')
    if (!exact.has(key)) exact.set(key, e)
  }
  // одно и то же дело может прийти из двух источников — в указатель «по набору слов» идут уже без повторов
  for (const e of exact.values()) {
    const b = [...e.ws].sort().join(' ')
    const prev = bag.get(b)
    bag.set(b, prev === undefined || prev?.value === e.value ? (prev ?? e) : null)
  }
  const vocab = [...new Set(list.flatMap((e) => e.ws))]
  const known = new Set(vocab)

  const lookup = (ws: string[]): E | null => exact.get(ws.join(' ')) ?? bag.get([...ws].sort().join(' ')) ?? null

  /** все варианты слова: само слово, если оно есть в базе, иначе ближайшие слова базы (могут быть несколько) */
  const options = (w: string): string[] => {
    if (known.has(w)) return [w]
    const max = allowed(w)
    // короткое слово меняем только на его же форму: «пол» → «полы», но не «зол» → «зал»
    if (!max) {
      const forms = w.length === 3 ? vocab.filter((v) => v.length === 4 && v.startsWith(w)) : []
      return forms.length ? [w, ...forms] : [w]
    }
    let best = max + 1
    let out: string[] = []
    // слово так же близко к туалетному или интимному, как к обычному («порать»: посрать или пожрать) — не исправляем вовсе:
    // туалетное само по опечатке не узнаётся, а уводить его в другое дело нельзя (владелец 17.11: «посрать и поспать — не
    // опечатка, а разные дела»)
    let nearExact = max + 1
    for (const v of EXACT_ONLY) if (Math.abs(v.length - w.length) <= max) nearExact = Math.min(nearExact, distance(w, v, max))
    for (const v of vocab) {
      if (EXACT_ONLY.has(v) || Math.abs(v.length - w.length) > max) continue
      const d = distance(w, v, max)
      if (d < best) [best, out] = [d, [v]]
      else if (d === best) out.push(v)
    }
    if (nearExact <= max && nearExact <= best) return [w]
    return best <= max ? out : [w]
  }

  function tryWords(ws: string[]): E | null {
    if (!ws.length || ws.length > 8) return null
    const direct = lookup(ws)
    if (direct) return direct
    // перебор исправлений: у каждого слова 1–3 варианта, слов мало — комбинаций немного
    const opts = ws.map(options)
    if (opts.reduce((n, o) => n * o.length, 1) > 64) return null
    const found = new Set<E>()
    const walk = (i: number, acc: string[]) => {
      if (i === opts.length) {
        const e = lookup(acc)
        if (e) found.add(e)
        return
      }
      for (const o of opts[i]) walk(i + 1, [...acc, o])
    }
    walk(0, [])
    // два разных дела одинаково близко — не угадываем, пусть разбивает модель; дело и его синоним — одно дело
    const plans = new Set([...found].map((e) => e.value))
    return plans.size === 1 ? [...found][0] : null
  }

  // глаголы базы — первое слово названий дел: только в них превращаются формы вроде «помыла», «покорми»
  const verbs = new Set(list.map((e) => e.ws[0]).filter((w) => w && /(ть|ться|ти|тись|чь|чься)$/.test(w)))
  const DETAILS = TIME_DETAILS.map((d) => d.split(' '))

  /**
   * Второй этап — «понимание» (breakdown-understand.ts). Только после того, как первый ничего не нашёл. Убирает уточнения
   * (сначала как можно меньше), переводит формы и синонимы и ищет дело ДОСЛОВНО, без опечаток. Два разных плана — null.
   */
  function understand(text: string): { e: E; details: string[] } | null {
    const toks = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: normalize(m[0]), start: m.index!, end: m.index! + m[0].length }))
    if (!toks.length || toks.length > 12) return null
    const tw = toks.map((t) => t.w)
    // уточнения: отрезки [от, до) по словам, не пересекаются
    const spans: [number, number][] = []
    const taken = new Set<number>()
    const add = (a: number, b: number) => {
      for (let k = a; k < b; k++) if (taken.has(k)) return
      for (let k = a; k < b; k++) taken.add(k)
      spans.push([a, b])
    }
    for (const d of [...DETAILS].sort((x, y) => y.length - x.length))
      for (let i = 0; i + d.length <= tw.length; i++) if (d.every((w, k) => tw[i + k] === w)) add(i, i + d.length)
    for (let i = 0; i < tw.length - 1; i++) {
      if (!TIME_NUMBER.test(tw[i]) || !/^\d{1,2}$/.test(tw[i + 1])) continue
      let j = i + 2
      if (j < tw.length && /^\d{2}$/.test(tw[j])) j++
      if (j < tw.length && TIME_TAIL.has(tw[j])) j++
      add(i, j)
    }
    if (tw.some((w) => STUDY_HEADS.has(w) || STUDY_HEADS.has(ASPECT[w] ?? ''))) {
      const i = tw.indexOf('по')
      if (i > 0 && !taken.has(i) && SUBJECTS.has(tw[i + 1] ?? '')) {
        add(i, SUBJECT_TAIL.has(tw[i + 2] ?? '') ? i + 3 : i + 2)
      }
    }
    if (spans.length > 4) return null
    const variants = (w: string): string[] => {
      const out = new Set([w])
      for (const m of [ASPECT[w], VERB_SAME[w], NOUN_SAME[w]]) if (m) out.add(m)
      if (!known.has(w)) for (const c of verbCandidates(w, verbs)) out.add(c)
      return [...out]
    }
    // уровни: убрать 0, 1, 2… уточнений; первый уровень, где что-то нашлось, решает. Внутри уровня слово как написано
    // сильнее замены: «готовиться к экзамену» — своё дело, хотя замена дала бы и «Подготовиться к экзамену»
    for (let size = 0; size <= spans.length; size++) {
      const found = new Map<T, { e: E; details: string[] }>()
      let fewest = Infinity
      const subsets = (from: number, acc: number[]): number[][] =>
        acc.length === size ? [acc] : spans.slice(from).flatMap((_, k) => subsets(from + k + 1, [...acc, from + k]))
      for (const sub of subsets(0, [])) {
        const cut = new Set(sub.flatMap((n) => Array.from({ length: spans[n][1] - spans[n][0] }, (_, k) => spans[n][0] + k)))
        const rest = meaningful(tw.filter((_, k) => !cut.has(k)))
        if (!rest.length || rest.length > 8) continue
        const opts = rest.map(variants)
        if (opts.reduce((n, o) => n * o.length, 1) > 32) continue
        const walk = (i: number, acc: string[], subs: number) => {
          if (i === opts.length) {
            const e = lookup(acc)
            if (!e || subs > fewest) return
            if (subs < fewest) {
              fewest = subs
              found.clear()
            }
            const details = sub.map((n) => spans[n]).sort((a, b) => a[0] - b[0]).map(([a, b]) => text.slice(toks[a].start, toks[b - 1].end))
            found.set(e.value, found.get(e.value) ?? { e, details })
            return
          }
          for (const o of opts[i]) walk(i + 1, [...acc, o], subs + (o === rest[i] ? 0 : 1))
        }
        walk(0, [], 0)
      }
      if (found.size === 1) return [...found.values()][0]
      if (found.size > 1) return null
    }
    return null
  }

  return {
    find(text) {
      const ws = meaningful(words(text))
      const flipped = fromLatinLayout(text)
      const fws = flipped ? meaningful(words(flipped)) : null
      // 1) дословно (с точностью до регистра, порядка слов и слов-паразитов)
      let e = (ws.length && ws.length <= 8 ? lookup(ws) : null) ?? (fws?.length && fws.length <= 8 ? lookup(fws) : null)
      // 2) понимание — РАНЬШЕ исправления опечаток: настоящее слово («мыться», «кормить») не должно «исправляться» в
      // похожее чужое («умыться»); понимание само опечаток не правит, поэтому опечатки дальше узнаются как раньше
      if (!e && opts.understand) {
        const u = understand(text)
        if (u) {
          const title = [u.e.title, ...u.details.map((d) => d.toLowerCase())].join(' ')
          return { title, value: u.e.value, corrected: true }
        }
      }
      // 3) опечатки
      if (!e) e = tryWords(ws) ?? (fws ? tryWords(fws) : null)
      if (!e) return null
      return { title: e.title, value: e.value, corrected: normalize(text) !== normalize(e.title) }
    },
  }
}
