import { describe, expect, it } from 'vitest'
import { parseOneStep, toImperative, POOL } from '@/lib/ai/agents/one-step'
import { brightnessOf, fireDaysThisWeek, levelOf, litLine } from '@/lib/fire'

describe('один шаг «Не могу начать» (владелец 22.11)', () => {
  it('ответ модели: одна строка «шаг | секунды», время не больше ступени', () => {
    expect(parseOneStep('Открой файл диплома и напиши заголовок первой главы | 90', 0)).toEqual({ step: 'Открой файл диплома и напиши заголовок первой главы.', seconds: 90 })
    expect(parseOneStep('Открой файл | 300', 1)?.seconds).toBe(30)
  })
  it('запрещённые слова, длиннее 12 слов и вопросы — мимо', () => {
    expect(parseOneStep('Подумай, с чего начать | 60', 0)).toBeNull()
    expect(parseOneStep('Тебе нужно открыть файл | 60', 0)).toBeNull()
    expect(parseOneStep('Открой файл и потом напиши заголовок и потом ещё одну строчку текста для начала | 60', 0)).toBeNull()
  })
  it('восклицательных призывов нет: «!» становится точкой', () => {
    expect(parseOneStep('Открой файл! | 30', 1)?.step).toBe('Открой файл.')
  })
  it('шаг базы на «ты»: все глаголы, а не только первый; иначе мимо', () => {
    expect(toImperative('Открыть почту и прочитать новые письма')).toBe('Открой почту и прочитай новые письма.')
    expect(toImperative('Собрать и изучить литературу')).toBeNull()
    expect(toImperative('Позвонить или оформить запись')).toBeNull()
  })
  it('последняя ступень лестницы есть у каждой ситуации и кончается «Всё.»', () => {
    for (const s of Object.values(POOL)) expect(s[2]).toMatch(/^Просто .+ Всё\.$/)
  })
})

describe('огонь на хвосте', () => {
  it('уровни по сумме начатых дел, никогда не падают', () => {
    expect(levelOf(0)).toBeNull()
    expect(levelOf(1)).toBe('Искра')
    expect(levelOf(10)).toBe('Огонёк')
    expect(levelOf(37)).toBe('Пламя')
    expect(levelOf(75)).toBe('Костёр')
    expect(levelOf(500)).toBe('Феникс')
    expect(litLine(37)).toBe('Подожжено: 37 · Пламя')
  })
  it('яркость тускнеет без дел, но не гаснет', () => {
    const now = new Date(2026, 10, 22)
    expect(brightnessOf([{ date: '2026-11-22' }], now)).toBe(1)
    expect(brightnessOf([{ date: '2026-10-01' }], now)).toBe(0.25)
  })
  it('огненные дни считаются с понедельника этой недели', () => {
    const sunday = new Date(2026, 10, 22)
    expect(fireDaysThisWeek([{ date: '2026-11-16' }, { date: '2026-11-16' }, { date: '2026-11-20' }, { date: '2026-11-15' }], sunday)).toBe(2)
  })
})
