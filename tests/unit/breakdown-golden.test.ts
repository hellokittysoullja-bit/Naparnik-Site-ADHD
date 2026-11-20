import { describe, expect, it } from 'vitest'
import { readyPlan } from '@/lib/ai/agents/breakdown'
import { GOLDEN } from '../fixtures/breakdown-golden'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'
import { TASK_ALIASES } from '@/lib/ai/agents/breakdown-aliases'
import { ASPECT, VERB_SAME } from '@/lib/ai/agents/breakdown-understand'
import { ALL_TEMPLATES } from '@/lib/templates'

const steps = (t: string) => readyPlan(t)?.value.steps ?? null

describe('проверочный набор узнавания дел (tests/fixtures/breakdown-golden.ts)', () => {
  it('у каждого ожидаемого дела есть план в базе — иначе ответ в наборе записан неверно', () => {
    const missing = GOLDEN.filter(([, exp]) => exp && !steps(exp)).map(([, exp]) => exp)
    expect(missing).toEqual([])
  })

  it('ни одного чужого плана: фраза получает план своего дела или не получает никакого', () => {
    const wrong = GOLDEN.flatMap(([phrase, exp]) => {
      const got = readyPlan(phrase)
      if (!got) return []
      return exp && JSON.stringify(got.value.steps) === JSON.stringify(steps(exp)) ? [] : [`${phrase} → ${got.title} (ждали ${exp ?? 'ничего'})`]
    })
    expect(wrong).toEqual([])
  })

  it('узнаётся всё ожидаемое (без «понимания» 20.11 было 126 из 219; с опечатками и уточнением набор 228)', () => {
    const want = GOLDEN.filter(([, exp]) => exp)
    const ok = want.filter(([phrase, exp]) => JSON.stringify(steps(phrase)) === JSON.stringify(steps(exp!))).length
    expect(ok).toBeGreaterThanOrEqual(want.length)
  })
})

describe('понимание на всей базе (breakdown-understand.ts)', () => {
  // каждое третье дело базы — полный прогон в research/27-breakdown/understanding/ (32 тыс. и 13 тыс. фраз)
  const all = [...new Set([...Object.keys(GOBLIN_PLANS), ...ALL_TEMPLATES.map((t) => t.title)])]
  const titles = all.filter((_, i) => i % 3 === 0)
  const same = (a: string, b: string) => JSON.stringify(steps(a)) === JSON.stringify(steps(b))

  it('дело с уточнением времени — то же дело или более узкое с этим временем, а не чужое', () => {
    // план → названия и синонимы дел с этим планом: «более узкое дело» — то, в чьём СОБСТВЕННОМ названии есть это время
    const owners = new Map<string, string[]>()
    for (const t of [...all, ...Object.values(TASK_ALIASES).flat()]) {
      const k = JSON.stringify(steps(t))
      owners.set(k, [...(owners.get(k) ?? []), t])
    }
    const bad: string[] = []
    for (const t of titles) for (const [q, w] of [[`${t} вечером`, /вечер/i], [`в субботу ${t}`, /суббот/i]] as const) {
      const r = readyPlan(q)
      if (r && !same(q, t) && !(owners.get(JSON.stringify(r.value.steps)) ?? []).some((o) => w.test(o))) bad.push(`${q} → ${r.title}`)
    }
    expect(bad).toEqual([])
  })

  it('глагол в другом виде или форме — то же дело, отдельное дело с этим глаголом или ничего', () => {
    const inv: Record<string, string[]> = {}
    for (const [a, b] of Object.entries({ ...ASPECT, ...VERB_SAME })) (inv[b] ??= []).push(a)
    const bad: string[] = []
    for (const t of titles) {
      const [v, ...rest] = t.split(' ')
      for (const a of inv[v.toLowerCase()] ?? []) {
        const q = [a, ...rest].join(' ')
        const r = readyPlan(q)
        // своё дело — или дело, которое ровно так и названо («Готовиться к экзамену» рядом с «Подготовиться к экзамену»)
        if (r && !same(q, t) && r.title.toLowerCase() !== q.toLowerCase()) bad.push(`${q} → ${r.title}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('уточнение даёт название с уточнением, а план — дела', () => {
    expect(readyPlan('покормить собаку вечером')).toMatchObject({ title: 'Покормить собаку вечером', corrected: true })
    expect(readyPlan('написать курсовую по истории')?.title).toBe('Написать курсовую по истории')
    expect(readyPlan('позвонить маме в 19:00')?.title).toBe('Позвонить маме в 19:00')
  })

  it('настоящее слово не «исправляется» в чужое: понимание идёт раньше опечаток', () => {
    expect(readyPlan('мыться')?.title).toBe('Помыться')
  })

  it('не срезает то, что меняет дело: предмет вне списка, длительность, место', () => {
    expect(readyPlan('сдать экзамен по вождению')?.title).not.toBe('Сдать экзамен')
    expect(readyPlan('написать доклад по работе')).toBeNull()
    expect(readyPlan('убраться на кухне вечером')?.title).toBe('Убраться на кухне вечером')
    expect(readyPlan('кастрировать кошку')?.title).not.toBe('Кастрировать кота')
    expect(readyPlan('вечером')).toBeNull()
    expect(readyPlan('по истории')).toBeNull()
    expect(readyPlan('в 7')).toBeNull()
  })

  it('двусмысленное не угадывается: два дела одинаково подходят — план пишет модель', () => {
    expect(readyPlan('отдохнуть в выходные вечером')).toBeNull()
  })
})
