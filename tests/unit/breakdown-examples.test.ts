import { describe, expect, it } from 'vitest'
import { EXEMPLARS, examplesBlock, pickExamples } from '@/lib/ai/agents/breakdown-examples'
import { parsePlan } from '@/lib/ai/agents/breakdown'
import { checkOutput } from '@/lib/ai/guards/output'

const pick = (t: string) => pickExamples(t).map((e) => e.task)

describe('библиотека эталонов разбивки', () => {
  it('каждый эталон — годный план: разбирается parsePlan целиком, минуты у каждого шага, кроме многодневных этапов', () => {
    for (const ex of EXEMPLARS) {
      const plan = parsePlan(ex.steps.join('\n'))
      expect(plan, ex.task).not.toBeNull()
      expect(plan!.steps.length, ex.task).toBe(ex.steps.length)
      plan!.minutes.forEach((m, i) => expect(typeof m === 'number' || !ex.steps[i].includes('|'), `${ex.task}: ${ex.steps[i]}`).toBe(true))
      expect(ex.steps.length, ex.task).toBeGreaterThanOrEqual(3)
      expect(ex.steps.length, ex.task).toBeLessThanOrEqual(8)
    }
  })

  it('шаги эталонов проходят проверку вывода: без латиницы, ссылок и стыда', () => {
    for (const ex of EXEMPLARS) expect(checkOutput(ex.steps.map((s) => s.split(' | ')[0]).join('\n'), { maxChars: 1100 }), ex.task).toEqual({ ok: true })
  })

  it('дела не повторяются', () => {
    const tasks = EXEMPLARS.map((e) => e.task.toLowerCase())
    expect(new Set(tasks).size).toBe(tasks.length)
  })

  it('находит своё дело по форме слова, опечатке и сленгу', () => {
    expect(pick('почистить зубы')[0]).toBe('Почистить зубы')
    expect(pick('записаться к зубному')[0]).toBe('Записаться к зубному')
    expect(pick('убратся')[0]).toBe('Убраться в комнате')
    expect(pick('посрать')[0]).toBe('Сходить в туалет')
    expect(pick('поебаться')[0]).toBe('Заняться сексом')
    expect(pick('хахахаха')[0]).toBe('Посмеяться')
    expect(pick('Сдклть видос в рилс')[0]).toBe('Сделать видео для рилс')
    expect(pick('го в зал')[0]).toBe('Сходить в зал')
  })

  it('не тянет чужое дело по общему началу слова или общему глаголу', () => {
    expect(pick('сдать кровь')).not.toContain('Встать с кровати')
    expect(pick('купить подарок маме')).not.toContain('Подать налоговый вычет')
    expect(pick('перестать тревожиться')).toEqual(['Успокоиться'])
    expect(pick('подготовиться к свадьбе')).toEqual(['Подготовиться к свадьбе'])
  })

  it('бессмыслица и незнакомое дело — без образцов', () => {
    for (const t of ['Hh', 'ывапрол', 'кккк', 'asdfgh', 'лол', 'моргнуть']) expect(examplesBlock(t), t).toBeUndefined()
  })

  it('блок образцов — не больше двух дел, с заголовком', () => {
    const block = examplesBlock('выучить английский')!
    expect(block.startsWith('ОБРАЗЦЫ')).toBe(true)
    expect(block.match(/^Дело: /gm)?.length).toBeLessThanOrEqual(2)
  })
})
