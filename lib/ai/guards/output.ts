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
  notAfterNe('стыдн|позор'),
  word(String.raw`надо\s+было\s+(?:раньше|сразу|давно)`),
  notAfterNe(String.raw`долж(?:ен|на)\s+был`),
  word(String.raw`соберись|возьми\s+себя\s+в\s+руки`),
  word(String.raw`постарайся|старайся\s+лучше`),
  word('дисциплин'),
  word(String.raw`опять\s+ничего\s+не\s+сделал`),
]

// Медицина: препараты и дозы — только врач. Кот может сказать «это вопрос к врачу», но не советовать.
const MEDICAL = [
  word('метилфенидат|атомоксетин|риталин|страттер|аддерол|концерт[аы](?!' + L + ')|элванс|лисдексамфетамин|модафинил'),
  new RegExp(String.raw`\d+\s*(?:мг|mg)(?!${L})|дозировк|(?<!${L})дозу(?!${L})`, 'iu'),
  word(String.raw`(?:прими|принять|пей|выпей|брось|бросить|отмени|отменить|увеличь|уменьши)\s+(?:\d+\s*)?(?:${L}+\s+)?(?:таблет|капсул|лекарств|препарат|антидепрессант)`),
]

// Английские слова в русской реплике (замер 11.11: DeepSeek выдал «всё, что туда не belongs»). Слова, которые
// написал сам человек («открыть Notion», «отчёт в Excel»), разрешены: кот их повторяет, это не смена языка.
const LATIN_WORDS = /(?<![a-z])[a-z]{3,}(?![a-z])/gi

function foreignWord(text: string, echo: ReadonlySet<string>): boolean {
  for (const m of text.matchAll(LATIN_WORDS)) if (!echo.has(m[0].toLowerCase())) return true
  return false
}

/** Латинские слова из текстов человека — их коту повторять можно */
export function echoWords(texts: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>()
  for (const t of texts) for (const m of t.matchAll(LATIN_WORDS)) out.add(m[0].toLowerCase())
  return out
}

// Ссылки и упоминания: вывод кота никогда не становится адресом (security-ai.md R1/R7 — у бота превью ссылок
// превратило бы ответ в запрос наружу, «смертельная тройка» Willison)
const LINK = new RegExp(String.raw`https?:\/\/|www\.|(?<![\p{L}\d])[\p{L}\d-]+\.(?:ru|com|org|net|io|me|рф|su|app|dev|онлайн|рус|москва)(?![\p{L}\d])|t\.me\/|(?<![\p{L}\d])@[a-z0-9_]{4,}`, 'iu')
// Телефоны: модель не называет номера сама — решение владельца 11.11: «только 112, модели номера запретить»
// (на «дай номер, куда позвонить» модель сама назвала 051 и 103). Кризисный ответ — проверенный текст из crisis.ts,
// через эту проверку он не идёт. Два правила:
//  - любая последовательность из ≥ 10 цифр — это номер, где бы она ни стояла (даты и время короче);
//  - короткий номер (2–6 цифр, кроме 112) рядом со словами «звони / номер / телефон / набери / линия» — тоже номер:
//    «звони 103», «телефон доверия 051». Без этих слов число остаётся числом («25 минут», «3 шага»).
const PHONE_RUN = /\+?\d[\d\s()‐-]{6,}\d/gu
const CALL_WORD = /(?<!\p{L})(?:звон\p{L}*|позвон\p{L}*|набер\p{L}*|набир\p{L}*|номер\p{L}*|телефон\p{L}*|лини\p{L}*|горяч\p{L}*|служб\p{L}*)(?!\p{L})/iu
// не часть дробного числа или времени («2,5», «10:30»): разделитель исключаем, только если за ним снова цифра
const SHORT_NUMBER = /(?<!\d|\d[.,:])\d(?:[\d\s‐-]?\d){1,5}(?!\d|[.,:]\d|\s*(?:мин|минут|час|сек|шаг|раз|дн|%))/gu
const isPhone = (t: string) => {
  if ([...t.matchAll(PHONE_RUN)].some((m) => (m[0].match(/\d/g) ?? []).length >= 10)) return true
  if (!CALL_WORD.test(t)) return false
  return [...t.matchAll(SHORT_NUMBER)].some((m) => m[0].replace(/\D/g, '') !== '112')
}

// Чужая личность: провайдер может подмешать свою инструкцию (замер 11.11: маршрут cc/ у AnyModel несёт системный
// промпт Claude Code — модель без нашей обвязки отвечала «I'm Claude Code»). Кот никогда не называет себя моделью,
// ассистентом или чужим продуктом — такой ответ не показывается, ход уходит следующей модели или в заготовку.
// «не» перед словом — это как раз отрицание («я не нейросеть, я кот», «нет, я не Claude») — пропускаем
const notNe = (body: string) => String.raw`(?<!(?<!\p{L})не\s(?:\p{L}+\s)?)` + body
const IDENTITY = new RegExp(
  [
    notNe(String.raw`(?<!\p{L})(?:claude|клод\p{L}*|anthropic|антропик\p{L}*|openai|chatgpt|чатгпт|gpt-?\d|deepseek|дипсик\p{L}*|gemini|гемини|qwen|llama)(?!\p{L})`),
    notNe(String.raw`(?<!\p{L})(?:языков\p{L}*|нейросетев\p{L}*|ии|ai)[\s-]+(?:модел\p{L}*|ассистент\p{L}*|помощник\p{L}*)`),
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
  if (hit((t) => LINK.test(t))) return { ok: false, reason: 'link' }
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
    .replace(/^["«„]([\s\S]*)["»“]$/, '$1')
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
