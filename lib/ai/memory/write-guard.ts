import { checkInput } from '../guards/input'
import { forMatching, matchVariants, stripInvisible } from '../guards/normalize'
import { checkOutput } from '../guards/output'

/**
 * Что можно записать в память о человеке — проверка СОДЕРЖАНИЯ факта до записи (research/20-ai-harness/
 * memory-personalization.md §7.1). Одна функция для всех путей записи: инструмент кота в разговоре, фоновая выжимка
 * после разговора, будущее серверное хранилище. Её зовут и сервер (схема инструмента, выжимка), и устройство перед
 * записью — последний исполнитель проверяет сам (security-ai.md R5).
 *
 * Почему так строго: факт уходит в КАЖДЫЙ следующий разговор. Отравленная запись живёт между сессиями (Hermes
 * tools/memory_tool_store.py:29-32 — скан каждой записи), а лишний факт о человеке с СДВГ хуже пропущенного
 * (стыд, приватность, 152-ФЗ). Источники списков: Claude memory (по умолчанию не хранит здоровье, религию,
 * политику, идентичность; никогда — документы и счета), Hermes background_review.py:383-388 (не выводить черты,
 * настроение, уровень).
 */
export type WriteRejection = 'injection' | 'health' | 'crisis' | 'identity' | 'documents' | 'money' | 'contact' | 'trait' | 'unsafe'

const L = String.raw`\p{L}`
const w = (body: string) => new RegExp(String.raw`(?<!${L})(?:${body})`, 'iu')

/** Указание коту под видом факта — «отныне отвечай…», «ты должен…» (перенесено из tools/catalog.ts) */
export const INSTRUCTION_LIKE =
  /(?<!\p{L})(?:отныне|с этого момента|игнорир\p{L}*|забудь|ты должен|ты обязан|(?:кот|напарник)\p{L}*\s+(?:должен|обязан|всегда|никогда)|отвечай|отвечал\p{L}*|говори|называй\p{L}*|называл\p{L}*\s+себя|вызывай|рекоменд\p{L}*|советуй|советовал\p{L}*|не упоминай|system|assistant|json|prompt|промпт\p{L}*|инструкци\p{L}*)(?!\p{L})/iu

// Кризис о третьем лице («не хочет жить») проверка входа не ловит — она про первое лицо; в память не идёт никогда
const CRISIS_FACT = w(String.raw`не\s+хоч${L}*\s+жить|умер(?:еть|ть)|суицид|самоубий|поконч${L}*\s+с\s+собой|сдохн|навредить\s+себе|самоповрежд|порез${L}*\s+себя`)

// Здоровье: диагнозы, лекарства, врачи, тест — красная линия product-science.md:129 (решение владельца по умолчанию:
// не хранить, memory-personalization.md ⚑1)
const HEALTH = w(
  String.raw`сдвг|адхд|adhd|синдром\s+дефицит|диагноз|диагностир|психиатр|психотерапевт|невролог|антидепресс|таблет|лекарств|препарат|рецепт|доз[аыу](?!${L})|мг(?!${L})|риталин|метилфенидат|атомоксетин|страттер|концерт[аы](?!${L})|депресс|бипол|тревожн${L}*\s+расстройств|расстройств|окр(?!${L})|аутиз|аутист|бессонниц|паническ${L}*\s+атак|беремен|болезн|болеет|болею|болен|больна|инвалид|asrs|результат${L}*\s+теста|прош[её]л\s+тест|прошла\s+тест`,
)
// Документы, счета, пароли — никогда, даже по просьбе (Claude memory)
const DOCUMENTS = w(String.raw`паспорт|снилс|инн(?!${L})|полис|пароль|пин-?код|cvv|номер\s+карт|карт[аы]\s+\d|сч[её]т\s*№|логин`)
// длинная цифровая последовательность (номер карты, документа, счёта); даты — не номер
const LONG_NUMBER = /\d[\d\s-]{4,}\d/
const DATES = /\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?/g
// Вера, политика, национальность, ориентация, гендерная идентичность — по умолчанию нет
const IDENTITY = w(
  String.raw`религи|верующ|православ|мусульм|католи|иуде|буддис|атеис|молит|церк|мечет|политик|партии|партия|выбор${L}*\s+за|либерал|коммунист|националь|по\s+национальности|ориентаци|гей(?!${L})|лесби|бисексу|трансгендер|небинарн`,
)
// Деньги в цифрах и долги — не храним (memory-personalization.md §4.4)
const MONEY = /\d[\d\s]*(?:₽|руб\p{L}*|р\.|\$|€|долл\p{L}*|евро|тыс\p{L}*\.?\s*(?:₽|руб))|(?<!\p{L})(?:долг(?:а|у|ом|и|ов|ам|ами|ах)?(?!\p{L})|кредит\p{L}*|ипотек\p{L}*|займ\p{L}*|микрозайм\p{L}*)/iu
const CONTACT = /[\p{L}\d.+-]+@[\p{L}\d-]+\.[\p{L}\d.]+|(?<!\p{L})(?:адрес|живу\s+(?:на|в\s+доме)|улиц\p{L}*|кв\.|квартир\p{L}*\s+\d)/iu
// Догадки о характере и состоянии — не факт, а ярлык (Hermes: «не выводи черты, уровень, настроение»)
const TRAIT = w(
  String.raw`ленив|лентяй|безответствен|неорганизован|несобран|тревожн${L}*\s+(?:человек|по\s+натуре)|по\s+натуре|по\s+характеру|склонен|склонна|интроверт|экстраверт|глуп|умн(?:ый|ая)|слаб(?:ый|ая)\s+воля|выгорел|выгоран|в\s+депресс`,
)

/**
 * null — можно записать; иначе причина отказа. Проверка по всем прочтениям текста (латинские двойники, невидимые
 * символы), как у проверки входа: «тaблетки» с латинской «a» не проходят.
 */
export function factRejection(text: string, opts: { echo?: ReadonlySet<string> } = {}): WriteRejection | null {
  if (stripInvisible(text) !== text) return 'unsafe'
  const vs = matchVariants(text)
  const any = (r: RegExp) => vs.some((v) => r.test(v))
  if (any(INSTRUCTION_LIKE)) return 'injection'
  if (checkInput([text]).crisis || any(CRISIS_FACT)) return 'crisis'
  if (any(HEALTH)) return 'health'
  if (any(DOCUMENTS) || LONG_NUMBER.test(text.replace(DATES, ' '))) return 'documents'
  if (any(IDENTITY)) return 'identity'
  if (any(MONEY)) return 'money'
  if (any(CONTACT)) return 'contact'
  if (any(TRAIT)) return 'trait'
  // остальное — общие правила вывода кота: ссылки, телефоны, стыд, чужая личность, чужой язык
  const verdict = checkOutput(text, { maxChars: 400, echo: opts.echo })
  return verdict.ok ? null : 'unsafe'
}

/**
 * Основание факта — слова человека, а не кота (Hermes background_review: «сохраняй только то, что обосновано
 * репликой»; mem0: «не выдумывать признаки»). Цитата должна найтись в репликах человека: целиком или так, что
 * совпадает не меньше двух третей её слов (модель вправе убрать «ну» и поменять падеж — окончания не сравниваем).
 */
export function groundedIn(evidence: string | undefined, userTexts: readonly string[]): boolean {
  if (!evidence) return false
  const norm = (s: string) => forMatching(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const ev = norm(evidence)
  if (ev.length < 3) return false
  const hay = norm(userTexts.join(' \n '))
  if (hay.includes(ev)) return true
  const stem = (x: string) => x.slice(0, 5)
  const words = ev.split(' ').filter((x) => x.length >= 3)
  if (words.length === 0) return false
  const have = new Set(hay.split(' ').map(stem))
  return words.filter((x) => have.has(stem(x))).length / words.length >= 2 / 3
}
