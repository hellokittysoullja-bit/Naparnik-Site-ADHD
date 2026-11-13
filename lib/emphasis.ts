/**
 * Акцент в речи кота: *слово* или *короткая фраза*, не больше двух на реплику. Экран рисует его рукописным шрифтом
 * (components/emphasis-text.tsx); там, где шрифта нет (бот в Telegram, копирование реплики, голос), звёздочки снимаются.
 *
 * Модель пишет разметку как умеет: двойные звёздочки, подчёркивания, решётки заголовков, обратные кавычки, непарную
 * звёздочку. Всё это человек увидел бы знаками в тексте. ownMarkup приводит вывод к нашей одной конвенции и
 * гарантирует, что после неё в тексте остаются только парные звёздочки вокруг короткого акцента.
 */
export const EMPHASIS_LIMIT = 2
const EMPHASIS_MAX_CHARS = 60

/**
 * Акцент: парные звёздочки вплотную к тексту в одной строке и не внутри слова или числа (как в CommonMark): «2 * 3 * 4»,
 * «3*4» и «*.txt» акцентом не считаются. Тем же правилом рисует экран, чтобы сервер и браузер не расходились.
 */
export const EMPHASIS_PAIR = new RegExp(String.raw`(?<![\p{L}\d*\\])\*(?!\s)([^*\n]{1,${EMPHASIS_MAX_CHARS}}?)(?<!\s)\*(?![\p{L}\d])`, 'gu')

export type Marked = { text: string; used: number }

const OPEN = '\u0001'
const CLOSE = '\u0002'

/**
 * Вывод модели → наша разметка. budget — сколько акцентов ещё можно оставить (остальные раскрываются в обычный текст):
 * поток зовёт по предложениям и передаёт остаток. После разбора звёздочка остаётся только парой вокруг акцента, знаком
 * умножения между числами или маской имени файла («*.txt»).
 */
export function ownMarkup(raw: string, budget = EMPHASIS_LIMIT): Marked {
  let used = 0
  const text = raw
    .replace(/[\u0001\u0002]/g, '')
    .replace(/\*{2,}/g, '*')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    // пункт списка «* шаг» — это список, а не акцент: маркер становится точкой (разбор шагов дробления его знает)
    .replace(/^([ \t]*)\*[ \t]+/gm, '$1• ')
    .replace(/`+/g, '')
    // подчёркивание-акцент: только на границах слов, чтобы не трогать «имя_файла» и «__init__.py»
    .replace(/(?<![\p{L}\d_])_{1,2}([^_\n]+?)_{1,2}(?![\p{L}\d_]|\.[\p{L}\d])/gu, '$1')
    .replace(EMPHASIS_PAIR, (_, word: string) => (used < budget ? (used++, `${OPEN}${word}${CLOSE}`) : word))
    // всё, что осталось, — знак в тексте, а не акцент; умножение между числами и маску файла не трогаем
    .replace(/\*/g, (m, at: number, all: string) => (keepsStar(all, at) ? m : ''))
    .replaceAll(OPEN, '*')
    .replaceAll(CLOSE, '*')
    .replace(/[ \t]{2,}/g, ' ')
  return { text, used }
}

/** звёздочка-знак: умножение («3*4», «2 * 3») или маска имени файла («*.txt») */
function keepsStar(text: string, at: number): boolean {
  const before = text.slice(Math.max(0, at - 2), at)
  const after = text.slice(at + 1, at + 3)
  return (/\d[ \t]?$/.test(before) && /^[ \t]?\d/.test(after)) || /^\.[\p{L}\d]/u.test(after)
}

/** Текст без акцентов: для каналов и мест, где рукописного шрифта нет */
export function plainText(text: string): string {
  return ownMarkup(text, 0).text
}
