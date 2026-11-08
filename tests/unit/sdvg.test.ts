import { describe, expect, it } from 'vitest'
import { asrsBand, asrsScore, clampStep, procType, readState, stateHash, stateQuery, shadedFrom, typeFromSlug, TYPE_SLUG } from '@/lib/sdvg'

describe('подсчёт Harvard 0–24', () => {
  it('сумма 0–4 за пункт и четыре диапазона с порогом 14', () => {
    expect(asrsScore([0, 0, 0, 0, 0, 0])).toBe(0)
    expect(asrsScore([4, 4, 4, 4, 4, 4])).toBe(24)
    expect([0, 9, 10, 13, 14, 17, 18, 24].map(asrsBand)).toEqual(['low', 'low', 'below', 'below', 'above', 'above', 'high', 'high'])
  })
  it('штриховка бланка: пункты 1–3 с «Иногда», 4–6 с «Часто»', () => {
    expect([0, 1, 2, 3, 4, 5].map(shadedFrom)).toEqual([2, 2, 2, 3, 3, 3])
  })
})

describe('тип прокрастинации', () => {
  it('самый частый ответ; при равенстве — ответ на первый вопрос', () => {
    expect(procType(['P', 'H', 'H', 'U'])).toBe('H')
    expect(procType(['M', 'P', 'P', 'M'])).toBe('M')
    expect(procType(['U', 'P', 'H', 'M'])).toBe('U')
    expect(procType([])).toBeNull()
  })
  it('адреса типов латиницей и обратно', () => {
    for (const [t, slug] of Object.entries(TYPE_SLUG)) {
      expect(slug).toMatch(/^[a-z-]+$/)
      expect(typeFromSlug(slug)).toBe(t)
    }
  })
})

describe('приватность адреса', () => {
  const state = { step: 'q2' as const, adult: true, asrs: [4, 3, 2, 1, 0, 4], l2: ['P' as const], sphere: null }
  it('ответы ВОЗ — только во фрагменте, в обычной части — шаг, возраст, слой 2 и метки', () => {
    const q = stateQuery(state, '?src=reel-1&step=old')
    expect(q).toBe('step=q2&adult=1&l=P&src=reel-1')
    expect(q).not.toMatch(/a=|432104/)
    expect(stateHash(state)).toBe('#a=432104')
  })
  it('состояние из адреса восстанавливается, мусор отбрасывается', () => {
    const s = readState('?step=q2&adult=1&l=PX', '#a=4321049')
    expect(s.asrs).toEqual([4, 3, 2, 1, 0, 4])
    expect(s.l2).toEqual(['P'])
    expect(s.step).toBe('q2')
  })
  it('по ссылке нельзя перепрыгнуть к результату без ответов', () => {
    expect(readState('?step=result&adult=1', '#a=12').step).toBe('a3')
    expect(clampStep('result', { step: 'result', adult: null, asrs: [], l2: [], sphere: null })).toBe('age')
    expect(readState('?step=q1&adult=0', '').step).toBe('q1')
  })
})
