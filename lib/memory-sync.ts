import type { UIMessage } from 'ai'
import type { ExtractLine, ExtractOp } from '@/lib/ai/agents/memory-extract'
import { asksToForget, asksToForgetAll, asksToRemember, FACT_LIMITS, forgetMatches, forgetsLast, forgetTopic, type FactOp } from '@/lib/ai/memory/facts'
import { factKey } from '@/lib/ai/memory/fact-key'
import { toFactOp } from '@/lib/ai/memory/policy'
import { memoryInput, TOOL_REFUSED } from '@/lib/ai/tools/catalog'
import { applyMemoryOps, applySkillMemoryOps, forgetTopics, peekChatTimestamps, peekFacts, peekSkills, todayKey } from '@/lib/memory'
import { isForgotten, peekForgotten, type Tomb } from '@/lib/forgotten'
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
/** реплика в выжимке — не длиннее этого: простыня на 30 КБ давала 413, курсор не двигался, и выжимка вставала навсегда (аудит 12.11) */
const MAX_LINE_CHARS = 1200

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
export function pendingChunk(
  messages: readonly UIMessage[],
  cursor: string | null,
  hidden: (m: UIMessage) => boolean = () => false,
): { lines: ExtractLine[]; upTo: string | null } {
  const at = cursor ? messages.findIndex((m) => m.id === cursor) : -1
  let fresh = messages.slice(at + 1).filter((m) => m.role === 'user' || m.role === 'assistant')
  // «забудь …» отменяет сказанное выше: ревью не видит ничего до последней такой просьбы включительно (аудит 12.11:
  // «переезжаю в Казань» и «забудь про переезд» попадали в один кусок, и ревью возвращало переезд в память)
  const lastForget = fresh.findLastIndex((m) => m.role === 'user' && asksToForget(textOf(m)))
  const skipped = lastForget >= 0 ? fresh[lastForget].id : null
  if (lastForget >= 0) fresh = fresh.slice(lastForget + 1)
  const chunk: { id: string; line: ExtractLine }[] = []
  let seen: string | null = skipped
  for (const m of fresh) {
    if (chunk.length === MAX_LINES) break
    seen = m.id
    const text = textOf(m).slice(0, MAX_LINE_CHARS)
    if (!text || hidden(m)) continue
    chunk.push({ id: m.id, line: { role: m.role === 'user' ? 'user' : 'cat', text } })
  }
  const upTo = seen
  const lines = chunk.map((c) => c.line)
  return { lines: lines.some((l) => l.role === 'user' && l.text.length >= MIN_USER_CHARS) ? lines : [], upTo }
}

/**
 * Реплики, которые кот больше не видит (lib/forgotten.ts): старше просьбы «забудь» и о забытой теме, либо старше
 * «забудь всё»; и сами прошлые просьбы забыть — в них названо забытое. Последняя реплика человека видна всегда: это
 * текущий ход. Используют отправка разговора модели, фоновое ревью и архив.
 */
export function hiddenFromModel(
  messages: readonly UIMessage[],
  times: Readonly<Record<string, string>> = peekChatTimestamps(),
  tombs: readonly Tomb[] = peekForgotten(),
): Set<string> {
  const out = new Set<string>()
  if (tombs.length === 0) return out
  const lastUser = messages.findLast((m) => m.role === 'user')?.id
  for (const m of messages) {
    if (m.id === lastUser || (m.role !== 'user' && m.role !== 'assistant')) continue
    const text = textOf(m)
    const at = times[m.id]
    if (isForgotten(text, at, tombs) || (m.role === 'user' && at !== undefined && asksToForget(text))) out.add(m.id)
  }
  return out
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
      const hidden = hiddenFromModel(messages)
      const { lines, upTo } = pendingChunk(messages, readCursor(), (m) => hidden.has(m.id))
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

/**
 * Явные «запомни» / «забудь» исполняются независимо от модели (Hermes: исполнение команд не зависит от того, послушалась
 * ли модель). Набор задач 12.11: Gemini через AnyModel игнорирует обязательный вызов инструмента и пишет «давай
 * запишем это в память», ничего не вызвав. Если в ответе на такую просьбу нет вызова памяти:
 *  - «запомни X» — сразу фоновое ревью этого куска (не ждём 90 с тишины): ревью записывает надёжно, по тем же правилам;
 *  - «забудь X» — правило без модели: забываются факты, у которых есть общая основа слова с просьбой; «забудь всё» — всё.
 */
export function explicitForgetOps(userText: string, facts: readonly { id: string; text: string }[], justSaved: readonly string[] = []): FactOp[] {
  if (!asksToForget(userText)) return []
  // «забудь всё» исполняется всегда: без фактов остаются навыки, архив, ответы знакомства (аудит 12.11)
  if (asksToForgetAll(userText)) return [{ op: 'forgetAll' }]
  // «забудь это» сразу после «запомнил: …» — о том, что кот только что записал
  if (forgetsLast(userText)) {
    const keys = new Set(justSaved.map(factKey))
    return facts.filter((f) => keys.has(factKey(f.text))).map((f) => ({ op: 'forget' as const, id: f.id }))
  }
  return facts.filter((f) => forgetMatches(f.text, userText)).map((f) => ({ op: 'forget' as const, id: f.id }))
}

export type ExplicitResult = 'none' | 'handled-by-cat' | 'review' | 'forgot'

type MemoryPart = { type: string; input?: { op?: unknown; text?: unknown }; output?: unknown }
const memoryParts = (m: UIMessage) => m.parts.filter((p) => p.type === 'tool-memory' || p.type === 'tool-savePlan') as MemoryPart[]
const done = (p: MemoryPart) => p.output !== undefined && p.output !== TOOL_REFUSED

/** Последняя просьба человека и ответ кота после неё: была ли явная просьба о памяти и исполнил ли её кот */
export async function enforceExplicitMemory(messages: readonly UIMessage[]): Promise<ExplicitResult> {
  let i = messages.length - 1
  while (i >= 0 && messages[i].role !== 'user') i--
  if (i < 0 || i === messages.length - 1) return 'none'
  const userText = textOf(messages[i])
  const wantsForget = asksToForget(userText)
  const wantsRemember = asksToRemember(userText)
  if (!wantsForget && !wantsRemember) return 'none'
  // исполнил ли кот — по виду операции: «забудь X и запомни Y», где кот только записал Y, оставляло X (аудит 12.11)
  const after = messages.slice(i + 1).flatMap(memoryParts).filter(done)
  const catForgot = after.some((p) => p.type === 'tool-memory' && (p.input?.op === 'forget' || p.input?.op === 'forgetAll'))
  const catSaved = after.some((p) => p.type === 'tool-savePlan' || p.input?.op === 'add' || p.input?.op === 'replace')
  let result: ExplicitResult = 'handled-by-cat'
  if (wantsForget && !catForgot) {
    // что кот записал в ответе перед этой просьбой («забудь это»)
    const prev = messages.slice(0, i).findLast((m) => m.role === 'assistant')
    const justSaved = prev
      ? memoryParts(prev)
          .filter((p) => done(p) && p.type === 'tool-memory' && (p.input?.op === 'add' || p.input?.op === 'replace') && typeof p.input.text === 'string')
          .map((p) => p.input!.text as string)
      : []
    const ops = explicitForgetOps(userText, peekFacts(), justSaved)
    if (ops.length > 0) await applyMemoryOps(ops)
    // тема, о которой не было факта («забудь про развод»): всё равно уходит из переписки для модели, архива, навыков
    const topic = forgetTopic(userText)
    if (ops.length === 0 && topic.length > 0) forgetTopics([topic.join(' ')])
    if (ops.length > 0 || topic.length > 0) result = 'forgot'
  }
  if (wantsRemember && !catSaved) {
    await syncMemory(messages)
    if (result !== 'forgot') result = 'review'
  }
  return result
}
