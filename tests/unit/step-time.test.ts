import { describe, expect, it } from 'vitest'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'
import { GOBLIN_MINUTES } from '@/lib/ai/agents/breakdown-minutes'
import { estimateDeal, estimateStep } from '@/lib/ai/agents/step-time'
import { readyPlan } from '@/lib/ai/agents/breakdown'

describe('база времени шагов (оценено вручную 18.11)', () => {
  it('у каждого готового плана есть минуты на каждый шаг', () => {
    const missing = Object.entries(GOBLIN_PLANS).filter(([t, s]) => GOBLIN_MINUTES[t]?.length !== s.length).map(([t]) => t)
    expect(missing).toEqual([])
    for (const m of Object.values(GOBLIN_MINUTES)) for (const x of m) expect(Number.isInteger(x) && x >= 1 && x <= 525600).toBe(true)
  })
  it('план из базы приходит со временем шагов', () => {
    const hit = readyPlan('Постирать бельё')
    expect(hit?.value.minutes).toEqual([...GOBLIN_MINUTES['Постирать бельё']])
  })
  it('ожидание считается целиком: стирка — час, а не минута на кнопку', () => {
    expect(GOBLIN_MINUTES['Постирать бельё'][4]).toBeGreaterThanOrEqual(45)
  })
})

describe('оценка любого шага по самому похожему шагу базы', () => {
  it('дело из базы — ровно его ручные минуты, даже с опечаткой в названии не теряется по шагам', () => {
    const steps = [...GOBLIN_PLANS['Помыть посуду']]
    expect(estimateDeal('Помыть посуду', steps)).toEqual([...GOBLIN_MINUTES['Помыть посуду']])
  })
  it('шаг не из базы получает правдоподобное время', () => {
    expect(estimateStep('Запустить стирку', 'Постирать шторы')).toBeGreaterThanOrEqual(30)
    expect(estimateStep('Набрать номер банка', 'Позвонить в банк')).toBeLessThanOrEqual(5)
    expect(estimateStep('Погладить штанины с двух сторон', 'Погладить джинсы')).toBeLessThanOrEqual(10)
  })
  it('пустой или непонятный шаг — без падения, время есть всегда', () => {
    expect(estimateStep('')).toBeGreaterThan(0)
    expect(estimateStep('ыыыы ффф')).toBeGreaterThan(0)
  })
  it('точность вслепую: оценка без своего плана в пределах ×2 у большинства шагов выборки', () => {
    let ok = 0
    let n = 0
    const titles = Object.keys(GOBLIN_PLANS).filter((_, i) => i % 20 === 0)
    for (const t of titles)
      GOBLIN_PLANS[t].forEach((s, i) => {
        n++
        if (Math.abs(Math.log2(estimateStep(s, t, t) / GOBLIN_MINUTES[t][i])) <= 1) ok++
      })
    // 10 минут на всё — 42 %; оценщик по базе — около 62 %
    expect(ok / n).toBeGreaterThan(0.55)
  })
})
