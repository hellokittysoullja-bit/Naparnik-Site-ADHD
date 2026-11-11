import type { KnowledgeCard } from './types'

/**
 * Каталог знаний кота. ПУСТ НАМЕРЕННО: что кот знает — решение владельца (цель 11.11: «про знания — спросить»).
 * Каждая карточка добавляется только после его «да» на список приёмов из knowledge/techniques.md.
 * Механизм отбора и подачи (select.ts, prompt/assemble.ts) работает и проверен тестами на карточках-образцах.
 */
export const KNOWLEDGE: readonly KnowledgeCard[] = []
