import { describe, expect, it } from 'vitest'
import { buildMatcher, distance } from '@/lib/ai/agents/breakdown-match'
import { readyPlan } from '@/lib/ai/agents/breakdown'
import { TASK_ALIASES } from '@/lib/ai/agents/breakdown-aliases'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'

const t = (s: string) => readyPlan(s)?.title ?? null

describe('готовое дело узнаётся, как бы его ни написали', () => {
  it('регистр, знаки, «ё», лишние пробелы', () => {
    expect(t('  ПОМЫТЬ   посуду!!! ')).toBe('Помыть посуду')
    expect(t('постирать белье')).toBe('Постирать бельё')
  })
  it('слова-паразиты и другой порядок слов', () => {
    expect(t('надо срочно помыть посуду')).toBe('Помыть посуду')
    expect(t('посуду помыть')).toBe('Помыть посуду')
    expect(t('мне сегодня надо вынести мусор')).toBe('Вынести мусор')
  })
  it('английская раскладка вместо русской', () => {
    expect(t('gjvsnm gjcele')).toBe('Помыть посуду')
  })
  it('частые опечатки: буква не та, пропущена, лишняя, переставлена; -тся/-ться', () => {
    expect(t('помыть посду')).toBe('Помыть посуду')
    expect(t('пазвонить маме')).toBe('Позвонить маме')
    expect(t('Сдклать презентацию')).toBe('Сделать презентацию')
    expect(t('убратся в комнате')).toBe('Убраться в комнате')
    expect(t('вынисти мусор')).toBe('Вынести мусор')
    expect(t('почистить зуюы')).toBe('Почистить зубы')
    expect(t('записатся к зубному')).toBe('Записаться к зубному')
    expect(t('помыть пол')).toBe('Помыть пол')
  })
  it('исправленное дело отдаётся правильным названием и помечается', () => {
    expect(readyPlan('помыть посду')).toMatchObject({ title: 'Помыть посуду', corrected: true })
    expect(readyPlan('Помыть посуду')).toMatchObject({ corrected: false })
  })
  it('не угадывает: другое дело с похожим словом и дело с лишним смыслом уходят модели', () => {
    expect(t('позвонить тёте')).toBeNull()
    expect(t('помыть посуду после гостей')).toBeNull()
    expect(t('сходить в зол')).toBeNull()
    // «покакать» — синоним туалетного дела, а не опечатка в «поплакать»
    expect(t('покакать')).not.toBe('Поплакать')
    expect(t('Hh')).toBeNull()
    expect(t('')).toBeNull()
  })
  it('опечатка не уводит в туалетное или интимное дело: «поспать», «пожрать» не становятся «Посрать» (16.11)', () => {
    expect(t('поспать')).not.toBe('Посрать')
    expect(t('пожрать')).not.toBe('Посрать')
    expect(t('посрать')).toBe('Посрать')
  })
  it('дело и его синоним с одним планом — не «два дела», совпадение не теряется', () => {
    const plan = { p: 1 }
    const m = buildMatcher([['Помыть посуду', plan], ['Мыть посуду', plan], ['Купить хлеб', { p: 2 }]])
    expect(m.find('мыть посду')?.value).toBe(plan)
    expect(m.find('посуду мыть')?.title).toBe('Мыть посуду')
  })
  it('два дела одинаково близко — не выбирает наугад', () => {
    const m = buildMatcher([['Купить хлеб', 1], ['Купить хрен', 2]])
    expect(m.find('купить хлед')?.value).toBe(1)
    expect(m.find('купить хлеп')?.value).toBe(1)
    const amb = buildMatcher([['Мыть кота', 1], ['Мыть кита', 2]])
    expect(amb.find('мыть кмта')).toBeNull()
  })
  it('расстояние Дамерау-Левенштейна: перестановка соседних букв — одна правка', () => {
    expect(distance('убарться', 'убраться', 2)).toBe(1)
    expect(distance('посуду', 'посду', 2)).toBe(1)
    expect(distance('абв', 'где', 1)).toBe(2)
  })
  it('длинный ввод не тормозит: 2000 знаков — меньше 50 мс', () => {
    const t0 = performance.now()
    readyPlan('помыть посуду '.repeat(150))
    expect(performance.now() - t0).toBeLessThan(50)
  })
  it('синоним даёт план своего дела: «покушать» = «поесть», «принять душ» = «сходить в душ», «сделать дз» = «сделать домашку» (16.11)', () => {
    const plan = (s: string) => readyPlan(s)?.value.steps
    expect(plan('покушать')).toEqual(plan('Поесть'))
    expect(plan('принять душ')).toEqual(plan('Сходить в душ'))
    expect(plan('мыть посуду')).toEqual(plan('Помыть посуду'))
    expect(plan('сделать дз')).toEqual(plan('Сделать домашку'))
    expect(readyPlan('покушать')?.title).toBe('Покушать')
  })
  it('опечатки в синонимах тоже узнаются', () => {
    expect(readyPlan('покущать')?.value.steps).toEqual(readyPlan('Поесть')?.value.steps)
    expect(readyPlan('пинять душ')?.value.steps).toEqual(readyPlan('Сходить в душ')?.value.steps)
  })
  it('не синонимы — дела с похожими шагами, но другим способом, предметом или объёмом (владелец 16.11)', () => {
    // помыться можно и в ванне, посудомойка — не раковина, гречка — не любая каша, подстричься можно дома
    for (const [a, b] of [['помыться', 'Сходить в душ'], ['загрузить посудомойку', 'Помыть посуду'], ['постричься', 'Сходить к парикмахеру'], ['уйти с работы', 'Уволиться'], ['поправиться', 'Набрать вес'], ['погасить кредит', 'Закрыть кредит']] as const)
      expect(readyPlan(a)?.value.steps ?? null, a).not.toEqual(readyPlan(b)?.value.steps)
  })
  it('каждый синоним ведёт к плану своего дела, а каждое дело — к своему плану (синонимы не перехватывают дела)', () => {
    for (const [title, steps] of Object.entries(GOBLIN_PLANS)) expect(readyPlan(title)?.value.steps, title).toEqual([...steps])
    for (const [title, aliases] of Object.entries(TASK_ALIASES)) {
      const own = readyPlan(title)?.value.steps
      for (const a of aliases) expect(readyPlan(a)?.value.steps, `${a} → ${title}`).toEqual(own)
    }
  })
})
