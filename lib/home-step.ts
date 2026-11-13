import { defaultStep, type Blocker, type Motive, type Sphere } from './onboarding'
import type { Plan, StartEntry, StepQueue } from './memory'

/**
 * Что показать на Доме (research/22-chat-and-home/E-home-design.md §8–12, согласовано владельцем 13.11).
 * Чистая функция над памятью устройства: никаких случайных фраз — только то, о чём человек договорился сам
 * (план, очередь шагов, старты) или что выбрал в знакомстве (сфера, помеха, «ради чего»).
 *
 * Порядок (берётся первое подходящее): план на сегодня → план на завтра → очередь шагов → план из прошлых дней
 * (до 7 дней) → сегодня уже был старт → «Что сейчас висит?».
 */

export type HomeKind = 'plan-now' | 'plan-later' | 'tomorrow' | 'queue' | 'carry' | 'done-today' | 'empty'

export type HomeStep = {
  kind: HomeKind
  /** Моно-надпись над шагом: состояние и время */
  label: string
  /** Шаг крупно — словами человека; null у «Что сейчас висит?» (там поле ввода) */
  title: string | null
  /** Подпись под шагом: дело */
  sub: string | null
  /** Старт засчитывается плану (`plan=1` в адресе Фокуса) */
  fromPlan: boolean
}

export type HomeProfile = { sphere?: string; blocker?: string; motive?: string } | null

/** План из прошлых дней держится неделю, потом уходит (дни не считаем и не показываем) */
const CARRY_DAYS = 7
/** «Позже» — если до времени плана больше получаса */
const LATER_MIN = 30

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function daysBetween(fromKey: string, toKey: string): number {
  const [a, b] = [fromKey, toKey].map((k) => {
    const [y, m, d] = k.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  })
  return Math.round((b - a) / 86_400_000)
}

/**
 * Точное время плана — только если вся строка и есть время: «09:00», «9.30», «в 18», «в 9 вечера».
 * «через 15 минут», «после 2 пары», «утром» → null: тогда на Доме просто «ПО ПЛАНУ», без выдуманного часа
 * (проверка 13.11: поле времени у плана — свободный текст до 40 знаков, его пишет и ИИ).
 */
const CLOCK = /^\s*(?:в\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(утра|дня|вечера)?\s*$/i

export function planMinutes(startTime: string | undefined): number | null {
  const m = startTime?.match(CLOCK)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const part = m[3]?.toLowerCase()
  if ((part === 'дня' || part === 'вечера') && h < 12) h += 12
  return h <= 23 && min <= 59 ? h * 60 + min : null
}

const hhmm = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

/** Строка дела под шагом — только если она не повторяет сам шаг (iPhone владельца 13.11: «Н» и под ним «Н»). */
function other(task: string, title: string): string | null {
  const t = task.trim()
  return t && t.toLowerCase() !== title.trim().toLowerCase() ? t : null
}

export function homeStep(input: {
  now: Date
  plan: Plan | null
  queue: StepQueue | null
  starts: StartEntry[]
}): HomeStep {
  const { now, plan, queue, starts } = input
  const today = dayKey(now)
  const startedToday = starts.filter((s) => s.date === today)
  // по плану уже начинали сегодня — план исполнен, он не висит на Доме
  const planDone = plan !== null && startedToday.some((s) => s.fromPlan)
  const at = plan ? planMinutes(plan.startTime) : null

  if (plan && !planDone && plan.forDate === today) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const later = at !== null && at - nowMin > LATER_MIN
    return {
      kind: later ? 'plan-later' : 'plan-now',
      label: at !== null ? `ПО ПЛАНУ · ${hhmm(at)}` : 'ПО ПЛАНУ',
      title: plan.firstStep,
      sub: other(plan.task, plan.firstStep),
      fromPlan: true,
    }
  }
  if (plan && !planDone && plan.forDate > today) {
    return { kind: 'tomorrow', label: at !== null ? `ЗАВТРА · ${hhmm(at)}` : 'ЗАВТРА', title: plan.firstStep, sub: other(plan.task, plan.firstStep), fromPlan: true }
  }
  if (queue && queue.steps.length > 0) {
    return { kind: 'queue', label: 'СЛЕДУЮЩИЙ ШАГ', title: queue.steps[0], sub: other(queue.task, queue.steps[0]), fromPlan: false }
  }
  if (plan && !planDone && plan.forDate < today && daysBetween(plan.forDate, today) <= CARRY_DAYS) {
    return { kind: 'carry', label: 'ПРОДОЛЖИМ', title: plan.firstStep, sub: other(plan.task, plan.firstStep), fromPlan: true }
  }
  if (startedToday.length > 0) {
    const last = startedToday[startedToday.length - 1]
    return { kind: 'done-today', label: 'СЕГОДНЯ СТАРТ УЖЕ БЫЛ', title: last.label, sub: 'это достаточно на сегодня', fromPlan: false }
  }
  return { kind: 'empty', label: 'ЧТО СЕЙЧАС ВИСИТ?', title: null, sub: null, fromPlan: false }
}

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
export function breakHref(step: string, fromPlan: boolean): string {
  const q = new URLSearchParams({ step: step.trim().slice(0, 120), break: '1' })
  if (fromPlan) q.set('plan', '1')
  return `/app/session?${q.toString()}`
}

export function findsLabel(n: number): string {
  const tens = n % 100
  const ones = n % 10
  const word = tens >= 11 && tens <= 14 ? 'находок' : ones === 1 ? 'находка' : ones >= 2 && ones <= 4 ? 'находки' : 'находок'
  return `${n} ${word}`
}
