/**
 * Проверка ответа модели до того, как его увидит человек (OpenAI Agents SDK: output guardrails, «растяжка»).
 * Нарушение → одна попытка следующей моделью цепочки, затем заготовленная реплика задачи. Правила — главное
 * обещание продукта: тон без стыда и вины, никаких медицинских советов, по-русски, коротко.
 */

// Стыд и давление. «не» перед словом — это как раз поддержка («ты не ленивый»), её не трогаем.
const SHAME = [
  /(?<!не\s)(?<!не\s\S{0,12}\s)\b(ленив|лентя|бездельн)/i,
  /(?<!не\s)\bстыдн|позор/i,
  /надо\s+было\s+(раньше|сразу|давно)/i,
  /(?<!не\s)\bдолж(ен|на)\s+был(а)?\b/i,
  /соберись|возьми\s+себя\s+в\s+руки/i,
  /постарайся|старайся\s+лучше/i,
  /дисциплин/i,
  /опять\s+ничего\s+не\s+сделал/i,
]

// Медицина: препараты и дозы — только врач. Кот может сказать «это вопрос к врачу», но не советовать.
const MEDICAL = [
  /метилфенидат|атомоксетин|риталин|страттер|аддерол|концерт[аы]\b|элванс|лисдексамфетамин|модафинил/i,
  /\b\d+\s*(мг|mg)\b|дозировк|дозу\b/i,
  /(прими|принять|пей|выпей|брось|бросить|отмени|отменить|увеличь|уменьши)\s+\S*\s*(таблетк|лекарств|препарат|антидепрессант)/i,
]

// Английские слова в русской реплике (замер 11.11: DeepSeek выдал «всё, что туда не belongs»)
const LATIN_WORD = /\b[a-z]{3,}\b/i

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
