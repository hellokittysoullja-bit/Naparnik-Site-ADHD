import type { MemoryInput } from '../tools/catalog'
import { activeFacts, applyFactOps, asksToForget, asksToForgetAll, asksToRemember, forgetMatches, FACT_LIMITS, type Fact, type FactOp, type OpResult } from './facts'
import { factKey } from './fact-key'
import type { MemorySnapshot } from './schema'

/**
 * Правила записи в память — одни для любого хранилища (устройство, база, бот). Источники:
 *  - Hermes tools/memory_tool_store.py:397-675 — проверка ДО записи, лимит считается на итоге, атомарно;
 *  - mem0 main.py:~933 — модель видит номера, а не id: номер переводится в id здесь, по списку, который модель видела;
 *  - Letta core memory — блок фиксированного размера; ChatGPT/Claude memory — «забудь» по слову человека.
 * Проверка содержания (здоровье, «указания коту», контакты) — write-guard.ts через схему инструмента: сюда
 * приходят уже прошедшие её вызовы.
 */
export type MemoryWrite =
  | { kind: 'memory'; input: MemoryInput }
  | { kind: 'plan'; task: string; firstStep: string; startTime?: string }

/** Состояние памяти, которое хранит хранилище (устройство — в localStorage, сервер — в базе) */
export type MemoryState = { facts: Fact[]; plan: MemorySnapshot['plan'] }

/** Порядок фактов, который видит модель: номер факта = место в этом списке */
export function factRefs(facts: readonly Fact[], today: string): string[] {
  return activeFacts(facts, today).map((f) => f.id)
}

/** Факты для снимка (то, что уходит в промпт) — в том же порядке, что factRefs */
export function snapshotFacts(facts: readonly Fact[], today: string): NonNullable<MemorySnapshot['facts']> {
  return activeFacts(facts, today)
    .slice(0, FACT_LIMITS.active)
    .map((f) => ({ category: f.category, text: f.text, since: f.createdAt.slice(0, 10) }))
}

export type RefusedWrite = 'unknown_ref' | 'not_asked_to_forget' | 'incomplete'

/**
 * Вызов инструмента → операция над фактами. Здесь — правила, которые знает только ход:
 *  - номер факта должен быть из показанного списка (иначе модель удалила бы «что-то»);
 *  - забыть — только если человек сам попросил в последней реплике (правило, не модель: модель, которую
 *    уговорил текст в памяти, не может стереть память человека).
 */
export function toFactOp(
  input: MemoryInput,
  ctx: { refs: readonly string[]; lastUserText: string; textOf?: (id: string) => string | undefined },
): { ok: true; op: FactOp } | { ok: false; reason: RefusedWrite } {
  const idOf = (ref: string | undefined) => (ref !== undefined && /^\d{1,2}$/.test(ref) ? ctx.refs[Number(ref)] : undefined)
  switch (input.op) {
    case 'add':
      if (!input.category || !input.text) return { ok: false, reason: 'incomplete' }
      return {
        ok: true,
        op: {
          op: 'add',
          category: input.category,
          text: input.text,
          evidence: input.evidence,
          expiresOn: input.until,
          source: asksToRemember(ctx.lastUserText) ? 'explicit' : 'stated',
        },
      }
    case 'replace': {
      const id = idOf(input.ref)
      if (!id) return { ok: false, reason: 'unknown_ref' }
      if (!input.text) return { ok: false, reason: 'incomplete' }
      return { ok: true, op: { op: 'replace', id, text: input.text, evidence: input.evidence, expiresOn: input.until } }
    }
    case 'forget': {
      if (!asksToForget(ctx.lastUserText)) return { ok: false, reason: 'not_asked_to_forget' }
      const id = idOf(input.ref)
      if (!id) return { ok: false, reason: 'unknown_ref' }
      // забыть можно только то, о чём просят (кроме «забудь всё» словами — тогда любой)
      const text = ctx.textOf?.(id)
      if (text !== undefined && !asksToForgetAll(ctx.lastUserText) && !forgetMatches(text, ctx.lastUserText)) {
        return { ok: false, reason: 'not_asked_to_forget' }
      }
      return { ok: true, op: { op: 'forget', id } }
    }
    case 'forgetAll':
      return asksToForgetAll(ctx.lastUserText) ? { ok: true, op: { op: 'forgetAll' } } : { ok: false, reason: 'not_asked_to_forget' }
  }
}

export type AppliedWrite = { write: MemoryWrite; accepted: boolean; reason?: RefusedWrite | Extract<OpResult, { ok: false }>['reason'] }

/**
 * Применить записи хода — чистая функция. Номера фактов переводятся по списку, который модель видела в НАЧАЛЕ хода
 * (refs), а не по меняющемуся по ходу пачки: «забудь 2» и «замени 3» в одном ходе относятся к тому, что было
 * показано.
 */
export function applyWrites(
  base: MemoryState,
  writes: readonly MemoryWrite[],
  ctx: { now: string; lastUserText: string; newId: () => string },
): { next: MemoryState; applied: AppliedWrite[] } {
  const refs = factRefs(base.facts, ctx.now.slice(0, 10))
  let facts = base.facts
  let plan = base.plan
  const applied: AppliedWrite[] = []
  for (const w of writes) {
    if (w.kind === 'plan') {
      // план один — на завтра; новый согласованный план заменяет прежний (как savePlan на устройстве)
      plan = { forDate: ctx.now.slice(0, 10), task: w.task, firstStep: w.firstStep, startTime: w.startTime }
      applied.push({ write: w, accepted: true })
      continue
    }
    const op = toFactOp(w.input, { refs, lastUserText: ctx.lastUserText, textOf: (id) => base.facts.find((f) => f.id === id)?.text })
    if (!op.ok) {
      applied.push({ write: w, accepted: false, reason: op.reason })
      continue
    }
    const r = applyFactOps(facts, [op.op], { now: ctx.now, newId: ctx.newId })
    facts = r.facts
    const res = r.results[0]
    applied.push(res.ok ? { write: w, accepted: true } : { write: w, accepted: false, reason: res.reason })
  }
  return { next: { facts, plan }, applied }
}

/** Прежние заметки (до фактов) → факты «о себе»: перенос при первом чтении на устройстве и при импорте */
export function notesToFacts(notes: readonly { text: string; createdAt: string }[], newId: () => string): Fact[] {
  const seen = new Set<string>()
  const out: Fact[] = []
  for (const n of notes) {
    const key = factKey(n.text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      id: newId(),
      category: 'about',
      text: n.text.trim().slice(0, FACT_LIMITS.text),
      source: 'stated',
      createdAt: n.createdAt,
      updatedAt: n.createdAt,
      status: 'active',
    })
  }
  return out
}

export { factKey }
