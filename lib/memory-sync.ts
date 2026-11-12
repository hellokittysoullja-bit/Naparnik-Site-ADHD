import type { UIMessage } from 'ai'
import type { ExtractLine, ExtractOp } from '@/lib/ai/agents/memory-extract'
import type { FactOp } from '@/lib/ai/memory/facts'
import { toFactOp } from '@/lib/ai/memory/policy'
import { memoryInput } from '@/lib/ai/tools/catalog'
import { applyMemoryOps, peekFacts, todayKey } from '@/lib/memory'

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

/** Реплики после курсора (если курсор не найден — история обрезана, берём хвост) */
export function pendingLines(messages: readonly UIMessage[], cursor: string | null): ExtractLine[] {
  const at = cursor ? messages.findIndex((m) => m.id === cursor) : -1
  const fresh = messages.slice(at + 1)
  const lines = fresh
    .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('cat' as const), text: textOf(m), system: m.role === 'system' }))
    .filter((l) => l.text && !l.system)
    .map(({ role, text }) => ({ role, text }))
    .slice(-MAX_LINES)
  return lines.some((l) => l.role === 'user' && l.text.length >= MIN_USER_CHARS) ? lines : []
}

/** Операция выжимки → операция устройства, через те же проверки, что вызов инструмента памяти в чате */
export function toDeviceOp(op: ExtractOp, ctx: { refs: readonly string[]; userText: string }): FactOp | null {
  const parsed = memoryInput.safeParse(op)
  if (!parsed.success) return null
  const r = toFactOp(parsed.data, { refs: ctx.refs, lastUserText: ctx.userText })
  if (!r.ok) return null
  return r.op.op === 'add' && op.op === 'add' && op.expiresOn ? { ...r.op, expiresOn: op.expiresOn } : r.op
}

/** Выжать память из затихшего разговора. Возвращает число применённых операций (для тестов и журнала) */
export async function syncMemory(messages: readonly UIMessage[], opts: { keepalive?: boolean } = {}): Promise<number> {
  if (inFlight || messages.length === 0) return 0
  const last = messages[messages.length - 1]
  const lines = pendingLines(messages, readCursor())
  if (lines.length === 0) {
    writeCursor(last.id)
    return 0
  }
  inFlight = true
  try {
    const facts = peekFacts()
    const refs = facts.map((f) => f.id)
    const res = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      keepalive: opts.keepalive,
      body: JSON.stringify({ facts: facts.map((f) => ({ category: f.category, text: f.text })), lines, today: todayKey() }),
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { ops?: unknown }
    const userText = lines
      .filter((l) => l.role === 'user')
      .map((l) => l.text)
      .join('\n')
    const ops = (Array.isArray(data.ops) ? (data.ops as ExtractOp[]) : [])
      .map((op) => toDeviceOp(op, { refs, userText }))
      .filter((op): op is FactOp => op !== null)
    const results = await applyMemoryOps(ops)
    writeCursor(last.id)
    return results.filter((r) => r.ok).length
  } catch {
    return 0
  } finally {
    inFlight = false
  }
}
