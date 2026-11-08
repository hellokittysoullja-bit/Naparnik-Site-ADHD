/**
 * Первый вход: три вопроса голосом напарника → шаг на 2 минуты → старт.
 *
 * Правило Appelune из базы знаний: каждый вопрос обязан менять то, что
 * человек увидит дальше, иначе его не задают. Здесь «что висит» меняет
 * готовые шаги, «что мешает» — реплику кота и то, как он объясняет
 * «почему всего 2 минуты». Ответы лежат локально (как вся память
 * продукта) и потом пригодятся репликам напарника.
 */

export type Sphere = 'study' | 'work' | 'home' | 'message' | 'unsure'
export type Hanging = 'day' | 'week' | 'month' | 'unknown'
export type Blocker = 'where' | 'phone' | 'fear' | 'boring' | 'tired'

export const SPHERES: { key: Sphere; label: string }[] = [
  { key: 'study', label: 'Учёба' },
  { key: 'work', label: 'Работа' },
  { key: 'home', label: 'Дом и быт' },
  { key: 'message', label: 'Написать или позвонить' },
  { key: 'unsure', label: 'Пока не знаю' },
]

/**
 * «Сколько уже висит?» — сразу после «что висит». Ответ без оценки: кот не считает, сколько потеряно, а снимает
 * вес — «двух минут хватит». Висящее дело тянет вернуться (эффект Овсянкиной), а длинный срок без упрёка снимает
 * стыд, на котором держится избегание (Fee и Tangney). Метка срока видна на договоре и при сборке.
 */
export const HANGING: { key: Hanging; label: string; reaction: string; chip: string }[] = [
  { key: 'day', label: 'День', reaction: 'Свежее. *Двух минут* хватит.', chip: 'Висит день' },
  { key: 'week', label: 'Неделю', reaction: 'Неделя — нормально. *Двух минут* хватит.', chip: 'Висит неделю' },
  { key: 'month', label: 'Месяц или дольше', reaction: 'Бывает. Без разборов — просто *2 минуты*.', chip: 'Висит месяц и дольше' },
  { key: 'unknown', label: 'Не помню', reaction: 'Неважно. Начнём *сейчас*.', chip: '' },
]

export const BLOCKERS: { key: Blocker; label: string; reaction: string }[] = [
  {
    key: 'where',
    label: 'Не знаю, с чего начать',
    reaction: 'Тогда первый шаг подберу *я*. Крошечный.',
  },
  {
    key: 'phone',
    label: 'Рука сама тянется к телефону',
    reaction: 'Тогда положи его *экраном вниз*. Я посторожу.',
  },
  {
    key: 'fear',
    label: 'Боюсь, что выйдет плохо',
    reaction: 'Можно криво. Черновик *никто не увидит*.',
  },
  {
    key: 'boring',
    label: 'Скучно, сбегаю в другое',
    reaction: 'Значит, коротко: всего *две минуты*, и я рядом.',
  },
  {
    key: 'tired',
    label: 'Нет сил даже начать',
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
  hanging: Hanging | null
  blocker: Blocker | null
  firstStep: string | null
}

const KEY = 'naparnik:onboarding'

export const EMPTY_ONBOARDING: OnboardingState = {
  step: 1,
  sphere: null,
  hanging: null,
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
    // шаг из чужой/старой записи (строка, NaN) — с первого вопроса, а не пустой экран без единого шага
    const step = Number.isFinite(saved.step) ? Math.max(1, saved.step) : 1
    return { ...saved, step }
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

/**
 * Шаг и ответы знакомства — в адресе (`/app/start?step=3&s=study&h=week&b=phone&f=0`), как у Noom: «Назад» браузера
 * открывает предыдущий вопрос, перезагрузка и ссылка в новой вкладке или в Safari (из встроенного браузера Instagram
 * переносится только адрес) — тот же вопрос с теми же ответами. В адресе только ключи вариантов и номер шаблонного
 * шага; свой текст человека («Своё дело…») в адрес не попадает — `f=own`, сам текст остаётся на устройстве.
 */
const SPHERE_KEYS = new Set<string>(SPHERES.map((s) => s.key))
const HANGING_KEYS = new Set<string>(HANGING.map((h) => h.key))
const BLOCKER_KEYS = new Set<string>(BLOCKERS.map((b) => b.key))
const ONB_LAST_STEP = 5

export const ONBOARDING_QUERY_KEYS = ['step', 's', 'h', 'b', 'f'] as const

export function onboardingToQuery(state: OnboardingState): Record<string, string> {
  const q: Record<string, string> = { step: String(state.step) }
  if (state.sphere) q.s = state.sphere
  if (state.hanging) q.h = state.hanging
  if (state.blocker) q.b = state.blocker
  if (state.firstStep) {
    const i = (state.sphere ? STEPS[state.sphere] : STEPS.unsure).indexOf(state.firstStep)
    q.f = i >= 0 ? String(i) : 'own'
  }
  return q
}

/**
 * Состояние из адреса. `saved` — запись с устройства: из неё берётся только свой текст шага (`f=own`).
 * Шаг не может быть дальше первого вопроса без ответа — по ссылке нельзя «перепрыгнуть» к договору без дела.
 * Нет `step` в адресе — null (берём запись с устройства).
 */
export function onboardingFromQuery(params: URLSearchParams, saved: OnboardingState): OnboardingState | null {
  const rawStep = Number(params.get('step'))
  if (!params.has('step') || !Number.isInteger(rawStep)) return null
  const s = params.get('s')
  const h = params.get('h')
  const b = params.get('b')
  const sphere = s && SPHERE_KEYS.has(s) ? (s as Sphere) : null
  const hanging = h && HANGING_KEYS.has(h) ? (h as Hanging) : null
  const blocker = b && BLOCKER_KEYS.has(b) ? (b as Blocker) : null
  const f = params.get('f')
  let firstStep: string | null = null
  if (f === 'own') {
    const templates = sphere ? STEPS[sphere] : STEPS.unsure
    firstStep = saved.firstStep && !templates.includes(saved.firstStep) ? saved.firstStep : null
  } else if (f !== null && /^\d$/.test(f)) {
    firstStep = (sphere ? STEPS[sphere] : STEPS.unsure)[Number(f)] ?? null
  }
  // дальше первого вопроса без ответа не пускаем
  const reachable = !sphere ? 1 : !hanging ? 2 : !blocker ? 3 : !firstStep ? 4 : ONB_LAST_STEP
  const step = Math.min(Math.max(1, rawStep), reachable)
  return { step, sphere, hanging, blocker, firstStep }
}
