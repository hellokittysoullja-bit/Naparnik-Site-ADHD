import type { ModelMessage } from 'ai'
import { CRISIS_REPLY } from '../crisis'
import { systemFor } from '../prompt/assemble'
import { raceTurn, type TurnOutcome } from './stream-turn'
import { newTurn, type TurnContext } from './turn'

/**
 * Разовый ход (голос сессии, дробление, «Подскажи»): один ответ целиком, без печати по мере генерации.
 * Это та же гонка, что у чата (stream-turn.ts) — проверка входа, middleware, страхующие попытки, журнал, отмена —
 * с другим правилом фиксации: ответ принимается, только когда он готов, прошёл проверку вывода и разобран задачей
 * (parse). Отдельного второго механизма гонки нет (аудит 12.11: два автомата расходились в мелочах).
 */
export type TurnInput<T> = {
  /** контекст хода (задача, канал, разговор); задача определяет маршрут моделей */
  ctx: TurnContext
  /** системная часть задачи: что делать в этом режиме (стабильна — кэшируется провайдером) */
  system: string
  /** данные человека — уже собранные dataMessage(); в роли user только они (security-ai.md R16) */
  data: string
  /** тексты человека для проверки входа (кризис, взлом промпта) */
  userTexts: string[]
  /** бюджет времени на весь ход (все попытки вместе) */
  timeoutMs: number
  /** через сколько мс без годного ответа запускать следующую модель параллельно (страхующий запрос) */
  hedgeAfterMs?: number
  maxOutputTokens: number
  /** потолок длины ответа для проверки выхода */
  maxChars: number
  /** разбор ответа задачей; null — ответ не годится (следующая модель) */
  parse: (text: string) => T | null
  /** заготовка, если модели не ответили или ответили не так */
  fallback: () => T
  /** что вернуть при кризисе */
  onCrisis: (reply: string) => T
  signal?: AbortSignal
}

export type TurnResult<T> = { value: T } & TurnOutcome

export const DEFAULT_HEDGE_MS = 1500

export async function runTurn<T>(input: TurnInput<T>): Promise<TurnResult<T>> {
  const messages: ModelMessage[] = [{ role: 'user', content: input.data }]
  const { stream, result } = raceTurn({
    ctx: input.ctx,
    instructions: systemFor(input.system),
    messages,
    userTexts: input.userTexts,
    commitTimeoutMs: input.timeoutMs,
    totalTimeoutMs: input.timeoutMs,
    hedgeAfterMs: input.hedgeAfterMs ?? DEFAULT_HEDGE_MS,
    maxOutputTokens: input.maxOutputTokens,
    maxChars: input.maxChars,
    whole: { accept: (text) => input.parse(text) !== null },
    signal: input.signal,
  })
  let text = ''
  for await (const part of stream as unknown as AsyncIterable<{ type: string; text?: string }>) {
    if (part.type === 'text-delta') text += part.text ?? ''
  }
  const end = await result
  if (end.outcome === 'crisis') return { value: input.onCrisis(CRISIS_REPLY), ...end }
  if (end.outcome === 'model') {
    const value = input.parse(text)
    if (value !== null) return { value, ...end }
  }
  return { value: input.fallback(), ...end }
}

export { newTurn }
