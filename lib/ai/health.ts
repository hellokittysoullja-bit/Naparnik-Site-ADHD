import { breakerSnapshot } from './core/breaker'
import { ANYMODEL_BASE_URL, configuredProviders, type ProviderName } from './models'

/**
 * Состояние ИИ одним взглядом: настроены ли поставщики и хватает ли баланса. ИИ у нас отказывает тихо (кот отвечает
 * заготовками), поэтому владельцу нужен адрес, который можно открыть самому или отдать внешнему монитору
 * (app/api/health/ai). Наружу — только грубые состояния: ни суммы баланса, ни ключа, ни имён моделей.
 *
 * Баланс AnyModel — GET /v1/balance (их документация, api-docs.md): «balance tokens», 402 при нуле. Порог «мало» —
 * AI_BALANCE_LOW (по умолчанию 1,5 млн ≈ 500 ответов кота: ход чата ≈ 3 тыс. токенов × коэффициент 0,6 и страховка).
 */
export type BalanceState = 'ok' | 'low' | 'empty' | 'unlimited' | 'rejected' | 'unknown' | 'none'
export type AiState = 'ok' | 'low' | 'degraded' | 'down' | 'unconfigured'

export type AiHealth = {
  ai: AiState
  balance: BalanceState
  /** сколько независимых поставщиков настроено: при одном любая его заминка выключает ИИ у всех */
  providers: number
  /** сколько моделей или поставщиков сейчас на паузе после сбоев (в этом экземпляре сервера) */
  paused: number
  checkedAt: string
}

const DEFAULT_LOW = 1_500_000
const TTL_MS = 5 * 60_000
const BALANCE_TIMEOUT_MS = 4_000

export function balanceLowMark(): number {
  const n = Number(process.env.AI_BALANCE_LOW)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOW
}

async function anymodelBalance(fetchImpl: typeof fetch): Promise<BalanceState> {
  const key = process.env.ANYMODEL_API_KEY
  if (!key) return 'none'
  try {
    const res = await fetchImpl(`${ANYMODEL_BASE_URL}/balance`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(BALANCE_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (res.status === 401 || res.status === 403) return 'rejected'
    if (res.status === 402) return 'empty'
    if (!res.ok) return 'unknown'
    const data = (await res.json()) as { balance?: unknown; unlimited?: unknown; status?: unknown }
    if (typeof data.status === 'string' && data.status !== 'active') return 'rejected'
    if (data.unlimited === true) return 'unlimited'
    if (typeof data.balance !== 'number' || !Number.isFinite(data.balance)) return 'unknown'
    return data.balance <= 0 ? 'empty' : data.balance < balanceLowMark() ? 'low' : 'ok'
  } catch {
    return 'unknown' // сеть или таймаут: состояние не подтверждено, тревогу из-за этого не поднимаем
  }
}

/** Итог по балансу и числу поставщиков (чистая функция: проверяется таблицей) */
export function aiState(balance: BalanceState, providers: readonly ProviderName[]): AiState {
  if (providers.length === 0) return 'unconfigured'
  const anymodelDead = providers.includes('anymodel') && (balance === 'empty' || balance === 'rejected')
  if (anymodelDead) return providers.length > 1 ? 'degraded' : 'down'
  return balance === 'low' ? 'low' : 'ok'
}

let cached: { at: number; value: AiHealth } | null = null

export async function aiHealth(opts: { fetchImpl?: typeof fetch; now?: number; fresh?: boolean } = {}): Promise<AiHealth> {
  const now = opts.now ?? Date.now()
  if (!opts.fresh && cached && now - cached.at < TTL_MS) return cached.value
  const providers = configuredProviders()
  const balance = await anymodelBalance(opts.fetchImpl ?? fetch)
  const value: AiHealth = {
    ai: aiState(balance, providers),
    balance,
    providers: providers.length,
    paused: breakerSnapshot(now).length,
    checkedAt: new Date(now).toISOString(),
  }
  // неподтверждённое состояние не кэшируем: следующая проверка спросит заново
  if (balance !== 'unknown') cached = { at: now, value }
  return value
}

export function resetHealthForTests() {
  cached = null
}
