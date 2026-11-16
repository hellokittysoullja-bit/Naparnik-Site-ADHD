import { describe, expect, it } from 'vitest'
import { buildMatcher, distance } from '@/lib/ai/agents/breakdown-match'
import { readyPlan } from '@/lib/ai/agents/breakdown'

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
    expect(t('покакать')).toBeNull()
    expect(t('написать курсач')).toBeNull()
    expect(t('Hh')).toBeNull()
    expect(t('')).toBeNull()
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
})
