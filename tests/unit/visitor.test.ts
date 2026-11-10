import { describe, expect, it } from 'vitest'
import { decodeAttribution, encodeAttribution, isNid, newNid, readAttribution, withAttribution } from '@/lib/visitor'
import {
  EMPTY_ONBOARDING,
  costBundle,
  defaultStep,
  onboardingFromQuery,
  onboardingToQuery,
  planLines,
  stepsFor,
} from '@/lib/onboarding'
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
  const full = {
    step: 9,
    sphere: 'study' as const,
    hanging: 'week' as const,
    blocker: 'phone' as const,
    motive: 'relief' as const,
    cost: 'hour' as const,
    firstStep: stepsFor('study', 'phone')[1],
  }

  it('туда и обратно: тот же шаг и те же ответы', () => {
    const q = new URLSearchParams(onboardingToQuery(full))
    expect(q.toString()).toBe('step=9&s=study&h=week&b=phone&m=relief&c=hour&f=1')
    expect(onboardingFromQuery(q, EMPTY_ONBOARDING)).toEqual(full)
  })

  it('свой текст шага в адрес не попадает — только «own», текст берётся с устройства', () => {
    const own = { ...full, firstStep: 'Позвонить маме про курсовую' }
    const q = new URLSearchParams(onboardingToQuery(own))
    expect(q.toString()).not.toContain('%D0')
    expect(q.get('f')).toBe('own')
    expect(onboardingFromQuery(q, own)?.firstStep).toBe('Позвонить маме про курсовую')
    // на другом устройстве своего текста нет — человек снова на вопросе о первом шаге
    expect(onboardingFromQuery(q, EMPTY_ONBOARDING)?.step).toBe(7)
  })

  it('по ссылке нельзя перепрыгнуть дальше первого вопроса без ответа', () => {
    expect(onboardingFromQuery(new URLSearchParams('step=9&s=study'), EMPTY_ONBOARDING)?.step).toBe(2)
    expect(onboardingFromQuery(new URLSearchParams('step=4&s=hack&h=week'), EMPTY_ONBOARDING)?.step).toBe(1)
    expect(onboardingFromQuery(new URLSearchParams('step=-3'), EMPTY_ONBOARDING)?.step).toBe(1)
    // без ответа «сколько ест» дальше этого вопроса не пускает, без шага — дальше выбора шага
    expect(onboardingFromQuery(new URLSearchParams('step=9&s=work&h=month&b=fear&m=relief'), EMPTY_ONBOARDING)?.step).toBe(5)
    expect(onboardingFromQuery(new URLSearchParams('step=9&s=work&h=month&b=fear&m=relief&c=hour'), EMPTY_ONBOARDING)?.step).toBe(7)
  })

  it('без step в адресе — берём запись с устройства', () => {
    expect(onboardingFromQuery(new URLSearchParams('src=reel-12'), EMPTY_ONBOARDING)).toBeNull()
  })
})

describe('знакомство: шаги, цена бездействия и план', () => {
  it('«не знаю, с чего» — первым «Выписать первый шаг»; «боюсь, что плохо» — по умолчанию черновик', () => {
    expect(stepsFor('study', 'where')[0]).toBe('Выписать первый шаг')
    // у работы такой шаг уже есть — он переезжает на первое место и не дублируется
    expect(stepsFor('work', 'where')).toEqual(['Выписать первый шаг', 'Открыть документ или задачу', 'Написать 3 строки черновика'])
    expect(defaultStep('message', 'fear')).toBe('Написать черновик ответа (не отправлять)')
    expect(defaultStep('home', 'tired')).toBe('Убрать одну поверхность')
  })

  it('цена бездействия — только из числа человека; пример документа слово в слово', () => {
    const base = { ...EMPTY_ONBOARDING, sphere: 'work' as const, hanging: 'month' as const, cost: 'hour' as const }
    expect(costBundle(base)).toBe(
      'Рабочая задача висит уже месяц. По твоей оценке, она забирает около часа в день — примерно 30 часов только за этот месяц. Если ничего не менять, следующий месяц возьмёт ещё столько же. Мы предлагаем вместо этого 2 минуты — прямо сейчас.',
    )
    // без числа («весь день», «не могу сказать») связки с часами нет
    expect(costBundle({ ...base, cost: 'allday' })).toBeNull()
    expect(costBundle({ ...base, cost: 'unknown' })).toBeNull()
    // короткий срок — без «этого месяца»
    expect(costBundle({ ...base, hanging: 'week' })).not.toContain('этот месяц')
    // сообщение + месяц — отдельная строка про тревогу, а не про часы
    expect(costBundle({ ...base, sphere: 'message' })).toContain('меньше времени, чем один такой день тревоги')
  })

  it('план: каждая строка — ответ человека; «через 7 дней» ведёт мотив', () => {
    const plan = planLines(
      { ...EMPTY_ONBOARDING, sphere: 'home', hanging: 'week', blocker: 'phone', motive: 'safety', cost: 'hour' },
      'Собрать 10 вещей на место',
    )
    expect(plan.title).toBe('Твой план для дома и быта')
    expect(plan.hanging).toBe('дом и быт — уже неделю-две')
    expect(plan.approach).toBe('Телефон экраном вниз — я посторожу')
    expect(plan.today).toBe('2 минуты — «Собрать 10 вещей на место»')
    expect(plan.future).toBe('Бумажки сдвинулись')
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
