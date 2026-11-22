import { dataMessage } from '../context'
import { newTurn, type TurnContext } from '../core/turn'
import { runTurn } from '../core/run-turn'
import { readyPlan } from './breakdown'

/**
 * «Не могу начать» (владелец 22.11, функция 1): ровно ОДИН шаг, а не план. Лестница уменьшения: 2 минуты → 30 секунд →
 * «Просто открой … Всё.» Человек не упирается в стену никогда: последняя ступень есть всегда и не зависит от модели.
 */
export type Situation = 'study' | 'work' | 'home' | 'other'
export type StepLevel = 0 | 1 | 2
export type OneStep = { step: string; seconds: number; source: 'model' | 'library' | 'pool' }

export const LEVEL_SECONDS: Record<StepLevel, number> = { 0: 120, 1: 30, 2: 10 }

/** правила владельца для ИИ, слово в слово по смыслу (22.11) */
export const ONE_STEP_SYSTEM = `Ты даёшь человеку, который не может начать дело, ровно ОДИН первый шаг. Правила:
- Ровно один шаг: физическое видимое действие, которое можно сделать прямо сейчас
- Начинается с глагола в повелительной форме на «ты» («Открой», «Возьми», «Напиши»), не длиннее 12 слов, занимает не больше 2 минут
- Конкретный предмет: файл, тетрадь, тряпка, номер телефона, письмо. Не абстракция
- Запрещены слова «подумай», «спланируй», «организуй», «разберись», «реши», «определи», «соберись»
- Тон тёплый и спокойный: без восклицательных знаков, без призывов и без «ты должен», «нужно», «надо»
- Если в данных есть «Уровень: в 4 раза меньше», шаг в 4 раза меньше прошлого: одно движение, до 30 секунд
- Не повторяй шаги из «Уже были»
- В конце через вертикальную черту поставь, сколько секунд займёт шаг, числом
Ответь одной строкой: шаг | секунды`

// \b в JS не видит границ русских слов — границы заданы буквами явно
const FORBIDDEN = /(^|[^а-яё])(подумай|спланируй|организуй|разберись|реши|определи|соберись|должен|должна|нужно|надо)(?![а-яё])/i

/** разбор ответа модели: одна строка «шаг | секунды»; всё, что нарушает правила, — мимо (шаг даст запасная ступень) */
export function parseOneStep(text: string, level: StepLevel): { step: string; seconds: number } | null {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean)
  if (!line) return null
  const [raw, secRaw] = line.split('|').map((s) => s.trim())
  const step = raw?.replace(/^[-•*\d.)\s]+/, '').replace(/[«»"]/g, '').replace(/!+/g, '.').replace(/\s+/g, ' ').trim()
  if (!step || step.length < 6) return null
  const words = step.split(' ').length
  if (words > 12 || FORBIDDEN.test(step) || /[?]/.test(step)) return null
  const n = Number.parseInt(secRaw ?? '', 10)
  const cap = LEVEL_SECONDS[level]
  const seconds = Number.isFinite(n) && n > 0 ? Math.min(n, cap) : cap
  return { step: step.endsWith('.') ? step : `${step}.`, seconds }
}

/**
 * Шаги без дела («Пропустить») и запасные ступени, когда модели нет. Тексты — для согласования владельцем (22.11).
 * Ступень 0 — до 2 минут, 1 — до 30 секунд, 2 — «Просто открой … Всё.»
 */
export const POOL: Record<Situation, [string[], string[], string]> = {
  study: [
    ['Открой конспект и прочитай первый абзац.', 'Положи тетрадь на стол и напиши сегодняшнюю дату.', 'Открой файл и напиши заголовок первой главы.'],
    ['Положи тетрадь перед собой.', 'Открой учебник на нужной странице.', 'Возьми ручку в руку.'],
    'Просто открой тетрадь. Всё.',
  ],
  work: [
    ['Открой файл и напиши первую строчку, как получится.', 'Открой почту и прочитай одно письмо.', 'Выпиши три слова о том, что сделать сегодня.'],
    ['Открой нужный файл.', 'Открой почту.', 'Поставь курсор в начало документа.'],
    'Просто открой файл. Всё.',
  ],
  home: [
    ['Возьми пакет и собери в него мусор с одного стола.', 'Отнеси одну кружку на кухню.', 'Протри одну полку.'],
    ['Встань и подойди к месту, где беспорядок.', 'Возьми в руки одну вещь не на месте.', 'Открой окно.'],
    'Просто встань с места. Всё.',
  ],
  other: [
    ['Возьми телефон и открой то, что откладываешь.', 'Запиши дело одним предложением на листке.', 'Положи нужную вещь перед собой.'],
    ['Положи телефон экраном вниз.', 'Открой то, что нужно для дела.', 'Сделай один вдох и встань.'],
    'Просто открой то, что нужно. Всё.',
  ],
}

function fromPool(situation: Situation, level: StepLevel, avoid: readonly string[]): OneStep {
  const [l0, l1, last] = POOL[situation]
  if (level === 2) return { step: last, seconds: LEVEL_SECONDS[2], source: 'pool' }
  const list = level === 0 ? l0 : l1
  const step = list.find((s) => !avoid.includes(s)) ?? list[avoid.length % list.length]
  return { step, seconds: LEVEL_SECONDS[level], source: 'pool' }
}

/** первый шаг плана из базы, на «ты»: «Открыть письмо» → «Открой письмо.» (только частые глаголы, иначе мимо) */
const IMPERATIVE: Record<string, string> = {
  открыть: 'Открой', взять: 'Возьми', написать: 'Напиши', найти: 'Найди', положить: 'Положи', включить: 'Включи',
  собрать: 'Собери', прочитать: 'Прочитай', достать: 'Достань', встать: 'Встань', выписать: 'Выпиши', записать: 'Запиши',
  набрать: 'Набери', поставить: 'Поставь', сложить: 'Сложи', убрать: 'Убери', налить: 'Налей', выбрать: 'Выбери',
  отнести: 'Отнеси', снять: 'Сними', протереть: 'Протри', посмотреть: 'Посмотри', проверить: 'Проверь', зайти: 'Зайди',
  сесть: 'Сядь', начать: 'Начни', помыть: 'Помой', вынести: 'Вынеси', позвонить: 'Позвони', отправить: 'Отправь',
}
export function toImperative(step: string): string | null {
  const words = step.trim().replace(/[.!]+$/, '').split(/\s+/)
  if (words.length < 2 || words.length > 12) return null
  const out = words.map((w, i) => {
    const imp = IMPERATIVE[w.toLowerCase()]
    if (!imp) return w
    return i === 0 ? imp : imp.toLowerCase()
  })
  if (!IMPERATIVE[words[0].toLowerCase()]) return null
  // второй глагол после «и» или запятой остался в неопределённой форме («Собери и изучить») — такой шаг мимо
  for (let i = 1; i < out.length; i++) if (/(ть|ться|чь)$/.test(out[i]) && /^(и|или|,)$|,$/.test(out[i - 1])) return null
  return `${out.join(' ')}.`
}

function fromLibrary(task: string, avoid: readonly string[]): OneStep | null {
  const hit = readyPlan(task)
  if (!hit) return null
  for (let i = 0; i < Math.min(2, hit.value.steps.length); i++) {
    const step = toImperative(hit.value.steps[i])
    if (!step || avoid.includes(step)) continue
    const min = hit.value.minutes?.[i]
    if (min && min > 5) continue
    return { step, seconds: Math.min(LEVEL_SECONDS[0], min ? min * 60 : LEVEL_SECONDS[0]), source: 'library' }
  }
  return null
}

export async function oneStep(input: {
  situation: Situation
  task?: string
  level: StepLevel
  avoid: readonly string[]
  energy?: 'low' | 'mid' | 'high'
  ctx?: TurnContext
  signal?: AbortSignal
}): Promise<OneStep> {
  const { situation, level, avoid } = input
  const task = input.task?.trim()
  // последняя ступень — всегда своя и мгновенная: «Просто открой … Всё.»
  if (level === 2 || !task) return fromPool(situation, level, avoid)
  // дело есть в базе — первый лёгкий шаг её плана сразу, без модели (база одна везде, владелец 22.11)
  const library = level === 0 ? fromLibrary(task, avoid) : null
  if (library) return library
  const fallback = () => library ?? fromPool(situation, level, avoid)
  const { value, outcome } = await runTurn<OneStep>({
    ctx: input.ctx ?? newTurn({ task: 'one-step' }),
    system: ONE_STEP_SYSTEM,
    noPersona: true,
    data: dataMessage({
      Дело: task,
      Ситуация: { study: 'учёба', work: 'работа', home: 'дом', other: 'другое' }[situation],
      Уровень: level === 1 ? 'в 4 раза меньше прошлого шага' : 'обычный шаг до 2 минут',
      'Силы сейчас': input.energy === 'low' ? 'мало' : undefined,
      'Уже были': avoid.length ? avoid.join('; ') : undefined,
    }),
    userTexts: [task],
    timeoutMs: 2500,
    hedgeAfterMs: 1200,
    maxOutputTokens: 400,
    temperature: 0.5,
    maxChars: 200,
    parse: (t) => {
      const p = parseOneStep(t, level)
      return p && !avoid.includes(p.step) ? { ...p, source: 'model' } : null
    },
    fallback,
    // кризисный текст вместо дела — не шаг: экран покажет общий маленький шаг, а бережный ответ даёт чат
    onCrisis: () => fromPool(situation, level, avoid),
    signal: input.signal,
  })
  return outcome === 'model' ? value : fallback()
}
