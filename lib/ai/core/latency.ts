import { observe } from './hooks'
import { registerRequestMiddleware } from './middleware'

/**
 * Адаптивная страховка: наблюдатель копит реальную задержку моделей, middleware по ней решает, когда звать
 * запасную. Пример того, как два контракта Hermes работают вместе: observer только смотрит, middleware меняет ход.
 *
 * Замер 11.11 через AnyModel: первый кусок у DeepSeek V4 Flash — 7,5–19,5 с, у Haiku — 2,8–4,4 с. С постоянной
 * задержкой страховки 2,5 с каждый ход ждал впустую 2,5 с, прежде чем позвать быструю модель. Теперь: если
 * основная модель в этом экземпляре стабильно медленнее порога страховки, запасная стартует сразу (hedge 0) —
 * основная при этом остаётся первой и побеждает, когда отвечает быстро (выбор модели — за владельцем).
 *
 * Оценка — EWMA (α = 0,3) по времени до точки фиксации; таймаут считается как его длительность (нижняя оценка).
 * Состояние — на тёплый экземпляр сервера: холодный старт начинает с чистого листа, это безопасно (обычная страховка).
 */
const ALPHA = 0.3
const MIN_SAMPLES = 3
const stats = new Map<string, { ewma: number; n: number }>()

function record(model: string, ms: number) {
  const s = stats.get(model)
  stats.set(model, s ? { ewma: s.ewma + ALPHA * (ms - s.ewma), n: s.n + 1 } : { ewma: ms, n: 1 })
}

export function latencyOf(model: string): { ewma: number; n: number } | undefined {
  return stats.get(model)
}

export function resetLatencyForTests() {
  stats.clear()
}

observe((e) => {
  if (e.type === 'model.commit') record(e.model, e.ms)
  else if (e.type === 'model.end' && (e.result === 'timeout' || e.result === 'cancelled') && e.ms > 0) {
    // не дождались — это нижняя граница задержки: учитываем, только если она хуже текущей оценки. Отменённая
    // попытка без истории — не сведение (её могли запустить страховкой за миг до чужой победы)
    const s = stats.get(e.model)
    if (s ? e.ms > s.ewma : e.result === 'timeout') record(e.model, e.ms)
  }
})

registerRequestMiddleware({
  name: 'adaptive-hedge',
  onRequest(req) {
    const primary = req.chain[0]
    if (!primary || req.chain.length < 2) return
    const s = stats.get(primary.id)
    if (s && s.n >= MIN_SAMPLES && s.ewma > 2 * req.hedgeAfterMs) req.hedgeAfterMs = 0
    return req
  },
})
