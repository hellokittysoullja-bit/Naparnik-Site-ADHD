/**
 * «Просьбы к коту» (приём goblin.tools Pro: «Set instructions once… and every tool follows them» — просьбу задают один
 * раз, ей следуют все инструменты; research/25-deep-teardowns/goblin-tools.md). У нас просьба уходит вместе с памятью
 * как факт темы «как говорить» (style): его читают чат, голос сессии и дробление (lib/ai/memory/render.ts).
 * Готовые варианты вместо свободного текста: свободное поле «указаний» — прямой путь для внедрения команд в промпт.
 * Хранится отдельно от фактов: выключить просьбу — не «забыть тему» (у забывания длинный хвост: переписка, архив, навыки).
 * Без зависимостей: модуль подключает lib/memory.ts, а он есть на каждой странице.
 */
export type AskKey = 'short' | 'literal' | 'nojokes' | 'nopraise' | 'tiny'

/** Только то, что уходит в память: этот модуль лежит в общем коде всех экранов /app (его подключает lib/memory.ts).
 *  Подписи для экрана — в components/breakdown-prefs.tsx, они грузятся вместе с листом настроек */
export const ASK_FACT: Record<AskKey, string> = {
  short: 'Просит отвечать совсем коротко, одной-двумя фразами',
  literal: 'Просит писать буквально, без намёков и образов',
  nojokes: 'Просит говорить без шуток, спокойно и по делу',
  nopraise: 'Просит не хвалить за каждую мелочь',
  tiny: 'Просит делать шаги совсем мелкими, на одну-две минуты',
}
const KEYS = Object.keys(ASK_FACT) as AskKey[]

const KEY = 'naparnik:asks'

export function activeAsks(): AskKey[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? KEYS.filter((k) => raw.includes(k)) : []
  } catch {
    return []
  }
}

export function setAsk(key: AskKey, on: boolean): AskKey[] {
  const next = KEYS.filter((k) => (k === key ? on : activeAsks().includes(k)))
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('naparnik:memory'))
  } catch {
    /* приватный режим: просьба живёт до перезагрузки не будет — честно вернём то, что есть */
    return activeAsks()
  }
  return next
}

/** Просьбы как факты «как говорить» для снимка памяти */
export function askFacts(): { category: 'style'; text: string }[] {
  return activeAsks().map((k) => ({ category: 'style' as const, text: ASK_FACT[k] }))
}
