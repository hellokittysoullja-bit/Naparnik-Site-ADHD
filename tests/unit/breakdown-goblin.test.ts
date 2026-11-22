import { describe, expect, it } from 'vitest'
import { GOBLIN_PLANS, goblinPlan } from '@/lib/ai/agents/breakdown-goblin'
import { breakdown } from '@/lib/ai/agents/breakdown'
import { GOBLIN_MINUTES } from '@/lib/ai/agents/breakdown-minutes'

describe('готовые разбивки goblin.tools (дословно, владелец 16.11)', () => {
  it('дело ровно как в списке — план сразу, без учёта регистра, «ё» и знаков', () => {
    expect(goblinPlan('Помыть посуду')?.[0]).toBe('Собрать всю грязную посуду')
    expect(goblinPlan('  помыть посуду!! ')).toEqual(goblinPlan('Помыть посуду'))
    expect(goblinPlan('постирать белье')).toEqual(GOBLIN_PLANS['Постирать бельё'])
  })
  it('другое дело или дело с добавкой — не готовое (его пишет модель)', () => {
    expect(goblinPlan('помыть посуду после ремонта')).toBeNull()
    expect(goblinPlan('посуда')).toBeNull()
    expect(goblinPlan('помыть посду')).toBeNull()
  })
  it('каждый план — от 2 до 18 непустых шагов без точки в конце (владелец 16.11: «точных мерок нет, по логике дела»)', () => {
    for (const [task, steps] of Object.entries(GOBLIN_PLANS)) {
      expect(steps.length, task).toBeGreaterThanOrEqual(2)
      expect(steps.length, task).toBeLessThanOrEqual(18)
      for (const s of steps) expect(s.trim() && !s.endsWith('.'), `${task}: ${s}`).toBeTruthy()
    }
  })
  it('при пересборке база не теряет дела: все 42 первых дела владельца на месте (16.11 13 из них выпали)', () => {
    const first = ['Успокоиться', 'Перестать прокрастинировать', 'Подготовиться к созвону', 'Разобрать документы', 'Позвонить в поликлинику', 'Позвонить маме', 'Записаться к зубному', 'Записаться к врачу', 'Оплатить штраф', 'Оплатить коммуналку', 'Забрать посылку', 'Почистить зубы', 'Поесть нормально', 'Сходить в спортзал', 'Сходить в зал', 'Выпить таблетки', 'Сделать зарядку', 'Лечь спать вовремя', 'Сходить в душ', 'Встать с кровати', 'Созвониться с клиентом', 'Написать пост для соцсетей', 'Ответить маме', 'Ответить подруге', 'Ответить другу', 'Ответить на письма', 'Написать эссе', 'Сделать презентацию', 'Написать отчет', 'Написать реферат', 'Написать курсовую', 'Выйти на улицу', 'Полить цветы', 'Почистить унитаз', 'Сделать порядок', 'Разобрать завал на столе', 'Пропылесосить', 'Помыть полы', 'Вынести мусор', 'Постирать бельё', 'Помыть посуду', 'Убраться в комнате']
    for (const k of first) expect(GOBLIN_PLANS[k], k).toBeDefined()
  })
  it('breakdown отдаёт готовый план без модели', async () => {
    const r = await breakdown({ task: 'Вынести мусор' })
    expect(r).toEqual({ kind: 'steps', steps: [...GOBLIN_PLANS['Вынести мусор']], minutes: [...GOBLIN_MINUTES['Вынести мусор']], source: 'library', title: 'Вынести мусор' })
  })
  it('наш шаблон из «Дел» (у гоблина такого дела нет) — тоже сразу, с минутами и «пока ждёшь»', async () => {
    const r = await breakdown({ task: 'убрать ванную' })
    expect(r).toMatchObject({ kind: 'steps', source: 'library', steps: expect.arrayContaining(['Достать средство и губку']) })
    expect(r.kind === 'steps' && r.wait?.some(Boolean)).toBe(true)
  })
  it('гоблин важнее шаблона с тем же названием (владелец 16.11)', async () => {
    const r = await breakdown({ task: 'Помыть посуду' })
    expect(r.kind === 'steps' && r.steps[0]).toBe(GOBLIN_PLANS['Помыть посуду'][0])
  })
  it('база одна везде (22.11): «мало сил» и размер шагов из настроек — тот же план из базы, что на Доме и в боте', async () => {
    for (const context of [{ 'Размер шагов': 'мельче' }, { 'Силы сейчас': 'мало' }, { Сфера: 'Дом', 'Что мешает': 'Нет сил' }]) {
      const r = await breakdown({ task: 'Вынести мусор', context, timeoutMs: 50 })
      expect(r, JSON.stringify(context)).toMatchObject({ kind: 'steps', source: 'library', steps: [...GOBLIN_PLANS['Вынести мусор']] })
    }
  })
  it('«Ещё мельче» — для всего дела и для шага внутри дела — не готовый план, а модель', async () => {
    for (const [context, again] of [[undefined, true], [{ 'Это часть дела': 'Убраться в комнате' }, false]] as const) {
      const r = await breakdown({ task: 'Вынести мусор', context, again, timeoutMs: 50 })
      expect(r.kind === 'steps' && r.source, JSON.stringify(context)).not.toBe('library')
    }
  })
})
