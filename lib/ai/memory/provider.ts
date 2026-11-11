import type { TurnContext } from '../core/turn'
import { parseSnapshot, type MemorySnapshot } from './schema'

/**
 * Поставщик памяти (Hermes agent/memory_provider.py: prefetch → sync turn → on_session_end; Mastra Memory:
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
  /** конец разговора: свёртка, напоминания (бот) */
  onSessionEnd?(ctx: TurnContext): Promise<void>
}

/** Запись, которую предложила модель: проходит проверку (memory/write-policy.ts) до исполнения */
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

/** Разовые задачи без памяти (голос сессии, дробление) */
export const NoMemory: MemoryProvider = { name: 'none', prefetch: async () => null }
