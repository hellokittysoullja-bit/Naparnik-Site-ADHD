import { describe, expect, it } from 'vitest'
import { dealsCount } from '@/lib/deals'
import { strikeVariant } from '@/components/step-check'

describe('«Дела»: подписи и черта', () => {
  it('«N дел» склоняется', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 20, 21, 22, 25, 101, 111].map(dealsCount)).toEqual([
      '1 дело', '2 дела', '4 дела', '5 дел', '11 дел', '12 дел', '14 дел', '20 дел', '21 дело', '22 дела', '25 дел', '101 дело', '111 дел',
    ])
  })
  it('почерк черты постоянный для шага и разный у разных шагов', () => {
    const steps = ['Открыть письмо', 'Почистить зубы', 'Выйти из туалета', 'Поставить таймер на 10 минут', 'Убрать телефон', 'Сделать первый шаг', 'Выпить стакан воды', 'Записать причины', 'Позвонить маме', 'Помыть одну тарелку', 'Лечь', 'Открыть ноутбук']
    expect(strikeVariant('Открыть письмо')).toBe(strikeVariant('Открыть письмо'))
    const used = new Set(steps.map(strikeVariant))
    expect(used.size).toBe(4)
  })
})
