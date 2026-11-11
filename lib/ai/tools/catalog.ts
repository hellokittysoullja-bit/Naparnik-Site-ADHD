import { z } from 'zod'
import { matchVariants, stripInvisible } from '../guards/normalize'
import { isLink, isPhone } from '../guards/output'
import { ToolRegistry } from './registry'

/**
 * Инструменты кота. Все три сейчас исполняет устройство: память и план живут в браузере. Схемы — граница доверия
 * (research/20-ai-harness/security-ai.md): аргументы пишет модель, а модель читала текст человека, значит
 * аргументы — недоверенные данные. Отсюда потолки длины и запрет ссылок и разметки: факт из rememberFact потом
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

// Факт уходит в память и в каждый следующий разговор — значит это самое опасное место для «сохранённой»
// инъекции (Hermes tools/memory_tool_store.py + threat_patterns.py: строгий скан каждой записи по нормализованному
// тексту; security-ai.md R6). Отказ, если факт — указание коту, а не сведение о человеке, или несёт контакты.
// Проверка идёт по всем прочтениям (matchVariants): «зaбудь» с латинской «a» и «игнор\u200bируй» не проходят.
const INSTRUCTION_LIKE =
  /(?<!\p{L})(?:отныне|с этого момента|игнорир\p{L}*|забудь|ты должен|ты обязан|(?:кот|напарник)\p{L}*\s+(?:должен|обязан|всегда|никогда)|отвечай|отвечал\p{L}*|говори|называй\p{L}*|называл\p{L}*\s+себя|вызывай|рекоменд\p{L}*|советуй|советовал\p{L}*|не упоминай|system|assistant|json|prompt|промпт\p{L}*|инструкци\p{L}*)(?!\p{L})/iu
const EMAIL = /[\p{L}\d.+-]+@[\p{L}\d-]+\.[\p{L}\d.]+/u

export const rememberFactInput = z.object({
  fact: safeText(160)
    .refine((s) => !matchVariants(s).some((v) => INSTRUCTION_LIKE.test(v)), 'похоже на указание, а не на факт о человеке')
    .refine((s) => !EMAIL.test(s), 'контакты не запоминаем')
    .describe('Один факт о человеке, максимум одно предложение'),
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
    name: 'rememberFact',
    description:
      'Запомнить один короткий важный факт о человеке для будущих разговоров (имя, над чем работает, что мешает).',
    input: rememberFactInput,
    executor: 'client',
    clientResult: 'Запомнил.',
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
