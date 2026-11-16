import { describe, expect, it } from 'vitest'
import { breakable, BREAK_MIN } from '@/lib/break-task'
import { parseBreakdownAnswer, parsePlan, PLAN_MAX } from '@/lib/ai/agents/breakdown'

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

// 16.11, владелец: «разбивка как у goblin.tools» — весь путь до конца дела, а не три шага на старт
describe('parsePlan', () => {
  it('план до конца: все шаги, минуты, «пока ждёшь», без нумерации и вступления', () => {
    const text = [
      'Вот план:',
      '1. Собрать грязное бельё в корзину | 3',
      '2. Загрузить бельё в машинку | 2',
      '3. Засыпать порошок и включить стирку | 2',
      '4. Пока ждёшь: протереть полку в ванной | 5',
      '5. Развесить бельё на сушилке | 10',
      '6. Сложить сухое бельё в шкаф | 10',
    ].join('\n')
    expect(parseBreakdownAnswer(text)).toEqual({
      kind: 'steps',
      steps: [
        'Собрать грязное бельё в корзину',
        'Загрузить бельё в машинку',
        'Засыпать порошок и включить стирку',
        'Протереть полку в ванной',
        'Развесить бельё на сушилке',
        'Сложить сухое бельё в шкаф',
      ],
      minutes: [3, 2, 2, 5, 10, 10],
      wait: [false, false, false, true, false, false],
      source: 'model',
    })
  })
  it('больше 12 шагов обрезается, повтор — один раз, меньше трёх — негодно', () => {
    const many = Array.from({ length: 15 }, (_, i) => `Сделать шаг номер ${i + 1}`).join('\n')
    expect(parsePlan(many)?.steps).toHaveLength(PLAN_MAX)
    expect(parsePlan('Открыть файл\nОткрыть файл\nНаписать заголовок\nСохранить')?.steps).toEqual(['Открыть файл', 'Написать заголовок', 'Сохранить'])
    expect(parsePlan('Открыть файл\nСохранить')).toBeNull()
  })
  it('абзац вместо шага — негодный ответ (уйдёт следующей модели)', () => {
    expect(parsePlan('Открыть файл\nСначала очень внимательно прочитай всё задание целиком и подумай над каждым пунктом\nСохранить')).toBeNull()
  })
})
