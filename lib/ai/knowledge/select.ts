import { forMatching } from '../guards/normalize'
import { dataBlock } from '../context'
import type { KnowledgeCard } from './types'

/**
 * Отбор знаний под ход — без модели и без векторной базы (research/20-ai-harness/memory-personalization.md:
 * лексическое совпадение для малых каталогов; позже — эмбеддинги в Postgres/pgvector). Порядок: число совпавших
 * сигналов → сила доказательств → порядок в каталоге (стабильно, кэш промпта не дрожит).
 */
export const KNOWLEDGE_LIMIT = 2

export function selectKnowledge(catalog: readonly KnowledgeCard[], texts: readonly string[], limit = KNOWLEDGE_LIMIT): KnowledgeCard[] {
  if (catalog.length === 0) return []
  const hay = forMatching(texts.join('\n'))
  return catalog
    .map((card, order) => ({ card, order, hits: card.cues.filter((c) => hay.includes(forMatching(c))).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.card.strength - a.card.strength || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.card)
}

/**
 * Знания — блоком данных в сообщении (ярус «контекст», prompt/assemble.ts), не в системе: система остаётся одной
 * для всех, а знание подаётся тому ходу, которому оно нужно. Текст карточек — наш, но формат тот же, что у
 * данных: одна граница для всего, что меняется от хода к ходу.
 */
export function renderKnowledge(cards: readonly KnowledgeCard[]): string | undefined {
  if (cards.length === 0) return undefined
  return dataBlock('knowledge', Object.fromEntries(cards.map((c) => [c.title, c.text])), 600)
}
