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
    // «тёте» не уводит в «Позвонить маме»: у тёти теперь своё дело (batch8), а у соседки дела нет
    expect(t('позвонить тёте')).toBe('Позвонить тёте')
    expect(t('позвонить соседке')).toBeNull()
    expect(t('помыть посуду после гостей')).toBeNull()
    expect(t('сходить в зол')).toBeNull()
    // «покакать» — синоним туалетного дела, а не опечатка в «поплакать»
    expect(t('покакать')).not.toBe('Поплакать')
    expect(t('Hh')).toBeNull()
    expect(t('')).toBeNull()
  })
  it('дела для СДВГ (18.11): ступор, «когда нет сил», висящие письма узнаются; дубли ведут к старым делам', () => {
    expect(t('выйти из ступора')).toBe('Выйти из ступора')
    expect(t('помыться когда нет сил')).toBe('Помыться, когда нет сил')
    expect(readyPlan('ответить на висящее письмо')?.value.steps.join(' ')).not.toMatch(/[—–]/)
    expect(readyPlan('остановить думскроллинг')?.value.steps).toEqual(readyPlan('Перестать залипать в телефон')?.value.steps)
  })
  it('четвёртая партия (18.11): «Открыть переписку» есть, «передохнуть» и «отлежаться» не уходят в чужие дела', () => {
    expect(t('открыть переписку')).toBe('Открыть переписку')
    expect(t('открыть перепеску')).toBe('Открыть переписку')
    expect(readyPlan('передохнуть')?.value.steps).toEqual(readyPlan('Сделать перерыв')?.value.steps)
    expect(readyPlan('отлежаться')?.value.steps).toEqual(readyPlan('Вылечить простуду')?.value.steps)
    // дубль другими словами слит в синоним, а не стал вторым делом
    expect(readyPlan('пройти медкомиссию')?.value.steps).toEqual(readyPlan('Пройти медосмотр')?.value.steps)
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
  it('сон не уходит в туалет: «проспаться» — выспаться, «спать» — лечь спать (20.11)', () => {
    expect(readyPlan('Проспаться')?.value.steps).toEqual(readyPlan('Выспаться')?.value.steps)
    expect(readyPlan('Спать')?.value.steps).toEqual(readyPlan('Лечь спать')?.value.steps)
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
  it('опечатка туалетного слова не уходит в соседнее обычное дело: «порать» — не «Пожрать» (владелец 17.11)', () => {
    for (const w of ['порать', 'почрать', 'помрать']) expect(readyPlan(w), w).toBeNull()
    expect(readyPlan('пожрать')?.value.steps).toEqual(readyPlan('Поесть')?.value.steps)
    // «пожрат» на одну букву и от «пожрать», и от «посрат» (частая ошибка в «посрать») — не угадываем, разбивает модель
    expect(readyPlan('пожрат')).toBeNull()
  })
  it('сленг и частые ошибки написания ведут к своему делу (17.11)', () => {
    const same: [string, string][] = [
      ['поссать', 'Сходить в туалет'], ['отлить', 'Сходить в туалет'], ['пописять', 'Сходить в туалет'], ['пасрать', 'Посрать'],
      ['сгонять в магаз', 'Сходить в магазин'], ['закинуть стирку', 'Постирать бельё'], ['пофиксить баг', 'Исправить баг'],
      ['набить тату', 'Сделать тату'], ['заварить доширак', 'Заварить лапшу'], ['сделать дз', 'Сделать домашку'],
    ]
    for (const [a, b] of same) expect(readyPlan(a)?.value.steps, a).toEqual(readyPlan(b)?.value.steps)
    // сленг, который исправлением ушёл бы в другое дело, в базу не добавлен
    expect(readyPlan('прикупить машину')).toBeNull()
  })
})
