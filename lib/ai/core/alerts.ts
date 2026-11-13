import { observe } from './hooks'

/**
 * Сигналы владельцу: то, что само не починится и что человек иначе заметит последним. ИИ у нас отказывает тихо (кот
 * отвечает заготовками), поэтому кончившийся баланс или отозванный ключ выглядели бы как «кот поглупел».
 *
 * Сигнал — одна строка уровня error в журнале сервера: {"t":"ai-alert","kind":…}. На неё вешается оповещение в Vercel
 * (Log Drains / Alerts) или любой сборщик журналов. В строке нет текста человека и ответа модели. Повторы одного вида —
 * не чаще раза в THROTTLE_MS на экземпляр. Состояние поставщика без журнала — GET /api/health/ai.
 */
export type AlertKind = 'billing' | 'auth' | 'all-down'

const THROTTLE_MS = 10 * 60_000
/** столько ходов подряд без ответа модели — «ИИ лежит» (кризисные и отменённые ходы не считаются) */
const DOWN_AFTER = 5

const last = new Map<AlertKind, number>()
let fallbacks = 0
let sink: (line: string) => void = (l) => console.error(l)

export function setAlertSinkForTests(fn?: (line: string) => void) {
  sink = fn ?? ((l) => console.error(l))
  last.clear()
  fallbacks = 0
}

function alert(kind: AlertKind, detail: Record<string, string | number | undefined>) {
  const now = Date.now()
  if (now - (last.get(kind) ?? -Infinity) < THROTTLE_MS) return
  last.set(kind, now)
  sink(JSON.stringify({ t: 'ai-alert', kind, ...detail }))
}

observe((e, ctx) => {
  if (e.type === 'breaker.open') {
    if (e.reason === 'billing' || e.reason === 'auth') alert(e.reason, { provider: e.model, task: ctx.task })
    // обычная пауза после сбоев — не тревога, но в журнале её должно быть видно: по ней понятно, почему ходы
    // какое-то время шли через запасную модель. Частоту ограничивает сама пауза предохранителя
    else sink(JSON.stringify({ t: 'ai-breaker', model: e.model, reason: e.reason, ms: e.ms }))
  } else if (e.type === 'turn.end') {
    if (e.outcome === 'model') fallbacks = 0
    else if (e.outcome === 'fallback' && ++fallbacks >= DOWN_AFTER) alert('all-down', { turns: fallbacks, task: ctx.task })
  }
})
