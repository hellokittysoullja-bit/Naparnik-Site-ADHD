import type { TurnContext } from '../core/turn'
import { applyWrites, snapshotFacts, type MemoryState, type MemoryWrite } from './policy'
import { parseSnapshot, type MemorySnapshot } from './schema'

export type { MemoryWrite }

/**
 * Поставщик памяти (Hermes agent/memory_provider.py: prefetch → sync turn; конец разговора (on_session_end) появится вместе с
 * серверным хранилищем; Mastra Memory:
 * thread/resource). Ядро зависит только от этого интерфейса, хранилище подставляется адаптером:
 *  - сейчас — ClientSnapshotMemory: снимок присылает устройство, записи исполняет устройство (инструмент memory);
 *  - позже — серверное хранилище (база, бот): тот же интерфейс, ядро и маршруты не меняются.
 */
export interface MemoryProvider {
  readonly name: string
  /** до вызова модели: что известно о человеке к этому ходу */
  prefetch(ctx: TurnContext): Promise<MemorySnapshot | null>
  /** после хода: принять предложенные моделью записи (уже проверенные ядром); lastUserText — для правила «забудь» */
  onTurnEnd?(ctx: TurnContext, writes: readonly MemoryWrite[], turn: { lastUserText: string }): Promise<void>
}

/** Устройство — хранилище: читаем присланный снимок; записи исполняет клиент, сервер их только проверяет */
export class ClientSnapshotMemory implements MemoryProvider {
  readonly name = 'client-snapshot'
  private readonly snapshot: MemorySnapshot | null
  constructor(raw: unknown) {
    this.snapshot = parseSnapshot(raw)
  }
  async prefetch(): Promise<MemorySnapshot | null> {
    return this.snapshot
  }
}

/**
 * Память на сервере в процессе: эталонный адаптер для серверного хранилища (бот, будущая база) и для тестов —
 * показывает, что ядро не зависит от того, где память. Состояние живёт в памяти процесса, поэтому для продакшена
 * на serverless не годится: там его заменит адаптер KV/базы с тем же интерфейсом.
 */
export class InProcessMemory implements MemoryProvider {
  // Ключ памяти — ctx.sessionId, и без него адаптер бросает: общий ключ «аноним» смешал бы память разных людей.
  // Для бота ключом должен быть номер чата от маршрута (его знает маршрут), а НЕ псевдоним журнала: псевдонима
  // может не быть (нет VISIT_SECRET — channels/telegram.ts pseudonym), а память от секрета для журнала зависеть не
  // должна. Боевой адаптер получит ключ явно — этот остаётся эталоном для тестов.
  readonly name = 'in-process'
  private readonly store = new Map<string, MemoryState>()
  private seq = 0
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}
  private key(ctx: TurnContext): string {
    if (!ctx.sessionId) throw new Error('InProcessMemory needs ctx.sessionId')
    return ctx.sessionId
  }
  async prefetch(ctx: TurnContext): Promise<MemorySnapshot | null> {
    const state = this.store.get(this.key(ctx))
    if (!state) return null
    return { ...EMPTY_SNAPSHOT, plan: state.plan, facts: snapshotFacts(state.facts, this.now().slice(0, 10)) }
  }
  async onTurnEnd(ctx: TurnContext, writes: readonly MemoryWrite[], turn: { lastUserText: string }): Promise<void> {
    if (writes.length === 0) return
    const base = this.store.get(this.key(ctx)) ?? { facts: [], plan: null }
    const { next } = applyWrites(base, writes, { now: this.now(), lastUserText: turn.lastUserText, newId: () => `f${++this.seq}` })
    this.store.set(this.key(ctx), next)
  }
}

export const EMPTY_SNAPSHOT: MemorySnapshot = {
  plan: null,
  recentStarts: [],
  patterns: { totalStarts: 0, runningDays: 0, favoriteHour: null, lastStartDate: null },
  facts: [],
}

/** Задача без памяти: служебные вызовы и первый визит */
export const NoMemory: MemoryProvider = { name: 'none', prefetch: async () => null }

export const MEMORY_PREFETCH_MS = 1500

/**
 * Память не держит ход (Hermes: prefetch ограничен по времени и fail-open): медленное или упавшее хранилище — ход без
 * памяти, а не зависший ответ. Общая для всех задач: чат, голос сессии, дробление.
 */
export async function prefetchWithin(memory: MemoryProvider, ctx: TurnContext, ms = MEMORY_PREFETCH_MS): Promise<MemorySnapshot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      memory.prefetch(ctx),
      new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms))),
    ])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
