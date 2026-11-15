import { describe, expect, test } from 'vitest'
import { factRejection } from '@/lib/ai/memory/write-guard'
import { ASK_FACT } from '@/lib/asks'
import { parseSteps, parseStepsWithMinutes } from '@/lib/ai/agents/breakdown'
import { ALL_TEMPLATES, findTemplate, TEMPLATE_GROUPS } from '@/lib/templates'
import { dealIcon, splitDump } from '@/lib/deals'
import { PAINS } from '@/content/pains.ru'

describe('просьбы к коту', () => {
  test('каждая готовая просьба проходит проверку фактов памяти: иначе сервер молча выбросил бы её из промпта', () => {
    for (const [key, fact] of Object.entries(ASK_FACT)) expect([key, factRejection(fact)]).toEqual([key, null])
  })
})

describe('оценка шага в минутах', () => {
  test('«шаг | минуты» и «шаг (N мин)» разбираются, шаг остаётся без хвоста', () => {
    expect(parseStepsWithMinutes('Открыть документ | 1\nНаписать заголовок | 2\nНабросать план (5 мин)')).toEqual({
      steps: ['Открыть документ', 'Написать заголовок', 'Набросать план'],
      minutes: [1, 2, 5],
    })
  })
  test('модель не дала минут — шаги те же, что раньше, оценки нет', () => {
    const text = '1. Открыть документ\n2. Написать заголовок\n3. Набросать план'
    expect(parseStepsWithMinutes(text)).toEqual({ steps: parseSteps(text), minutes: [undefined, undefined, undefined] })
  })
  test('нелепая оценка (0 или больше часа) не показывается', () => {
    expect(parseStepsWithMinutes('Открыть документ | 0\nНаписать заголовок | 99\nНабросать план | 3')?.minutes).toEqual([undefined, undefined, 3])
  })
})

describe('готовые дела', () => {
  test('у каждого дела первый шаг не дольше двух минут, шаг не длиннее восьми слов, название уникально', () => {
    const titles = new Set<string>()
    for (const t of ALL_TEMPLATES) {
      expect(titles.has(t.title), t.title).toBe(false)
      titles.add(t.title)
      expect(t.steps.length, t.title).toBeGreaterThanOrEqual(4)
      expect(t.steps[0].minutes, t.title).toBeLessThanOrEqual(2)
      for (const s of t.steps) expect(s.text.split(/\s+/).length, `${t.title}: ${s.text}`).toBeLessThanOrEqual(8)
    }
    expect(TEMPLATE_GROUPS.length).toBe(3)
  })
  test('в текстах шагов нет тире: шаг читает кот', () => {
    for (const t of ALL_TEMPLATES) for (const s of t.steps) expect(s.text).not.toMatch(/[—–]/)
  })
  test('дело из поля, совпавшее с готовым, находится без учёта регистра и «ё»', () => {
    expect(findTemplate('помыть посуду')?.key).toBe('dishes')
    expect(findTemplate('  Передать показания счетчиков ')?.key).toBe('meters')
    expect(findTemplate('Курсовая по логистике')).toBeNull()
  })
})

describe('вывали всё', () => {
  test('запятые, «ещё», «потом» и переносы делят строку на дела; вводные слова уходят; с заглавной буквы', () => {
    expect(splitDump('надо отчёт для Марины, записаться на стрижку, ещё оплатить интернет')).toEqual(['Отчёт для Марины', 'Записаться на стрижку', 'Оплатить интернет'])
    expect(splitDump('позвонить маме потом купить корм\nвынести мусор')).toEqual(['Позвонить маме', 'Купить корм', 'Вынести мусор'])
  })
  test('одно дело остаётся одним; не больше восьми', () => {
    expect(splitDump('Курсовая по логистике')).toEqual(['Курсовая по логистике'])
    expect(splitDump('а1, а2, а3, а4, а5, а6, а7, а8, а9, а10')).toHaveLength(8)
  })
  test('значок дела подбирается по словам, неизвестное дело получает общий', () => {
    expect(dealIcon('Записаться к врачу')).toBe('stethoscope')
    expect(dealIcon('Помыть посуду')).toBe('utensils')
    expect(dealIcon('Что-то странное')).toBe('spark')
  })
})

describe('каталог «боль → приём»', () => {
  test('шесть болей, у каждой три приёма, адрес и снимок; ссылки ведут внутрь продукта', () => {
    expect(PAINS).toHaveLength(6)
    expect(new Set(PAINS.map((p) => p.slug)).size).toBe(6)
    for (const p of PAINS) {
      expect(p.helps, p.slug).toHaveLength(3)
      expect(p.href.startsWith('/app/'), p.slug).toBe(true)
      expect(p.slug).toMatch(/^[a-z-]+$/)
    }
  })
  test('без диагнозов и обещаний результата (красные линии 2 и 7)', () => {
    const all = JSON.stringify(PAINS).toLowerCase()
    for (const w of ['сдвг', 'диагноз', 'вылеч', 'доказан', 'гарантир', 'лень']) expect(all, w).not.toContain(w)
  })
})
