import { forMatching, matchVariants } from './normalize'

/**
 * Проверка ответа модели до того, как его увидит человек (OpenAI Agents SDK: output guardrails, «растяжка»).
 * Нарушение → одна попытка следующей моделью цепочки, затем заготовленная реплика задачи. Правила — главное
 * обещание продукта: тон без стыда и вины, никаких медицинских советов, по-русски, коротко.
 */

// Стыд и давление. «не» перед словом — это как раз поддержка («ты не ленивый»), её не трогаем.
// В JS \w и \b — только латиница: границы русских слов — через (?<!\p{L}) / (?!\p{L}) с флагом u.
const L = String.raw`\p{L}`
const word = (body: string) => new RegExp(String.raw`(?<!${L})(?:${body})`, 'iu')
// «не» перед словом (в пределах двух слов) — это как раз поддержка («ты не ленивый»), её не трогаем.
const notAfterNe = (body: string) => new RegExp(String.raw`(?<!(?<!${L})не\s(?:${L}+\s)?)(?<!${L})(?:${body})`, 'iu')

const SHAME = [
  notAfterNe('ленив|лентя|бездельн'),
  // «стыдно» само по себе не стыдит («Стыдно бывает всем, это нормально»): ловим обращённое к человеку
  word(String.raw`(?:тебе|вам)\s+(?:должно\s+быть\s+)?стыдно|как\s+(?:тебе\s+)?не\s+стыдно|не\s+стыдно\s*\?|постыдись|стыдись`),
  notAfterNe('позор'),
  word(String.raw`слабак|тряпк[аи]|нытик|хватит\s+ныть|разочарован`),
  word(String.raw`надо\s+было\s+(?:раньше|сразу|давно)`),
  notAfterNe(String.raw`долж(?:ен|на)\s+был`),
  word(String.raw`соберись|возьми\s+себя\s+в\s+руки`),
  word(String.raw`постарайся|старайся\s+лучше`),
  notAfterNe('дисциплин'), // «тебе не нужна дисциплина — нужен первый шаг» — это поддержка
  word(String.raw`опять\s+ничего\s+не\s+сделал`),
]

// Медицина: препараты и дозы — только врач. Кот может сказать «это вопрос к врачу», но не советовать.
const MEDICAL = [
  word('метилфенидат|атомоксетин|риталин|страттер|аддерол|концерт[аы](?!' + L + ')|элванс|лисдексамфетамин|модафинил'),
  new RegExp(String.raw`\d+\s*(?:мг|mg|мкг|миллиграмм${L}*)(?!${L})|(?<!${L})миллиграмм|дозировк|(?<!${L})доз[ауы](?!${L})`, 'iu'),
  word(String.raw`полтаблетк|пол-таблетк|(?:пропей|пропить|попей)\s+(?:курс|${L}+\s+курс)|удво(?:ить|й)\s+при[её]м`),
  word(String.raw`(?:прими|принять|пей|выпей|брось|бросить|отмени|отменить|увеличь|уменьши)\s+(?:\d+\s*)?(?:${L}+\s+)?(?:таблет|капсул|лекарств|препарат|антидепрессант)`),
]

// Английские слова в русской реплике (замер 11.11: DeepSeek выдал «всё, что туда не belongs»). Слова, которые
// написал сам человек («открыть Notion», «отчёт в Excel»), разрешены: кот их повторяет, это не смена языка.
const LATIN_WORDS = /(?<![a-z])[a-z]{3,}(?![a-z])/gi

// Названия, которые по-русски пишут латиницей всегда: человек сказал «пдф» / «ютуб», кот вправе написать PDF /
// YouTube — это не смена языка (аудит 12.11: без списка каждая такая реплика уходила в заготовку)
const COMMON_LATIN: ReadonlySet<string> = new Set(
  'pdf youtube pomodoro telegram adhd wifi excel word notion google zoom email whatsapp todoist figma github iphone android mac windows tiktok instagram docs powerpoint slack trello obsidian gmail chrome safari doc docx xls xlsx ppt pptx txt csv png jpg jpeg zip'.split(' '),
)

function foreignWord(text: string, echo: ReadonlySet<string>): boolean {
  for (const m of text.matchAll(LATIN_WORDS)) {
    const w = m[0].toLowerCase()
    if (!echo.has(w) && !COMMON_LATIN.has(w)) return true
  }
  return false
}

/** Латинские слова из текстов человека — их коту повторять можно */
export function echoWords(texts: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>()
  for (const t of texts) for (const m of t.matchAll(LATIN_WORDS)) out.add(m[0].toLowerCase())
  return out
}

// Ссылки и упоминания: вывод кота никогда не становится адресом (security-ai.md R1/R7 — у бота превью ссылок
// превратило бы ответ в запрос наружу, «смертельная тройка» Willison; Telegram сам делает ссылкой голый домен).
// Домен — любая «метка.зона»: латинская зона любая (bit.ly, evil.xyz), кириллическая — из списка (иначе «шаг.Давай»
// без пробела считалось бы доменом). Имена файлов («отчёт.docx») — не ссылки. Слова человека (echo) это правило
// НЕ отключают: пересланный в бот «evil xyz» не делает «evil.xyz» разрешённым.
const FILE_EXT = 'docx?|xlsx?|pptx?|pdf|txt|md|csv|png|jpe?g|gif|zip|key|pages|numbers|mp[34]|mov|fig|psd|json|html?'
const LINK_RULES = [
  /https?:\/\/|www\.|t\.me\/|(?<![\p{L}\d])(?:tg|mailto):/iu,
  /(?<![\p{L}\d])@[a-z0-9_]{4,}/iu,
  new RegExp(String.raw`(?<![\p{L}\d.])[\p{L}\d-]+\.(?!(?:${FILE_EXT})(?![\p{L}\d]))(?:[a-z]{2,24}|рф|рус|онлайн|москва|сайт|дети|бел|укр)(?![\p{L}\d])`, 'iu'),
  // «example точка ру», «example [.] ru», «example dot ru», «example . ru»
  /[\p{L}\d-]{2,}\s*(?:\[\.\]|\(\.\)|。|\sточка\s|\sdot\s)\s*(?:[a-z]{2,24}|ру|ком|рф)(?![\p{L}\d])/iu,
  /[a-z\d-]{2,}\s\.\s?(?:ru|com|org|net|io|me|xyz|info|su)(?![\p{L}\d])/iu,
]
export const isLink = (t: string) => LINK_RULES.some((r) => r.test(t))

// Телефоны: модель не называет номера сама — решение владельца 11.11: «только 112, модели номера запретить»
// (на «дай номер, куда позвонить» модель сама назвала 051 и 103). Кризисный ответ — проверенный текст из crisis.ts,
// через эту проверку он не идёт. Два правила:
//  - последовательность из ≥ 10 цифр — номер, где бы она ни стояла и чем бы ни была разделена (пробел, скобки,
//    дефис, тире, точка, косая черта; цифры любого письма). Даты перед подсчётом убираются;
//  - короткий номер (кроме 112) — только когда он прямо назван номером: «звони 103», «позвони в 051», «номер 103»,
//    «телефон доверия 051», «линия 122». Число с единицей («20 слов», «в 14 ч», «в 2026 году») — не номер; число
//    в стороне от глагола («позвони в банк до 18») — тоже (аудит 12.11: прежнее правило «звонок и любое число в
//    одной реплике» блокировало обычные планы на вечер).
const DATE = /(?<![\d.-])(?:\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{2,4})(?![\d.-])/g
const PHONE_RUN = /\+?\d[\d\s().\/‐–—-]{6,}\d/gu
const UNIT = String.raw`(?:мин|минут|час|ч|сек|шаг|раз|дн|дел|слов|строк|страниц|пункт|приседан|отжиман|год|лет|числа|руб|штук|%|₽)`
const NUM = String.raw`(\d(?:[\d\s‐-]?\d){1,5})(?!\d|[.,:]\d|\s*${UNIT})`
const SHORT_PHONE = [
  new RegExp(String.raw`(?<!\p{L})(?:по)?(?:звон|набер|набир)\p{L}*\s+(?:(?:в|на|по)\s+)?(?:номер\p{L}*\s+)?${NUM}`, 'giu'),
  new RegExp(String.raw`(?<!\p{L})(?:номер|телефон)\p{L}*(?:\s+\p{L}+){0,2}\s+${NUM}`, 'giu'),
  new RegExp(String.raw`(?<!\p{L})(?:лини|служб)\p{L}*\s+${NUM}`, 'giu'),
]
const asciiDigits = (t: string) => t.replace(/\p{Nd}/gu, (d) => (d >= '0' && d <= '9' ? d : digitValue(d)))
function digitValue(d: string): string {
  // цифры других письменностей идут в Юникоде десятками подряд: значение — смещение от нуля своего блока
  const cp = d.codePointAt(0)!
  for (let zero = cp; zero > cp - 10; zero--) if (!/\p{Nd}/u.test(String.fromCodePoint(zero - 1))) return String(cp - zero)
  return d
}
export const isPhone = (raw: string) => {
  const t = asciiDigits(raw).replace(DATE, ' ')
  if ([...t.matchAll(PHONE_RUN)].some((m) => (m[0].match(/\d/g) ?? []).length >= 10)) return true
  return SHORT_PHONE.some((r) => [...t.matchAll(r)].some((m) => m[1].replace(/\D/g, '') !== '112'))
}

// Чужая личность: провайдер может подмешать свою инструкцию (замер 11.11: маршрут cc/ у AnyModel несёт системный
// промпт Claude Code — модель без нашей обвязки отвечала «I'm Claude Code»). Кот никогда не называет себя моделью,
// ассистентом или чужим продуктом — такой ответ не показывается, ход уходит следующей модели или в заготовку.
// «не» перед словом — это как раз отрицание («я не нейросеть, я кот», «нет, я не Claude») — пропускаем
const notNe = (body: string) => String.raw`(?<!(?<!\p{L})не\s(?:\p{L}+\s)?)` + body
const IDENTITY = new RegExp(
  [
    notNe(String.raw`(?<!\p{L})(?:claude|клод\p{L}*|anthropic|антропик\p{L}*|openai|chatgpt|чатгпт|gpt-?\d|deepseek|дипсик\p{L}*|gemini|гемини|джемини|гигачат|gigachat|яндекс\s*гпт|yandexgpt|чат\s*гпт|qwen|llama)(?!\p{L})`),
    notNe(String.raw`(?<!\p{L})(?:языков\p{L}*|нейросетев\p{L}*|ии|ai)[\s-]+(?:модел\p{L}*|ассистент\p{L}*|помощник\p{L}*)`),
    notNe(String.raw`(?<!\p{L})(?:искусственн\p{L}*\s+интеллект\p{L}*|нейронн\p{L}*\s+сет\p{L}*)`),
    String.raw`(?<!\p{L})меня\s+(?:сделал|создал|разработал|обучил)\p{L}*\s+(?:в|компани\p{L}*)\s`,
    String.raw`(?<!\p{L})я\s+(?:—\s+|-\s+)?(?:всего\s+лишь\s+|просто\s+)?(?:ии|бот|нейросеть|программа|ассистент|чат-?бот|приложение)(?!\p{L})`,
  ].join('|'),
  'iu',
)

const NO_ECHO: ReadonlySet<string> = new Set()

export type OutputViolation = 'shame' | 'medical' | 'language' | 'empty' | 'length' | 'link' | 'phone' | 'leak' | 'identity'
export type OutputVerdict = { ok: true } | { ok: false; reason: OutputViolation }

export type OutputOpts = {
  maxChars: number
  /** латинские слова человека (echoWords) */
  echo?: ReadonlySet<string>
  /** отпечаток системной инструкции (leakPrint): пересказ правил дословно — мимо (OWASP LLM07) */
  leak?: LeakPrint
}

export function checkOutput(text: string, opts: OutputOpts): OutputVerdict {
  const raw = text.trim()
  if (!raw) return { ok: false, reason: 'empty' }
  if (raw.length > opts.maxChars) return { ok: false, reason: 'length' }
  const vs = matchVariants(raw)
  const hit = (test: (t: string) => boolean) => vs.some(test)
  if (hit((t) => IDENTITY.test(t))) return { ok: false, reason: 'identity' }
  if (hit(isLink)) return { ok: false, reason: 'link' }
  if (hit(isPhone)) return { ok: false, reason: 'phone' }
  if (hit((t) => MEDICAL.some((r) => r.test(t)))) return { ok: false, reason: 'medical' }
  if (hit((t) => SHAME.some((r) => r.test(t)))) return { ok: false, reason: 'shame' }
  const { leak } = opts
  if (leak && hit((t) => leaks(t, leak))) return { ok: false, reason: 'leak' }
  if (foreignWord(raw, opts.echo ?? NO_ECHO)) return { ok: false, reason: 'language' }
  return { ok: true }
}

/** Разметка, которую мы не рисуем: двойные звёздочки → одиночные, кавычки-обёртки вокруг всей реплики — прочь */
export function tidy(text: string): string {
  return text
    .trim()
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    // кавычки снимаются, только если обёрнута вся реплика: «A» — шаг «B» остаётся как есть
    .replace(/^["«„]([^"«»„“]*)["»“]$/, '$1')
    .trim()
}

/**
 * Утечка правил: 8 слов подряд из системной инструкции. Промпт — не секрет (OWASP LLM07 прямо это говорит), но
 * кот, читающий вслух свои правила, ломает характер; такой ответ уходит дальше по цепочке.
 */
const SHINGLE = 8
export type LeakPrint = ReadonlySet<string>

const wordsOf = (s: string) => forMatching(s).match(/[\p{L}\d]+/gu) ?? []

// отпечаток системной инструкции считается один раз на текст (инструкций — по одной на задачу и режим)
const prints = new Map<string, LeakPrint>()

export function leakPrint(system: string): LeakPrint {
  const hit = prints.get(system)
  if (hit) return hit
  if (prints.size > 32) prints.clear()
  const print = buildPrint(system)
  prints.set(system, print)
  return print
}

function buildPrint(system: string): LeakPrint {
  const w = wordsOf(system)
  const out = new Set<string>()
  for (let i = 0; i + SHINGLE <= w.length; i++) out.add(w.slice(i, i + SHINGLE).join(' '))
  return out
}

function leaks(normalized: string, print: LeakPrint): boolean {
  const w = normalized.match(/[\p{L}\d]+/gu) ?? []
  for (let i = 0; i + SHINGLE <= w.length; i++) if (print.has(w.slice(i, i + SHINGLE).join(' '))) return true
  return false
}

/** человек сам говорит о лекарствах («спросить врача про риталин») — тогда его слова в плане не нарушение */
export function mentionsMedical(texts: readonly string[]): boolean {
  const vs = matchVariants(texts.join('\n'))
  return vs.some((t) => MEDICAL.some((r) => r.test(t)))
}

/**
 * Аргументы инструмента — тоже вывод кота: их увидит человек (карточка плана, кнопка, «запомнил: …») и следующие
 * промпты. Каждая строка проходит те же правила, что текст ответа (без утечки и общей длины). Дело человека кот
 * записывает его словами, поэтому латинские слова человека (echo) и названные им самим лекарства допустимы.
 */
export function toolArgsOk(input: unknown, person: { echo?: ReadonlySet<string>; medical?: boolean } = {}): boolean {
  if (!input || typeof input !== 'object') return true
  return Object.values(input as Record<string, unknown>).every((v) => {
    if (typeof v !== 'string') return true
    const verdict = checkOutput(v, { maxChars: 400, echo: person.echo })
    return verdict.ok || (verdict.reason === 'medical' && person.medical === true)
  })
}
