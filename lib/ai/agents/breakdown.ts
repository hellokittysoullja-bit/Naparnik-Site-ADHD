import { dataMessage } from '../context'
import { newTurn, type TurnContext } from '../core/turn'
import { NoMemory, prefetchWithin, type MemoryProvider } from '../memory/provider'
import { memoryWords, renderTaskMemory } from '../memory/render'
import { runTurn } from '../core/run-turn'

/**
 * Разбивка дела на шаги до самого конца, как у goblin.tools (владелец 16.11: «он что угодно правильно разбивает»).
 * Раньше кот давал ровно 3 крошечных шага на старт, и дело дальше старта не доходило. Теперь — весь путь: первый шаг
 * крошечный (вход), последний доводит дело до результата; число шагов решает дело и настройка «Как дробить». Любой шаг
 * можно разбить ещё раз — тогда в запросе есть всё дело и соседние шаги (у гоблина цепочка родителей — главное, что
 * делает глубокое дробление осмысленным: research/12-earlier-agents/goblin-tools-breakdown.md). Зовут Фокус, «Дела»,
 * бот и знакомство («Подскажи» — берётся первый шаг).
 */
export const BREAKDOWN_SYSTEM = `Режим: РАЗБИВКА ДЕЛА. Человек назвал дело (оно в блоке данных). Разбей его на шаги-действия, которые доведут это дело до конца. Правила:
- Разбивай ЛЮБОЕ дело, которое можно понять: рабочее, учебное, бытовое, телесное (поспать, сходить в туалет, помыться), личное и интимное (секс, мастурбация), странное или шуточное («поорать»; «хахаха», «ахах», «лол» значит посмеяться). Понимай сленг, мат, опечатки и латиницу вместо кириллицы. Не отказывайся, не стыди и не читай мораль: это обычное дело человека
- Интимные и телесные дела разбивай спокойно и по-взрослому, без смакования и анатомических подробностей: место, приватность, гигиена, согласие и защита, если дело с партнёром
- Ответь только шагами, по порядку, по одному на строку, без нумерации, вступлений и пояснений
- Каждый шаг это одно конкретное действие, начинается с глагола, не длиннее 8 слов
- Первый шаг самый простой, его можно сделать прямо сейчас за минуту
- Шаги покрывают ВСЁ дело от начала до конца, а не только его начало. Последний шаг завершает дело: результат готов, отправлен, сдан, бельё развешано, вещи перевезены. Нельзя заканчивать на «начать», «первое предложение», «повторить с остальным»
- Шаги про это дело, с его предметами, программами, людьми и местами. Не пиши общих шагов вроде «Подготовиться», «Определить цели», «Собраться с мыслями»
- Обычно 3-5 шагов. Совсем простое дело (моргнуть, выпить воды) 3 шага. Большое и долгое (диплом, переезд, ремонт) до 8 крупных этапов, каждый человек сможет разбить ещё
- Если в деле есть ожидание (стирка, духовка, загрузка, ответ человека), шаг, который можно сделать в это время, начни словами «Пока ждёшь:»
- В конце каждой строки через вертикальную черту поставь честную оценку в минутах числом: «Открыть документ | 1»
- Если в данных есть «Это часть дела», разбей ТОЛЬКО этот шаг на 3-5 шагов мельче его самого, внутри всего дела. Шаги из «Соседние шаги» не повторяй: они уже в плане
- Если в данных есть «Силы сейчас: мало», шаги совсем лёгкие, по 1-3 минуты, без решений и без письма с нуля, первый просто открыть или взять. Если «много», шаги могут быть крупнее
- Если в данных есть «Размер шагов: мельче», дроби до одного движения рукой, шагов больше, до 10; если «крупнее», 3-4 крупных этапа, шаг может занимать до 20 минут
- Пример. Дело «постирать бельё»:
Собрать грязное бельё в корзину | 3
Загрузить бельё в машинку и включить | 2
Пока ждёшь: протереть полку в ванной | 5
Развесить бельё на сушилке | 10
Сложить сухое бельё в шкаф | 10
- Пример большого дела «переезд»: этапы до конца, от «Составить список вещей» и «Упаковать вещи по коробкам» через «Заказать машину на день переезда» до «Перевезти коробки» и «Разобрать коробки на новом месте»
- Ответь ровно одним знаком «?» ТОЛЬКО если в «Деле» нет смысла вообще: случайные буквы без слова («Hh», «ывапрол», «кккк»). Смех и возгласы это не бессмыслица: «Хахахаха», «ахах», «лол» значит дело «посмеяться», разбей его. Если хоть как-то можно понять, что человек хочет сделать, разбивай
- Если перед делом есть блок ПАМЯТЬ О ЧЕЛОВЕКЕ, делай шаги под этого человека: его программы и места, то, с чего он уже начинал это дело, то, что ему мешает и помогает, и его просьбы «как говорить» (короче, буквально, без шуток). Саму память не пересказывай и не упоминай: в ответе только шаги`

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
const MINUTES = /\s*(?:\||\()\s*(?:≈\s*)?(\d{1,3})\s*(?:мин\p{L}*\.?)?\s*\)?\s*$/u

/** Сколько шагов принимаем от модели: меньше 3 — не разбивка, больше 12 — новая стена (у гоблина на остроте 5 их 42) */
export const PLAN_MIN = 3
export const PLAN_MAX = 12
const WAIT = /^пока\s+ждёшь\s*[:,—–-]\s*/iu

export type Plan = { steps: string[]; minutes: (number | undefined)[]; wait: boolean[] }

/**
 * План из ответа модели: 3–12 шагов по 1–10 слов, у каждого необязательная оценка в минутах («| 2», «(2 мин)») и
 * пометка «Пока ждёшь:». Вступление («Вот шаги:», «Давай разобьём.») и напутствие («Ты справишься!») отбрасываются,
 * нумерация и выделение снимаются, повтор шага — один раз. Негодный ответ — null (следующая модель).
 */
export function parsePlan(text: string): Plan | null {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const marked = lines.filter((s) => MARKER.test(s))
  let rows = marked.length >= PLAN_MIN ? marked : lines.filter((s) => !s.endsWith(':') && !(INTRO.test(s) && !MINUTES.test(s)) && !/[!?]$/.test(s))
  rows = rows.slice(0, PLAN_MAX)
  const out: Plan = { steps: [], minutes: [], wait: [] }
  for (const row of rows) {
    let line = row.replace(MARKER, '').replace(/\*/g, '').trim()
    const m = line.match(MINUTES)
    let minutes: number | undefined
    if (m) {
      const n = Number(m[1])
      // этап большого дела бывает и на пару часов («Перевезти коробки | 120»); дальше — уже не оценка
      minutes = n >= 1 && n <= 240 ? n : undefined
      line = line.slice(0, m.index).trim()
    }
    const wait = WAIT.test(line)
    line = line.replace(WAIT, '').replace(/^[\s\d\-–—.)•]+/, '').replace(/[.;]+$/, '').trim()
    if (!line) continue
    const words = line.split(/\s+/).length
    if (words > 10) return null
    if (out.steps.some((x) => x.toLowerCase() === line.toLowerCase())) continue
    out.steps.push(line.charAt(0).toUpperCase() + line.slice(1))
    out.minutes.push(minutes)
    out.wait.push(wait)
  }
  return out.steps.length >= PLAN_MIN ? out : null
}

export function parseStepsWithMinutes(text: string): { steps: string[]; minutes: (number | undefined)[] } | null {
  const p = parsePlan(text)
  return p ? { steps: p.steps.slice(0, 3), minutes: p.minutes.slice(0, 3) } : null
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
  | { kind: 'steps'; steps: string[]; minutes?: (number | undefined)[]; wait?: boolean[]; source: 'model' | 'fallback' }
  | { kind: 'care'; reply: string }
  /** модель не поняла дело (набор букв): экран честно просит написать словами вместо общих шагов «для любого дела» */
  | { kind: 'unclear' }

/** Ответ модели → результат: «?» — дело не понято, 3–12 строк — план (с оценками и «пока ждёшь», если есть), иначе негоден */
export function parseBreakdownAnswer(text: string): BreakdownResult | null {
  if (/^[\s«»"'*?]*\?[\s«»"'*?]*$/.test(text)) return { kind: 'unclear' }
  const p = parsePlan(text)
  if (!p) return null
  // поля без единого значения не отдаём вовсе
  return {
    kind: 'steps',
    steps: p.steps,
    ...(p.minutes.some(Boolean) ? { minutes: p.minutes } : {}),
    ...(p.wait.some(Boolean) ? { wait: p.wait } : {}),
    source: 'model',
  }
}

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
    timeoutMs: input.timeoutMs ?? 9000,
    // план длиннее трёх шагов: годный ответ приходит за 1–4 с, страховка не должна стартовать раньше
    hedgeAfterMs: 3500,
    // Gemini через AnyModel иногда рассуждает скрыто, несмотря на reasoning_effort: none (набор задач 12.11: 160 из 160
    // токенов ушли на рассуждение, текста ноль). Платим за потраченное, запас бесплатен
    maxOutputTokens: 1500,
    maxChars: 1100,
    parse: parseBreakdownAnswer,
    fallback: () => ({ kind: 'steps', steps: BREAKDOWN_FALLBACK, source: 'fallback' }),
    // кризисный текст вместо дела — не шаги, а бережный проверенный ответ (lib/ai/crisis.ts)
    onCrisis: (reply) => ({ kind: 'care', reply }),
    signal: input.signal,
  })
  return value.kind === 'steps' && outcome !== 'model' ? { ...value, source: 'fallback' } : value
}
