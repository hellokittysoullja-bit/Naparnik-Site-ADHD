import { z } from 'zod'
import { ToolRegistry } from './registry'

/**
 * Инструменты кота. Все три сейчас исполняет устройство: память и план живут в браузере. Схемы — граница доверия
 * (research/20-ai-harness/security-ai.md): аргументы пишет модель, а модель читала текст человека, значит
 * аргументы — недоверенные данные. Отсюда потолки длины и запрет ссылок и разметки: факт из rememberFact потом
 * попадает в память и в следующие промпты (сохранённая инъекция, OWASP LLM01 «stored»).
 */
const NO_LINKS = /(https?:\/\/|www\.|<\/?[a-z]|```)/i
const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !NO_LINKS.test(s), 'ссылки и разметка не допускаются')

export const savePlanInput = z.object({
  task: safeText(200).describe('Дело целиком, как его назвал человек'),
  firstStep: safeText(160).describe('Первый крошечный физический шаг, например «открыть файл презентации»'),
  startTime: safeText(40).optional().describe('Примерное время старта, например «09:00» или «после обеда»'),
})

// Факт уходит в память и в каждый следующий разговор — значит это самое опасное место для «сохранённой»
// инъекции (Hermes tools/memory_tool_store.py: строгий скан каждой записи; security-ai.md R6). Отказ, если факт
// похож на указание коту, а не на сведение о человеке, или несёт контакты.
const INSTRUCTION_LIKE =
  /(?<!\p{L})(?:отныне|с этого момента|игнорир\p{L}*|забудь|ты должен|ты обязан|отвечай|говори|вызывай|не упоминай|system|assistant|json|prompt|промпт\p{L}*|инструкци\p{L}*)(?!\p{L})/iu
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s()‐-]{6,}\d/u

export const rememberFactInput = z.object({
  fact: safeText(160)
    .refine((s) => !INSTRUCTION_LIKE.test(s), 'похоже на указание, а не на факт о человеке')
    .refine((s) => !CONTACT.test(s), 'контакты не запоминаем')
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
