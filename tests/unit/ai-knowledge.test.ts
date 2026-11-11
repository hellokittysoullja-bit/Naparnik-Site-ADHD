import { describe, expect, it } from 'vitest'
import { KNOWLEDGE } from '@/lib/ai/knowledge/catalog'
import { renderKnowledge, selectKnowledge } from '@/lib/ai/knowledge/select'
import type { KnowledgeCard } from '@/lib/ai/knowledge/types'
import { assemble } from '@/lib/ai/prompt/assemble'

// карточки-образцы для проверки механизма; настоящий каталог пуст до утверждения владельцем
const card = (id: string, cues: string[], strength: 1 | 2 | 3): KnowledgeCard => ({ id, title: id, cues, text: `текст ${id}`, strength })
const SAMPLE = [card('A', ['начать', 'не могу'], 2), card('B', ['не могу'], 3), card('C', ['уборк'], 1)]

describe('слой знаний (Hermes skills: индекс + загрузка по требованию)', () => {
  it('каталог пуст до решения владельца — кот ведёт себя как раньше', () => {
    expect(KNOWLEDGE).toHaveLength(0)
    expect(renderKnowledge(selectKnowledge(KNOWLEDGE, ['не могу начать']))).toBeUndefined()
  })
  it('отбор: больше совпадений → выше; при равенстве — сильнее доказательства; не больше двух', () => {
    expect(selectKnowledge(SAMPLE, ['Не могу НАЧАТЬ отчёт']).map((c) => c.id)).toEqual(['A', 'B'])
    expect(selectKnowledge(SAMPLE, ['не могу']).map((c) => c.id)).toEqual(['B', 'A'])
    expect(selectKnowledge(SAMPLE, ['привет'])).toEqual([])
  })
  it('знания идут сообщением перед последней репликой, не в систему', () => {
    const k = renderKnowledge(selectKnowledge(SAMPLE, ['уборка']))!
    const r = assemble({ taskSystem: 'X', knowledge: k, situation: 'S', conversation: [{ role: 'user', content: 'уборка' }] })
    expect(r.instructions).not.toContain('текст C')
    expect(r.messages.map((m) => m.content)).toEqual([k, 'S', 'уборка'])
  })
})
