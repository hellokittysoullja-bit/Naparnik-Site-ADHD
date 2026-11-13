import { describe, expect, it } from 'vitest'
import { breakHref, findsLabel, homeChips, homeExample, homeFallbackTask, homeHint, homeSphere } from '@/lib/home-step'

describe('Дом: строка над кнопкой по двум ответам знакомства', () => {
  it('оба ответа — своя строка из 25', () => {
    expect(homeHint({ blocker: 'fear', motive: 'rest' })).toBe('Сделай криво, и вечер будет твоим')
    expect(homeHint({ blocker: 'phone', motive: 'people' })).toBe('Телефон подождёт, а близкий человек ждёт дольше')
    expect(homeHint({ blocker: 'tired', motive: 'proof' })).toBe('Даже открыть уже считается')
  })
  it('все 25 строк разные, без тире, без «надо» и без стыда', () => {
    const lines = ['where', 'phone', 'fear', 'boring', 'tired'].flatMap((b) => ['relief', 'people', 'safety', 'rest', 'proof'].map((m) => homeHint({ blocker: b, motive: m })))
    expect(new Set(lines).size).toBe(25)
    for (const l of lines) expect(l).not.toMatch(/[—–]|надо|должен|обязан|опять|ленив/)
  })
  it('один ответ — строка по нему; знакомства нет, ответы чужого формата или их забыли — общая строка, но не пусто', () => {
    expect(homeHint({ motive: 'safety' })).toBe('Чтобы быть в спокойствии')
    expect(homeHint({ blocker: 'boring' })).toBe('Всего 2 минуты, потом решишь, продолжать ли')
    expect(homeHint(null)).toBe('Можно криво. Сначала просто начнём')
    expect(homeHint({ blocker: 'чужое', motive: 'тоже' })).toBe('Можно криво. Сначала просто начнём')
  })
})

describe('Дом: подсказки сфер, кнопка, находки', () => {
  it('Учёба, Работа, Дом; «Написать» вместо «Дом» тем, кто его выбрал', () => {
    expect(homeChips(null).map((c) => c.label)).toEqual(['Учёба', 'Работа', 'Дом'])
    expect(homeChips({ sphere: 'message' }).map((c) => c.label)).toEqual(['Учёба', 'Работа', 'Написать'])
  })
  it('«Разломать на шаг» ведёт в Фокус с делом и сразу запущенным дроблением', () => {
    expect(breakHref('Открыть файл')).toBe('/app/session?step=%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C+%D1%84%D0%B0%D0%B9%D0%BB&break=1')
    expect(breakHref('x'.repeat(300))).toMatch(/^\/app\/session\?step=x{120}&break=1$/)
  })
  it('ответы знакомства на Доме: подсвеченная сфера, пример в поле, дело для пустого поля', () => {
    expect(homeSphere({ sphere: 'study' })).toBe('study')
    expect(homeSphere({ sphere: 'unsure' })).toBeNull()
    expect(homeSphere(null)).toBeNull()
    expect(homeExample('study')).toMatch(/реферат/)
    expect(homeFallbackTask('study', { blocker: 'where' }).length).toBeGreaterThan(5)
    expect(homeFallbackTask(null, null).length).toBeGreaterThan(5)
  })
  it('падежи находок', () => {
    expect([1, 2, 5, 11, 21, 104].map(findsLabel)).toEqual(['1 находка', '2 находки', '5 находок', '11 находок', '21 находка', '104 находки'])
  })
})
