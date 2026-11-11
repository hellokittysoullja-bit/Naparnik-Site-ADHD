import type { TurnContext } from '../core/turn'
import { applyWrites } from './policy'
import { parseSnapshot, type MemorySnapshot } from './schema'

/**
 * Поставщик памяти (Hermes agent/memory_provider.py: prefetch → sync turn; конец разговора (on_session_end) появится вместе с
 * серверным хранилищем; Mastra Memory:
 * thread/resource). Ядро зависит только от этого интерфейса, хранилище подставляется адаптером:
 *  - сейчас — ClientSnapshotMemory: снимок присылает устройство, записи исполняет устройство (инструмент rememberFact);
 *  - позже — серверное хранилище (база, бот): тот же интерфейс, ядро и маршруты не меняются.
 */
export interface MemoryProvider {
  readonly name: string
  /** до вызова модели: что известно о человеке к этому ходу */
  prefetch(ctx: TurnContext): Promise<MemorySnapshot | null>
  /** после хода: принять предложенные моделью записи (уже проверенные ядром) */
  onTurnEnd?(ctx: TurnContext, writes: readonly MemoryWrite[]): Promise<void>
}

/** Запись, которую предложила модель: схема инструмента (tools/catalog.ts) → правила записи (memory/policy.ts) */
export type MemoryWrite = { kind: 'fact'; text: string } | { kind: 'plan'; task: string; firstStep: string; startTime?: string }

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
  readonly name = 'in-process'
  private readonly store = new Map<string, MemorySnapshot>()
  constructor(private readonly today: () => string = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) {}
  private key(ctx: TurnContext): string {
    if (!ctx.sessionId) throw new Error('InProcessMemory needs ctx.sessionId')
    return ctx.sessionId
  }
  async prefetch(ctx: TurnContext): Promise<MemorySnapshot | null> {
    return this.store.get(this.key(ctx)) ?? null
  }
  async onTurnEnd(ctx: TurnContext, writes: readonly MemoryWrite[]): Promise<void> {
    if (writes.length === 0) return
    const base = this.store.get(this.key(ctx)) ?? EMPTY_SNAPSHOT
    this.store.set(this.key(ctx), applyWrites(base, writes, this.today()).next)
  }
}

export const EMPTY_SNAPSHOT: MemorySnapshot = {
  plan: null,
  recentStarts: [],
  patterns: { totalStarts: 0, runningDays: 0, favoriteHour: null, lastStartDate: null },
  notes: [],
}

/** Разовые задачи без памяти (голос сессии, дробление) */
export const NoMemory: MemoryProvider = { name: 'none', prefetch: async () => null }
