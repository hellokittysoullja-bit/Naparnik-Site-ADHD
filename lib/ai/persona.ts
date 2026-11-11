import { personaBase } from '@/lib/companion'

/**
 * Характер кота — один источник для всех каналов (personaBase в lib/companion.ts) + ярусы как у Hermes
 * (prompt-assembly): сначала неизменное (личность и правила), затем задача. Изменчивые данные человека в системный
 * промпт не попадают — они идут сообщением (context.ts). Стабильный префикс кэшируется провайдером.
 */
export function systemFor(taskSystem: string): string {
  return `${personaBase}\n\n${taskSystem}`
}
