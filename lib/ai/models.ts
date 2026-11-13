import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { google } from '@ai-sdk/google'
import type { LanguageModel, streamText } from 'ai'
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
  /** чей это ключ и баланс: предохранитель размыкает поставщика целиком при 401/402/403 (core/breaker.ts) */
  provider?: ProviderName
  /** настройки вызова, понятные только этому поставщику (например, выключенное рассуждение) */
  options?: Parameters<typeof streamText>[0]['providerOptions']
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
type Profile = { provider: ProviderName; id: string; robust?: boolean }

/**
 * Поставщики — независимые точки отказа (свой хост, свой ключ, свой баланс). До 13.11 все три модели шли через один
 * AnyModel: его заминка или кончившийся баланс тихо выключали ИИ у всех (аудит 12.11, находка 25; живой прогон 13.11:
 * в 3 запросах из 12 не ответила ни одна из трёх моделей разом). Второй поставщик включается ключом в окружении, без
 * правки кода; без ключа его звено в цепочку не попадает.
 */
export type ProviderName = 'anymodel' | 'google'

const PROVIDERS: Record<ProviderName, { available: () => boolean; step: (p: Profile) => ModelStep | null }> = {
  anymodel: {
    available: () => !!process.env.ANYMODEL_API_KEY,
    step: (p) => {
      const am = anyModel()
      return am && { id: p.id, model: am.chatModel(p.id), provider: 'anymodel', robust: p.robust }
    },
  },
  // Gemini напрямую у Google: тот же ответ кота, другой хост и другой счёт. Рассуждение выключено, как у AnyModel
  google: {
    available: () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    step: (p) => ({
      id: `google/${p.id}`,
      model: google(p.id),
      provider: 'google',
      robust: p.robust,
      options: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    }),
  },
}

/**
 * Выбор владельца 11.11 по замеру (5 запросов на модель, настоящая инструкция кота, research/20-ai-harness/proof.md §4):
 *  - основная Gemini 2.5 Flash через AnyModel: первое слово 3,3 с в среднем (1,9–6,8), $0.03 за 1 млн токенов, без
 *    чужой системной инструкции (у маршрутов cc/ внутри промпт Claude Code);
 *  - страхует DeepSeek V4 Flash: медиана 4,4 с, но выбросы до 21 с; самая дешёвая ($0.0125).
 * Пометку robust не ставим ни одной: устойчивость к взлому у этой пары не замерена — звено «устойчивая первой»
 * просто ничего не меняет, пока замер (evals/ai-attacks.eval.ts) не покажет разницу.
 */
export const PRIMARY_MODEL = 'gc/gemini-2.5-flash'
/**
 * Резервный провайдер (Hermes: цепочка «основная → резервный провайдер → запасная»): та же Gemini 2.5 Flash по
 * второму маршруту AnyModel. Замер 12.11 (8 запросов, поток, настоящие инструкции): gc 8/8, первое слово 1,4 с;
 * ag 8/8, 1,8 с (худшее 3,4 с); DeepSeek 6/8, 4,4 с, худшее 14 с. Набор задач в тот же день: провалы почти
 * целиком — обрыв Gemini на одном маршруте и медленная DeepSeek. Выбор владельца (Gemini основная, DeepSeek
 * запасная) не меняется: резерв — та же модель, платим за него, только когда первая медлит или упала.
 */
export const RESERVE_MODEL = 'ag/gemini-2.5-flash'
export const FALLBACK_MODEL = 'ds/deepseek-v4-flash'

/** Независимый поставщик: та же Gemini 2.5 Flash напрямую у Google (нужен GOOGLE_GENERATIVE_AI_API_KEY) */
export const INDEPENDENT_MODEL = 'gemini-2.5-flash'

const PROFILES = {
  primary: { provider: 'anymodel', id: PRIMARY_MODEL },
  reserve: { provider: 'anymodel', id: RESERVE_MODEL },
  fallback: { provider: 'anymodel', id: FALLBACK_MODEL },
  independent: { provider: 'google', id: INDEPENDENT_MODEL },
} satisfies Record<string, Profile>

/**
 * Порядок по умолчанию. Независимый поставщик стоит последним намеренно: он дороже (цена Google против цены
 * посредника), и при здоровом AnyModel до него дело не доходит. Когда AnyModel сбоит, предохранитель переносит его
 * звенья в конец, и независимый оказывается первым без ожидания страховки.
 */
const DEFAULT_ROUTE = ['primary', 'reserve', 'fallback', 'independent'] as const

/**
 * Маршруты задач (Hermes hermes_cli/config_defaults.py: у каждой вспомогательной задачи свой маршрут). Сейчас у
 * всех задач одна цепочка — так решил владелец («одна модель везде»); таблица — место, где задаче дают свою
 * модель (например, дешёвую для фоновой выжимки памяти), не трогая ядро и маршруты.
 */
const ROUTES: Record<TaskName, readonly (keyof typeof PROFILES)[]> = {
  test: DEFAULT_ROUTE,
  chat: DEFAULT_ROUTE,
  'session-voice': DEFAULT_ROUTE,
  breakdown: DEFAULT_ROUTE,
  'onboarding-first-step': DEFAULT_ROUTE,
  'memory-extract': DEFAULT_ROUTE,
  recall: DEFAULT_ROUTE,
  summarize: DEFAULT_ROUTE,
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
    return [{ id, model: google(id), provider: 'google' }]
  }
  const id = chat ? 'google/gemini-3.6-flash' : 'openai/gpt-5.4-nano'
  return [{ id, model: id }]
}

export function modelChain(task: TaskName): ModelStep[] {
  if (!PROVIDERS.anymodel.available()) return legacyChain(task)
  return ROUTES[task].flatMap((k) => {
    const p: Profile = PROFILES[k]
    const provider = PROVIDERS[p.provider]
    const step = provider.available() ? provider.step(p) : null
    return step ? [step] : []
  })
}

/** Какие поставщики сейчас настроены (для страницы здоровья; имена, не ключи) */
export function configuredProviders(): ProviderName[] {
  return (Object.keys(PROVIDERS) as ProviderName[]).filter((n) => PROVIDERS[n].available())
}

/** Для тестов: сбросить кэш провайдера после смены переменных окружения */
export function resetModelsForTests() {
  anymodel = null
}
