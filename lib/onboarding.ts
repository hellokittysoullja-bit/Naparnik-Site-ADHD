/**
 * Первый вход: два вопроса голосом напарника → шаг на 2 минуты → старт.
 *
 * Правило Appelune из базы знаний: каждый вопрос обязан менять то, что
 * человек увидит дальше, иначе его не задают. Здесь «что висит» меняет
 * готовые шаги, «что мешает» — реплику кота и то, как он объясняет
 * «почему всего 2 минуты». Ответы лежат локально (как вся память
 * продукта) и потом пригодятся репликам напарника.
 */

export type Sphere = 'study' | 'work' | 'home' | 'message' | 'unsure'
export type Blocker = 'where' | 'boring' | 'fear' | 'tired'

export const SPHERES: { key: Sphere; label: string }[] = [
  { key: 'study', label: 'Учёба' },
  { key: 'work', label: 'Работа' },
  { key: 'home', label: 'Дом и быт' },
  { key: 'message', label: 'Написать или позвонить' },
  { key: 'unsure', label: 'Пока не знаю' },
]

export const BLOCKERS: { key: Blocker; label: string; reaction: string }[] = [
  {
    key: 'where',
    label: 'Не знаю, с чего начать',
    reaction: 'Тогда первый шаг подберу *я*. Крошечный.',
  },
  {
    key: 'boring',
    label: 'Скучно — тянет на другое',
    reaction: 'Значит, коротко: всего *две минуты*, и я рядом.',
  },
  {
    key: 'fear',
    label: 'Боюсь, что выйдет плохо',
    reaction: 'Можно криво. Черновик *никто не увидит*.',
  },
  {
    key: 'tired',
    label: 'Совсем нет сил',
    reaction: 'Хватит *двух минут*. Можно даже лёжа.',
  },
]

/** Первый шаг: физический, смешно маленький, меньше 2 минут (Fogg, Barkley). */
export const STEPS: Record<Sphere, string[]> = {
  study: ['Открыть конспект', 'Прочитать один абзац', 'Записать один вопрос'],
  work: ['Открыть нужный файл', 'Написать первую строку', 'Разобрать одно письмо'],
  home: ['Убрать одну вещь', 'Помыть одну чашку', 'Разобрать один угол стола'],
  message: ['Открыть переписку', 'Написать черновик ответа', 'Найти нужный номер'],
  unsure: ['Открыть то, что висит', 'Убрать одну вещь', 'Ответить на одно сообщение'],
}

export const FIRST_MINUTES = 2

export type OnboardingState = {
  step: number
  sphere: Sphere | null
  blocker: Blocker | null
  firstStep: string | null
}

const KEY = 'naparnik:onboarding'

export const EMPTY_ONBOARDING: OnboardingState = {
  step: 1,
  sphere: null,
  blocker: null,
  firstStep: null,
}

/** Шаг онбординга переживает перезагрузку: вернулся — продолжаем, не с нуля. */
export function readOnboarding(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY_ONBOARDING
    const saved = { ...EMPTY_ONBOARDING, ...(JSON.parse(raw) as Partial<OnboardingState>) }
    // Приветствие убрано: лендинг и есть приветствие, сразу к первому вопросу
    return { ...saved, step: Math.max(1, saved.step) }
  } catch {
    return EMPTY_ONBOARDING
  }
}

export function writeOnboarding(state: OnboardingState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* приватный режим — онбординг просто не запомнит шаг */
  }
}
