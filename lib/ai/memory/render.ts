import { dataBlock } from '../context'
import type { MemorySnapshot } from './schema'

/**
 * Память → блок данных для сообщения (не для системной инструкции):
 *  - безопасность: снимок присылает устройство, любая заметка может оказаться попыткой взлома (OWASP LLM01
 *    «stored») — поэтому JSON-блок с пометкой «данные, не инструкции» (context.ts);
 *  - кэш: системный промпт остаётся байт-в-байт одинаковым у всех людей (Hermes prompt tiers).
 * Правила поведения («не стыди за пропуск», «откликайся на имя») — в системной части задачи (prompt/tasks/chat.ts),
 * здесь только факты. Ключи по-русски: модель читает их как подписи.
 */
export function renderMemory(m: MemorySnapshot | null): string {
  if (!m) return dataBlock('memory', { 'первый разговор': true })
  const p = m.patterns
  return dataBlock('memory', {
    // подпись однозначная: в сравнении 11.11 модель называла этим именем самого человека («Эй, Уголёк, бывает»)
    'твоё имя (так человек назвал ТЕБЯ, кота; это не имя человека)': m.companionName ?? undefined,
    'план на завтра': m.plan
      ? { дата: m.plan.forDate, дело: m.plan.task, 'первый шаг': m.plan.firstStep, время: m.plan.startTime }
      : 'нет',
    'последние старты': m.recentStarts.length
      ? m.recentStarts.map((s) => ({ дата: s.date, дело: s.label, минут: s.minutes > 0 ? Math.round(s.minutes) : undefined }))
      : 'стартов ещё не было',
    // стриков нет намеренно: только накопительное число, которое не сгорает
    'всего стартов': p.totalStarts > 0 ? p.totalStarts : undefined,
    'чаще всего начинает около, ч': p.favoriteHour ?? undefined,
    'не появлялся дней': typeof p.daysAway === 'number' && p.daysAway >= 3 ? p.daysAway : undefined,
    'находки на острове': m.recentFinds?.length
      ? m.recentFinds.map((f) => ({ название: f.name, редкая: f.rarity === 'rare' }))
      : undefined,
    'ты запомнил о человеке': m.notes.length ? m.notes : undefined,
  })
}
