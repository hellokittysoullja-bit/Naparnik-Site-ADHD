import { describe, expect, it } from 'vitest'
import { breakHref, findsLabel, homeChips, homeHint, homeStep, planMinutes } from '@/lib/home-step'
import type { Plan, StartEntry } from '@/lib/memory'

/** Дом «Привал» (13.11): что показывается на Доме — research/22-chat-and-home/E-home-design.md §8–12 */
const NOW = new Date(2026, 10, 13, 10, 0) // 13.11, 10:00 по местному
const key = (d: number) => `2026-11-${String(d).padStart(2, '0')}`
const plan = (forDate: string, startTime?: string): Plan => ({ forDate, task: 'Курсовая по логистике', firstStep: 'Открыть файл с курсовой', startTime, createdAt: '' })
const start = (date: string, fromPlan = false, label = 'Открыть почту'): StartEntry => ({ id: date + label, date, startedAt: '', label, fromPlan, minutes: 2 })
const at = (p: Partial<Parameters<typeof homeStep>[0]>) => homeStep({ now: NOW, plan: null, queue: null, starts: [], ...p })

describe('Дом: какой шаг показать', () => {
  it('план на сегодня, время пришло — «ПО ПЛАНУ · 9:00», шаг и дело словами человека', () => {
    expect(at({ plan: plan(key(13), '09:00') })).toEqual({ kind: 'plan-now', label: 'ПО ПЛАНУ · 9:00', title: 'Открыть файл с курсовой', sub: 'Курсовая по логистике', fromPlan: true })
  })
  it('план на сегодня позже чем через полчаса — «позже», ближе — уже «сейчас»', () => {
    expect(at({ plan: plan(key(13), '18:00') }).kind).toBe('plan-later')
    expect(at({ plan: plan(key(13), '10:20') }).kind).toBe('plan-now')
    expect(at({ plan: plan(key(13), 'утром') })).toMatchObject({ kind: 'plan-now', label: 'ПО ПЛАНУ' })
  })
  it('по плану сегодня уже начинали — план не висит, Дом говорит, что старт был', () => {
    expect(at({ plan: plan(key(13), '09:00'), starts: [start(key(13), true, 'Открыть файл с курсовой')] })).toMatchObject({ kind: 'done-today', title: 'Открыть файл с курсовой' })
  })
  it('сразу после знакомства: план на завтра главнее сегодняшнего старта', () => {
    expect(at({ plan: plan(key(14), '9:00'), starts: [start(key(13))] })).toMatchObject({ kind: 'tomorrow', label: 'ЗАВТРА · 9:00' })
  })
  it('план на завтра, начатый уже сегодня, на Доме не висит', () => {
    expect(at({ plan: plan(key(14), '9:00'), starts: [start(key(13), true, 'Открыть файл с курсовой')] }).kind).toBe('done-today')
  })
  it('очередь дробления — следующий шаг того же дела', () => {
    expect(at({ queue: { task: 'Курсовая', steps: ['Написать план из трёх пунктов', 'ещё'] } })).toMatchObject({ kind: 'queue', label: 'СЛЕДУЮЩИЙ ШАГ', title: 'Написать план из трёх пунктов', sub: 'Курсовая' })
  })
  it('план из прошлых дней держится неделю как «ПРОДОЛЖИМ», без счёта дней; потом уходит', () => {
    expect(at({ plan: plan(key(10)) })).toMatchObject({ kind: 'carry', label: 'ПРОДОЛЖИМ' })
    expect(at({ plan: plan(key(5)) }).kind).toBe('empty')
    expect(JSON.stringify(at({ plan: plan(key(10)) }))).not.toMatch(/дн/)
  })
  it('ничего нет — «Что сейчас висит?» без шага', () => {
    expect(at({})).toEqual({ kind: 'empty', label: 'ЧТО СЕЙЧАС ВИСИТ?', title: null, sub: null, fromPlan: false })
  })
})

describe('Дом: строка над кнопкой по двум ответам знакомства', () => {
  it('оба ответа — своя строка из 25', () => {
    expect(homeHint({ blocker: 'fear', motive: 'rest' })).toBe('Сделай криво, и вечер будет твоим')
    expect(homeHint({ blocker: 'phone', motive: 'people' })).toBe('Телефон подождёт, а близкий человек ждёт дольше')
    expect(homeHint({ blocker: 'tired', motive: 'proof' })).toBe('Даже открыть уже считается')
  })
  it('все 25 строк разные, без тире, без «надо» и без стыда', () => {
    const lines = ['where', 'phone', 'fear', 'boring', 'tired'].flatMap((b) => ['relief', 'people', 'safety', 'rest', 'proof'].map((m) => homeHint({ blocker: b, motive: m })))
    expect(new Set(lines).size).toBe(25)
    for (const l of lines) expect(l).not.toMatch(/[—–]|надо|должен|обязан|опять|ленив/)
  })
  it('один ответ — строка по нему; знакомства нет или его забыли — строки нет', () => {
    expect(homeHint({ motive: 'safety' })).toBe('Чтобы быть в спокойствии')
    expect(homeHint({ blocker: 'boring' })).toBe('Всего 2 минуты, потом решишь, продолжать ли')
    expect(homeHint(null)).toBeNull()
    expect(homeHint({ blocker: 'чужое', motive: 'тоже' })).toBeNull()
  })
})

describe('Дом: подсказки сфер, кнопка, находки', () => {
  it('Учёба, Работа, Дом; «Написать» вместо «Дом» тем, кто его выбрал', () => {
    expect(homeChips(null).map((c) => c.label)).toEqual(['Учёба', 'Работа', 'Дом'])
    expect(homeChips({ sphere: 'message' }).map((c) => c.label)).toEqual(['Учёба', 'Работа', 'Написать'])
  })
  it('«Разломать на шаг» ведёт в Фокус с делом и сразу запущенным дроблением; план отмечается', () => {
    expect(breakHref('Открыть файл', true)).toBe('/app/session?step=%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C+%D1%84%D0%B0%D0%B9%D0%BB&break=1&plan=1')
    expect(breakHref('x'.repeat(300), false)).toMatch(/^\/app\/session\?step=x{120}&break=1$/)
  })
  it('время плана и падежи находок', () => {
    expect([planMinutes('09:00'), planMinutes('в 18'), planMinutes('утром'), planMinutes('25:00')]).toEqual([540, 1080, null, null])
    // проверка 13.11: свободный текст времени не превращается в выдуманный час
    expect([planMinutes('в 9 вечера'), planMinutes('в 3 дня'), planMinutes('9.30'), planMinutes('через 15 минут'), planMinutes('после 2 пары')]).toEqual([1260, 900, 570, null, null])
    expect([1, 2, 5, 11, 21, 104].map(findsLabel)).toEqual(['1 находка', '2 находки', '5 находок', '11 находок', '21 находка', '104 находки'])
  })
})
