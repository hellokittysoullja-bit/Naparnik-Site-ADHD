import { describe, expect, it } from 'vitest'
import { parseFocusPlan } from '@/lib/focus-plan'

const now = Date.UTC(2026, 10, 21, 12)
const ok = { title: 'Убрать ванную', task: 'Достать средство и губку', steps: [{ text: 'Достать средство и губку', minutes: 2 }, { text: 'Смыть средство', wait: true }], receipt: 'Разломал на 2 шага.', at: now - 1000 }

describe('открытая разбивка Фокуса на устройстве (lib/focus-plan.ts)', () => {
  it('целая свежая запись читается как есть', () => {
    expect(parseFocusPlan(ok, now)).toEqual(ok)
  })
  it('старше суток — разбивки нет', () => {
    expect(parseFocusPlan({ ...ok, at: now - 25 * 3600_000 }, now)).toBeNull()
  })
  it('битая или чужая форма — разбивки нет, экран не падает', () => {
    for (const bad of [null, 'x', 1, [], { ...ok, steps: [] }, { ...ok, steps: [{ text: '' }] }, { ...ok, steps: [{ text: 'a', minutes: -1 }] }, { ...ok, title: '' }, { ...ok, task: 5 }, { ...ok, at: 'now' }, { ...ok, at: now + 3600_000 }])
      expect(parseFocusPlan(bad, now)).toBeNull()
  })
  it('квитанция не того вида просто не восстанавливается', () => {
    expect(parseFocusPlan({ ...ok, receipt: 42 }, now)?.receipt).toBeNull()
  })
})
