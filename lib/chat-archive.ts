import type { UIMessage } from 'ai'
import { factKey } from '@/lib/ai/memory/fact-key'

/**
 * Архив прошлых разговоров на устройстве — для вспоминания (Hermes: все сообщения в SQLite + FTS5, инструмент
 * session_search). Базы на сервере нет (решение владельца: память только на устройстве), поэтому архив и поиск —
 * здесь: на экране и в запросе к модели живут последние 30 реплик, а архив хранит больше, только текст.
 *
 * Поиск лексический по основам слов (первые 4 буквы, как FTS5 с простым стеммингом), находки собираются в эпизоды
 * «реплика ± соседние». Сжимает найденное быстрая модель на сервере (/api/recall) — сервер ничего не хранит.
 *
 * Честность: «забудь X» вычищает из архива реплики про X, «забудь всё» — архив целиком. Иначе кот вспомнил бы
 * поиском то, что человек попросил забыть.
 */
const KEY = 'naparnik:chatArchive'
export const ARCHIVE_LIMITS = { lines: 1000, text: 400, episodes: 3, neighbours: 2, episodeLines: 5 } as const

export type ArchiveLine = { id: string; role: 'user' | 'cat'; text: string; at: string }

function readArchive(): ArchiveLine[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (l): l is ArchiveLine =>
        !!l && typeof l === 'object' && typeof l.id === 'string' && (l.role === 'user' || l.role === 'cat') && typeof l.text === 'string' && typeof l.at === 'string',
    )
  } catch {
    return []
  }
}

function writeArchive(lines: ArchiveLine[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines.slice(-ARCHIVE_LIMITS.lines)))
  } catch {
    // место кончилось — отпускаем старшую половину и пробуем ещё раз: вспоминание хуже, чем работающий чат
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines.slice(-Math.floor(ARCHIVE_LIMITS.lines / 2))))
    } catch {
      /* хранилище недоступно — живём без архива */
    }
  }
}

const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join(' ')
    .trim()

/** Дописать в архив новые реплики (по id, без дублей). Зовётся там же, где сохраняется переписка */
export function archiveMessages(messages: readonly UIMessage[], times: Readonly<Record<string, string>> = {}): void {
  const archive = readArchive()
  const known = new Set(archive.map((l) => l.id))
  let added = false
  for (const m of messages) {
    if (known.has(m.id) || (m.role !== 'user' && m.role !== 'assistant')) continue
    const text = textOf(m).slice(0, ARCHIVE_LIMITS.text)
    if (!text) continue
    archive.push({ id: m.id, role: m.role === 'user' ? 'user' : 'cat', text, at: times[m.id] ?? new Date().toISOString() })
    added = true
  }
  if (added) writeArchive(archive)
}

const stems = (s: string) => new Set(factKey(s).split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 4)))

export type Episode = { at: string; lines: { role: 'user' | 'cat'; text: string }[]; score: number }

/**
 * Поиск по архиву: строки, где совпали основы слов запроса, → эпизоды (строка ± 2 соседние), счёт = число совпавших
 * основ + немного за свежесть. Не больше трёх эпизодов. Чистая функция над переданным архивом (тестируется без DOM).
 */
export function searchLines(archive: readonly ArchiveLine[], query: string, exclude: ReadonlySet<string> = new Set()): Episode[] {
  const q = stems(query)
  if (q.size === 0) return []
  const scored = archive
    .map((l, i) => ({ i, hits: [...stems(l.text)].filter((w) => q.has(w)).length }))
    .filter((x) => x.hits > 0 && !exclude.has(archive[x.i].id))
  const n = archive.length
  const episodes: Episode[] = []
  const used = new Set<number>()
  for (const x of scored.sort((a, b) => b.hits - a.hits || b.i - a.i)) {
    if (used.has(x.i) || episodes.length >= ARCHIVE_LIMITS.episodes) continue
    const from = Math.max(0, x.i - ARCHIVE_LIMITS.neighbours)
    const to = Math.min(n - 1, x.i + ARCHIVE_LIMITS.neighbours)
    for (let j = from; j <= to; j++) used.add(j)
    episodes.push({
      at: archive[x.i].at.slice(0, 10),
      lines: archive.slice(from, to + 1).slice(0, ARCHIVE_LIMITS.episodeLines).map(({ role, text }) => ({ role, text })),
      score: x.hits + x.i / Math.max(1, n),
    })
  }
  return episodes
}

/** Поиск по архиву устройства; реплики, которые сейчас и так в разговоре (последние 30), не ищем */
export function searchArchive(query: string, inConversation: ReadonlySet<string>): Episode[] {
  return searchLines(readArchive(), query, inConversation)
}

/** «забудь X»: реплики, где встречается основная часть слов забытого факта (≥ 2 основы от 5 букв), уходят из архива */
export function forgetInArchive(factTexts: readonly string[]): void {
  if (factTexts.length === 0) return
  const keys = factTexts.map((t) => new Set(factKey(t).split(' ').filter((w) => w.length >= 5).map((w) => w.slice(0, 5))))
  const archive = readArchive()
  const kept = archive.filter((l) => {
    const ws = new Set(factKey(l.text).split(' ').filter((w) => w.length >= 5).map((w) => w.slice(0, 5)))
    return !keys.some((k) => {
      const common = [...k].filter((w) => ws.has(w)).length
      return common >= Math.min(2, k.size)
    })
  })
  if (kept.length !== archive.length) writeArchive(kept)
}

/** «забудь всё» — архив целиком */
export function clearArchive(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* нечего чистить */
  }
}
