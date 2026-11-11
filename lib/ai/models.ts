import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

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

/** Основная модель — выбор владельца (11.11); запасная — по замеру: тёплый тон, 2,5–4 с через тот же ключ */
export const PRIMARY_MODEL = 'ds/deepseek-v4-flash'
export const FALLBACK_MODEL = 'cc/claude-haiku-5-5'

export function modelChain(): ModelStep[] {
  const am = anyModel()
  if (am) {
    return [
      { id: PRIMARY_MODEL, model: am.chatModel(PRIMARY_MODEL) },
      { id: FALLBACK_MODEL, model: am.chatModel(FALLBACK_MODEL), robust: true },
    ]
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return [{ id: 'gemini-2.5-flash-lite', model: google('gemini-2.5-flash-lite') }]
  }
  return []
}

/** Для тестов: сбросить кэш провайдера после смены переменных окружения */
export function resetModelsForTests() {
  anymodel = null
}
