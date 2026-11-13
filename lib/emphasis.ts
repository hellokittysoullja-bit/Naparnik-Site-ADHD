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
 * Акцент: парные звёздочки вплотную к тексту в одной строке (как в CommonMark: «2 * 3 * 4» акцентом не считается).
 * Тем же правилом рисует экран, чтобы сервер и браузер не расходились.
 */
export const EMPHASIS_PAIR = new RegExp(String.raw`\*(?!\s)([^*\n]{1,${EMPHASIS_MAX_CHARS}}?)(?<!\s)\*`, 'g')

export type Marked = { text: string; used: number }

const OPEN = '\u0001'
const CLOSE = '\u0002'

/**
 * Вывод модели → наша разметка. budget — сколько акцентов ещё можно оставить (остальные раскрываются в обычный текст):
 * поток зовёт по предложениям и передаёт остаток.
 */
export function ownMarkup(raw: string, budget = EMPHASIS_LIMIT): Marked {
  let used = 0
  const text = raw
    .replace(/[\u0001\u0002]/g, '')
    .replace(/\*{2,}/g, '*')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/`+/g, '')
    // подчёркивание-акцент: только на границах слов, чтобы не трогать «имя_файла»
    .replace(/(?<![\p{L}\d_])_{1,2}([^_\n]+?)_{1,2}(?![\p{L}\d_])/gu, '$1')
    .replace(EMPHASIS_PAIR, (_, word: string) => (used < budget ? (used++, `${OPEN}${word}${CLOSE}`) : word))
    // всё, что осталось, — знак в тексте, а не акцент; умножение между числами не трогаем
    .replace(/(?<!\d\s?)\*|\*(?!\s?\d)/g, '')
    .replaceAll(OPEN, '*')
    .replaceAll(CLOSE, '*')
    .replace(/[ \t]{2,}/g, ' ')
  return { text, used }
}

/** Текст без акцентов: для каналов и мест, где рукописного шрифта нет */
export function plainText(text: string): string {
  return ownMarkup(text, 0).text
}
