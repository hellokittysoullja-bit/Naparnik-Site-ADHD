import { beforeEach, describe, expect, it } from 'vitest'
import { installStorage } from './storage-stub'
import * as memory from '@/lib/memory'

// window читается в момент вызова, не импорта — заглушку можно ставить после импорта модуля
const store = installStorage()

beforeEach(() => {
  store.data.clear()
  store.state.blocked = false
})

describe('memory: битые и чужие записи не роняют экран', () => {
  it('старты — не массив → пусто, мусор стёрт', async () => {
    store.data.set('naparnik:starts', '{"a":1}')
    expect(await memory.getStarts()).toEqual([])
    expect(store.data.has('naparnik:starts')).toBe(false)
  })

  it('одна битая запись в массиве не стирает остальную историю', async () => {
    const good = { id: '1', date: '2026-10-01', startedAt: '2026-10-01T10:00:00Z', label: 'Шаг', fromPlan: false, minutes: 15 }
    store.data.set('naparnik:starts', JSON.stringify([good, { id: 2 }, null, 'x']))
    expect(await memory.getStarts()).toEqual([good])
  })

  it('план чужой формы → null', async () => {
    store.data.set('naparnik:plan', '[]')
    expect(await memory.getPlan()).toBeNull()
    store.data.set('naparnik:plan', '"строка"')
    expect(await memory.getPlan()).toBeNull()
  })

  it('сырой текст (не JSON) в плане, очереди и сессии — пусто, а не «план» строкой', async () => {
    store.data.set('naparnik:plan', 'abc')
    store.data.set('naparnik:stepQueue', 'abc')
    store.data.set('naparnik:activeSession', 'abc')
    expect(await memory.getPlan()).toBeNull()
    expect(await memory.getStepQueue()).toBeNull()
    expect(await memory.getActiveSession()).toBeNull()
    expect(store.data.has('naparnik:plan')).toBe(false)
  })

  it('имя без кавычек (не JSON) принимается как есть', async () => {
    store.data.set('naparnik:companionName', 'Тень')
    expect(await memory.getCompanionName()).toBe('Тень')
  })

  it('заблокированное хранилище — продукт как при первом визите, без исключений', async () => {
    store.state.blocked = true
    await expect(memory.getStarts()).resolves.toEqual([])
    await expect(memory.getPlan()).resolves.toBeNull()
    await expect(memory.getPatterns()).resolves.toMatchObject({ totalStarts: 0 })
    await expect(memory.recordStart({ label: 'x' })).resolves.toMatchObject({ label: 'x' })
  })

  it('подпись старта обрезается до 200 символов', async () => {
    const e = await memory.recordStart({ label: 'а'.repeat(5000) })
    expect(e.label).toHaveLength(200)
  })

  it('peek* и get* отдают одно и то же', async () => {
    await memory.recordStart({ label: 'Открыть файл' })
    await memory.savePlan({ task: 'Отчёт', firstStep: 'Открыть файл' })
    expect(memory.peekStarts()).toEqual(await memory.getStarts())
    expect(memory.peekPlan()).toEqual(await memory.getPlan())
    expect(memory.peekPatterns()).toEqual(await memory.getPatterns())
    expect(memory.peekMemoryContext()).toEqual(await memory.buildMemoryContext())
  })
})

describe('memory: паттерны', () => {
  it('серия дней считает подряд и прощает паузу (история не сгорает)', async () => {
    const day = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      return d
    }
    const starts = [3, 1, 0].map((n, i) => ({
      id: String(i),
      date: memory.todayKey(day(n)),
      startedAt: day(n).toISOString(),
      label: 'Шаг',
      fromPlan: false,
      minutes: 15,
    }))
    store.data.set('naparnik:starts', JSON.stringify(starts))
    const p = await memory.getPatterns()
    expect(p.totalStarts).toBe(3)
    expect(p.runningDays).toBe(2)
    expect(p.daysAway).toBe(0)
  })
})

describe('memory: переписка', () => {
  it('реплики старого формата без parts отбрасываются, живые остаются', async () => {
    const ok = { id: 'a', role: 'assistant', parts: [{ type: 'text', text: 'привет' }] }
    store.data.set('naparnik:chat', JSON.stringify([{ role: 'user', content: 'привет' }, ok]))
    expect(await memory.getChatMessages()).toEqual([ok])
  })
})

describe('memory: факты о человеке на устройстве', () => {
  it('прежние заметки один раз переносятся в факты «о себе», без дублей', async () => {
    store.data.set('naparnik:notes', JSON.stringify([{ text: 'Пишет диплом.', createdAt: '2026-11-01T00:00:00Z' }, { text: 'Пишет диплом.', createdAt: '2026-11-02T00:00:00Z' }, { text: 'Любит чай' }]))
    const facts = memory.peekFacts()
    expect(facts.map((f) => [f.category, f.text])).toEqual([['about', 'Пишет диплом.'], ['about', 'Любит чай']])
    // второй раз не переносит: ключ фактов уже есть
    expect(memory.peekFacts().map((f) => f.id)).toEqual(facts.map((f) => f.id))
  })
  it('операции памяти: дубль не пишется, «забудь» стирает', async () => {
    await memory.applyMemoryOps([{ op: 'add', category: 'task', text: 'Пишет диплом', source: 'stated' }])
    const [r] = await memory.applyMemoryOps([{ op: 'add', category: 'task', text: 'пишет  ДИПЛОМ', source: 'stated' }])
    expect(r).toMatchObject({ ok: false, reason: 'duplicate' })
    const id = memory.peekFacts()[0].id
    await memory.applyMemoryOps([{ op: 'forget', id }])
    expect(memory.peekFacts()).toEqual([])
  })
  it('битая запись факта выбрасывается по одной, остальные живут', () => {
    const ok = { id: 'a', category: 'task', text: 'Пишет диплом', source: 'stated', createdAt: 'x', updatedAt: 'x', status: 'active' }
    store.data.set('naparnik:facts', JSON.stringify([ok, { id: 'b', category: 'ВЗЛОМ', text: 'x' }, 'мусор']))
    expect(memory.peekFacts().map((f) => f.id)).toEqual(['a'])
  })
  it('контекст для разговора: факты и их id в одном порядке, ответы знакомства — ключами', () => {
    store.data.set('naparnik:onboarding', JSON.stringify({ step: 9, sphere: 'study', blocker: 'phone', motive: null }))
    const ok = (id: string, text: string) => ({ id, category: 'task', text, source: 'stated', createdAt: '2026-11-01T00:00:00Z', updatedAt: 'x', status: 'active' })
    store.data.set('naparnik:facts', JSON.stringify([ok('a', 'Пишет диплом'), { ...ok('b', 'Старое'), status: 'superseded' }, ok('c', 'Любит чай')]))
    const ctx = memory.peekMemoryContext()
    expect(ctx.facts.map((f) => f.text)).toEqual(['Пишет диплом', 'Любит чай'])
    expect(ctx.factIds).toEqual(['a', 'c'])
    expect(ctx.profile).toEqual({ sphere: 'study', hanging: undefined, blocker: 'phone', motive: undefined })
  })
})

describe('memory: выводы по стартам (только с основанием)', () => {
  const start = (iso: string, planned?: number, minutes = 0) => ({ id: iso, date: iso.slice(0, 10), startedAt: iso, label: 'x', fromPlan: false, minutes, planned })
  it('окно старта: меньше пяти стартов — вывода нет; вечерние старты — окно вокруг них', () => {
    const local = (d: number, h: number) => new Date(2026, 10, d, h, 10).toISOString()
    expect(memory.windowOf([1, 2, 3, 4].map((d) => start(local(d, 19))), '2026-11-12')).toBeNull()
    const starts = [start(local(1, 19)), start(local(2, 20)), start(local(3, 19)), start(local(4, 18)), start(local(5, 9)), start(local(6, 19))]
    expect(memory.windowOf(starts, '2026-11-12')).toEqual({ from: 18, to: 20, n: 5, of: 6 })
  })
  it('разбросанные старты — окна нет (доля меньше 40 %)', () => {
    const local = (d: number, h: number) => new Date(2026, 10, d, h, 10).toISOString()
    const starts = [0, 4, 8, 12, 16, 20].map((h, i) => start(local(i + 1, h)))
    expect(memory.windowOf(starts, '2026-11-12')).toBeNull()
  })
  it('доводит до конца: только длительности с тремя и более сессиями; старые старты без выбора не считаются', () => {
    const s = (planned: number | undefined, minutes: number) => start(`2026-11-05T10:00:00Z`, planned, minutes)
    const starts = [s(15, 15), s(15, 14.5), s(15, 3), s(15, 15), s(25, 25), s(25, 0), s(undefined, 25)]
    expect(memory.durationsOf(starts)).toEqual([{ minutes: 15, done: 3, of: 4 }])
  })
})
