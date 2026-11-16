import { describe, expect, it } from 'vitest'
import { GOBLIN_PLANS, goblinPlan } from '@/lib/ai/agents/breakdown-goblin'
import { breakdown } from '@/lib/ai/agents/breakdown'

describe('готовые разбивки goblin.tools (дословно, владелец 16.11)', () => {
  it('дело ровно как в списке — план сразу, без учёта регистра, «ё» и знаков', () => {
    expect(goblinPlan('Помыть посуду')?.[0]).toBe('Собрать всю грязную посуду')
    expect(goblinPlan('  помыть посуду!! ')).toEqual(goblinPlan('Помыть посуду'))
    expect(goblinPlan('постирать белье')).toEqual(GOBLIN_PLANS['Постирать бельё'])
  })
  it('другое дело или дело с добавкой — не готовое (его пишет модель)', () => {
    expect(goblinPlan('помыть посуду после гостей')).toBeNull()
    expect(goblinPlan('посуда')).toBeNull()
    expect(goblinPlan('помыть посду')).toBeNull()
  })
  it('каждый план — 4–13 непустых шагов без точки в конце', () => {
    for (const [task, steps] of Object.entries(GOBLIN_PLANS)) {
      expect(steps.length, task).toBeGreaterThanOrEqual(4)
      expect(steps.length, task).toBeLessThanOrEqual(13)
      for (const s of steps) expect(s.trim() && !s.endsWith('.'), `${task}: ${s}`).toBeTruthy()
    }
  })
  it('breakdown отдаёт готовый план без модели', async () => {
    const r = await breakdown({ task: 'Вынести мусор' })
    expect(r).toEqual({ kind: 'steps', steps: [...GOBLIN_PLANS['Вынести мусор']], source: 'library' })
  })
  it('«мельче», «мало сил» и шаг внутри дела — не готовый план, а модель', async () => {
    for (const context of [{ 'Размер шагов': 'мельче' }, { 'Силы сейчас': 'мало' }, { 'Это часть дела': 'Убраться в комнате' }]) {
      const r = await breakdown({ task: 'Вынести мусор', context, timeoutMs: 50 })
      expect(r.kind === 'steps' && r.source, JSON.stringify(context)).not.toBe('library')
    }
  })
})
