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

export type Matcher<T> = { find: (text: string) => { title: string; value: T; corrected: boolean } | null }

/**
 * Указатель по готовым делам. entries — [название, значение]; название — как его покажем человеку.
 * Возвращает дело и флаг «исправили» (было не дословно), чтобы экран записал дело правильно.
 */
export function buildMatcher<T>(entries: [string, T][]): Matcher<T> {
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

  return {
    find(text) {
      const ws = meaningful(words(text))
      let e = tryWords(ws)
      if (!e) {
        const flipped = fromLatinLayout(text)
        if (flipped) e = tryWords(meaningful(words(flipped)))
      }
      if (!e) return null
      return { title: e.title, value: e.value, corrected: normalize(text) !== normalize(e.title) }
    },
  }
}
