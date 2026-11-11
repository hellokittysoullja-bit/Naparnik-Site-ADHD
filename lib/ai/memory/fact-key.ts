import { forMatching } from '../guards/normalize'

/**
 * Ключ сравнения фактов памяти: регистр, ё/е, латинские двойники, пунктуация и пробелы не делают факт новым
 * (mem0: дубли по нормализованному тексту). Отдельный модуль без zod: его подключает и устройство (lib/memory.ts),
 * а там каждый килобайт на счету (e2e/bundle-budget.spec.ts поймал +20 КБ, когда ключ жил рядом со схемами).
 */
export function factKey(text: string): string {
  return forMatching(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}
