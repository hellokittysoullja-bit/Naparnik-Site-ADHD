import { observe } from './hooks'
import { registerRequestMiddleware } from './middleware'

/**
 * Адаптивная страховка: наблюдатель копит реальную задержку моделей, middleware по ней решает, когда звать
 * запасную. Пример того, как два контракта Hermes работают вместе: observer только смотрит, middleware меняет ход.
 *
 * Замер 11.11 через AnyModel: первое слово у разных моделей — от 1,5 до 21 с, и у одной модели разброс в разы. С постоянной
 * задержкой страховки 2,5 с каждый ход ждал впустую 2,5 с, прежде чем позвать быструю модель. Теперь: если
 * основная модель в этом экземпляре стабильно медленнее порога страховки, запасная стартует сразу (hedge 0) —
 * основная при этом остаётся первой и побеждает, когда отвечает быстро (выбор модели — за владельцем).
 *
 * Оценка — EWMA (α = 0,3) по времени до точки фиксации, отдельно для каждой пары «задача × модель»: у чата фиксация —
 * первое предложение, у разовых задач — весь ответ, смешивать их нельзя. Каждый PROBE_EVERY-й ход задачи идёт с
 * обычной задержкой страховки (проба): иначе запасная, раз начав побеждать, не дала бы основной показать, что та
 * снова быстрая, — и экземпляр платил бы за две модели до конца жизни (находка независимой проверки).
 * Состояние — на тёплый экземпляр сервера: холодный старт начинает с чистого листа, это безопасно (обычная страховка).
 */
const ALPHA = 0.3
const MIN_SAMPLES = 3
const PROBE_EVERY = 8
const stats = new Map<string, { ewma: number; n: number }>()
const turns = new Map<string, number>()
const key = (task: string, model: string) => `${task}\u0000${model}`

function record(model: string, ms: number) {
  const s = stats.get(model)
  stats.set(model, s ? { ewma: s.ewma + ALPHA * (ms - s.ewma), n: s.n + 1 } : { ewma: ms, n: 1 })
}

export function latencyOf(task: string, model: string): { ewma: number; n: number } | undefined {
  return stats.get(key(task, model))
}

export function resetLatencyForTests() {
  stats.clear()
  turns.clear()
}

observe((e, ctx) => {
  if (e.type === 'model.commit') record(key(ctx.task, e.model), e.ms)
  else if (e.type === 'model.end' && !e.committed && (e.result === 'timeout' || e.result === 'cancelled') && e.ms > 0) {
    // попытка, прошедшая фиксацию, свою задержку уже сообщила (model.commit); её ms здесь — длительность всего
    // потока, и закрытая посреди ответа вкладка делала модель «медленной» навсегда (находка аудита 12.11)
    // не дождались — это нижняя граница задержки: учитываем, только если она хуже текущей оценки. Отменённая
    // попытка без истории — не сведение (её могли запустить страховкой за миг до чужой победы)
    const k = key(ctx.task, e.model)
    const s = stats.get(k)
    if (s ? e.ms > s.ewma : e.result === 'timeout') record(k, e.ms)
  }
})

registerRequestMiddleware({
  name: 'adaptive-hedge',
  onRequest(req, { ctx }) {
    const primary = req.chain[0]
    if (!primary || req.chain.length < 2) return
    const n = (turns.get(ctx.task) ?? 0) + 1
    turns.set(ctx.task, n)
    if (n % PROBE_EVERY === 0) return // проба: основная получает шанс показать, что снова быстрая
    const s = stats.get(key(ctx.task, primary.id))
    if (s && s.n >= MIN_SAMPLES && s.ewma > 2 * req.hedgeAfterMs) req.hedgeAfterMs = 0
    return req
  },
})
