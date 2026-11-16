import { describe, expect, it } from 'vitest'
import { breakable, BREAK_MIN } from '@/lib/break-task'
import { parseBreakdownAnswer } from '@/lib/ai/agents/breakdown'

// 16.11: одно правило разламывания на весь продукт (Дом, Фокус, «Дела», «Не могу начать», сервер)
describe('breakable', () => {
  it('понятное короткое дело разламывается, порог тот же, что у сервера', () => {
    expect(BREAK_MIN).toBe(3)
    for (const t of ['пол', 'почта', 'Курсовая по логистике', '  отчёт  ']) expect(breakable(t)).toBe(true)
  })
  it('то, что нечем разламывать, — нет', () => {
    for (const t of ['', '  ', 'Hh', 'ок', '2+2', '...', '1 2 3']) expect(breakable(t)).toBe(false)
  })
})

describe('parseBreakdownAnswer', () => {
  it('«?» модели — дело не понято, а не шаги', () => {
    for (const t of ['?', ' ? ', '«?»', '**?**']) expect(parseBreakdownAnswer(t)).toEqual({ kind: 'unclear' })
  })
  it('три шага с оценками — шаги', () => {
    expect(parseBreakdownAnswer('Открыть почту | 1\nНайти письмо | 2\nОтветить фразой | 3')).toEqual({
      kind: 'steps',
      steps: ['Открыть почту', 'Найти письмо', 'Ответить фразой'],
      minutes: [1, 2, 3],
      source: 'model',
    })
  })
  it('вопрос внутри текста — не «не понял»', () => {
    expect(parseBreakdownAnswer('Что именно висит?')).toBeNull()
  })
})
