import { factKey } from './fact-key'
import { contentWords, stemHits } from './stems'
import { similarity } from './facts'

/**
 * Навыки кота о конкретном человеке — процедурная память (Hermes: skills, «уроки, а не логи»; agentskills.io:
 * When to Use → Procedure → Pitfalls). Факт говорит, ЧТО известно («легче начинает после душа»); навык — КАК
 * действовать в повторяющейся ситуации с этим человеком («когда залипает в телефон: предложить убрать телефон в
 * другую комнату и взять 2 минуты; не торопить сроками»).
 *
 * Отличия от Hermes, осознанные:
 *  - навыки — о человеке и живут на его устройстве (решение владельца: память только на устройстве); общих для всех
 *    людей навыков, которые кот пишет сам, нет: это меняло бы голос кота без контроля владельца;
 *  - пишет их только фоновое ревью и только по словам самого человека (что сработало, что мешает, как с ним
 *    говорить) — кот в разговоре навыки не правит;
 *  - Curator — код, не модель: дубли сливаются по сходству, неиспользуемые уходят в архив, лимит держится по
 *    счётчикам «показан» и «после него был старт».
 * Модуль без zod: его подключает lib/memory.ts, а тот есть на каждой странице.
 */
export type Skill = {
  id: string
  /** короткое имя: «Залипание в телефон» */
  name: string
  /** когда применять: ситуация с этим человеком, его словами */
  when: string
  /** что делать коту: 1–3 коротких шага */
  steps: string
  /** чего избегать с этим человеком (может быть пусто) */
  avoid?: string
  createdAt: string
  updatedAt: string
  /** сколько ходов навык был раскрыт целиком */
  uses: number
  /** сколько раз после такого хода в течение получаса был старт */
  wins: number
  lastUsedAt?: string
  status: 'active' | 'archived'
}

export const SKILL_LIMITS = {
  /** активных навыков (Hermes: жёсткий лимит заставляет сжимать, а не раздувать) */
  active: 8,
  name: 40,
  when: 160,
  steps: 300,
  avoid: 160,
  /** сколько навыков раскрывается целиком в одном ходе (остальные — строкой индекса) */
  expanded: 2,
  /** не применялся столько дней — в архив */
  staleDays: 60,
  /** архивных храним не больше */
  archived: 16,
} as const

export type SkillOp =
  | { op: 'create'; name: string; when: string; steps: string; avoid?: string }
  | { op: 'patch'; id: string; when?: string; steps?: string; avoid?: string }

export type SkillOpResult = { op: SkillOp; ok: true; id: string } | { op: SkillOp; ok: false; reason: 'empty' | 'unknown_ref' | 'duplicate' }

const clip = (s: string | undefined, n: number) => (s ?? '').trim().replace(/\s+/g, ' ').slice(0, n)

/** почти тот же навык: та же ситуация другими словами — правка, а не второй навык */
const SAME_SKILL = 0.6
function sameSituation(a: Pick<Skill, 'name' | 'when'>, b: Pick<Skill, 'name' | 'when'>): boolean {
  return factKey(a.name) === factKey(b.name) || similarity(`${a.name} ${a.when}`, `${b.name} ${b.when}`) >= SAME_SKILL
}

export function activeSkills(skills: readonly Skill[]): Skill[] {
  return skills.filter((s) => s.status === 'active')
}

/**
 * Применить операции ревью — чистая функция (Hermes skill_manage: create / patch; patch предпочтительнее). Содержание
 * уже проверено (write-guard.ts skillRejection) — здесь дубли, правка и лимит.
 */
export function applySkillOps(
  base: readonly Skill[],
  ops: readonly SkillOp[],
  opts: { now: string; newId: () => string },
): { skills: Skill[]; results: SkillOpResult[] } {
  let skills = base.map((s) => ({ ...s }))
  const results: SkillOpResult[] = []
  for (const op of ops) {
    if (op.op === 'patch') {
      const s = skills.find((x) => x.id === op.id && x.status === 'active')
      if (!s) {
        results.push({ op, ok: false, reason: 'unknown_ref' })
        continue
      }
      if (op.when) s.when = clip(op.when, SKILL_LIMITS.when)
      if (op.steps) s.steps = clip(op.steps, SKILL_LIMITS.steps)
      if (op.avoid !== undefined) s.avoid = clip(op.avoid, SKILL_LIMITS.avoid) || undefined
      s.updatedAt = opts.now
      results.push({ op, ok: true, id: s.id })
      continue
    }
    const fresh = { name: clip(op.name, SKILL_LIMITS.name), when: clip(op.when, SKILL_LIMITS.when), steps: clip(op.steps, SKILL_LIMITS.steps) }
    if (!factKey(fresh.name) || !factKey(fresh.when) || !factKey(fresh.steps)) {
      results.push({ op, ok: false, reason: 'empty' })
      continue
    }
    const near = activeSkills(skills).find((s) => sameSituation(s, fresh))
    if (near) {
      // та же ситуация: ревью уточняет навык, счётчики сохраняются (Hermes: patch, а не новый навык)
      near.when = fresh.when
      near.steps = fresh.steps
      if (op.avoid) near.avoid = clip(op.avoid, SKILL_LIMITS.avoid)
      near.updatedAt = opts.now
      results.push({ op, ok: true, id: near.id })
      continue
    }
    const id = opts.newId()
    skills.push({ id, ...fresh, avoid: clip(op.avoid, SKILL_LIMITS.avoid) || undefined, createdAt: opts.now, updatedAt: opts.now, uses: 0, wins: 0, status: 'active' })
    results.push({ op, ok: true, id })
  }
  skills = curate(skills, opts.now.slice(0, 10))
  return { skills, results }
}

function daysBetween(fromIso: string, toDay: string): number {
  return (new Date(`${toDay}T12:00:00Z`).getTime() - new Date(fromIso).getTime()) / 86_400_000
}

/**
 * Польза навыка: сначала доля стартов после него (новый, ещё не применявшийся, — 0,5), потом сколько раз применялся,
 * потом свежесть. > 0 — a полезнее b
 */
function byWorth(a: Skill, b: Skill): number {
  // сглаженная доля: один случай не делает навык лучшим или худшим; новый, ещё не применявшийся (0,34) не вытесняет
  // проверенный (4 старта из 10 → 0,42) — аудит 12.11: раньше у нового было 0,5, и он отправлял в архив рабочий
  const rate = (s: Skill) => (s.uses > 0 ? (s.wins + 1) / (s.uses + 2) : 0.34)
  return rate(a) - rate(b) || a.uses - b.uses || (a.lastUsedAt ?? a.updatedAt).localeCompare(b.lastUsedAt ?? b.updatedAt)
}

/**
 * Curator (Hermes: периодически сливает дубли и архивирует неиспользуемое; решения — по счётчику использований).
 * Детерминированный, без модели: вызывается при каждой записи и при чтении раз в день.
 *  1) дубли — одна ситуация дважды: остаётся тот, что полезнее, счётчики складываются;
 *  2) не применялся больше 60 дней — в архив (не удаляется: вернётся правкой, если ситуация повторится);
 *  3) больше 8 активных — в архив наименее полезный;
 *  4) архив не растёт без конца: старые архивные удаляются.
 */
export function curate(skills: readonly Skill[], today: string): Skill[] {
  const out = skills.map((s) => ({ ...s }))
  const active = () => out.filter((s) => s.status === 'active')
  for (const a of active()) {
    if (a.status !== 'active') continue
    for (const b of active()) {
      if (a === b || b.status !== 'active' || !sameSituation(a, b)) continue
      const [keep, drop] = byWorth(a, b) >= 0 ? [a, b] : [b, a]
      keep.uses += drop.uses
      keep.wins += drop.wins
      drop.status = 'archived'
    }
  }
  for (const s of active()) if (daysBetween(s.lastUsedAt ?? s.updatedAt, today) > SKILL_LIMITS.staleDays) s.status = 'archived'
  const live = active().sort((a, b) => byWorth(b, a))
  for (const s of live.slice(SKILL_LIMITS.active)) s.status = 'archived'
  const archived = out.filter((s) => s.status === 'archived').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const dropIds = new Set(archived.slice(SKILL_LIMITS.archived).map((s) => s.id))
  return out.filter((s) => !dropIds.has(s.id))
}

/**
 * Прогрессивное раскрытие (Hermes: уровень 0 — список «имя + когда», уровень 1 — полный текст по требованию). У нас
 * «требование» определяет код: целиком раскрываются навыки, чья ситуация совпадает со словами последней реплики
 * (основы слов от 4 букв), не больше двух. Остальные — одной строкой в индексе.
 */
export function relevantSkills(skills: readonly Skill[], lastUserText: string): Skill[] {
  // содержательные слова по общей основе (memory/stems.ts): служебное «когда» есть почти в каждом навыке и раньше
  // раскрывало навык на любую реплику со словом «когда» (аудит 12.11)
  const said = contentWords(lastUserText)
  if (said.length === 0) return []
  // при равенстве — порядок списка: сервер счётчиков не знает, а устройство должно отметить «применён» ровно те
  // навыки, которые сервер раскрыл модели (раньше устройство разрешало ничью по wins и засчитывало не те)
  return activeSkills(skills)
    .map((s, i) => ({ s, i, hits: stemHits(contentWords(`${s.name} ${s.when}`), said) }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.i - b.i)
    .slice(0, SKILL_LIMITS.expanded)
    .map((x) => x.s)
}
