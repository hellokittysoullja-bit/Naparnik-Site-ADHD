import { factKey } from './fact-key'

/**
 * Факты о человеке (ярус Т3, research/20-ai-harness/memory-personalization.md §3–§4) — одно хранилище правил для
 * устройства и сервера. Модуль без zod и без проверок вывода: его подключает lib/memory.ts, а тот есть на каждой
 * странице (e2e/bundle-budget.spec.ts). Проверка СОДЕРЖАНИЯ записи (здоровье, документы, «указания коту») — в
 * write-guard.ts, до того, как операция дойдёт сюда.
 *
 * Откуда приёмы:
 *  - Hermes tools/memory_tool.py: пакет операций add/patch/remove, лимит считается на итоге, запись атомарна;
 *  - mem0 main.py: номера вместо id в промпте (модель не выдумает id), дубли по нормализованному тексту;
 *  - Letta core memory: блок фиксированного размера; Mastra working memory: «смена состояния: теперь X»;
 *  - Claude / ChatGPT memory: «забудь» словами, жёстко удаляет только человек; модель заменяет мягко (история видна).
 */
export type FactCategory = 'about' | 'task' | 'obstacle' | 'helps' | 'people' | 'schedule' | 'style' | 'event'

export const FACT_CATEGORIES: readonly FactCategory[] = ['about', 'task', 'obstacle', 'helps', 'people', 'schedule', 'style', 'event']

/** подписи для модели и для ответа «что ты помнишь» — по-русски */
export const CATEGORY_LABEL: Readonly<Record<FactCategory, string>> = {
  about: 'о себе',
  task: 'дело',
  obstacle: 'мешает',
  helps: 'помогает',
  people: 'люди',
  schedule: 'расписание',
  style: 'как говорить',
  event: 'событие',
}

export type FactSource = 'explicit' | 'stated'

export type Fact = {
  id: string
  category: FactCategory
  /** ≤ 160 символов, самодостаточно: «Пишет диплом про морских котиков» */
  text: string
  /** explicit — человек сам попросил запомнить; stated — сказал о себе, кот записал */
  source: FactSource
  /** короткая цитата человека — основание записи (для «что ты помнишь» и проверки обоснованности) */
  evidence?: string
  createdAt: string
  updatedAt: string
  /** YYYY-MM-DD: после этой даты факт не идёт в промпт (обязательно для события) */
  expiresOn?: string
  status: 'active' | 'superseded'
  /** id факта, который этот заменил */
  supersedes?: string
}

export const FACT_LIMITS = {
  /** активных фактов (Letta: блок фиксированного размера) */
  active: 20,
  /** заменённых храним для истории «было → стало», не больше */
  superseded: 20,
  text: 160,
  evidence: 80,
  /** расписание без подтверждения живёт 90 дней (memory-personalization.md §4.5) */
  scheduleDays: 90,
} as const

export type FactOp =
  | { op: 'add'; category: FactCategory; text: string; evidence?: string; expiresOn?: string; source: FactSource }
  | { op: 'replace'; id: string; text: string; evidence?: string; expiresOn?: string }
  | { op: 'forget'; id: string }
  | { op: 'forgetAll' }

export type OpResult =
  | { op: FactOp; ok: true; id?: string }
  | { op: FactOp; ok: false; reason: 'duplicate' | 'empty' | 'unknown_ref' | 'full' }

const DATE = /^\d{4}-\d{2}-\d{2}$/

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Срок факта: названная дата (не в прошлом, не дальше 400 дней), иначе событию — 30 дней, расписанию — 90 */
function expiryFor(category: FactCategory, asked: string | undefined, today: string): string | undefined {
  if (asked && DATE.test(asked) && asked >= today && asked <= addDays(today, 400)) return asked
  if (category === 'event') return addDays(today, 30)
  if (category === 'schedule') return addDays(today, FACT_LIMITS.scheduleDays)
  return undefined
}

/** Активные факты на дату: истёкшие и заменённые в промпт не идут. Порядок — по времени создания (стабильный) */
export function activeFacts(facts: readonly Fact[], today: string): Fact[] {
  return facts.filter((f) => f.status === 'active' && !(f.expiresOn && f.expiresOn < today))
}

// Триграммы для «почти тот же факт»: «Пишет диплом по экономике» и «Пишет диплом по экономике в МГУ» — замена,
// а не второй факт (memory-personalization.md §4.5 п.3: Жаккар ≥ 0,8 внутри категории)
function trigrams(text: string): Set<string> {
  const s = ` ${factKey(text)} `
  const out = new Set<string>()
  for (let i = 0; i + 3 <= s.length; i++) out.add(s.slice(i, i + 3))
  return out
}

export function similarity(a: string, b: string): number {
  const x = trigrams(a)
  const y = trigrams(b)
  if (x.size === 0 || y.size === 0) return 0
  let inter = 0
  for (const t of x) if (y.has(t)) inter++
  return inter / (x.size + y.size - inter)
}

export const NEAR_DUPLICATE = 0.8

// Что вытеснять, когда активных уже 20: просьба человека и стиль общения — никогда; иначе наименее важная
// категория, среди равных — самая давно обновлённая (Park et al. 2023: важность + давность; важность из категории,
// а не от модели — детерминированно и тестируемо)
const IMPORTANCE: Readonly<Record<FactCategory, number>> = {
  style: 1,
  obstacle: 0.9,
  task: 0.8,
  helps: 0.8,
  event: 0.8,
  schedule: 0.6,
  people: 0.5,
  about: 0.5,
}

function evictable(facts: Fact[], today: string): Fact | undefined {
  return activeFacts(facts, today)
    .filter((f) => f.source !== 'explicit' && f.category !== 'style')
    .sort((a, b) => IMPORTANCE[a.category] - IMPORTANCE[b.category] || a.updatedAt.localeCompare(b.updatedAt))[0]
}

const clip = (s: string | undefined, n: number) => (s === undefined ? undefined : s.trim().replace(/\s+/g, ' ').slice(0, n))

/**
 * Применить пакет операций — чистая функция (одна и та же на устройстве и на сервере). Каждая операция — отдельное
 * решение; удаление и замена работают по id (номер из промпта переводит в id вызывающий — он знает, какой список
 * показал модели). Возвращает новый список и решение по каждой операции.
 */
export function applyFactOps(
  base: readonly Fact[],
  ops: readonly FactOp[],
  opts: { now: string; newId: () => string; today?: string },
): { facts: Fact[]; results: OpResult[] } {
  let facts = base.map((f) => ({ ...f }))
  // «сегодня» — по часам человека (устройство передаёт местную дату): по UTC вечером в Нью-Йорке событие считалось бы
  // истёкшим здесь и живым в снимке — активных фактов становилось больше лимита (аудит 12.11)
  const today = opts.today ?? opts.now.slice(0, 10)
  const results: OpResult[] = []

  for (const op of ops) {
    if (op.op === 'forgetAll') {
      facts = []
      results.push({ op, ok: true })
      continue
    }
    if (op.op === 'forget') {
      // «забудь» — жёстко: и сам факт, и вся цепочка его прежних версий (человек просил забыть смысл, а не строку)
      const target = facts.find((f) => f.id === op.id && f.status === 'active')
      if (!target) {
        results.push({ op, ok: false, reason: 'unknown_ref' })
        continue
      }
      const drop = new Set<string>([target.id])
      for (let cur: Fact | undefined = target; cur?.supersedes; ) {
        drop.add(cur.supersedes)
        cur = facts.find((f) => f.id === cur!.supersedes)
      }
      facts = facts.filter((f) => !drop.has(f.id))
      results.push({ op, ok: true, id: target.id })
      continue
    }

    const text = clip(op.text, FACT_LIMITS.text) ?? ''
    if (!factKey(text)) {
      results.push({ op, ok: false, reason: 'empty' })
      continue
    }
    // цитату человека не храним: она нужна только проверке основания до записи, а хранить слова человека «на всякий
    // случай» — только риск (аудит 12.11: в цитате могли оказаться здоровье и кризис)
    const live = activeFacts(facts, today)
    const sameKey = live.find((f) => factKey(f.text) === factKey(text))

    if (op.op === 'replace') {
      const old = facts.find((f) => f.id === op.id && f.status === 'active')
      if (!old) {
        results.push({ op, ok: false, reason: 'unknown_ref' })
        continue
      }
      if (sameKey) {
        results.push({ op, ok: false, reason: 'duplicate' })
        continue
      }
      const id = opts.newId()
      old.status = 'superseded'
      old.updatedAt = opts.now
      facts.push({
        id,
        category: old.category,
        text,
        source: old.source,
        createdAt: opts.now,
        updatedAt: opts.now,
        // новая версия события или расписания живёт свой срок, а не остаток прежнего
        expiresOn: expiryFor(old.category, op.expiresOn, today),
        status: 'active',
        supersedes: old.id,
      })
      results.push({ op, ok: true, id })
      continue
    }

    // add
    if (sameKey) {
      // человек повторил то, что кот уже помнит, но теперь попросил запомнить — повышаем доверие к записи
      if (op.source === 'explicit' && sameKey.source !== 'explicit') {
        sameKey.source = 'explicit'
        sameKey.updatedAt = opts.now
      }
      results.push({ op, ok: false, reason: 'duplicate' })
      continue
    }
    const expiresOn = expiryFor(op.category, op.expiresOn, today)
    const near = live.find((f) => f.category === op.category && similarity(f.text, text) >= NEAR_DUPLICATE)
    const id = opts.newId()
    const fresh: Fact = {
      id,
      category: op.category,
      text,
      source: op.source,
      createdAt: opts.now,
      updatedAt: opts.now,
      expiresOn,
      status: 'active',
    }
    if (near) {
      near.status = 'superseded'
      near.updatedAt = opts.now
      fresh.supersedes = near.id
      if (near.source === 'explicit') fresh.source = 'explicit'
    } else if (live.length >= FACT_LIMITS.active) {
      const out = evictable(facts, today)
      if (!out) {
        results.push({ op, ok: false, reason: 'full' })
        continue
      }
      facts = facts.filter((f) => f.id !== out.id)
    }
    facts.push(fresh)
    results.push({ op, ok: true, id })
  }

  return { facts: compact(facts, today), results }
}

/** Убрать лишнее: заменённые сверх лимита (старые первыми) и истёкшие больше 30 дней назад */
function compact(facts: Fact[], today: string): Fact[] {
  const cutoff = addDays(today, -30)
  const kept = facts.filter((f) => !(f.expiresOn && f.expiresOn < cutoff))
  const superseded = kept.filter((f) => f.status === 'superseded').sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const extra = new Set(superseded.slice(0, Math.max(0, superseded.length - FACT_LIMITS.superseded)).map((f) => f.id))
  return kept.filter((f) => !extra.has(f.id))
}

/**
 * «Забудь»: прямая просьба к коту, без которой модель не вправе удалять память (правило, не модель). Только
 * повелительная форма и только о памяти: «надо удалить старые фото», «удалил тикток», «сотри файлы черновика»,
 * «боюсь забыть про дедлайн», «хочу забыть этот день» — не просьба (аудит 12.11: всё это открывало стирание).
 * «Не забудь», «не забывай» — наоборот, просьба помнить.
 */
const FORGET = /(?<!\p{L})(?<!не\s)(?:забудь(?:те)?|забывай(?:те)?|не\s+(?:помни|запоминай)(?:те)?|перестань\s+(?:помнить|запоминать)|больше\s+не\s+(?:вспоминай|напоминай)(?:те)?|выкинь(?:те)?\s+из\s+(?:памяти|головы)|(?:удали|сотри)(?:те)?\s+(?:\p{L}+\s+){0,2}?(?:из\s+памяти|это|всё|все|про|о|об|что))(?!\p{L})/iu

export function asksToForget(userText: string): boolean {
  return FORGET.test(userText.normalize('NFKC').toLowerCase().replace(/ё/g, 'е'))
}

/** Явная просьба запомнить — запись получает приоритет (не вытесняется) */
const REMEMBER = /(?<!\p{L})(?:запомни\p{L}*|запиши\p{L}*|не\s+забудь|учти|зови\s+меня|называй\s+меня)(?!\p{L})/iu

export function asksToRemember(userText: string): boolean {
  return REMEMBER.test(userText.normalize('NFKC').toLowerCase().replace(/ё/g, 'е'))
}
