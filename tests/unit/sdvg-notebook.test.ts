import { describe, expect, it } from 'vitest'
import { SPHERES, TYPES, effectiveType, secondType, type ProcType, type SdvgState } from '@/lib/sdvg'
import { notebookPage, notebookText } from '@/lib/sdvg-notebook'

// ТЗ research/15-product-science/traffic-attachment.md, п. 2: «смена любого своего ответа меняет видимый текст блока (а)».
// Иначе страница «Что я записал» — шаблон, выданный за персональный разбор (эффект Барнума, каталог PL11 🚫).

const base = (l2: ProcType[], sphere: SdvgState['sphere']): SdvgState => ({
  step: 'result',
  adult: true,
  asrs: [2, 2, 2, 2, 2, 2],
  l2,
  sphere,
  chosen: null,
})

function* allL2(): Generator<ProcType[]> {
  for (const a of TYPES) for (const b of TYPES) for (const c of TYPES) for (const d of TYPES) yield [a, b, c, d]
}

describe('«Что я записал»', () => {
  it('смена любого из 4 ответов меняет видимый текст — на всех 256 сочетаниях', () => {
    for (const l2 of allL2()) {
      const before = notebookText(notebookPage(base(l2, 'study')))
      for (let i = 0; i < 4; i++) {
        for (const t of TYPES) {
          if (t === l2[i]) continue
          const changed = [...l2]
          changed[i] = t
          expect(notebookText(notebookPage(base(changed, 'study')))).not.toBe(before)
        }
      }
    }
  })

  it('смена сферы меняет видимый текст', () => {
    const l2: ProcType[] = ['M', 'M', 'H', 'P']
    const texts = SPHERES.map((s) => notebookText(notebookPage(base(l2, s))))
    expect(new Set(texts).size).toBe(SPHERES.length)
  })

  it('ответы ВОЗ на текст не влияют', () => {
    const a = notebookText(notebookPage({ ...base(['U', 'U', 'H', 'P'], 'home'), asrs: [0, 0, 0, 0, 0, 0] }))
    const b = notebookText(notebookPage({ ...base(['U', 'U', 'H', 'P'], 'home'), asrs: [4, 4, 4, 4, 4, 4] }))
    expect(a).toBe(b)
    expect(a).not.toMatch(/из 24|балл/)
  })

  it('строки — словами человека, плюс честный счёт «k из 4»', () => {
    const page = notebookPage(base(['M', 'M', 'M', 'H'], 'study'))!
    expect(page.notes[0]).toBe('Тяну, пока не загорится')
    expect(page.count).toBe('3 из 4 ответов — про это')
    expect(page.sphere).toBe('Сильнее всего мешает: учёба')
  })
})

describe('«Не совсем про меня»', () => {
  it('второй тип — следующий по частоте; если все ответы про один тип — второго нет', () => {
    expect(secondType(['M', 'M', 'H', 'P'], 'M')).toBe('H')
    expect(secondType(['M', 'P', 'P', 'M'], 'M')).toBe('P')
    expect(secondType(['U', 'U', 'U', 'U'], 'U')).toBeNull()
  })
  it('выбранный человеком тип главнее подсчёта и меняет страницу', () => {
    const s = base(['M', 'M', 'H', 'P'], 'work')
    expect(effectiveType({ ...s, chosen: 'H' })).toBe('H')
    expect(notebookText(notebookPage({ ...s, chosen: 'H' }))).not.toBe(notebookText(notebookPage(s)))
  })
})
