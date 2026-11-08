import { describe, expect, it } from 'vitest'
import { decodeAttribution, encodeAttribution, isNid, newNid, readAttribution, withAttribution } from '@/lib/visitor'
import { EMPTY_ONBOARDING, STEPS, onboardingFromQuery, onboardingToQuery } from '@/lib/onboarding'
import { ENTRY_VARIANTS, entryVariantKey } from '@/content/entry-variants'

describe('анонимный ID', () => {
  it('22 символа base64url, каждый раз новый', () => {
    const ids = new Set(Array.from({ length: 200 }, newNid))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(isNid(id)).toBe(true)
  })
  it('чужое значение не принимается', () => {
    expect(isNid('')).toBe(false)
    expect(isNid('abc')).toBe(false)
    expect(isNid('a'.repeat(21) + '"')).toBe(false)
    expect(isNid(undefined)).toBe(false)
  })
})

describe('источник перехода', () => {
  it('берёт только наши ключи и чистые значения', () => {
    const a = readAttribution(new URLSearchParams('utm_source=Instagram&src=reel-12&utm_term=<script>&x=1'))
    expect(a).toEqual({ utm_source: 'instagram', src: 'reel-12' })
  })
  it('cookie туда и обратно', () => {
    const raw = encodeAttribution({ src: 'reel-12', utm_source: 'tiktok' })
    const back = decodeAttribution(raw)
    expect(back.src).toBe('reel-12')
    expect(back.utm_source).toBe('tiktok')
    expect(typeof back.t).toBe('number')
    expect(decodeAttribution('%%%')).toEqual({})
  })
  it('метка ролика протягивается во внутреннюю ссылку, не затирая её параметры', () => {
    expect(withAttribution('/app/start', '?src=reel-12&utm_source=tiktok&step=3')).toBe(
      '/app/start?utm_source=tiktok&src=reel-12',
    )
    expect(withAttribution('/app/session?d=2&src=own', '?src=reel-12')).toBe('/app/session?d=2&src=own')
    expect(withAttribution('/app', '')).toBe('/app')
  })
})

describe('знакомство в адресе', () => {
  const full = { step: 5, sphere: 'study' as const, hanging: 'week' as const, blocker: 'phone' as const, firstStep: STEPS.study[1] }

  it('туда и обратно: тот же шаг и те же ответы', () => {
    const q = new URLSearchParams(onboardingToQuery(full))
    expect(q.toString()).toBe('step=5&s=study&h=week&b=phone&f=1')
    expect(onboardingFromQuery(q, EMPTY_ONBOARDING)).toEqual(full)
  })

  it('свой текст шага в адрес не попадает — только «own», текст берётся с устройства', () => {
    const own = { ...full, firstStep: 'Позвонить маме про курсовую' }
    const q = new URLSearchParams(onboardingToQuery(own))
    expect(q.toString()).not.toContain('%D0')
    expect(q.get('f')).toBe('own')
    expect(onboardingFromQuery(q, own)?.firstStep).toBe('Позвонить маме про курсовую')
    // на другом устройстве своего текста нет — человек снова на вопросе о первом шаге
    expect(onboardingFromQuery(q, EMPTY_ONBOARDING)?.step).toBe(4)
  })

  it('по ссылке нельзя перепрыгнуть дальше первого вопроса без ответа', () => {
    expect(onboardingFromQuery(new URLSearchParams('step=5&s=study'), EMPTY_ONBOARDING)?.step).toBe(2)
    expect(onboardingFromQuery(new URLSearchParams('step=4&s=hack&h=week'), EMPTY_ONBOARDING)?.step).toBe(1)
    expect(onboardingFromQuery(new URLSearchParams('step=-3'), EMPTY_ONBOARDING)?.step).toBe(1)
  })

  it('без step в адресе — берём запись с устройства', () => {
    expect(onboardingFromQuery(new URLSearchParams('src=reel-12'), EMPTY_ONBOARDING)).toBeNull()
  })
})

describe('заголовок под ролик', () => {
  it('известный ключ — его вариант, чужой или пустой — по умолчанию', () => {
    expect(entryVariantKey('REEL-PHONE')).toBe('reel-phone')
    expect(entryVariantKey('reel-999')).toBeNull()
    expect(entryVariantKey('constructor')).toBeNull()
    expect(entryVariantKey('../etc')).toBeNull()
    expect(entryVariantKey(null)).toBeNull()
  })
  it('ключи — только латиница, цифры и дефисы', () => {
    for (const k of Object.keys(ENTRY_VARIANTS)) expect(k).toMatch(/^[a-z0-9-]{1,40}$/)
  })
})
