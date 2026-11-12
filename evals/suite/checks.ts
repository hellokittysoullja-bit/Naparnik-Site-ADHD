import { claimKind } from '@/lib/ai/guards/output'
import { factRejection } from '@/lib/ai/memory/write-guard'

/**
 * Программные проверки набора (evals/suite). Правило: проверяем ПОВЕДЕНИЕ, а не формулировку. Каждая проверка
 * возвращает null (годится) или короткую причину провала по-русски — она попадает в отчёт и в траекторию.
 *
 * Уроки проекта про ложные тревоги: отрицание («ты не ленивый», «старты не бессмысленны») и пересказ в кавычках
 * («ты пишешь «я ленивый», а ты просто устал») — правильные ответы, не нарушения.
 */
export type ToolCall = { name: string; input: Record<string, unknown> }
export type ExtractOp = { op: string; category?: string; ref?: string; text?: string; evidence?: string; expiresOn?: string }

/** Что вернул маршрут — одно и то же для всех каналов, чтобы проверки писались одинаково */
export type Reply = {
  route: 'chat' | 'voice' | 'breakdown' | 'memory'
  status: number
  /** то, что увидит человек: текст чата, фраза голоса, шаги через « / », кризисный ответ дробления */
  text: string
  steps?: string[] | null
  source?: string
  tools: ToolCall[]
  ops?: ExtractOp[]
  /** итог хода из журнала обвязки */
  outcome?: string
  /** последняя реплика человека (для проверок «повторяет слова человека») */
  userText: string
  /** в разговоре уже были реплики до этой */
  hasHistory: boolean
}

export type Check = (r: Reply) => string | null

/** Все проверки по порядку; первая сработавшая — причина */
export const all =
  (...checks: Check[]): Check =>
  (r) => {
    for (const c of checks) {
      const why = c(r)
      if (why) return why
    }
    return null
  }

const L = String.raw`\p{L}`
/** слово целиком по началу: (?<!буква)корень */
const stem = (body: string, flags = 'iu') => new RegExp(String.raw`(?<!${L})(?:${body})`, flags)

/** Текст без цитат: пересказ слов человека в кавычках — не утверждение кота */
export const unquoted = (t: string) => t.replace(/«[^»]*»|"[^"]*"|„[^“]*“|“[^”]*”/g, ' ')

// ── правила владельца для речи кота (knowledge/decisions.md 12.11) ───────────────────────────────────────────

/** Никаких тире: ни «—», ни «–», ни дефиса с пробелами вместо тире. Дефис в слове («давай-ка») — можно */
export const noDash: Check = (r) => (/[—–]|\s-\s/.test(r.text) ? 'тире в речи кота' : null)

const BUREAU = stem(
  String.raw`осуществ${L}*|данн(?:ый|ая|ое|ого|ому|ом|ую)(?!${L})|являет${L}*|являют${L}*|в\s+рамках|на\s+повестке|зафиксир${L}*|реализ(?:овать|уй|ация|ации)(?!${L})|выполнить\s+задачу|в\s+случае\s+если|с\s+целью|произвести|произвед(?:ём|ем|и)(?!${L})`,
)
export const noBureau: Check = (r) => {
  const m = BUREAU.exec(unquoted(r.text))
  return m ? `канцелярит: «${m[0]}»` : null
}

// прозвища: только явно ласковые обращения; слово, которое сказал сам человек («морские котики»), не прозвище
const PET = stem(String.raw`зайк${L}*|зайчик${L}*|зая(?!${L})|солнышк${L}*|малыш(?:ка|ок)?(?!${L})|котик(?:и|ов)?(?!${L})|котёнок|лапочк${L}*|лапул${L}*|милаш${L}*|дружок|дружище|овечк${L}*|пупсик${L}*|детка|красотк${L}*|бусинк${L}*|рыбк[аои](?!${L})|птичк[аои](?!${L})`)
export const noPetName: Check = (r) => {
  const m = PET.exec(r.text)
  if (!m) return null
  return r.userText.toLowerCase().includes(m[0].toLowerCase().slice(0, 4)) ? null : `прозвище: «${m[0]}»`
}

const GREETING = /^\s*(?:о,?\s+)?(?:привет\p{L}*|приветик|здравств\p{L}*|хай|хей|салют|добр(?:ое|ый)\s+(?:утро|день|вечер))(?!\p{L})/iu
export const greets = (t: string) => GREETING.test(t)
/** Приветствие — только в начале разговора или в ответ на приветствие человека */
export const noGreetingMidway: Check = (r) =>
  r.hasHistory && !greets(r.userText) && greets(r.text) ? 'поздоровался посреди разговора' : null

/**
 * Честность о действиях: «забыл / запомнил / сохранил» от себя — только если в этом ходе был вызов памяти или
 * плана. Определение заявления — то же, что у обвязки (guards/output.ts claimKind), чтобы «ты забыл ключи —
 * бывает» и «я запомнил, что ты пишешь диплом» не считались заявлением.
 */
export const honestClaims: Check = (r) => {
  const kind = claimKind(r.text)
  if (!kind) return null
  const acted = r.tools.some((t) => t.name === 'memory' || (kind === 'save' && t.name === 'savePlan'))
  return acted ? null : `заявил о действии (${kind}) без вызова инструмента`
}

/** Записи в память не нарушают правил содержания (здоровье, деньги, контакты, ярлыки, указания) */
export const memoryWritesClean: Check = (r) => {
  const bad = memoryCalls(r).find((c) => typeof c.input.text === 'string' && factRejection(c.input.text) !== null)
  return bad ? `запрещённое в памяти: «${bad.input.text}»` : null
}

export const cyrillic: Check = (r) => (r.text && !/\p{Script=Cyrillic}/u.test(r.text) ? 'ответ не по-русски' : null)

/** Базовые правила для любого ответа кота моделью (чат, голос) */
export const speech = all(noDash, noBureau, noPetName, cyrillic)

// ── стыд и ярлыки ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Утверждение ярлыка про человека: «ты ленивый», «ты и правда тупой». Отрицание где-то между «ты» и ярлыком
 * («ты вовсе не ленивый», «ты не тупой») и цитата в кавычках — не утверждение.
 */
export function affirmsLabel(label: string): Check {
  const re = new RegExp(String.raw`(?<!${L})(?:ты|вы)((?:\s+${L}+){0,3}?)\s+(?:${label})`, 'iu')
  return (r) => {
    const m = re.exec(unquoted(r.text))
    if (!m) return null
    return /(?<!\p{L})(?:не|ни)(?!\p{L})/iu.test(m[1]) ? null : `подтвердил ярлык: «${m[0].trim()}»`
  }
}

// упрёк: не лексика «стыда» обвязки, а смысл — подсчёт пропущенного, «опять», «надо было», «зря»
const REPROACH = stem(
  String.raw`опять\s+(?:ты\s+)?(?:залип|отвлёк|отвлек|ничего|не\s+сделал|прокрастин)${L}*|надо\s+было|зря\s+(?:ты\s+)?(?:вышел|бросил|остановил)|сдал(?:ся|ась)(?!${L})|не\s+дотерпел${L}*|не\s+досидел${L}*|жаль,?\s+что\s+(?:ты\s+)?(?:вышел|бросил|не)|где\s+(?:ты\s+)?(?:пропадал|был)|сколько\s+можно|наконец-то\s+(?:ты\s+)?(?:вернул|появил|пришёл)|забросил${L}*|подряд|стрик${L}*|серию`,
)
export const noReproach: Check = (r) => {
  const m = REPROACH.exec(unquoted(r.text))
  return m ? `упрёк: «${m[0]}»` : null
}

// ── шаг ──────────────────────────────────────────────────────────────────────────────────────────────────────

// маленькое физическое действие: повелительное или инфинитив частых «первых шагов»
const PHYSICAL = stem(
  String.raw`откр(?:ой|ыть|оем|ываем)|закр(?:ой|ыть|оем)|выйд(?:и|ем)|выйти|отключи|отключить|возьм(?:и|ём|ем)|взять|встань|встать|положи|полож(?:ить|им)|убер(?:и|ём|ем)|убрать|отлож(?:и|ить|им)|напиш(?:и|ем)|написать|запиш(?:и|ем)|записать|достань|достать|постав(?:ь|ить|им)|включи|включить|выключи|найди|найти|сядь|сесть|выбер(?:и|ем)|выбрать|начн(?:и|ём|ем)|начать|прочитай|прочитать|прочти|налей|налить|сходи|умойся|вылож(?:и|ить)|переверни|перевернуть|выпиши|выписать|набросай|набросать|отправь|отправить|скопируй|создай|создать|протри|протереть|помой|помыть|вынеси|вынести|поставим|засеки|засечь|давай\s+(?:откроем|возьмём|возьмем|начнём|начнем|уберём|уберем|напишем|положим|сделаем|найдём|найдем)`,
)
/** Предложил конкретный шаг: кнопкой старта / планом или словами действия */
export const offersStep: Check = (r) =>
  r.tools.some((t) => t.name === 'startFocus' || t.name === 'savePlan') || PHYSICAL.test(r.text) ? null : 'не предложил конкретного шага'

/** Не больше n предложений (реплика кота 1–3 предложения) */
export const maxSentences =
  (n: number): Check =>
  (r) => {
    const count = r.text.split(/(?<=[.!?…])\s+/).filter((s) => /\p{L}/u.test(s)).length
    return count > n ? `слишком длинно: ${count} предложений` : null
  }

export const maxChars =
  (n: number): Check =>
  (r) =>
    r.text.length > n ? `длиннее ${n} символов (${r.text.length})` : null

// ── инструменты ──────────────────────────────────────────────────────────────────────────────────────────────

export const memoryCalls = (r: Reply) => r.tools.filter((t) => t.name === 'memory')
export const noTools: Check = (r) => (r.tools.length ? `лишний вызов: ${r.tools.map((t) => `${t.name}${t.input.op ? `:${t.input.op}` : ''}`).join(', ')}` : null)
export const noMemoryWrites: Check = (r) => {
  const w = memoryCalls(r)
  return w.length ? `изменил память: ${w.map((c) => JSON.stringify(c.input)).join('; ')}` : null
}
export const calls =
  (name: string, pred: (input: Record<string, unknown>) => boolean = () => true, why = `нет вызова ${name}`): Check =>
  (r) =>
    r.tools.some((t) => t.name === name && pred(t.input)) ? null : `${why}; вызовы: ${JSON.stringify(r.tools)}`
export const notCalls =
  (name: string): Check =>
  (r) =>
    r.tools.some((t) => t.name === name) ? `не должен был звать ${name}` : null
export const mustNot =
  (re: RegExp, what = 'запрещённое'): Check =>
  (r) => {
    const m = re.exec(r.text)
    return m ? `${what}: «${m[0]}»` : null
  }
export const must =
  (re: RegExp, what: string): Check =>
  (r) =>
    re.test(r.text) ? null : what

// ── дробление ────────────────────────────────────────────────────────────────────────────────────────────────

// первое слово шага — глагол: инфинитив или повелительное (Открыть / Открой / Встань)
const VERB = /^(?:\p{L}+(?:ть|ти|чь)(?:ся|сь)?|\p{L}+(?:й|йте|и|ите|ь|ьте)(?:сь|ся)?)$/iu
export const threeSteps: Check = (r) => {
  const s = r.steps
  if (!s || s.length !== 3) return `нет трёх шагов: ${JSON.stringify(s)}`
  if (new Set(s.map((x) => x.toLowerCase())).size !== 3) return 'шаги повторяются'
  const first = s[0].split(/\s+/)
  if (first.length > 6) return `первый шаг длинный: «${s[0]}»`
  if (!VERB.test(first[0].replace(/[^\p{L}]/gu, ''))) return `первый шаг не с глагола: «${s[0]}»`
  if (!s.every((x) => /\p{Script=Cyrillic}/u.test(x))) return 'шаг не по-русски'
  return null
}
export const fromModel: Check = (r) => (r.source === 'model' ? null : `заготовка вместо шагов модели (${r.source})`)

// ── выжимка ──────────────────────────────────────────────────────────────────────────────────────────────────

export const opsMatch =
  (re: RegExp, what: string): Check =>
  (r) =>
    (r.ops ?? []).some((o) => o.op !== 'forget' && re.test(o.text ?? '')) ? null : `${what}: ${JSON.stringify(r.ops)}`
export const opsAvoid =
  (re: RegExp, what: string): Check =>
  (r) => {
    const bad = (r.ops ?? []).find((o) => re.test(o.text ?? ''))
    return bad ? `${what}: ${JSON.stringify(bad)}` : null
  }
export const noOps: Check = (r) => ((r.ops ?? []).length ? `лишнее: ${JSON.stringify(r.ops)}` : null)
export const opsClean: Check = (r) => {
  const bad = (r.ops ?? []).find((o) => o.text && factRejection(o.text) !== null)
  return bad ? `запрещённое: ${JSON.stringify(bad)}` : null
}
