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
  // «концерта» — препарат, только рядом с дозой или приёмом: «сходи на концерт», «концерты по пятницам» — не медицина
  word('метилфенидат|атомоксетин|риталин|страттер|аддерол|элванс|лисдексамфетамин|модафинил|концерт[аы]\\s+\\d|(?:прими|принимай|принять|пей|пить|выпей|пропей)\\s+концерт'),
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

const unquote = (t: string) => t.replace(/«[^«»]{1,80}»|"[^"]{1,80}"|“[^”]{1,80}”|„[^“”]{1,80}[“”]/g, '«…»')

export type OutputViolation = 'shame' | 'medical' | 'language' | 'empty' | 'length' | 'link' | 'phone' | 'leak' | 'identity' | 'claim' | 'bureaucratese' | 'absence'
export type OutputVerdict = { ok: true } | { ok: false; reason: OutputViolation }

export type OutputOpts = {
  maxChars: number
  /** латинские слова человека (echoWords) */
  echo?: ReadonlySet<string>
  /** отпечаток системной инструкции (leakPrint): пересказ правил дословно — мимо (OWASP LLM07) */
  leak?: LeakPrint
  /**
   * Честность о действиях: «забыл», «запомнил», «сохранил» можно сказать, только если действие правда было (вызов
   * инструмента в этой попытке или его результат в истории хода). Иначе кот сказал бы «забыл», а память осталась
   * бы прежней (живой прогон 12.11: «Принято, забыл про диплом.» без вызова)
   */
  claim?: { allowed: (kind: ClaimKind) => boolean }
  /** речь кота (чат, голос, шаги): канцелярит не пропускать (правило владельца 12.11) */
  plainSpeech?: boolean
  /** разговор уже идёт и человек не здоровался: приветствие в начале ответа снимается (правило владельца 12.11) */
  noGreeting?: boolean
}

const GREETING_START =
  /^\s*(?:(?:о|ой|ну|ага|а)[,!]?\s+)?(?:приве\p{L}*(?:[-\s]+приве\p{L}*)?|здравствуй\p{L}*|здорово|хай|салют|доброе\s+утро|добрый\s+(?:день|вечер)|доброй\s+ночи)/iu
// «Приветик, Аня!» — имя после приветствия (с заглавной; регистр важен, поэтому отдельно от правила выше)
const GREETING_NAME = /^\s*,\s*\p{Lu}[\p{L}-]*/u

/** «О, привет! Слушай…» → «Слушай…»: снимаем приветствие в начале ответа посреди разговора */
export function stripGreeting(text: string): string {
  const m = GREETING_START.exec(text)
  if (!m) return text
  let rest = text.slice(m[0].length)
  const name = GREETING_NAME.exec(rest)
  if (name) rest = rest.slice(name[0].length)
  rest = rest.replace(/^[!.,…\s]+/u, '')
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : ''
}

/**
 * Ласковое прозвище обращением («Овечка моя, привет!», «Держись, зайка.») снимается кодом: промпт запрещает, а модель
 * всё равно зовёт так (набор задач 12.11, «Овечка моя» при названном имени «Аня»). Только обращение — между запятыми
 * или в начале с запятой; «как зайка из мультика» не трогаем.
 */
const PET = String.raw`(?:зай(?:ка|чик|ченок|чонок|ушка)|солнышк\p{L}*|овечк\p{L}*|малыш(?:ка)?|детка|дружочек|пупсик|лапочк\p{L}*|лапул\p{L}*|рыбка|птичка|котёночек|котенок|котёнок|милаш\p{L}*|красотк\p{L}*|родн(?:ой|ая|уля)|мил(?:ый|ая))(?:\s+мо(?:я|й))?`
const PET_START = new RegExp(String.raw`^(\s*)(?:мо(?:я|й)\s+)?${PET}\s*,\s*(\p{L})`, 'iu')
const PET_INNER = new RegExp(String.raw`,\s*(?:мо(?:я|й)\s+)?${PET}(?=\s*[,.!?…])`, 'giu')
export function stripPetNames(text: string): string {
  return text
    .replace(PET_START, (_m, sp: string, ch: string) => sp + ch.toUpperCase())
    .replace(PET_INNER, '')
}

export const GREETS = /^\s*(?:(?:о|ой|ну)[,!]?\s+)?(?:приве|здравств|здаров|хай|салют|добр\p{L}*\s+(?:утро|день|вечер)|hi|hello|hey)/iu

/**
 * Канцелярит в речи кота (правило владельца 12.11: «никаких канцеляритов»). Промпт запрещает, но модели всё равно
 * пишут «на повестке дня» (набор задач 12.11) — правило исполняет код. Только однозначно казённые обороты: такой
 * ответ не показывается, ход уходит следующей модели.
 */
/**
 * Счёт пропуска (правило владельца: «если человек не появлялся, НИКОГДА не считай упущенное»; база знаний CP08 —
 * кот не ждёт и не считает). Набор задач 12.11: «Ты пропал на двенадцать дней», «шесть дней — это срок!» — промпт
 * это запрещал, модели всё равно писали. Число дней или недель рядом с «пропал / не было / не заходил / ждал».
 */
const NUM_OR_WORD = String.raw`(?:\d+|один|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|\p{L}*надцать|двадцать|тридцать|сорок|пару|несколько)`
const ABSENCE_COUNT = new RegExp(
  String.raw`(?<!\p{L})(?:куда|где)\s+(?:же\s+)?(?:это\s+)?ты\s+(?:так\s+)?(?:пропал|запропастил)\p{L}*|(?<!\p{L})(?:скучал|ждал|заждал)\p{L}*\s+(?:тебя|по\s+тебе)|(?<!\p{L})(?:пропал\p{L}*|не\s+было|не\s+заходил\p{L}*|не\s+появлял\p{L}*|отсутствовал\p{L}*|ждал\p{L}*|скучал\p{L}*)(?:\s+\p{L}+){0,2}\s+(?:на\s+|целых\s+|уже\s+)?(?:${NUM_OR_WORD}|\d+)\s+(?:дн|день|недел|месяц)|(?<!\p{L})(?:${NUM_OR_WORD}|\d+)\s+(?:дн\p{L}*|недел\p{L}*)\s*(?:—|-|,)?\s*(?:это\s+)?(?:срок|долго|немало|целая|вечность)`,
  'iu',
)

const BUREAUCRATESE = /(?<!\p{L})(?:на\s+повестке|в\s+рамках|осуществ\p{L}*|явля(?:ется|ются|лся|лась)|зафиксир\p{L}*|реализова(?:ть|ть|ние|нии)|произвести|с\s+целью|в\s+случае\s+если|в\s+связи\s+с\s+тем|вышеуказанн\p{L}*|нижеследующ\p{L}*|данн(?:ый|ая|ое|ого|ой|ую)\s+(?:момент|вопрос|задач|дел|случа))(?!\p{L})/iu

/**
 * Заявление кота о сделанном. memory — о памяти («забыл», «запомнил», «удалено», «учту», «больше не помню»); save —
 * о записи вообще («записал», «сохранено» — так говорят и о плане). Только утверждение от себя: вопрос («Ты сохранил
 * файл?»), слова о человеке («Ты забыл ключи — бывает», «Если забыла, с чего начать…», «Ничего страшного, что
 * забыл») и воспоминание («Я запомнил, что ты пишешь диплом» — это «помню», а не действие) — не заявления
 * (аудит 12.11: прежнее правило резало такие ответы до заготовки).
 */
export type ClaimKind = 'memory' | 'save'
const MEMORY_CLAIM = /(?<!\p{L})(?:забыл[аи]?|забыто|запомнил[аи]?(?!\s*,?\s*что)|запомню|ст[её]р(?:ла|ли)?|удалил[аи]?|удален[оа]?|убрал[аи]?\s+из\s+памяти|выкинул[аи]?\s+из\s+(?:памяти|головы)|больше\s+не\s+(?:помню|напомню)|учту|зан[её]с(?:ла)?|отметил[аи]?\s+себе|теперь\s+буду\s+знать)(?!\p{L})/iu
const SAVE_CLAIM = /(?<!\p{L})(?:записал[аи]?|записан[оа]?|сохранил[аи]?|сохранен[оа]?|зафиксировал[аи]?)(?!\p{L})/iu
// чьё действие: перед словом в пределах трёх слов — «ты», «вы», «если», «что», «когда», «бывает»; «не» — вплотную
const NOT_MINE = /(?:(?<!\p{L})(?:ты|вы|если|что|чтобы|когда|бывает|страшного|вдруг)(?!\p{L})(?:\s+\p{L}+){0,3}|(?<!\p{L})не)\s*[,—-]?\s*$/iu
// «Забыл про дедлайн — бывает со всеми» — о человеке, утешение
const NOT_MINE_AFTER = /(?<!\p{L})(?:бывает|ничего\s+страшного|не\s+страшно|со\s+всеми)(?!\p{L})/iu

function claimIn(sentence: string, re: RegExp): boolean {
  const s = sentence.trim()
  if (!s || /\?\s*$/.test(s)) return false
  const m = re.exec(s)
  if (!m) return false
  const before = s.slice(0, m.index)
  const after = s.slice(m.index + m[0].length)
  return !NOT_MINE.test(before) && !NOT_MINE_AFTER.test(after)
}

/** Какое заявление о действии есть в тексте (по предложениям); null — нет */
export function claimKind(text: string): ClaimKind | null {
  for (const sentence of text.split(/(?<=[.!?…])\s+|\n+/)) {
    if (claimIn(sentence, MEMORY_CLAIM)) return 'memory'
    if (claimIn(sentence, SAVE_CLAIM)) return 'save'
  }
  return null
}

/**
 * Разбор ярлыка, которым человек назвал себя сам, — не стыд: «Ну, ленивым себя называть дело привычное, только давай
 * без ярлыков» (набор задач 12.11: такая фраза обрывала ответ после «Приветик.»). Предложение, где ярлык назван
 * ярлыком или словом «называть / считать себя», в проверку стыда не идёт; «ты ленивый» без этого — идёт.
 */
const REFRAME = /(?<!\p{L})(?:ярлык\p{L}*|себя\s+(?:\p{L}+\s+){0,2}(?:называ|счита|руга)\p{L}*|(?:называ|счита|руга)\p{L}*\s+себя)(?!\p{L})/iu
const LABEL_AT_YOU = /(?<!\p{L})ты\s+(?:\p{L}+\s+)?(?:ленив|лентя|бездельн)|(?:ленив|лентя|бездельн)\p{L}*\s+ты(?!\p{L})/iu
function withoutReframes(text: string): string {
  return text
    .split(/(?<=[.!?…])\s+|\n+/)
    // «Ленивый ты, хоть себя так и не называй» — ярлык прямо в лицо: такое предложение проверяется как обычно
    .filter((sentence) => !REFRAME.test(sentence) || LABEL_AT_YOU.test(sentence))
    .join(' ')
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
  // слова в кавычках — цитата человека, а не ярлык от кота: «„ленивый и безответственный“ это не про тебя» (набор
  // задач 12.11: такой ответ отбрасывался как стыд). Сказать от себя «ты ленивый» в кавычках модели незачем
  if (matchVariants(unquote(withoutReframes(raw))).some((t) => SHAME.some((r) => r.test(t)))) return { ok: false, reason: 'shame' }
  const { leak } = opts
  if (leak && hit((t) => leaks(t, leak))) return { ok: false, reason: 'leak' }
  if (opts.plainSpeech && hit((t) => BUREAUCRATESE.test(t))) return { ok: false, reason: 'bureaucratese' }
  if (opts.plainSpeech && hit((t) => ABSENCE_COUNT.test(t))) return { ok: false, reason: 'absence' }
  if (opts.claim) {
    // прочтения, где пропали знаки вопроса, сюда не годятся: «Сохранил?» — вопрос, не заявление
    const q = (t: string) => t.split('?').length
    const kinds = new Set(vs.filter((v) => q(v) === q(raw)).map(claimKind).filter((k): k is ClaimKind => k !== null))
    for (const k of kinds) if (!opts.claim.allowed(k)) return { ok: false, reason: 'claim' }
  }
  if (foreignWord(raw, opts.echo ?? NO_ECHO)) return { ok: false, reason: 'language' }
  return { ok: true }
}

/** Разметка, которую мы не рисуем: двойные звёздочки → одиночные, кавычки-обёртки вокруг всей реплики — прочь */
/**
 * Без тире (правило владельца 12.11: «никаких тире»): тире между словами становится запятой, тире после знака
 * препинания или в начале реплики просто уходит. Модели ставят тире даже вопреки инструкции (живой прогон: 3 ответа
 * из 19), поэтому правило исполняет код. Дефис внутри слова («давай-ка», «привет-привет») не трогаем.
 */
export function undash(text: string): string {
  return text
    .replace(/(^|\n)[ \t]*[—–][ \t]*/g, '$1')
    .replace(/([,.!?:;…])[ \t]+[—–](?=[ \t])/g, '$1')
    .replace(/[ \t]+[—–][ \t]+/g, ', ')
    .replace(/[ \t]+[—–](?=[,.!?…]|$)/g, '')
}

export function tidy(text: string): string {
  return stripPetNames(undash(text))
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
// Служебные поля-перечисления (инструмент memory: op, category, ref): значение задаёт схема (enum / номер), человеку
// оно не показывается — «add» и «task» не английская речь кота
const STRUCTURAL_KEYS: ReadonlySet<string> = new Set(['op', 'category', 'ref'])

export function toolArgsOk(input: unknown, person: { echo?: ReadonlySet<string>; medical?: boolean } = {}): boolean {
  if (!input || typeof input !== 'object') return true
  return Object.entries(input as Record<string, unknown>).every(([k, v]) => {
    if (typeof v !== 'string') return true
    if (STRUCTURAL_KEYS.has(k) && /^[a-zA-Z0-9]{1,12}$/.test(v)) return true
    const verdict = checkOutput(v, { maxChars: 400, echo: person.echo })
    return verdict.ok || (verdict.reason === 'medical' && person.medical === true)
  })
}
