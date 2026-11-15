import { dataMessage } from '../context'
import { newTurn, type TurnContext } from '../core/turn'
import { NoMemory, prefetchWithin, type MemoryProvider } from '../memory/provider'
import { memoryWords, renderTaskMemory } from '../memory/render'
import { runTurn } from '../core/run-turn'

/**
 * Дробление задачи на три крошечных шага (task initiation — главный барьер при СДВГ). Используется Фокусом
 * («Раздроби») и знакомством («Подскажи» со своим делом — берётся первый шаг).
 */
export const BREAKDOWN_SYSTEM = `Режим: ДРОБЛЕНИЕ ЗАДАЧИ. Человек назвал дело (оно в блоке данных), которое его пугает своим размером. Разбей его на РОВНО 3 крошечных первых шага. Правила:
- Каждый шаг выполняется за 1-5 минут, не больше
- Каждый начинается с глагола («Открыть…», «Найти…», «Написать…»)
- Первый шаг самый крошечный, почти смешной («Открыть документ»)
- Максимум 6 слов на шаг
- Никаких пояснений: ответь ТОЛЬКО тремя строками, по шагу на строку
- В конце каждой строки через вертикальную черту поставь честную оценку в минутах числом: «Открыть документ | 1»
- Если в данных есть «Силы сейчас: мало», шаги совсем лёгкие: открыть, посмотреть, достать, по 1-2 минуты, без решений и без письма с нуля. Если «много», шаги могут быть по 5 минут и содержательнее
- Если в данных есть «Размер шагов: мельче», дроби до одного движения рукой («Открыть ноутбук»); если «крупнее», шаг может занимать до 10 минут
- Если перед делом есть блок ПАМЯТЬ О ЧЕЛОВЕКЕ, делай шаги под этого человека: его программы и места, то, с чего он уже начинал это дело, то, что ему мешает и помогает, и его просьбы «как говорить» (короче, буквально, без шуток). Саму память не пересказывай и не упоминай: в ответе только три шага`

export const BREAKDOWN_FALLBACK = ['Открыть то, что нужно для дела', 'Сделать одно крошечное действие', 'Записать, что дальше']

/**
 * Три шага из ответа модели. Модель иногда добавляет вступление («Слишком огромно, давай сузим. Вот три кусочка:»),
 * и оно попадало первым «шагом», а третий настоящий терялся (живой прогон 12.11). Поэтому:
 *  - если пронумерованных или маркированных строк хотя бы три — шаги только они;
 *  - иначе строки, оканчивающиеся двоеточием, — вступление, не шаг;
 *  - выделение звёздочками снимается: шаг показывается на кнопке и в поле ввода как есть.
 * Каждый шаг — 1–8 слов; иначе ответ не годится (следующая модель).
 */
const MARKER = /^\s*(?:\d{1,2}[.)]|[-–—•*])\s+/

const INTRO = /^(?:давай|вот|смотри|окей|ок|хорошо|слушай|так|итак|ладно|понял|готово|держи)(?!\p{L})/iu

/** «Открыть документ | 2», «Открыть документ (2 мин)» → минуты; оценка необязательна, шаг годится и без неё */
const MINUTES = /\s*(?:\||\()\s*(?:≈\s*)?(\d{1,2})\s*(?:мин\p{L}*\.?)?\s*\)?\s*$/u

export function parseStepsWithMinutes(text: string): { steps: string[]; minutes: (number | undefined)[] } | null {
  const minutes: (number | undefined)[] = []
  const bare = text
    .split('\n')
    .map((line) => {
      const m = line.match(MINUTES)
      if (!m) return line
      const n = Number(m[1])
      return `${line.slice(0, m.index)}\u0000${n >= 1 && n <= 60 ? n : ''}`
    })
    .join('\n')
  const byStep = new Map<string, number | undefined>()
  const clean = bare
    .split('\n')
    .map((line) => {
      const [body, n] = line.split('\u0000')
      if (n !== undefined) byStep.set(body.trim(), n ? Number(n) : undefined)
      return body
    })
    .join('\n')
  const steps = parseSteps(clean)
  if (!steps) return null
  for (const st of steps) {
    const hit = [...byStep.entries()].find(([k]) => k.replace(/\*/g, '').endsWith(st))
    minutes.push(hit?.[1])
  }
  return { steps, minutes }
}

export function parseSteps(text: string): string[] | null {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const marked = lines.filter((s) => MARKER.test(s))
  let candidates = marked.length >= 3 ? marked : lines.filter((s) => !s.endsWith(':'))
  // вступление без двоеточия («Давай разобьём.», «Смотри, вот так!») — не шаг: при лишних строках оно уходит первым,
  // иначе третий настоящий шаг терялся (аудит 12.11)
  if (marked.length < 3 && candidates.length > 3) {
    const steps = candidates.filter((s) => !INTRO.test(s) && !/[!?]$/.test(s))
    if (steps.length >= 3) candidates = steps
  }
  const steps = candidates
    .map((s) => s.replace(MARKER, '').replace(/\*/g, '').replace(/^[\s\d\-–—.)•]+/, '').trim())
    .filter(Boolean)
  if (steps.length < 3) return null
  const three = steps.slice(0, 3)
  return three.every((s) => {
    const words = s.split(/\s+/).length
    return words >= 1 && words <= 8
  })
    ? three
    : null
}

export type BreakdownResult =
  | { kind: 'steps'; steps: string[]; minutes?: (number | undefined)[]; source: 'model' | 'fallback' }
  | { kind: 'care'; reply: string }

export async function breakdown(input: {
  ctx?: TurnContext
  task: string
  /** память о человеке (Фокус); знакомство зовёт без неё: человек только пришёл */
  memory?: MemoryProvider
  /** контекст знакомства: сфера и помеха (необязательно) */
  context?: Record<string, string | undefined>
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<BreakdownResult> {
  const ctx = input.ctx ?? newTurn({ task: 'breakdown' })
  const snapshot = await prefetchWithin(input.memory ?? NoMemory, ctx)
  const { value, outcome } = await runTurn<BreakdownResult>({
    ctx,
    system: BREAKDOWN_SYSTEM,
    memory: renderTaskMemory(snapshot, input.task, 'breakdown'),
    echoExtra: memoryWords(snapshot),
    data: dataMessage({ Дело: input.task, ...input.context }),
    userTexts: [input.task],
    timeoutMs: input.timeoutMs ?? 8000,
    hedgeAfterMs: 2000,
    // Gemini через AnyModel иногда рассуждает скрыто, несмотря на reasoning_effort: none (набор задач 12.11: 160 из 160
    // токенов ушли на рассуждение, текста ноль). Платим за потраченное, запас бесплатен
    maxOutputTokens: 1000,
    maxChars: 340,
    parse: (text) => {
      const r = parseStepsWithMinutes(text)
      // оценки нет ни у одного шага — поля нет вовсе (ответ тот же, что был до оценок)
      return r ? { kind: 'steps', steps: r.steps, ...(r.minutes.some(Boolean) ? { minutes: r.minutes } : {}), source: 'model' } : null
    },
    fallback: () => ({ kind: 'steps', steps: BREAKDOWN_FALLBACK, source: 'fallback' }),
    // кризисный текст вместо дела — не шаги, а бережный проверенный ответ (lib/ai/crisis.ts)
    onCrisis: (reply) => ({ kind: 'care', reply }),
    signal: input.signal,
  })
  return value.kind === 'steps' && outcome !== 'model' ? { ...value, source: 'fallback' } : value
}
