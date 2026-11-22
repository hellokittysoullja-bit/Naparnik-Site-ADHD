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
import { VERB_FORMS, VERB_FORMS_LEAD } from './breakdown-verb-forms'

const FILLER = new Set([
  'надо', 'нужно', 'необходимо', 'мне', 'хочу', 'хотелось', 'бы', 'пора', 'сегодня', 'завтра', 'сейчас', 'срочно', 'наконец',
  'уже', 'еще', 'просто', 'пожалуйста', 'плиз', 'давай', 'давайте', 'короче', 'ну', 'блин', 'типа', 'вот', 'как', 'нибудь',
  'быстро', 'быстренько', 'по', 'быстрому', 'щас', 'ща', 'тупо', 'хоть', 'наконецто', 'опять', 'снова', 'все', 'таки', 'же',
  // 22.11: разговорное «нада», «надь», «нужна» и «я хочу/хотел», «обязательно» — не часть дела
  'нада', 'надь', 'нуна', 'нужна', 'нужен', 'я', 'хотел', 'хотела', 'хочется', 'обязательно',
  // 22.11 (проверка по всей базе): «я должен …», «помоги …», «… пж» не узнавались ни для одного дела
  'должен', 'должна', 'должны', 'обязан', 'обязана', 'пж', 'пжл', 'пжлст', 'плз', 'помоги', 'помогите', 'лень', 'никак',
  'бля', 'блять', 'капец', 'пипец', 'жесть', 'ваще', 'вообще', 'стоит', 'планирую', 'собираюсь', 'думаю',
  'наверное', 'может', 'реально', 'прям', 'вроде', 'немножко', 'чуть',
])

/**
 * Начало, которое говорит о состоянии, а не о деле: «не могу …», «боюсь …», «как заставить себя …». Срезается, только
 * если фраза целиком не нашлась: «Не могу встать с кровати» и «Боюсь звонить» — свои дела и узнаются дословно
 */
const STATE_LEADS: readonly string[] = [
  'как заставить себя', 'не могу заставить себя', 'не могу себя заставить', 'заставить себя', 'никак не могу', 'не могу',
  'не получается', 'не выходит', 'не хочу', 'не хочется', 'боюсь', 'страшно', 'не знаю как', 'как начать', 'с чего начать',
  'помоги мне', 'помогите мне', 'хочу начать', 'надо начать', 'нужно начать', 'начать', 'хорошо бы', 'было бы хорошо',
]
/** то же в конце: «… уже давно», «… хоть как-то», «… немного» — если без них дело находится, а с ними нет */
const STATE_TAILS: readonly string[] = ['уже давно', 'давно', 'хоть как то', 'хоть немного', 'немного', 'чуть чуть', 'хоть чуть чуть']

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

/**
 * Настоящие слова, которых нет в названиях дел, но которые на одну букву от другого слова базы (20.11, прогон
 * 3860 фраз партии 10): «лень» становилась «Лечь», «секция» — «лекция», «сальто» — «пальто», «вина» — «виза».
 * Их не исправляем: слово человек написал правильно, просто такого дела в базе нет — план пишет модель.
 */
const NOT_TYPO = new Set([
  'лень', 'секция', 'секцию', 'секции', 'сальто', 'вина', 'вино', 'цвет', 'белые', 'белый', 'киноа', 'фитбол',
  'применить', 'заботиться', 'заземлиться', 'фотограф', 'фотографа', 'фотографу', 'станки', 'станок', 'машинку',
  'машинка', 'машинки', 'краску', 'краска', 'лечить',
  // прогон всех слов шагов базы (16 601): слово стало делом на букву дальше — «сумма» → «Сумка», «теплой» → «Деплой»
  'печень', 'печени', 'сумма', 'теплой', 'высохнуть', 'сушки', 'убедиться', 'края', 'проработать', 'лака',
  'получение', 'изменение', 'брони', 'обоих', 'подъехать', 'перемешать', 'отмерить', 'губы', 'папы', 'зачем',
  'обменяться', 'виде', 'было', 'видно', 'конверт', 'повод', 'допеть', 'корочки', 'вдохнуть', 'довериться', 'сеть',
  'точки', 'вида', 'будет', 'курсам', 'блоки', 'применять', 'подписями', 'подписи', 'подход', 'жесты', 'ровность',
  'проредить', 'обмять', 'посыпать', 'подавать', 'доход', 'выгодные', 'кора', 'голода', 'рост', 'погрузить',
  'подключиться', 'направиться', 'достигать', 'сравнении', 'этих', 'соединение', 'текстовые', 'текстовое',
  'текстовой', 'текстового', 'текстовому', 'текстовом', 'стоя', 'плакать', 'форм', 'переходить', 'квиза', 'делая',
  'обуть', 'заряжаться', 'укола', 'наклонить', 'поморгать', 'веник', 'подержать', 'выведения', 'переход',
  'заседание', 'путь', 'стоп', 'улов', 'управление', 'суше', 'гриф', 'мост', 'колка', 'коже', 'выделяться', 'скола',
  'коры', 'золы', 'пленка', 'почва', 'мета', 'расслабление', 'масса', 'муки', 'загнуть', 'поднести', 'заводить',
  'полосы', 'копир', 'стал', 'копки', 'извещение', 'сути', 'поддаваться', 'обучаться', 'гели', 'мало', 'выдвинуть',
  'баллон', 'полировать', 'одна', 'опереться', 'голоса', 'прикоснуться', 'пожать', 'ошибся', 'проход', 'последить',
  'жечь', 'правда', 'метро', 'пообещать', 'цепи', 'щеки', 'мышки', 'закрепиться', 'относиться', 'пород', 'вредит',
  'продвигаться', 'кости', 'тары', 'сорт', 'плата', 'подлокотники', 'поилка', 'рассчитаться', 'каше', 'махи',
  'перекатиться', 'ведение', 'стоял', 'стараться', 'прихода', 'взобраться', 'прилегания', 'примечания',
  'попроститься', 'поклониться', 'краю', 'электричек', 'собранные', 'собранное', 'введенные', 'сдача', 'заходить',
])

import { ASPECT, NOUN_SAME, STUDY_HEADS, SUBJECTS, SUBJECT_TAIL, TIME_DETAILS, TIME_NUMBER, TIME_TAIL, VERB_SAME, studyRewrite, verbCandidates } from './breakdown-understand'

/**
 * typo — дело узнано через исправление опечатки (или раскладки): только тогда экран показывает название из базы. Узнанное
 * дословно, синонимом, другой формой или формулировкой («Пойти к психиатру» → план «Сходить к психиатру») остаётся словами
 * человека (владелец 22.11: «менять запрещено, если опечатки нет и просто по-другому написано»)
 */
export type Matcher<T> = { find: (text: string) => { title: string; value: T; corrected: boolean; typo: boolean } | null }

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
    if (known.has(w) || NOT_TYPO.has(w)) return [w]
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
    // Ничего не нашлось — пробуем и у известных слов другое окончание (20.11): слово, которое есть в названии
    // хоть одного дела, выше не исправляется вовсе, и когда новая партия принесла «ужину», «окно», «кредиты»,
    // «для мыла», перестали находиться «приготовить ужину», «помыть окно», «купить мыла» (243 формы старых дел).
    if (!found.size) {
      const opts2 = ws.map((w, i) => (opts[i].length === 1 && opts[i][0] === w && known.has(w) && !NOT_TYPO.has(w) ? [w, ...endings(w)] : opts[i]))
      if (opts2.some((o, i) => o.length !== opts[i].length) && opts2.reduce((n, o) => n * o.length, 1) <= 64) {
        opts.splice(0, opts.length, ...opts2)
        walk(0, [])
      }
    }
    // два разных дела одинаково близко — не угадываем, пусть разбивает модель; дело и его синоним — одно дело
    const plans = new Set([...found].map((e) => e.value))
    return plans.size === 1 ? [...found][0] : null
  }

  /** формы того же слова в базе: отличаются только окончанием (одна правка в последних двух буквах) */
  const byStem = new Map<string, string[]>()
  for (const v of vocab) if (v.length >= 4 && !EXACT_ONLY.has(v)) byStem.set(v.slice(0, 3), [...(byStem.get(v.slice(0, 3)) ?? []), v])
  function endings(w: string): string[] {
    if (w.length < 4 || EXACT_ONLY.has(w)) return []
    const head = w.length - 2
    return (byStem.get(w.slice(0, 3)) ?? []).filter((v) => v !== w && v.slice(0, head - 1) === w.slice(0, head - 1) && Math.abs(v.length - w.length) <= 1 && distance(w, v, 1) === 1)
  }

  // глаголы базы — первое слово названий дел: только в них превращаются формы вроде «помыла», «покорми»
  const verbs = new Set(list.map((e) => e.ws[0]).filter((w) => w && /(ть|ться|ти|тись|чь|чься)$/.test(w)))
  const DETAILS = TIME_DETAILS.map((d) => d.split(' '))

  /**
   * Второй этап — «понимание» (breakdown-understand.ts). Только после того, как первый ничего не нашёл. Убирает уточнения
   * (сначала как можно меньше), переводит формы и синонимы и ищет дело ДОСЛОВНО, без опечаток. Два разных плана — null.
   */
  type Tok = { w: string; start: number; end: number }
  function understand(text: string, typos = false): { e: E; details: string[] } | null {
    const toks: Tok[] = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: normalize(m[0]), start: m.index!, end: m.index! + m[0].length }))
    if (!toks.length || toks.length > 12) return null
    // учёба своими словами (21.11): «сделать дз к истории», «домашнее задание по англу», «решить дз» → как названы дела.
    // Порядок: фраза как написана без срезания уточнений → переписанная без срезания (так «дз по англу» находит своё дело
    // «Сделать домашку по английскому», а не общее «Сделать домашку») → как написана со срезанием → переписанная со срезанием
    const st = studyRewrite(toks.map((t) => t.w))
    const st2 = st && st.map((t) => ({ w: t.w, start: toks[t.from].start, end: toks[t.to - 1].end }))
    const lo = typos ? 1 : 0
    // два разных плана на любом шаге — стоп (null), не ищем дальше; undefined — на этом шаге ничего
    const passes: [Tok[] | null, number, number][] = [[toks, lo, lo], [st2, lo, lo], [toks, lo + 1, Infinity], [st2, lo + 1, Infinity]]
    for (const [t, a, b] of passes) {
      if (!t) continue
      const r = understandToks(text, t, typos, a, b)
      if (r !== undefined) return r
    }
    return null
  }

  function understandToks(text: string, toks: Tok[], typos: boolean, from: number, upTo: number): { e: E; details: string[] } | null | undefined {
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
    // учебное слово — как есть; во втором проходе и с опечаткой в одну букву («курсавую»), но только у слов от 5 букв
    const studyHead = (w: string) => STUDY_HEADS.has(w) || (typos && w.length >= 5 && [...STUDY_HEADS].some((h) => h.length >= 5 && distance(w, h, 1) <= 1))
    if (tw.some(studyHead)) {
      const i = tw.indexOf('по')
      if (i >= 0 && !taken.has(i) && SUBJECTS.has(tw[i + 1] ?? '')) {
        add(i, SUBJECT_TAIL.has(tw[i + 2] ?? '') ? i + 3 : i + 2)
      }
    }
    if (spans.length > 4) return undefined
    const variants = (w: string): string[] => {
      const out = new Set([w])
      for (const m of [ASPECT[w], VERB_SAME[w], NOUN_SAME[w]]) if (m) out.add(m)
      if (!known.has(w)) for (const c of verbCandidates(w, verbs)) out.add(c)
      return [...out]
    }
    // уровни: убрать 0, 1, 2… уточнений; первый уровень, где что-то нашлось, решает. Внутри уровня слово как написано
    // сильнее замены: «готовиться к экзамену» — своё дело, хотя замена дала бы и «Подготовиться к экзамену»
    // с опечатками — только когда уточнение отрезано (вся фраза с опечатками уже проверена третьим этапом) и без замен
    // слов: опечатку правит тот же tryWords, что и для фразы целиком, со всеми его запретами (туалетное, два дела)
    for (let size = from; size <= Math.min(upTo, spans.length); size++) {
      const found = new Map<T, { e: E; details: string[] }>()
      let fewest = Infinity
      const subsets = (from: number, acc: number[]): number[][] =>
        acc.length === size ? [acc] : spans.slice(from).flatMap((_, k) => subsets(from + k + 1, [...acc, from + k]))
      for (const sub of subsets(0, [])) {
        const cut = new Set(sub.flatMap((n) => Array.from({ length: spans[n][1] - spans[n][0] }, (_, k) => spans[n][0] + k)))
        const rest = meaningful(tw.filter((_, k) => !cut.has(k)))
        if (!rest.length || rest.length > 8) continue
        const details = () => sub.map((n) => spans[n]).sort((a, b) => a[0] - b[0]).map(([a, b]) => text.slice(toks[a].start, toks[b - 1].end))
        if (typos) {
          const e = tryWords(rest)
          if (e) found.set(e.value, found.get(e.value) ?? { e, details: details() })
          continue
        }
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
            found.set(e.value, found.get(e.value) ?? { e, details: details() })
            return
          }
          for (const o of opts[i]) walk(i + 1, [...acc, o], subs + (o === rest[i] ? 0 : 1))
        }
        walk(0, [], 0)
      }
      if (found.size === 1) return [...found.values()][0]
      if (found.size > 1) return null
    }
    return undefined
  }

  function findState(text: string): ReturnType<Matcher<T>['find']> {
    const n = normalize(text)
    for (const lead of STATE_LEADS) {
      if (!n.startsWith(lead + ' ')) continue
      const r = findOnce(n.slice(lead.length + 1))
      if (r) return { ...r, corrected: true }
    }
    for (const tail of STATE_TAILS) {
      if (!n.endsWith(' ' + tail)) continue
      const rest = n.slice(0, -tail.length - 1)
      const r = findOnce(rest) ?? findState(rest)
      if (r) return { ...r, corrected: true }
    }
    return null
  }

  /** «помою посуду», «позвоню маме», «давай помоем» → инфинитив, как в названиях дел (VERB_FORMS) */
  function findVerb(text: string): ReturnType<Matcher<T>['find']> {
    if (!opts.understand) return null
    const ws = words(text)
    let changed = false
    const lead = ws.findIndex((w) => !FILLER.has(w))
    const inf = ws.map((w, i) => {
      // «давай» — тоже форма глагола («давать»), но в фразе это слово-паразит
      if (FILLER.has(w)) return w
      const v = VERB_FORMS[w] ?? (i === lead ? VERB_FORMS_LEAD[w] : undefined)
      if (!v) return w
      changed = true
      return v
    })
    if (!changed) return null
    const t = inf.join(' ')
    const r = findOnce(t) ?? findState(t)
    return r ? { ...r, corrected: true } : null
  }

  return { find: (text) => findOnce(text) ?? findState(text) ?? findVerb(text) }

  function findOnce(text: string): ReturnType<Matcher<T>['find']> {
    {
      const ws = meaningful(words(text))
      const flipped = fromLatinLayout(text)
      const fws = flipped ? meaningful(words(flipped)) : null
      // 1) дословно (с точностью до регистра, порядка слов и слов-паразитов)
      let e = ws.length && ws.length <= 8 ? lookup(ws) : null
      // набрано в английской раскладке («gjcnbhfnm») — это та же опечатка: показываем название из базы
      let typo = false
      if (!e && fws?.length && fws.length <= 8) {
        e = lookup(fws)
        if (e) typo = true
      }
      // 2) понимание — РАНЬШЕ исправления опечаток: настоящее слово («мыться», «кормить») не должно «исправляться» в
      // похожее чужое («умыться»); понимание само опечаток не правит, поэтому опечатки дальше узнаются как раньше
      if (!e && opts.understand) {
        const u = understand(text)
        if (u) {
          const title = [u.e.title, ...u.details.map((d) => d.toLowerCase())].join(' ')
          return { title, value: u.e.value, corrected: true, typo: false }
        }
      }
      // 3) опечатки
      if (!e) {
        e = tryWords(ws) ?? (fws ? tryWords(fws) : null)
        if (e) typo = true
      }
      // 4) опечатки в деле с уточнением: «пакормить собаку вечером» — последним, когда остальное не нашло ничего
      if (!e && opts.understand) {
        const u = understand(text, true)
        if (u) {
          const title = [u.e.title, ...u.details.map((d) => d.toLowerCase())].join(' ')
          return { title, value: u.e.value, corrected: true, typo: true }
        }
      }
      if (!e) return null
      return { title: e.title, value: e.value, corrected: normalize(text) !== normalize(e.title), typo }
    }
  }
}
