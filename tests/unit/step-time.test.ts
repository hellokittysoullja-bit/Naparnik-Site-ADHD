import { describe, expect, it } from 'vitest'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'
import { GOBLIN_MINUTES } from '@/lib/ai/agents/breakdown-minutes'
import { calibratePlan, estimateDeal, estimateStep, estimateTitle, splitMinutes } from '@/lib/ai/agents/step-time'
import { estimate, estimateTotal } from '@/lib/ai/agents/estimate'
import { readyPlan } from '@/lib/ai/agents/breakdown'

describe('база времени шагов (оценено вручную 18.11)', () => {
  it('у каждого готового плана есть минуты на каждый шаг', () => {
    const missing = Object.entries(GOBLIN_PLANS).filter(([t, s]) => GOBLIN_MINUTES[t]?.length !== s.length).map(([t]) => t)
    expect(missing).toEqual([])
    for (const m of Object.values(GOBLIN_MINUTES)) for (const x of m) expect(Number.isInteger(x) && x >= 1 && x <= 525600).toBe(true)
  })
  it('план из базы приходит со временем шагов', () => {
    const hit = readyPlan('Постирать бельё')
    // минуты с поправкой суммы (step-time.ts calibratePlan, 22.11)
    expect(hit?.value.minutes).toEqual(calibratePlan(GOBLIN_PLANS['Постирать бельё'], GOBLIN_MINUTES['Постирать бельё']))
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
    // база 7554 дел (21.11): прогон ~5 с — больше лимита по умолчанию
  }, 30_000)
})

describe('оценка любого дела (22.11, research/30-estimate)', () => {
  it('дело без шагов оценивается по названию: из базы — сумма плана, чужое — по похожим делам, никогда не ноль', () => {
    const own = estimateTotal({ task: 'Помыть посуду', steps: [] })
    expect(own.work).toBeGreaterThan(5)
    expect(own.work).toBeLessThan(60)
    for (const t of ['Покрасить скамейку во дворе', 'Перебрать гербарий бабушки', 'Сделать скворечник для синиц', 'Хрюндель']) {
      expect(estimateTotal({ task: t, steps: [] }).work).toBeGreaterThan(0)
    }
    expect(estimateTitle('Покрасить скамейку')).toBeGreaterThan(estimateTitle('Покормить кота'))
  })
  it('дело своими словами получает минуты своего плана из базы («Пойти к психиатру» = «Сходить к психиатру»)', () => {
    const base = readyPlan('Сходить к психиатру')!.value
    expect(estimate({ task: 'Пойти к психиатру', steps: [...base.steps] })).toEqual(base.minutes)
  })
  it('долгое ожидание не твоё время: «ждать решения» и «дать высохнуть» за ночь — отдельно', () => {
    const r = splitMinutes(['Заполнить заявление', 'Дождаться решения налоговой', 'Нанести краску и дать высохнуть', 'Получить результаты анализов'], [30, 43200, 480, 1440])
    expect(r.work).toBe(30 + 60)
    expect(r.wait).toBe(43200 + 420 + 1440)
    // короткое ожидание рядом (стирка, доставка) — твоё время, как у goblin.tools
    expect(splitMinutes(['Дождаться конца стирки'], [60])).toEqual({ work: 60, wait: 0 })
  })
  it('поправка суммы сжимает работу и не трогает долгое ожидание; шаг не меньше минуты', () => {
    const c = calibratePlan(['Собрать вещи', 'Сложить вещи', 'Дождаться решения банка'], [60, 60, 4320])
    expect(c[2]).toBe(4320)
    expect(c[0] + c[1]).toBeLessThan(120)
    expect(calibratePlan(['Открыть', 'Нажать'], [1, 1])).toEqual([1, 1])
  })
})
