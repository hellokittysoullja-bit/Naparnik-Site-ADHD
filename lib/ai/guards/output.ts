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
  word(String.raw`(?:прими|принять|пей|выпей|брось|бросить|отмени|отменить|увеличь|уменьши)\s+(?:${L}+\s+)?(?:таблетк|лекарств|препарат|антидепрессант)`),
]

// Английские слова в русской реплике (замер 11.11: DeepSeek выдал «всё, что туда не belongs»)
const LATIN_WORD = /(?<![a-z])[a-z]{3,}(?![a-z])/i

export type OutputVerdict = { ok: true } | { ok: false; reason: 'shame' | 'medical' | 'language' | 'empty' | 'length' }

export function checkOutput(text: string, opts: { maxChars: number }): OutputVerdict {
  const t = text.trim()
  if (!t) return { ok: false, reason: 'empty' }
  if (t.length > opts.maxChars) return { ok: false, reason: 'length' }
  if (MEDICAL.some((r) => r.test(t))) return { ok: false, reason: 'medical' }
  if (SHAME.some((r) => r.test(t))) return { ok: false, reason: 'shame' }
  if (LATIN_WORD.test(t)) return { ok: false, reason: 'language' }
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
