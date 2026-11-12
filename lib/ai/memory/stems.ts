import { factKey } from './fact-key'

/**
 * Одно сравнение слов «по основе» для всей памяти (аудит 12.11: три места сравнивали по-своему — первые 4 буквы слов
 * от 4 букв, и «Машу» не находило «Маша», «душ» не находило «душа», а короткие слова выпадали совсем).
 *
 * Правило без словаря: у слова снимается одно конечное окончание-гласная (а, я, у, ю, ы, и, е, о, й, ь); два слова —
 * одна основа, если основа короткого — начало длинного и длинное длиннее основы не больше чем на три буквы (падеж,
 * число), а у двух длинных слов (от 5 букв) — общее начало не короче пяти букв или всего короткого слова без буквы.
 */
const ENDING = /[аяуюыиеойь]$/u
const VOWEL = /[аяуюыиеоёэйь]/u

const base = (w: string) => (w.length >= 3 && ENDING.test(w) ? w.slice(0, -1) : w)

function commonPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

export function sameStem(a: string, b: string): boolean {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < 3) return false
  if (short.length >= 5) return commonPrefix(short, long) >= Math.min(5, short.length - 1)
  const stem = base(short)
  if (stem.length < 2 || !long.startsWith(stem) || long.length - stem.length > 3) return false
  // основа из двух букв («ча» у «чай», «ол» у «Оля»): дальше в длинном слове должно идти окончание, а не корень — «чая», но не «часы»
  return stem.length >= 3 || (long.length <= 4 && VOWEL.test(long[stem.length] ?? ''))
}

/** Служебные слова: не несут темы, по ним ничего не сравниваем */
const FUNCTION_WORDS = new Set(
  'это этот эта эти того этом что как так там тут где кто его она они оно мне меня мой моя мою мои тебя тебе твой для без под над при про или если когда чтобы тоже ещё еще уже было был была были будет есть очень просто только надо нужно можно себя свой свою своих всё все всех вот вон ну да нет не ни же бы ли то'.split(
    ' ',
  ),
)

/** Содержательные слова текста (от 3 букв, без служебных), в нормализованном виде */
export function contentWords(text: string, skip?: (word: string) => boolean): string[] {
  return factKey(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !FUNCTION_WORDS.has(w) && !skip?.(w))
}

/** Сколько слов из `words` имеют пару по основе среди `among` */
export function stemHits(words: readonly string[], among: readonly string[]): number {
  return words.filter((w) => among.some((x) => sameStem(w, x))).length
}

/** текст касается хотя бы одной из тем (тема — содержательные слова забытого; у темы из одного слова хватает его) */
export function aboutAny(text: string, topics: readonly (readonly string[])[]): boolean {
  const words = contentWords(text)
  return topics.some((k) => k.length > 0 && stemHits(k, words) >= Math.min(2, k.length))
}
