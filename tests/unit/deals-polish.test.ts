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

import { formatDuration, stepsCount } from '@/lib/deals'
import { parseEstimate } from '@/lib/ai/agents/estimate'

describe('«Оценить»: время по-русски и разбор ответа модели', () => {
  it('время как у goblin.tools, только по-русски', () => {
    expect([1, 2, 5, 10, 21, 60, 117, 125, 180, 1440, 4800].map(formatDuration)).toEqual([
      '1 минута', '2 минуты', '5 минут', '10 минут', '21 минута', '1 час', '1 час 57 минут', '2 часа 5 минут', '3 часа', '1 день', '3 дня и 8 часов',
    ])
    expect(stepsCount(3)).toBe('3 шага')
  })
  it('столбик чисел по числу шагов; иначе — негоден', () => {
    expect(parseEstimate('10\n15\n2', 3)).toEqual([10, 15, 2])
    expect(parseEstimate('1. 10\n2. 15 минут', 2)).toEqual([10, 15])
    expect(parseEstimate('10\n15', 3)).toBeNull()
    expect(parseEstimate('10\nне знаю', 2)).toBeNull()
    expect(parseEstimate('0\n5', 2)).toBeNull()
  })
})
