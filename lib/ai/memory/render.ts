import { dataBlock } from '../context'
import { BLOCKERS, HANGING, MOTIVES, SPHERES } from '../../onboarding'
import { CATEGORY_LABEL, type FactCategory } from './facts'
import { relevantSkills } from './skills'
import { contentWords, stemHits } from './stems'
import type { MemorySnapshot } from './schema'
import { factRejection, INSTRUCTION_LIKE } from './write-guard'
import { matchVariants } from '../guards/normalize'
import { parseSummary, SUMMARY_LABEL, type SummaryLine } from './summary'

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
// даты с устройства — только датами: в поле даты не может прийти текст (аудит 12.11)
const day = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined)

const skillOk = (s: NonNullable<MemorySnapshot['skills']>[number]) =>
  [s.name, s.when, s.steps, s.avoid ?? ''].every((f) => !f || factRejection(f) === null)

function skillIndex(m: MemorySnapshot) {
  return (m.skills ?? [])
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => skillOk(s))
    .map(({ s, i }) => ({ '№': String(i), название: s.name, когда: s.when }))
}

/**
 * Навыки, подходящие к последней реплике, — целиком (уровень 1 раскрытия). Ярус «изменчивое» рядом со знаниями:
 * перед последней репликой человека (prompt/assemble.ts), чтобы не трогать кэш истории.
 */
export function renderSkills(m: MemorySnapshot | null, lastUserText: string): string | undefined {
  if (!m?.skills?.length) return undefined
  const full = relevantSkills(asSkills(m), lastUserText).filter(skillOk)
  if (full.length === 0) return undefined
  return dataBlock(
    'memory',
    Object.fromEntries(full.map((s) => [`навык №${s.id} «${s.name}»`, { когда: s.when, 'что делать': s.steps, 'чего избегать': s.avoid }])),
    400,
  )
}

/** снимок навыков → вид, который понимает общий отбор (счётчики знает только устройство) */
const asSkills = (m: MemorySnapshot) =>
  (m.skills ?? []).map((s, i) => ({ ...s, id: String(i), createdAt: '', updatedAt: '', uses: 0, wins: 0, status: 'active' as const }))

/**
 * Память под разовую задачу (дробление, голос сессии). Весь блок чата этим задачам не нужен и вреден: модель на три
 * шага начинает пересказывать план на завтра. Здесь принцип наименьшего достаточного (Hermes: prefetch(query) у
 * поставщика памяти возвращает то, что относится к запросу, а не всю память):
 *  - факты: сначала те, что перекликаются с делом по основам слов, затем темы, полезные задаче всегда; не больше TASK_FACTS;
 *  - навыки: только подходящие к делу, целиком (тот же отбор, что в чате, чтобы устройство отметило те же);
 *  - прошлые старты по этому же делу: шагам полезно знать, с чего человек уже начинал.
 * Нечего сказать — блока нет вовсе: запрос человека без памяти остаётся байт-в-байт прежним.
 */
export type TaskView = 'breakdown' | 'session-voice'

const TASK_FACTS = 6
/** темы, которые задаче полезны всегда; остальные — только если перекликаются с делом */
const ALWAYS: Readonly<Record<TaskView, readonly FactCategory[]>> = {
  // как человек работает и что ему мешает — из этого и делаются шаги; «о себе» даёт род и занятие
  breakdown: ['helps', 'obstacle', 'task', 'about'],
  // голосу важнее тон и то, что человеку помогает; остальное — только к делу
  'session-voice': ['style', 'helps', 'about'],
}

export function renderTaskMemory(m: MemorySnapshot | null, taskText: string, view: TaskView): string | undefined {
  if (!m) return undefined
  const said = contentWords(taskText)
  const always = ALWAYS[view]
  const facts = (m.facts ?? [])
    .map((f, i) => ({ f, i, hits: stemHits(contentWords(f.text), said), rank: always.indexOf(f.category) }))
    .filter(({ f, hits, rank }) => (hits > 0 || rank >= 0) && factRejection(f.text) === null)
    .sort((a, b) => b.hits - a.hits || (a.rank < 0 ? 99 : a.rank) - (b.rank < 0 ? 99 : b.rank) || a.i - b.i)
    .slice(0, TASK_FACTS)
    .map(({ f }) => ({ тема: CATEGORY_LABEL[f.category], факт: f.text }))
  const skills = relevantSkills(asSkills(m), taskText)
    .filter(skillOk)
    .map((s) => ({ навык: s.name, когда: s.when, 'что делать': s.steps, 'чего избегать': s.avoid }))
  const blocker = BLOCKERS.find((b) => b.key === m.profile?.blocker)
  const fields: Record<string, unknown> =
    view === 'breakdown'
      ? {
          'что мешает начать (сам выбрал)': blocker?.label,
          'договорились в знакомстве': blocker?.ifThen,
          'уже начинал это дело': m.recentStarts
            .filter((s) => stemHits(contentWords(s.label), said) > 0 && plain(s.label) !== HIDDEN)
            .slice(-3)
            .map((s) => ({ шаг: s.label, минут: s.minutes > 0 ? Math.round(s.minutes) : undefined })),
        }
      : {
          'твоё имя (так человек назвал ТЕБЯ, кота; это не имя человека)': m.companionName ? plain(m.companionName) : undefined,
          'ради чего (сам выбрал)': labelOf(MOTIVES, m.profile?.motive),
          'всего стартов': m.patterns.totalStarts > 0 ? m.patterns.totalStarts : undefined,
        }
  const block = {
    ...fields,
    'ты помнишь о человеке': facts,
    'твои навыки для этого дела': skills,
  }
  const filled = Object.entries(block).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined))
  return filled.length ? dataBlock('memory', Object.fromEntries(filled), 400) : undefined
}

/**
 * Слова человека, которые лежат в памяти: их латинские названия («Overleaf», «Ableton») кот вправе повторить так же,
 * как слова из текущего разговора (guards/output.ts echoWords). Только то, что прошло проверку чтения.
 */
export function memoryWords(m: MemorySnapshot | null): string[] {
  if (!m) return []
  return [
    ...(m.facts ?? []).map((f) => f.text).filter((t) => factRejection(t) === null),
    ...(m.skills ?? []).filter(skillOk).flatMap((s) => [s.name, s.when, s.steps, s.avoid ?? '']),
    ...m.recentStarts.map((s) => s.label),
    ...(m.plan ? [m.plan.task, m.plan.firstStep] : []),
  ].filter((t) => t && plain(t) !== HIDDEN)
}

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
    'твоё имя (так человек назвал ТЕБЯ, кота; это не имя человека)': m.companionName ? plain(m.companionName) : undefined,
    'из знакомства': profile && Object.values(profile).some(Boolean) ? profile : undefined,
    'план на завтра': m.plan
      ? { дата: day(m.plan.forDate), дело: plain(m.plan.task), 'первый шаг': plain(m.plan.firstStep), время: m.plan.startTime && plain(m.plan.startTime) }
      : 'нет',
    'последние старты': m.recentStarts.length
      ? m.recentStarts.map((s) => ({ дата: day(s.date), дело: plain(s.label), минут: s.minutes > 0 ? Math.round(s.minutes) : undefined }))
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
    // навыки — списком «название + когда» (Hermes: уровень 0 прогрессивного раскрытия); подходящие к реплике целиком
    // приходят отдельным блоком перед ней (renderSkills) — так этот блок стабилен от хода к ходу и кэшируется
    'твои навыки с этим человеком': skillIndex(m).length ? skillIndex(m) : undefined,
    'ты запомнил о человеке': legacy.length ? legacy : undefined,
  })
}

/**
 * Конспект прошлой части разговора → блок данных (agents/summarize.ts). Конспект присылает устройство, поэтому
 * каждая строка ещё раз проходит запреты памяти при чтении (parseSummary). Дата составления — в блоке: модель должна
 * понимать, что «договорились на завтра» двухнедельной давности уже прошло.
 */
export function renderSummary(raw: unknown, madeOn?: string): { block?: string; lines: SummaryLine[] } {
  const lines = parseSummary(raw)
  if (lines.length === 0) return { lines }
  const byKind: Record<string, string[]> = {}
  for (const l of lines) (byKind[SUMMARY_LABEL[l.kind].toLowerCase()] ??= []).push(l.text)
  return { lines, block: dataBlock('summary', { составлен: day(madeOn), ...byKind }) }
}
