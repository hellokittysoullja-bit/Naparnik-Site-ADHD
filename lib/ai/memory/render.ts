import { dataBlock } from '../context'
import { BLOCKERS, HANGING, MOTIVES, SPHERES } from '../../onboarding'
import { CATEGORY_LABEL } from './facts'
import type { MemorySnapshot } from './schema'
import { factRejection, INSTRUCTION_LIKE } from './write-guard'
import { matchVariants } from '../guards/normalize'

/**
 * Память → блок данных для сообщения (не для системной инструкции):
 *  - безопасность: снимок присылает устройство, любая заметка может оказаться попыткой взлома (OWASP LLM01
 *    «stored») — поэтому JSON-блок с пометкой «данные, не инструкции» (context.ts), и каждый факт ещё раз
 *    проверяется при чтении (Hermes memory_tool_store.py:224-255: отравленная запись не идёт в промпт);
 *  - кэш: системный промпт остаётся байт-в-байт одинаковым у всех людей (Hermes prompt tiers).
 * Правила поведения («не стыди за пропуск», «откликайся на имя», как менять память) — в системной части задачи
 * (prompt/tasks/chat.ts), здесь только факты. Ключи по-русски: модель читает их как подписи.
 */
const labelOf = <K extends string>(table: readonly { key: K; label: string }[], key: K | undefined) =>
  key ? table.find((x) => x.key === key)?.label : undefined

// подпись старта и план пишет человек, но приходят они с устройства: похожее на указание коту в промпт не идёт
// вовсе (Hermes memory_tool_store.py:224-255 — [BLOCKED] при чтении), даже блоком данных
const HIDDEN = '(подпись скрыта)'
const plain = (s: string) => (matchVariants(s).some((v) => INSTRUCTION_LIKE.test(v)) ? HIDDEN : s)

export function renderMemory(m: MemorySnapshot | null): string {
  if (!m) return dataBlock('memory', { 'первый разговор': true })
  const p = m.patterns
  // номер факта — его место в присланном списке: устройство помнит, какой факт на каком месте (memory/policy.ts).
  // Отклонённый при чтении факт номер сохраняет, но в блок не попадает — номера остальных не сдвигаются
  const facts = (m.facts ?? [])
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => factRejection(f.text) === null)
    .map(({ f, i }) => ({ '№': String(i), тема: CATEGORY_LABEL[f.category], факт: f.text, с: f.since }))
  // прежние заметки (страница до обновления) — без номеров: менять их нельзя, только читать
  const legacy = (m.notes ?? []).filter((n) => factRejection(n) === null)
  const blocker = BLOCKERS.find((b) => b.key === m.profile?.blocker)
  const profile = m.profile && {
    'что обычно откладывает': labelOf(SPHERES, m.profile.sphere),
    'как давно висит главное дело': labelOf(HANGING, m.profile.hanging),
    'что мешает начать (сам выбрал)': blocker?.label,
    'договорились в знакомстве': blocker?.ifThen,
    'ради чего (сам выбрал)': labelOf(MOTIVES, m.profile.motive),
  }
  return dataBlock('memory', {
    // подпись однозначная: в сравнении 11.11 модель называла этим именем самого человека («Эй, Уголёк, бывает»)
    'твоё имя (так человек назвал ТЕБЯ, кота; это не имя человека)': m.companionName ?? undefined,
    'из знакомства': profile && Object.values(profile).some(Boolean) ? profile : undefined,
    'план на завтра': m.plan
      ? { дата: m.plan.forDate, дело: plain(m.plan.task), 'первый шаг': plain(m.plan.firstStep), время: m.plan.startTime && plain(m.plan.startTime) }
      : 'нет',
    'последние старты': m.recentStarts.length
      ? m.recentStarts.map((s) => ({ дата: s.date, дело: plain(s.label), минут: s.minutes > 0 ? Math.round(s.minutes) : undefined }))
      : 'стартов ещё не было',
    // стриков нет намеренно: только накопительное число, которое не сгорает
    'всего стартов': p.totalStarts > 0 ? p.totalStarts : undefined,
    // вывод кода с основанием (Т4): «обычно» — только с числом, иначе это Барнум
    'обычно начинает (по стартам)': p.startWindow
      ? `${p.startWindow.from}–${p.startWindow.to + 1} ч, ${p.startWindow.n} из ${p.startWindow.of} стартов`
      : undefined,
    'доводит до конца': p.durations?.length
      ? p.durations.map((d) => `${d.minutes} мин: ${d.done} из ${d.of}`)
      : undefined,
    'не появлялся дней': typeof p.daysAway === 'number' && p.daysAway >= 3 ? p.daysAway : undefined,
    'находки на острове': m.recentFinds?.length
      ? m.recentFinds.map((f) => ({ название: plain(f.name), редкая: f.rarity === 'rare' }))
      : undefined,
    'ты помнишь о человеке': facts.length ? facts : undefined,
    'ты запомнил о человеке': legacy.length ? legacy : undefined,
  })
}
