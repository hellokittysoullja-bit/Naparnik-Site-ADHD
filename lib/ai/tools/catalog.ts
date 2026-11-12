import { z } from 'zod'
import { matchVariants, stripInvisible } from '../guards/normalize'
import { isLink, isPhone } from '../guards/output'
import { FACT_CATEGORIES, FACT_LIMITS, type FactCategory } from '../memory/facts'
import { factRejection } from '../memory/write-guard'
import { ToolRegistry } from './registry'

/**
 * Инструменты кота. Все три сейчас исполняет устройство: память и план живут в браузере. Схемы — граница доверия
 * (research/20-ai-harness/security-ai.md): аргументы пишет модель, а модель читала текст человека, значит
 * аргументы — недоверенные данные. Отсюда потолки длины и запрет ссылок и разметки: факт из memory потом
 * попадает в память и в следующие промпты (сохранённая инъекция, OWASP LLM01 «stored»).
 */
// Строки аргументов: без разметки, ссылок и номеров — теми же правилами, что у ответа кота (guards/output.ts).
const MARKUP = /<\/?[a-z]|```|~~~/i
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // невидимые символы в аргументе — признак контрабанды: такой вызов отклоняется целиком (схема без transform,
    // чтобы модель видела в JSON-схеме настоящие ограничения длины)
    .refine((s) => stripInvisible(s) === s, 'невидимые символы не допускаются')
    .refine((s) => !MARKUP.test(s) && !matchVariants(s).some(isLink), 'ссылки и разметка не допускаются')
    .refine((s) => !matchVariants(s).some(isPhone), 'номера не допускаются')

export const savePlanInput = z.object({
  task: safeText(200).describe('Дело целиком, как его назвал человек'),
  firstStep: safeText(160).describe('Первый крошечный физический шаг, например «открыть файл презентации»'),
  startTime: safeText(40).optional().describe('Примерное время старта, например «09:00» или «после обеда»'),
})

// Факт уходит в память и в каждый следующий разговор — самое опасное место для «сохранённой» инъекции и для
// лишнего о человеке. Проверка содержания — memory/write-guard.ts (одна для инструмента, фоновой выжимки и
// устройства); номер факта, просьба «забудь» и основание записи проверяет ход (agents/chat.ts memoryToolCheck) и
// ещё раз устройство: только они знают, какой список видела модель и что сказал человек.
const factText = safeText(FACT_LIMITS.text).refine((s) => factRejection(s) === null, 'это не записывается в память')

// Одна операция на вызов и плоская схема (без anyOf): её одинаково понимают все модели маршрута; несколько
// операций — несколько вызовов
export const memoryInput = z
  .object({
    op: z.enum(['add', 'replace', 'forget', 'forgetAll']).describe(
      'add — новый факт; replace — факт изменился (номер старого в ref); forget — человек попросил забыть факт (номер в ref); forgetAll — человек попросил забыть всё',
    ),
    category: z.enum(FACT_CATEGORIES as [FactCategory, ...FactCategory[]]).optional().describe(
      'Только для add: about — о себе (учёба, работа); task — долгое дело; obstacle — что мешает начать; helps — что помогает; people — человек из его дел (имя и роль); schedule — устойчивое расписание; style — как с ним говорить; event — датированное событие',
    ),
    ref: z.string().regex(/^\d{1,2}$/).optional().describe('Для replace и forget: номер факта из блока памяти'),
    text: factText.optional().describe('Для add и replace: одно предложение без подлежащего, понятно без разговора: «Пишет диплом про…», «Легче начинает после душа» (не «Человек…», не «Пользователь…»)'),
    evidence: safeText(FACT_LIMITS.evidence).optional().describe('Для add и replace: короткая цитата человека, на которой основан факт'),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Для события или расписания: до какой даты это актуально, ГГГГ-ММ-ДД (например, дата экзамена)'),
  })
  // цитата необязательна (набор задач 12.11: модель присылала replace без неё, и вызов терялся) — тогда основание
  // ход ищет в последней реплике человека (agents/chat.ts memoryToolCheck)
  .refine((m) => m.op !== 'add' || (m.category && m.text), 'add: нужны category и text')
  .refine((m) => m.op !== 'replace' || (m.ref && m.text), 'replace: нужны ref и text')
  .refine((m) => m.op !== 'forget' || m.ref, 'forget: нужен ref')

export type MemoryInput = z.infer<typeof memoryInput>

/** Старые разговоры на устройствах хранят вызовы прежнего инструмента — схема нужна, чтобы показать их чип */
export const rememberFactInput = z.object({ fact: factText })

export const recallInput = z.object({
  query: safeText(120).describe('Что вспомнить, своими словами: «диплом, что решили про введение»'),
})

export const startFocusInput = z.object({
  firstStep: safeText(160).describe('Первый крошечный физический шаг, например «открыть файл отчёта»'),
  // приведение, а не отказ (Hermes: coercion схемы): модель может сказать 20 — человек получит ближайшую из трёх
  minutes: z
    .number()
    .finite()
    .optional()
    .transform((m) => (m === undefined ? undefined : [15, 25, 45].reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a))))
    .describe('Рекомендуемая длительность: 15, 25 или 45 минут. По умолчанию 15.'),
})

/**
 * Ответ устройства, если оно отказалось исполнять вызов (схема не прошла). Сервер узнаёт его в истории и передаёт
 * модели свой текст отказа, а не clientResult — иначе модель считала бы, что запомнила
 */
export const TOOL_REFUSED = 'Не сохранил.'

export const tools = new ToolRegistry()
  .register({
    name: 'savePlan',
    description: 'Сохранить план на завтра, когда он согласован с человеком. Вызывай один раз, с самым важным делом.',
    input: savePlanInput,
    executor: 'client',
    clientResult: 'План сохранён. Утром напомнишь про первый шаг.',
    tasks: ['chat'],
  })
  .register({
    name: 'memory',
    description:
      'Изменить долгую память о человеке. add — когда человек сам сказал о себе устойчивое и полезное для будущих разговоров о делах, или попросил запомнить. replace — когда сказанное раньше изменилось. forget/forgetAll — ТОЛЬКО когда человек прямо попросил забыть. Не записывай догадки о характере и настроении, здоровье, деньги, контакты, документы.',
    input: memoryInput,
    executor: 'client',
    clientResult: 'Готово, память обновлена.',
    tasks: ['chat'],
  })
  .register({
    name: 'recall',
    description:
      'Вспомнить прошлые разговоры с этим человеком, которых нет в текущей переписке. Вызывай, только когда человек сам ссылается на прошлое («помнишь, я говорил…», «как в прошлый раз», «что мы решили про…») или без этого не понять, о чём речь. Вернёт короткую выжимку или «ничего не нашёл».',
    input: recallInput,
    executor: 'client',
    clientResult: 'Поиск по прошлым разговорам выполнен.',
    clientOutputAsData: { maxChars: 600 },
    tasks: ['chat'],
  })
  .register({
    name: 'startFocus',
    description:
      'Предложить начать фокус-сессию прямо сейчас с конкретным первым шагом. Вызывай, когда шаг раздроблен и человек готов действовать сейчас (не вечером при планировании завтра).',
    input: startFocusInput,
    executor: 'client',
    clientResult: 'Кнопка «Начинаю» показана в чате.',
    tasks: ['chat'],
  })
