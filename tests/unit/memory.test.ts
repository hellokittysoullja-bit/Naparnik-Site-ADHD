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
