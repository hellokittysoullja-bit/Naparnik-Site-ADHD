import { describe, expect, it } from 'vitest'
import { vitalPayload } from '@/lib/events'

describe('полевые Web Vitals: только имя, число, оценка и путь', () => {
  it('путь без параметров и фрагмента (ответы теста, метки, шаг сессии не уходят)', () => {
    const p = vitalPayload({ name: 'LCP', value: 1234.56, rating: 'good' }, '/sdvg-test?step=3#a=1,2,3')
    expect(p).toEqual({ name: 'vital_LCP', data: { value: 1235, rating: 'good', path: '/sdvg-test' } })
  })
  it('CLS — три знака, INP — целые мс; чужая оценка → unknown', () => {
    expect(vitalPayload({ name: 'CLS', value: 0.123456, rating: 'needs-improvement' }, '/')?.data.value).toBe(0.123)
    expect(vitalPayload({ name: 'INP', value: 87.4, rating: '<x>' }, '/app')?.data).toEqual({ value: 87, rating: 'unknown', path: '/app' })
  })
  it('посторонние метрики и не-числа не отправляются', () => {
    expect(vitalPayload({ name: 'FID', value: 10 }, '/')).toBeNull()
    expect(vitalPayload({ name: 'LCP', value: Number.NaN }, '/')).toBeNull()
  })
})
