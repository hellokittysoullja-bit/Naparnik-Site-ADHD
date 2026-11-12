import type { UIMessage } from 'ai'
import type { ExtractLine, ExtractOp } from '@/lib/ai/agents/memory-extract'
import { FACT_LIMITS, type FactOp } from '@/lib/ai/memory/facts'
import { factKey } from '@/lib/ai/memory/fact-key'
import { toFactOp } from '@/lib/ai/memory/policy'
import { memoryInput } from '@/lib/ai/tools/catalog'
import { applyMemoryOps, applySkillMemoryOps, peekFacts, peekSkills, todayKey } from '@/lib/memory'
import type { SkillOp } from '@/lib/ai/memory/skills'
import { factRejection } from '@/lib/ai/memory/write-guard'

/**
 * Фоновая выжимка памяти на устройстве (решение владельца 12.11): когда разговор затих, кусок после прошлой
 * выжимки уходит на /api/memory, ответ — операции над фактами. Память живёт здесь, поэтому и последнее слово здесь:
 * каждая операция ещё раз проходит схему инструмента памяти (содержание) и toFactOp (номер, «забудь»).
 * Курсор — id последней обработанной реплики: сбой сети его не двигает, кусок уйдёт в следующий раз.
 */
const CURSOR_KEY = 'naparnik:memCursor'
const MIN_USER_CHARS = 8
const MAX_LINES = 16

let inFlight = false

function readCursor(): string | null {
  try {
    return window.localStorage.getItem(CURSOR_KEY)
  } catch {
    return null
  }
}

function writeCursor(id: string) {
  try {
    window.localStorage.setItem(CURSOR_KEY, id)
  } catch {
    /* без хранилища выжимка просто повторится — дубли отсекут правила памяти */
  }
}

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
    .trim()

/**
 * Следующий кусок после курсора: не больше MAX_LINES реплик С НАЧАЛА непрочитанного (а не хвост — иначе при быстром
 * разговоре середина терялась навсегда, аудит 12.11) и id последней отправленной реплики — до неё сдвинется курсор.
 * Курсор не найден (история обрезана до 30 реплик) — весь доступный хвост.
 */
export function pendingChunk(messages: readonly UIMessage[], cursor: string | null): { lines: ExtractLine[]; upTo: string | null } {
  const at = cursor ? messages.findIndex((m) => m.id === cursor) : -1
  const fresh = messages.slice(at + 1).filter((m) => m.role === 'user' || m.role === 'assistant')
  const chunk: { id: string; line: ExtractLine }[] = []
  for (const m of fresh) {
    const text = textOf(m)
    if (!text) continue
    if (chunk.length === MAX_LINES) break
    chunk.push({ id: m.id, line: { role: m.role === 'user' ? 'user' : 'cat', text } })
  }
  const upTo = chunk.at(-1)?.id ?? fresh.at(-1)?.id ?? null
  const lines = chunk.map((c) => c.line)
  return { lines: lines.some((l) => l.role === 'user' && l.text.length >= MIN_USER_CHARS) ? lines : [], upTo }
}

/**
 * Фоновое ревью по счёту ходов (Hermes: каждые ~10 ходов отдельный дешёвый вызов смотрит последние ходы): долгий
 * разговор без пауз тоже доходит до памяти, а не только затихший. Сколько реплик человека после курсора.
 */
export const REVIEW_EVERY_TURNS = 10

export function pendingUserTurns(messages: readonly UIMessage[]): number {
  const cursor = readCursor()
  const at = cursor ? messages.findIndex((m) => m.id === cursor) : -1
  return messages.slice(at + 1).filter((m) => m.role === 'user').length
}

/** Операция выжимки → операция устройства, через те же проверки, что вызов инструмента памяти в чате */
export function toDeviceOp(op: ExtractOp, refs: readonly string[]): FactOp | null {
  // выжимка только добавляет и заменяет (удаляет только человек в разговоре)
  if (op.op !== 'add' && op.op !== 'replace') return null
  const parsed = memoryInput.safeParse({ ...op, until: op.op === 'add' ? op.expiresOn : undefined })
  if (!parsed.success) return null
  // источник — «сказал о себе»: «запиши» в одной реплике куска не делает явными все факты куска (аудит 12.11)
  const r = toFactOp(parsed.data, { refs, lastUserText: '' })
  return r.ok ? r.op : null
}

/** Навык из выжимки → операция устройства: номер → id по отправленному списку, содержание ещё раз через запреты */
export function toDeviceSkillOp(op: ExtractOp, refs: readonly string[]): SkillOp | null {
  if (op.op !== 'skill' && op.op !== 'skillPatch') return null
  const fields = [op.op === 'skill' ? op.name : '', op.when, op.steps, op.avoid ?? '']
  if (fields.some((f) => typeof f !== 'string' || (f !== '' && factRejection(f) !== null))) return null
  if (op.op === 'skill') return { op: 'create', name: op.name, when: op.when, steps: op.steps, avoid: op.avoid }
  const id = /^\d{1,2}$/.test(op.ref) ? refs[Number(op.ref)] : undefined
  return id ? { op: 'patch', id, when: op.when, steps: op.steps, avoid: op.avoid } : null
}

/** Выжать память из затихшего разговора. Возвращает число применённых операций (для тестов и журнала) */
export async function syncMemory(messages: readonly UIMessage[], opts: { keepalive?: boolean } = {}): Promise<number> {
  if (inFlight || messages.length === 0) return 0
  inFlight = true
  let applied = 0
  try {
    // за один раз — до трёх кусков подряд (длинный разговор до затишья)
    for (let round = 0; round < 3; round++) {
      const { lines, upTo } = pendingChunk(messages, readCursor())
      if (!upTo) break
      if (lines.length === 0) {
        writeCursor(upTo)
        if (upTo === messages[messages.length - 1].id) break
        continue
      }
      const facts = peekFacts().slice(0, FACT_LIMITS.active)
      const refs = facts.map((f) => f.id)
      const skills = peekSkills()
      const skillRefs = skills.map((s) => s.id)
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        keepalive: opts.keepalive,
        body: JSON.stringify({
          facts: facts.map((f) => ({ category: f.category, text: f.text })),
          skills: skills.map((s) => ({ name: s.name, when: s.when })),
          lines,
          today: todayKey(),
        }),
      })
      // 503 — модели не ответили; 429 — лимит; сеть — исключение: курсор стоит, кусок уйдёт в следующий раз
      if (!res.ok) break
      const data = (await res.json()) as { ops?: unknown }
      const ops = (Array.isArray(data.ops) ? (data.ops as ExtractOp[]) : [])
        .map((op) => toDeviceOp(op, refs))
        .filter((op): op is FactOp => op !== null)
      const results = await applyMemoryOps(ops)
      applied += results.filter((r) => r.ok).length
      const skillOps = (Array.isArray(data.ops) ? (data.ops as ExtractOp[]) : [])
        .map((op) => toDeviceSkillOp(op, skillRefs))
        .filter((op): op is SkillOp => op !== null)
      applied += (await applySkillMemoryOps(skillOps)).filter((r) => r.ok).length
      writeCursor(upTo)
      if (upTo === messages[messages.length - 1].id) break
    }
  } catch {
    /* нет сети — курсор не сдвинут */
  } finally {
    inFlight = false
  }
  return applied
}

/**
 * После «забудь» отметки «запомнил: …» о забытом уходят из переписки: иначе кот прочёл бы забытое в истории разговора
 * (её последние 30 реплик уходят модели) и человек видел бы на экране то, чего кот уже не помнит (аудит 12.11).
 * Остаётся отметка только о том, что память ещё хранит (в том числе в истории замен). Реплики человека не трогаем.
 */
export function purgeForgottenChips<M extends UIMessage>(messages: readonly M[], keptKeys: ReadonlySet<string>): M[] | null {
  let changed = false
  const out: M[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') {
      out.push(m)
      continue
    }
    const parts = m.parts.filter((p) => {
      const x = p as { type: string; input?: { op?: unknown; text?: unknown; fact?: unknown } }
      const text =
        x.type === 'tool-memory' && (x.input?.op === 'add' || x.input?.op === 'replace')
          ? x.input.text
          : x.type === 'tool-rememberFact'
            ? x.input?.fact
            : undefined
      if (typeof text !== 'string' || keptKeys.has(factKey(text))) return true
      changed = true
      return false
    })
    if (parts.some((p) => p.type !== 'step-start')) out.push(parts.length === m.parts.length ? m : ({ ...m, parts } as M))
    else changed = true
  }
  return changed ? out : null
}
