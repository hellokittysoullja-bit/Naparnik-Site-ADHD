import { describe, expect, it } from 'vitest'
import { catActivity } from '@/lib/cat-activity'

describe('чем занят кот в сессии (22.11)', () => {
  it('чтение и учёба — книга', () => {
    for (const t of ['Прочитать параграф', 'Выучить билеты', 'Сделать дз по истории', 'Подготовиться к экзамену', 'Читать книгу']) expect(catActivity(t)).toBe('book')
  })
  it('остальное — ноутбук', () => {
    for (const t of ['Написать отчёт', 'Ответить на письмо', 'Сделать презентацию', 'Помыть посуду']) expect(catActivity(t)).toBe('laptop')
  })
})
