import { emit, observe } from './hooks'
import { classify, type FailureKind } from './errors'
import { registerRequestMiddleware } from './middleware'

/**
 * Предохранитель по моделям и поставщикам (circuit breaker; Hermes: провайдер после сбоев уходит на паузу и цепочка
 * идёт дальше без ожидания). Наблюдатель считает сбои поставщика подряд, middleware запроса ставит разомкнутые звенья
 * в конец цепочки.
 *
 * Зачем: страховка запускает следующую модель только через hedgeAfterMs. Когда основной маршрут лежит, КАЖДЫЙ ход
 * сначала ждал эти секунды впустую, а у разовых задач с пределом 6–8 с на здоровую модель уже не хватало времени
 * (живой прогон 13.11: 3 запроса из 12 закончились заготовкой, все три модели не успели).
 *
 * Правила:
 *  - THRESHOLD сбоев поставщика подряд (сеть, 429, 5xx, таймаут после SLOW_MS) — звено разомкнуто на COOLDOWN_MS;
 *  - 401/402/403 — разомкнуто сразу и надолго, причём весь поставщик: ключ и баланс у его моделей общие;
 *  - ответ модели (точка фиксации) замыкает звено; негодный ответ (проверки, разбор) сбоем не считается;
 *  - пауза истекла — звено возвращается на своё место с одной пробной попыткой: снова сбой — снова пауза;
 *  - разомкнутые звенья не выбрасываются, а идут последними: когда лежит всё, лучше попробовать, чем молчать.
 * Состояние — на тёплый экземпляр сервера, как у оценки задержек (core/latency.ts): холодный старт начинает с нуля.
 */
export const BREAKER = { threshold: 3, cooldownMs: 30_000, fatalCooldownMs: 5 * 60_000, slowMs: 3_000 } as const

type State = { fails: number; openUntil: number; reason?: FailureKind }
const steps = new Map<string, State>()
const providers = new Map<string, State>()
/** модель → поставщик: событие model.end поставщика не несёт, его знает цепочка (заполняет middleware) */
const providerOf = new Map<string, string>()

const stateOf = (map: Map<string, State>, key: string): State => {
  let s = map.get(key)
  if (!s) map.set(key, (s = { fails: 0, openUntil: 0 }))
  return s
}

function isOpen(s: State | undefined, now: number): boolean {
  if (!s || s.openUntil === 0) return false
  if (now < s.openUntil) return true
  // пауза истекла: одна пробная попытка. Счётчик остаётся у порога — следующий же сбой размыкает снова
  s.openUntil = 0
  s.fails = Math.max(0, BREAKER.threshold - 1)
  return false
}

export function breakerOpen(model: string, now = Date.now()): boolean {
  const provider = providerOf.get(model)
  return isOpen(steps.get(model), now) || (provider !== undefined && isOpen(providers.get(provider), now))
}

/** Сводка для страницы здоровья и тестов: что сейчас разомкнуто и почему (без данных людей) */
export function breakerSnapshot(now = Date.now()): { model: string; reason?: FailureKind; forMs: number }[] {
  const out: { model: string; reason?: FailureKind; forMs: number }[] = []
  for (const [model, s] of [...steps, ...providers]) if (s.openUntil > now) out.push({ model, reason: s.reason, forMs: s.openUntil - now })
  return out
}

export function resetBreakerForTests() {
  steps.clear()
  providers.clear()
  providerOf.clear()
}

observe((e, ctx) => {
  if (e.type === 'model.commit') {
    const s = steps.get(e.model)
    if (s) {
      s.fails = 0
      s.openUntil = 0
    }
    return
  }
  if (e.type !== 'model.end' || e.committed) return
  const f = classify(e.result, e.status)
  if (!f?.infra) return
  // «не дождались» — сведение, только если попытка успела поработать: общий таймаут хода помечает так и ту, что
  // стартовала за миг до него
  if (f.kind === 'timeout' && e.ms < BREAKER.slowMs) return
  const now = Date.now()
  if (f.fatal) {
    const provider = providerOf.get(e.model)
    const s = stateOf(provider ? providers : steps, provider ?? e.model)
    const wasOpen = s.openUntil > now
    s.openUntil = now + BREAKER.fatalCooldownMs
    s.reason = f.kind
    if (!wasOpen) emit({ type: 'breaker.open', model: provider ?? e.model, reason: f.kind, ms: BREAKER.fatalCooldownMs }, ctx)
    return
  }
  const s = stateOf(steps, e.model)
  s.fails++
  if (s.fails >= BREAKER.threshold && s.openUntil <= now) {
    s.openUntil = now + BREAKER.cooldownMs
    s.reason = f.kind
    emit({ type: 'breaker.open', model: e.model, reason: f.kind, ms: BREAKER.cooldownMs }, ctx)
  }
})

registerRequestMiddleware({
  name: 'circuit-breaker',
  onRequest(req) {
    const now = Date.now()
    for (const s of req.chain) if (s.provider) providerOf.set(s.id, s.provider)
    const open = req.chain.filter((s) => breakerOpen(s.id, now))
    if (open.length === 0 || open.length === req.chain.length) return
    req.chain = [...req.chain.filter((s) => !open.includes(s)), ...open]
    return req
  },
})
