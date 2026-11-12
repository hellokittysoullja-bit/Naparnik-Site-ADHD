import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import type { TaskName } from './core/turn'

/**
 * Реестр моделей обвязки (research/20-ai-harness/design.md §2, «провайдеры» Hermes): задача → цепочка моделей.
 * Первая отвечает, следующая — только если первая не уложилась в бюджет времени или упала. Последний рубеж —
 * заготовленная реплика задачи (её даёт harness, не этот файл): кот не молчит никогда.
 *
 * AnyModel (anymodel.org) — OpenAI-совместимый посредник; ключ только на сервере (ANYMODEL_API_KEY, Vercel Sensitive).
 * DeepSeek V4 Flash — модель «с рассуждением»: по умолчанию весь лимит уходил на рассуждение и ответ был пустым
 * за 23 с (замер 11.11) — рассуждение выключено для всех вызовов (reasoning_effort: none → 2–5 с).
 * Без ключа AnyModel — прежний путь через Google (как было до обвязки), без обоих — сразу заготовки.
 */
export const ANYMODEL_BASE_URL = 'https://anymodel.org/v1'

export type ModelStep = {
  id: string
  model: LanguageModel
  /** устойчивее к взлому промпта: при подозрении цепочка начинается с неё (core/middleware.ts) */
  robust?: boolean
}

let anymodel: ReturnType<typeof createOpenAICompatible> | null = null

function anyModel() {
  const apiKey = process.env.ANYMODEL_API_KEY
  if (!apiKey) return null
  anymodel ??= createOpenAICompatible({
    name: 'anymodel',
    baseURL: ANYMODEL_BASE_URL,
    apiKey,
    includeUsage: true,
    // рассуждение выключено у всех задач реального времени: кот отвечает за секунды, а не за десятки
    transformRequestBody: (body) => ({ ...body, reasoning_effort: 'none' }),
  })
  return anymodel
}

/**
 * Профили моделей — данные, а не ветки кода (Hermes providers/base.py: профиль провайдера как запись).
 * robust — устойчивее к взлому промпта (core/middleware.ts ставит её первой при подозрении).
 */
type Profile = { id: string; robust?: boolean }

/**
 * Выбор владельца 11.11 по замеру (5 запросов на модель, настоящая инструкция кота, research/20-ai-harness/proof.md §4):
 *  - основная Gemini 2.5 Flash через AnyModel: первое слово 3,3 с в среднем (1,9–6,8), $0.03 за 1 млн токенов, без
 *    чужой системной инструкции (у маршрутов cc/ внутри промпт Claude Code);
 *  - страхует DeepSeek V4 Flash: медиана 4,4 с, но выбросы до 21 с; самая дешёвая ($0.0125).
 * Пометку robust не ставим ни одной: устойчивость к взлому у этой пары не замерена — звено «устойчивая первой»
 * просто ничего не меняет, пока замер (evals/ai-attacks.eval.ts) не покажет разницу.
 */
export const PRIMARY_MODEL = 'gc/gemini-2.5-flash'
export const FALLBACK_MODEL = 'ds/deepseek-v4-flash'

const PROFILES: Record<string, Profile> = {
  primary: { id: PRIMARY_MODEL },
  fallback: { id: FALLBACK_MODEL },
}

/**
 * Маршруты задач (Hermes hermes_cli/config_defaults.py: у каждой вспомогательной задачи свой маршрут). Сейчас у
 * всех задач одна цепочка — так решил владелец («одна модель везде»); таблица — место, где задаче дают свою
 * модель (например, дешёвую для фоновой выжимки памяти), не трогая ядро и маршруты.
 */
const ROUTES: Record<TaskName, readonly (keyof typeof PROFILES)[]> = {
  test: ['primary', 'fallback'],
  chat: ['primary', 'fallback'],
  'session-voice': ['primary', 'fallback'],
  breakdown: ['primary', 'fallback'],
  'onboarding-first-step': ['primary', 'fallback'],
  'memory-extract': ['primary', 'fallback'],
  recall: ['primary', 'fallback'],
}

/**
 * Запасной путь без ключа AnyModel — ТОТ ЖЕ, что был у маршрутов до обвязки, чтобы вливание в main ничего не
 * ухудшило, пока ключ не лежит в Vercel: есть ключ Google — Gemini напрямую (чат на Flash, разовые задачи на
 * Flash-Lite), нет — AI Gateway (на Vercel он работает без ключа; вне Vercel ответ не придёт, и канал возьмёт
 * заготовку, как и раньше). Модели шлюза указаны строкой, провайдер выбирает сам AI SDK.
 */
function legacyChain(task: TaskName): ModelStep[] {
  const chat = task === 'chat'
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const id = chat ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite'
    return [{ id, model: google(id) }]
  }
  const id = chat ? 'google/gemini-3.6-flash' : 'openai/gpt-5.4-nano'
  return [{ id, model: id }]
}

export function modelChain(task: TaskName): ModelStep[] {
  const am = anyModel()
  if (!am) return legacyChain(task)
  return ROUTES[task].map((k) => {
    const p = PROFILES[k]
    return { id: p.id, model: am.chatModel(p.id), robust: p.robust }
  })
}

/** Для тестов: сбросить кэш провайдера после смены переменных окружения */
export function resetModelsForTests() {
  anymodel = null
}
