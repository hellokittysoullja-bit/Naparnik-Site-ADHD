import type { AttemptResult } from './hooks'

/**
 * Что случилось с попыткой — одна классификация на всё ядро (Hermes agent/error_classifier.py: причина сбоя и
 * подсказки «повторять ли», «менять ли провайдера» считаются один раз, цикл повторов их только читает). Раньше
 * коды разбирались в двух местах по-своему, а 402 «кончился баланс» выглядел в журнале как обычная ошибка.
 */
export type FailureKind =
  /** кончились деньги у поставщика (402): повтор бесполезен, нужен человек */
  | 'billing'
  /** ключ не принят или аккаунт не активен (401, 403): то же */
  | 'auth'
  /** 429: поставщик просит притормозить */
  | 'rate-limit'
  /** 5xx, 408: поставщик или модель за ним не справляются */
  | 'overload'
  /** сеть, обрыв потока: кода нет */
  | 'network'
  /** не дождались ответа */
  | 'timeout'
  /** 4xx на наш запрос: дефект обвязки, повтор даст то же */
  | 'bad-request'
  /** модель ответила, но ответ негоден (проверки, разбор, пустота): поставщик здоров */
  | 'model'

export type Failure = {
  kind: FailureKind
  /** та же модель может ответить со второй попытки */
  retry: boolean
  /** сбой поставщика, а не поведение модели: считается предохранителем (core/breaker.ts) */
  infra: boolean
  /** ждать бесполезно, пока человек не вмешается: предохранитель размыкается сразу, владельцу уходит сигнал */
  fatal: boolean
}

const F = (kind: FailureKind, retry: boolean, infra: boolean, fatal = false): Failure => ({ kind, retry, infra, fatal })

export function classify(result: AttemptResult, status?: number): Failure | null {
  if (result === 'ok' || result === 'cancelled') return null
  if (result === 'timeout') return F('timeout', false, true)
  if (result !== 'error') return F('model', false, false)
  if (status === undefined) return F('network', true, true)
  if (status === 402) return F('billing', false, true, true)
  if (status === 401 || status === 403) return F('auth', false, true, true)
  if (status === 429) return F('rate-limit', true, true)
  if (status === 408 || status >= 500) return F('overload', true, true)
  return F('bad-request', false, false)
}
