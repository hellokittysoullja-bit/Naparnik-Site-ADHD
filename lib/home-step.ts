import { defaultStep, type Blocker, type Motive, type Sphere } from './onboarding'
/**
 * Дом «Привал» (research/22-chat-and-home/E-home-design.md §10–12, согласовано владельцем 13.11): у всех один экран —
 * «Что сейчас висит?», поле, три сферы, строка над кнопкой, «Разломать на шаг». От ответов знакомства зависят только
 * подсвеченная сфера, пример в поле, строка над кнопкой и дело для дробления при пустом поле. Состояний «по плану»,
 * «следующий шаг» и т. п. на Доме нет — решение владельца 13.11 («всегда должно быть как на примере»).
 */

export type HomeProfile = { sphere?: string; blocker?: string; motive?: string } | null

// ---------- строка над кнопкой: «что мешает» × «что изменится первым» (§12, 25 вариантов) ----------

const BLOCKER_KEYS = ['where', 'phone', 'fear', 'boring', 'tired'] as const satisfies readonly Blocker[]
const MOTIVE_KEYS = ['relief', 'people', 'safety', 'rest', 'proof'] as const satisfies readonly Motive[]

const HINTS: Record<Blocker, Record<Motive, string>> = {
  where: {
    relief: 'Один шаг, и в голове уже тише',
    people: 'Первый шаг, и ответ близкому уже ближе',
    safety: 'Начнём с понятного куска, спокойствие придёт следом',
    rest: 'Один понятный шаг, и вечер освобождается',
    proof: 'Первый шаг понятен. Покажи себе, что можешь',
  },
  phone: {
    relief: 'Две минуты без телефона, и голова выдохнет',
    people: 'Телефон подождёт, а близкий человек ждёт дольше',
    safety: 'Телефон экраном вниз, спокойствие ближе ленты',
    rest: 'Две минуты без ленты, и вечер твой',
    proof: 'Телефон вниз. Ты сильнее этой привычки',
  },
  fear: {
    relief: 'Можно криво. Главное, чтобы перестало висеть',
    people: 'Можно ответить неидеально, это всё равно ответ',
    safety: 'Черновик уже лучше пустоты, и сразу спокойнее',
    rest: 'Сделай криво, и вечер будет твоим',
    proof: 'Криво тоже считается. Это и есть доказательство',
  },
  boring: {
    relief: 'Две минуты скуки, и одной вкладкой меньше',
    people: 'Две минуты, и близкий человек получит ответ',
    safety: 'Всего две минуты до спокойствия',
    rest: 'Две минуты сейчас, и вечер весь твой',
    proof: 'Две минуты, и ещё одно доказательство',
  },
  tired: {
    relief: 'Просто открой. Даже это уже легче',
    people: 'Только открыть. Ответ начнётся сам',
    safety: 'Только открыть, это уже шаг к спокойствию',
    rest: 'Самое лёгкое, и можно отдыхать честно',
    proof: 'Даже открыть уже считается',
  },
}

/** Ответ только на «ради чего» (тексты владельца 13.11) */
const MOTIVE_ONLY: Record<Motive, string> = {
  relief: 'Чтобы в голове стало на одну вкладку меньше',
  people: 'Чтобы близкий человек дождался ответа',
  safety: 'Чтобы быть в спокойствии',
  rest: 'Чтобы вечер был полностью твой',
  proof: 'Ещё одно доказательство, что ты можешь',
}

/** Ответ только на «что мешает» */
const BLOCKER_ONLY: Record<Blocker, string> = {
  where: 'Первый шаг уже выбран, думать не нужно',
  phone: 'Телефон экраном вниз, и поехали',
  fear: 'Можно криво. Сначала просто начнём',
  boring: 'Всего 2 минуты, потом решишь, продолжать ли',
  tired: 'Совсем чуть-чуть, бросить можно когда угодно',
}

const asBlocker = (v: string | undefined): Blocker | null => ((BLOCKER_KEYS as readonly string[]).includes(v ?? '') ? (v as Blocker) : null)
const asMotive = (v: string | undefined): Motive | null => ((MOTIVE_KEYS as readonly string[]).includes(v ?? '') ? (v as Motive) : null)

/**
 * Строка над главной кнопкой есть всегда (владелец, 13.11: без неё экран не тот). По двум ответам знакомства — одна
 * из 25, по одному — его строка; знакомства нет, ответы старого формата или человек попросил их забыть — общая
 * строка из утверждённых (подходит и к плану, и к пустому Дому).
 */
export const HINT_DEFAULT = 'Можно криво. Сначала просто начнём'

export function homeHint(profile: HomeProfile): string {
  const b = asBlocker(profile?.blocker)
  const m = asMotive(profile?.motive)
  if (b && m) return HINTS[b][m]
  if (m) return MOTIVE_ONLY[m]
  if (b) return BLOCKER_ONLY[b]
  return HINT_DEFAULT
}

// ---------- подсказки сфер на «Что сейчас висит?» ----------

export type HomeChip = { sphere: Sphere; label: string; icon: string }

/** Учёба, Работа, Дом; выбравшему в знакомстве «Написать или позвонить» — «Написать» вместо «Дом» */
export function homeChips(profile: HomeProfile): HomeChip[] {
  const third: HomeChip =
    profile?.sphere === 'message' ? { sphere: 'message', label: 'Написать', icon: '✉️' } : { sphere: 'home', label: 'Дом', icon: '🏠' }
  return [{ sphere: 'study', label: 'Учёба', icon: '📚' }, { sphere: 'work', label: 'Работа', icon: '💼' }, third]
}

export function homeSphere(profile: HomeProfile): Sphere | null {
  const s = profile?.sphere
  return s === 'study' || s === 'work' || s === 'home' || s === 'message' ? s : null
}

const EXAMPLES: Record<Sphere, string> = {
  study: 'например, «курсовая» или «реферат»',
  work: 'например, «отчёт» или «письмо клиенту»',
  home: 'например, «посуда» или «стирка»',
  message: 'например, «написать маме»',
  unsure: 'например, «курсовая» или «почта»',
}

export const homeExample = (sphere: Sphere | null) => EXAMPLES[sphere ?? 'unsure']

/** Что отдать на дробление, если поле пустое: шаг по сфере и помехе из знакомства */
export function homeFallbackTask(sphere: Sphere | null, profile: HomeProfile): string {
  return defaultStep(sphere, asBlocker(profile?.blocker))
}

/** Адрес «Разломать на шаг»: Фокус с делом в поле и сразу запущенным дроблением */
export function breakHref(step: string): string {
  const q = new URLSearchParams({ step: step.trim().slice(0, 120), break: '1' })
  return `/app/session?${q.toString()}`
}

export function findsLabel(n: number): string {
  const tens = n % 100
  const ones = n % 10
  const word = tens >= 11 && tens <= 14 ? 'находок' : ones === 1 ? 'находка' : ones >= 2 && ones <= 4 ? 'находки' : 'находок'
  return `${n} ${word}`
}
