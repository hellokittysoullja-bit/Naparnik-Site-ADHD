import type { OutputViolation } from '../guards/output'
import type { TurnContext } from './turn'

/**
 * Наблюдатели хода (Hermes observer hooks, OpenAI Agents SDK TracingProcessor): ядро публикует типизированные
 * события, подписчики (журнал, метрики, оценки) их читают. Правила:
 *  - наблюдатель НЕ меняет ход (для этого — middleware.ts); его ошибка проглатывается (fail-open);
 *  - в событиях нет текста человека и ответа модели — только метаданные (приватность, CLAUDE.md §5.5);
 *  - синхронная доставка: на сервере без фоновых процессов (Vercel) асинхронный журнал мог бы не успеть.
 */
/** cancelled — попытку отменили, потому что другая модель уже ответила (не сбой) */
export type AttemptResult = 'ok' | 'parse' | 'timeout' | 'cancelled' | 'error' | OutputViolation
export type TurnOutcome = 'model' | 'fallback' | 'crisis' | 'budget' | 'aborted'

export type HarnessEvent =
  | { type: 'turn.start' }
  | { type: 'guard.input'; crisis: boolean; injection: boolean }
  | { type: 'model.start'; model: string; hedge: boolean }
  /** первый годный кусок ответа (точка фиксации) — по нему считается задержка модели (core/latency.ts) */
  | { type: 'model.commit'; model: string; ms: number }
  | { type: 'model.end'; model: string; ms: number; result: AttemptResult; inTokens?: number; outTokens?: number }
  | { type: 'tool.call'; tool: string; executor: 'client' | 'server'; valid: boolean }
  | { type: 'memory.write'; kind: string; accepted: boolean }
  | { type: 'turn.end'; outcome: TurnOutcome; model?: string; ms: number; inTokens?: number; outTokens?: number }

export type Observer = (event: HarnessEvent, ctx: TurnContext) => void

const observers = new Set<Observer>()

/** Подписка; возвращает отписку (тесты, временные стенды оценки) */
export function observe(fn: Observer): () => void {
  observers.add(fn)
  return () => observers.delete(fn)
}

export function emit(event: HarnessEvent, ctx: TurnContext): void {
  for (const fn of observers) {
    try {
      fn(event, ctx)
    } catch {
      /* наблюдатель не мешает ответу */
    }
  }
}

/**
 * Журнал по умолчанию: одна JSON-строка на ход (итог + попытки), как было в trace.ts, теперь собирается из
 * событий. Подключается один раз при загрузке модуля ядра.
 */
export function createTurnLogger(write: (line: string) => void = (l) => console.info(l)): Observer {
  const open = new Map<string, { attempts: Array<{ model: string; ms: number; result: AttemptResult }>; injection?: boolean }>()
  return (e, ctx) => {
    if (e.type === 'turn.start') {
      // ход без turn.end (сбой процесса посреди потока) не должен копиться вечно в тёплом экземпляре
      if (open.size >= 500) open.delete(open.keys().next().value as string)
      open.set(ctx.turnId, { attempts: [] })
    }
    const acc = open.get(ctx.turnId)
    if (!acc) return
    if (e.type === 'guard.input' && e.injection) acc.injection = true
    if (e.type === 'model.end') acc.attempts.push({ model: e.model, ms: e.ms, result: e.result })
    if (e.type === 'turn.end') {
      open.delete(ctx.turnId)
      write(
        JSON.stringify({
          t: 'ai',
          turn: ctx.turnId,
          session: ctx.sessionId,
          channel: ctx.channel,
          task: ctx.task,
          outcome: e.outcome,
          model: e.model,
          ms: e.ms,
          attempts: acc.attempts,
          injection: acc.injection,
          inTokens: e.inTokens,
          outTokens: e.outTokens,
        }),
      )
    }
  }
}

/** Журнал подключён всегда; тесты и стенды могут отключить его этой функцией */
export const detachDefaultLogger = observe(createTurnLogger())
