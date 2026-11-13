import type { UIMessage } from 'ai'
import { isSummaryLines, SUMMARY_LIMITS, type SummaryLine, type SummarizeLine } from '@/lib/ai/memory/summary-shape'
import { aboutAny, contentWords } from '@/lib/ai/memory/stems'
import { isForgotten, peekForgotten, type Tomb } from '@/lib/forgotten'

/**
 * Конспект прошлой части разговора на устройстве (lib/ai/agents/summarize.ts; Hermes: сжатие контекста сводкой).
 * Переписка на устройстве — последние 30 реплик; всё, что старше, кот раньше терял посреди разговора. Теперь, когда
 * непересказанных реплик набирается TRIGGER, старшие из них уходят на /api/summary и возвращаются несколькими
 * строками; модели дальше идут конспект и реплики после него.
 *
 * Инварианты:
 *  - конспект покрывает реплики до `upTo` включительно; модели уходят только реплики ПОСЛЕ него (и конспект);
 *  - последние KEEP реплик всегда идут дословно: свежий разговор не пересказывается;
 *  - хвост после конспекта начинается с реплики человека (вызов инструмента и его результат не разрываются);
 *  - сбой сети или моделей курсор не двигает: кусок уйдёт в следующий раз;
 *  - «забудь X» стирает конспект, если он касается X; «забудь всё» стирает всегда.
 */
const KEY = 'naparnik:chatSummary'

export const SUMMARY_WINDOW = { trigger: 24, keep: 12, retryMs: 60_000 } as const

export type StoredSummary = { lines: SummaryLine[]; upTo: string; at: string }

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
    .trim()

export function peekSummary(tombs: readonly Tomb[] = peekForgotten()): StoredSummary | null {
  let raw: unknown
  try {
    raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const { lines, upTo, at } = raw as Partial<StoredSummary>
  // конспект без строк — законная запись: это отметка «до этой реплики пересказывать было нечего» (кусок из одних
  // забытых реплик или с кризисом), без неё тот же кусок уходил бы на сервер снова и снова
  if (!isSummaryLines(lines) || typeof upTo !== 'string' || typeof at !== 'string') return null
  // забытое после составления конспекта в нём остаться не должно: проверка при чтении, если стирание не дошло
  if (isForgotten(lines.map((l) => l.text).join(' '), at, tombs)) return null
  return { lines, upTo, at }
}

function store(s: StoredSummary | null): boolean {
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s))
    else window.localStorage.removeItem(KEY)
    return true
  } catch {
    return false
  }
}

export function clearSummary(): void {
  store(null)
}

/** «забудь X»: конспект, который касается X, стирается целиком (лучше потерять пересказ, чем сохранить забытое) */
export function forgetInSummary(texts: readonly string[]): void {
  const s = peekSummary([])
  if (!s) return
  const topics = texts.map((t) => contentWords(t)).filter((k) => k.length > 0)
  if (aboutAny(s.lines.map((l) => l.text).join(' '), topics)) clearSummary()
}

/** Реплики, которые идут модели: всё после конспекта. Конспекта нет или его конец уже вышел из переписки — все */
export function afterSummary<M extends UIMessage>(messages: readonly M[], summary: StoredSummary | null): M[] {
  if (!summary) return [...messages]
  const at = messages.findIndex((m) => m.id === summary.upTo)
  return at < 0 ? [...messages] : messages.slice(at + 1)
}

export type SummaryPlan = { lines: SummarizeLine[]; upTo: string }

/**
 * Что пора пересказать: null — рано. Чистая функция (проверяется таблицей).
 * hidden — реплики, которые кот не видит (забытое, lib/memory-sync.ts hiddenFromModel): в конспект они не идут.
 */
export function planSummary(
  messages: readonly UIMessage[],
  summary: StoredSummary | null,
  hidden: (m: UIMessage) => boolean = () => false,
): SummaryPlan | null {
  const fresh = afterSummary(messages, summary).filter((m) => m.role === 'user' || m.role === 'assistant')
  if (fresh.length < SUMMARY_WINDOW.trigger) return null
  // граница: последняя реплика человека не позже, чем за KEEP реплик до конца — хвост начинается с неё
  let cut = fresh.length - SUMMARY_WINDOW.keep
  while (cut > 0 && fresh[cut].role !== 'user') cut--
  if (cut <= 0) return null
  // сервер принимает не больше chunk реплик за раз: берём самые ранние и ставим курсор на последнюю взятую, остальное
  // уйдёт следующим заходом (после долгих сбоев кусок бывает длиннее; пропускать реплики без пересказа нельзя)
  const lines: SummarizeLine[] = []
  let upTo = ''
  for (const m of fresh.slice(0, cut)) {
    upTo = m.id
    if (hidden(m)) continue
    const text = textOf(m).slice(0, m.role === 'user' ? SUMMARY_LIMITS.userText : SUMMARY_LIMITS.catText)
    if (!text) continue
    lines.push({ role: m.role === 'user' ? 'user' : 'cat', text })
    if (lines.length === SUMMARY_LIMITS.chunk) break
  }
  return { lines, upTo }
}

let inFlight = false
/** когда была последняя неудачная попытка; до первой попытки паузы нет */
const NEVER = Number.NEGATIVE_INFINITY
let lastTry = NEVER

/** пора ли пробовать прямо сейчас: есть что пересказать, запрос не идёт и после сбоя прошла пауза */
export function summaryDue(messages: readonly UIMessage[], now = Date.now()): boolean {
  return !inFlight && now - lastTry >= SUMMARY_WINDOW.retryMs && planSummary(messages, peekSummary()) !== null
}

/** Обновить конспект, если пора. true — запись на устройстве изменилась (новый конспект или сдвинут курсор) */
export async function syncSummary(
  messages: readonly UIMessage[],
  opts: { hidden?: (m: UIMessage) => boolean; today: string; now?: number; keepalive?: boolean },
): Promise<boolean> {
  const now = opts.now ?? Date.now()
  if (inFlight || now - lastTry < SUMMARY_WINDOW.retryMs) return false
  const current = peekSummary()
  const plan = planSummary(messages, current, opts.hidden)
  if (!plan) return false
  const at = new Date(now).toISOString()
  // в куске нет слов человека (только забытое или вызовы инструментов): пересказывать нечего, курсор двигаем
  if (!plan.lines.some((l) => l.role === 'user')) return store({ lines: current?.lines ?? [], upTo: plan.upTo, at: current?.at ?? at })
  inFlight = true
  lastTry = now
  try {
    const res = await fetch('/api/summary', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      keepalive: opts.keepalive,
      body: JSON.stringify({ previous: current?.lines, lines: plan.lines, today: opts.today }),
    })
    // 503 — модели не ответили; 429 — лимит: курсор стоит, кусок уйдёт в следующий раз
    if (!res.ok) return false
    const data = (await res.json()) as { summary?: unknown }
    if (!isSummaryLines(data.summary)) return false
    // сервер вернул обновлённый конспект, прошлый как был (кризис в куске) или пустой: курсор сдвигается в любом случае
    const saved = store({ lines: data.summary, upTo: plan.upTo, at })
    // запись не удалась (хранилище переполнено или закрыто): пауза остаётся, иначе каждый ход слал бы платный запрос заново
    if (saved) lastTry = NEVER
    return saved
  } catch {
    return false // нет сети — курсор не сдвинут
  } finally {
    inFlight = false
  }
}

export function resetSummaryForTests() {
  inFlight = false
  lastTry = NEVER
}
