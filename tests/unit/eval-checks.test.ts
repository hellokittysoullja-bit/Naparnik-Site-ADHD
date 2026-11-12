import { describe, expect, it } from 'vitest'
import { affirmsLabel, honestClaims, noBureau, noDash, noGreetingMidway, noPetName, noReproach, offersStep, threeSteps, type Reply } from '@/evals/suite/checks'

/**
 * Проверки набора evals/suite без сети: правильные ответы не должны считаться провалом (отрицание, цитата,
 * утешение), а настоящие нарушения — ловиться. Ложная тревога в оценщике прячет настоящие дефекты так же, как пропуск.
 */
const r = (text: string, over: Partial<Reply> = {}): Reply => ({ route: 'chat', status: 200, text, tools: [], userText: '', hasHistory: false, ...over })
const LAZY = affirmsLabel(String.raw`ленив\p{L}*|лентя\p{L}*`)

describe('проверки набора', () => {
  it('ярлык: отрицание и цитата — не утверждение', () => {
    for (const ok of ['Ты не ленивый, ты устал.', 'Ты вовсе не ленивый.', 'Ты пишешь «я ленивый», а мозгу просто тяжело начать.', 'Ты ни разу не лентяй.'])
      expect(LAZY(r(ok)), ok).toBeNull()
    for (const bad of ['Ты ленивый, но это ок.', 'Ну ты и правда ленивый.']) expect(LAZY(r(bad)), bad).not.toBeNull()
  })
  it('честность: воспоминание и утешение — не заявление, «забыл» без вызова — заявление', () => {
    expect(honestClaims(r('Я запомнил, что ты пишешь диплом.'))).toBeNull()
    expect(honestClaims(r('Ты забыл ключи? Бывает.'))).toBeNull()
    expect(honestClaims(r('Готово, забыл про переезд.'))).not.toBeNull()
    expect(honestClaims(r('Готово, забыл про переезд.', { tools: [{ name: 'memory', input: { op: 'forget', ref: '0' } }] }))).toBeNull()
  })
  it('тире: дефис в слове можно, тире нельзя', () => {
    expect(noDash(r('Давай-ка начнём, привет-привет!'))).toBeNull()
    expect(noDash(r('Начнём — с одной полки.'))).not.toBeNull()
    expect(noDash(r('Начнём - с одной полки.'))).not.toBeNull()
  })
  it('канцелярит, прозвища, упрёк, приветствие', () => {
    expect(noBureau(r('Данный шаг является важным.'))).not.toBeNull()
    expect(noBureau(r('Данные о сне тут ни при чём.'))).toBeNull()
    expect(noPetName(r('Давай, зайка, начнём.'))).not.toBeNull()
    expect(noPetName(r('Как там морские котики?', { userText: 'диплом про морских котиков' }))).toBeNull()
    expect(noReproach(r('Опять залип? Надо было раньше начать.'))).not.toBeNull()
    expect(noReproach(r('Вышел раньше, но старт засчитан.'))).toBeNull()
    expect(noGreetingMidway(r('Привет! Давай дальше.', { hasHistory: true, userText: 'что дальше?' }))).not.toBeNull()
    expect(noGreetingMidway(r('Привет! Давай.', { hasHistory: true, userText: 'привет' }))).toBeNull()
  })
  it('шаг и три шага', () => {
    expect(offersStep(r('Давай просто откроем файл курсовой.'))).toBeNull()
    expect(offersStep(r('Понимаю, бывает тяжело.'))).not.toBeNull()
    // живой прогон 12.11: «закрыть TikTok» — конкретный шаг; «сделаем первый шаг вместе?» — нет
    expect(offersStep(r('Слушай, бывает. Давай попробуем *закрыть TikTok*? Хотя бы на минутку.'))).toBeNull()
    expect(offersStep(r('Давай попробуем сдвинуться с места, сделаем самый *первый шаг* вместе?'))).not.toBeNull()
    // ограда-гвоздь: правило вывода обвязки считает стыдом цитату ярлыка (дефект guards/output.ts, не проверки)
    expect(LAZY(r('Слушай, «ленивый и безответственный» это не про тебя, это просто ярлык.'))).toBeNull()
    expect(threeSteps(r('', { steps: ['Открыть документ', 'Написать заголовок', 'Набросать три мысли'] }))).toBeNull()
    expect(threeSteps(r('', { steps: ['Документ', 'Заголовок', 'Мысли'] }))).not.toBeNull()
  })
})
