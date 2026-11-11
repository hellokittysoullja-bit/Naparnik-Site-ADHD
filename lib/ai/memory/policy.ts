import { factKey } from './fact-key'
import type { MemoryWrite } from './provider'
import { MEMORY_LIMITS, type MemorySnapshot } from './schema'

/**
 * Правила записи в память — одни для любого хранилища (устройство, база, бот). Источники:
 *  - Hermes tools/memory_tool_store.py:397-675 — проверка ДО записи, лимит считается на итоге, атомарно;
 *  - Hermes tests/agent/test_memory_context_dedupe.py — повтор хранится один раз;
 *  - mem0 main.py — дубли отсекаются по нормализованному тексту (хэш), а не по точному совпадению строк;
 *  - Letta core memory — блок фиксированного размера: новое вытесняет самое старое, а не растёт без конца.
 * Проверка формы («похоже на указание», контакты, ссылки) — в схеме инструмента (tools/catalog.ts): сюда приходят
 * уже прошедшие её записи.
 */
export type AppliedWrite = { write: MemoryWrite; accepted: boolean; reason?: 'duplicate' | 'empty' }

/**
 * Применить записи хода к снимку — чистая функция: возвращает новый снимок и решение по каждой записи.
 * Пачка применяется целиком (как memory operations у Hermes): лимит считается на итоге, а не на каждой записи.
 */
export function applyWrites(
  base: MemorySnapshot,
  writes: readonly MemoryWrite[],
  today: string,
): { next: MemorySnapshot; applied: AppliedWrite[] } {
  const notes = [...base.notes]
  const keys = new Set(notes.map(factKey))
  let plan = base.plan
  const applied: AppliedWrite[] = []
  for (const w of writes) {
    if (w.kind === 'fact') {
      const key = factKey(w.text)
      if (!key) applied.push({ write: w, accepted: false, reason: 'empty' })
      else if (keys.has(key)) applied.push({ write: w, accepted: false, reason: 'duplicate' })
      else {
        keys.add(key)
        notes.push(w.text.trim())
        applied.push({ write: w, accepted: true })
      }
    } else {
      // план один — на завтра; новый согласованный план заменяет прежний (как savePlan на устройстве)
      plan = { forDate: today, task: w.task, firstStep: w.firstStep, startTime: w.startTime }
      applied.push({ write: w, accepted: true })
    }
  }
  return { next: { ...base, notes: notes.slice(-MEMORY_LIMITS.notes), plan }, applied }
}

export { factKey }
