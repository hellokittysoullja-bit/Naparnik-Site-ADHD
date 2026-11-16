import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepaint, prepaintData, prepaintScript } from '@/lib/app-prepaint'
import { BLOCKER_KEYS, MOTIVE_KEYS, findsLabel, homeChips, homeExample, homeHint, homeSphere } from '@/lib/home-step'
import { LANDMARK_COUNT } from '@/lib/island-elements'
import { getActiveSession, getUnseenWorldCount, peekFinds, peekProfile, getStarts } from '@/lib/memory'
import { RIDGE, moonPhase, phaseForHour } from '@/lib/sky'

/**
 * Скрипт первого кадра /app (lib/app-prepaint.ts) обязан поставить РОВНО то, что потом покажут React-компоненты: иначе
 * при обновлении вместо одного прыжка было бы два. Сверяем с теми же функциями, что вызывают home-camp.tsx,
 * app-backdrop.tsx и app-nav.tsx, на всех сочетаниях ответов знакомства, на «Забудь всё», на битых и чужих записях.
 */
function fakeHtml() {
  const attrs: Record<string, string> = {}
  const vars: Record<string, string> = {}
  return {
    attrs,
    vars,
    setAttribute: (k: string, v: string) => void (attrs[k] = v),
    removeAttribute: (k: string) => void delete attrs[k],
    style: { setProperty: (k: string, v: string) => void (vars[k] = v), removeProperty: (k: string) => void delete vars[k] },
  }
}

async function run(store: Record<string, string>, viaScript = false) {
  const ls = { getItem: (k: string) => (k in store ? store[k] : null), setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] }
  const html = fakeHtml()
  const input = { placeholder: homeExample(null) }
  const document = { documentElement: html, readyState: 'complete', getElementById: (id: string) => (id === 'home-task' ? input : null) }
  const window = { localStorage: ls, requestAnimationFrame: () => 0 }
  vi.stubGlobal('window', window)
  if (viaScript) new Function('window', 'document', prepaintScript())(window, document)
  else prepaint(window as unknown as Window, document as unknown as Document, prepaintData())
  // то, что покажут компоненты, — те же функции
  const profile = peekProfile()
  const sphere = homeSphere(profile)
  const starts = (await getStarts()).length
  const finds = peekFinds()
  const s = await getActiveSession()
  const left = s ? Math.ceil((s.minutes * 60 - (Date.now() - s.startedAt) / 1000) / 60) : 0
  const ph = moonPhase(new Date())
  const lit = 1 - Math.abs(ph * 2 - 1)
  return {
    html,
    input,
    react: {
      sphere,
      third: homeChips(profile)[2].sphere,
      hint: homeHint(profile),
      example: homeExample(sphere),
      finds: finds.length,
      landmarks: Math.min(starts, RIDGE.length),
      island: Math.min(starts, LANDMARK_COUNT),
      moon: starts >= LANDMARK_COUNT && lit > 0.06,
      moonDx: (ph < 0.5 ? -1 : 1) * (1 - lit) * 1.9 * 6,
      aurora: finds.some((f) => f.key === 'aurora'),
      worldNew: (await getUnseenWorldCount()) > 0,
      left: left > 0 ? left : 0,
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function check(store: Record<string, string>, viaScript = false) {
  const { html, input, react } = await run(store, viaScript)
  expect(JSON.parse(html.vars['--home-hint'])).toBe(react.hint)
  expect(input.placeholder).toBe(react.example)
  expect(html.attrs['data-home-sphere'] ?? null).toBe(react.sphere)
  expect(html.attrs['data-home-third'] ? 'message' : 'home').toBe(react.third)
  expect(html.vars['--home-finds'] ? JSON.parse(html.vars['--home-finds']) : null).toBe(react.finds ? findsLabel(react.finds) : null)
  expect('data-home-finds' in html.attrs).toBe(react.finds > 0)
  expect(Number(html.attrs['data-lm'])).toBe(react.landmarks)
  expect(Number(html.attrs['data-island'])).toBe(react.island)
  expect('data-moon' in html.attrs).toBe(react.moon)
  if (react.moon) expect(Number(html.vars['--moon-dx'])).toBeCloseTo(react.moonDx, 6)
  expect('data-aurora' in html.attrs).toBe(react.aurora)
  expect('data-world-new' in html.attrs).toBe(react.worldNew)
  expect('data-focus-left' in html.attrs).toBe(react.left > 0)
  expect(html.vars['--focus-left'] ? JSON.parse(html.vars['--focus-left']) : null).toBe(react.left > 0 ? `${react.left}м` : null)
}

const answers = (o: object) => ({ 'naparnik:onboarding': JSON.stringify(o) })
const start = (i: number) => ({ id: `s${i}`, date: '2026-11-01', startedAt: '2026-11-01T10:00:00Z', label: `Шаг ${i}`, fromPlan: false, minutes: 15 })
const find = (i: number, key = `k${i}`) => ({ key, name: 'Ракушка', startId: `s${i}`, seed: i, rarity: 'common' })

describe('первый кадр /app совпадает с тем, что покажут компоненты', () => {
  it('Дом: все 36 сочетаний «что мешает» × «ради чего» и все сферы', async () => {
    for (const b of [undefined, ...BLOCKER_KEYS])
      for (const m of [undefined, ...MOTIVE_KEYS])
        for (const sphere of [undefined, 'study', 'work', 'home', 'message', 'unsure']) await check(answers({ sphere, blocker: b, motive: m }))
  })
  it('Дом: без памяти, «Забудь всё», битый JSON, чужие формы, ответы старого формата', async () => {
    await check({})
    await check({ ...answers({ sphere: 'message', blocker: 'fear', motive: 'rest' }), 'naparnik:profileForgotten': 'true' })
    await check({ ...answers({ sphere: 'study' }), 'naparnik:profileForgotten': '"да"' })
    await check({ 'naparnik:onboarding': '{битый' })
    await check({ 'naparnik:onboarding': '["study"]' })
    await check(answers({ sphere: 42, blocker: 'phone', hanging: 'week' }))
    await check(answers({ hanging: 'week' }))
    await check(answers({ sphere: 'message'.padEnd(30, 'x') }))
  })
  it('находки: число и склонение как у findsLabel, битые не считаются, сияние только за настоящую', async () => {
    for (const n of [0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112]) await check({ 'naparnik:finds': JSON.stringify(Array.from({ length: n }, (_, i) => find(i))) })
    await check({ 'naparnik:finds': JSON.stringify([find(1), { key: 'aurora' }, null, 'строка', { ...find(2), rarity: 'epic' }, { ...find(3), seed: 'NaN' }]) })
    await check({ 'naparnik:finds': JSON.stringify([find(1), find(2, 'aurora')]) })
    await check({ 'naparnik:finds': '{"не":"список"}' })
    await check({ 'naparnik:finds': 'мусор' })
  })
  it('фон и меню: ориентиры, луна в разные фазы, «есть новое», минуты сессии', async () => {
    for (const n of [0, 1, 3, 4, 9, 10, 11, 40]) {
      const starts = JSON.stringify([...Array.from({ length: n }, (_, i) => start(i)), { id: 'битый' }])
      for (const seen of [undefined, '0', String(n), '"три"']) await check({ 'naparnik:starts': starts, ...(seen === undefined ? {} : { 'naparnik:worldSeen': seen }) })
    }
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let day = 0; day < 30; day += 2) {
      vi.setSystemTime(new Date(2026, 10, 1 + day, 12))
      await check({ 'naparnik:starts': JSON.stringify(Array.from({ length: 12 }, (_, i) => start(i))) })
    }
    vi.useRealTimers()
    const now = Date.now()
    for (const s of [{ startedAt: now - 60_000, minutes: 25, task: 'x', startId: 's' }, { startedAt: now - 30 * 60_000, minutes: 25, task: 'x', startId: 's' }, { startedAt: now, minutes: '25', task: 'x', startId: 's' }])
      await check({ 'naparnik:activeSession': JSON.stringify(s) })
  })
  it('небо — по часу, по тем же границам, что у фона', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let hr = 0; hr < 24; hr++) {
      vi.setSystemTime(new Date(2026, 10, 16, hr, 30))
      const html = fakeHtml()
      prepaint({ localStorage: { getItem: () => null } } as unknown as Window, { documentElement: html, getElementById: () => null } as unknown as Document, prepaintData())
      expect(html.attrs['data-sky']).toBe(phaseForHour(hr))
    }
  })
  it('строка для HTML — та же функция: исходный текст работает сам по себе', async () => {
    await check({ ...answers({ sphere: 'message', blocker: 'tired', motive: 'proof' }), 'naparnik:finds': JSON.stringify([find(1)]), 'naparnik:starts': JSON.stringify([start(1)]) }, true)
    expect(prepaintScript()).not.toMatch(/<\/script/i)
  })
  it('хранилище бросает (Safari с блокировкой cookie): небо по часу, остальное — как без памяти', () => {
    const html = fakeHtml()
    const window = {
      get localStorage(): Storage {
        throw new Error('SecurityError')
      },
    }
    expect(() => prepaint(window as unknown as Window, { documentElement: html, getElementById: () => null } as unknown as Document, prepaintData())).not.toThrow()
    expect(html.attrs['data-sky']).toBeTruthy()
    expect(html.attrs['data-lm']).toBe('0')
    expect(html.attrs['data-home-sphere']).toBeUndefined()
  })
})
