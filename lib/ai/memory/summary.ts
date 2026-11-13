import { z } from 'zod'
import { contentWords, stemHits } from './stems'
import { factRejection } from './write-guard'

/**
 * Конспект прошлой части разговора: форма, пределы и проверки — общие для сервера (agents/summarize.ts составляет,
 * memory/render.ts читает) и устройства (lib/chat-summary.ts хранит). Без зависимостей от ядра: модуль уходит в браузер.
 */
export const SUMMARY_KINDS = ['task', 'done', 'agreed', 'open', 'note'] as const
export type SummaryKind = (typeof SUMMARY_KINDS)[number]
export type SummaryLine = { kind: SummaryKind; text: string }

export const SUMMARY_LABEL: Readonly<Record<SummaryKind, string>> = {
  task: 'ДЕЛО',
  done: 'СДЕЛАНО',
  agreed: 'ДОГОВОРИЛИСЬ',
  open: 'ОТКРЫТО',
  note: 'ЗАМЕТКА',
}

export const SUMMARY_LIMITS = { lines: 6, lineChars: 200, chunk: 24, userText: 600, catText: 300 } as const

const clip = (n: number) => z.string().transform((s) => s.slice(0, n))

/** Конспект в форме, в которой он ходит между устройством и сервером: недоверенные данные, обрезка вместо отказа */
export const SummarySchema = z
  .array(z.object({ kind: z.enum(SUMMARY_KINDS), text: clip(SUMMARY_LIMITS.lineChars) }))
  .max(SUMMARY_LIMITS.lines)

export function parseSummary(raw: unknown): SummaryLine[] {
  const r = SummarySchema.safeParse(raw ?? [])
  return r.success ? r.data.filter(lineSafe) : []
}

/** строка годится в промпт: не пустая и проходит запреты памяти (проверка при чтении, как у фактов) */
const lineSafe = (l: SummaryLine) => l.text.trim().length > 0 && factRejection(l.text) === null

export type SummarizeLine = { role: 'user' | 'cat'; text: string }

const BY_LABEL = new Map<string, SummaryKind>(SUMMARY_KINDS.map((k) => [SUMMARY_LABEL[k], k]))

/** Ответ модели → строки конспекта. null — ответ не по формату (следующая модель); [] — «ничего» */
export function parseSummaryReply(text: string): SummaryLine[] | null {
  const rows = text
    .split('\n')
    .map((l) => l.trim().replace(/^[-•*]\s*/, ''))
    .filter(Boolean)
  if (rows.length === 0) return null
  const out: SummaryLine[] = []
  let recognized = 0
  for (const row of rows) {
    const cut = row.indexOf('|')
    const head = (cut < 0 ? row : row.slice(0, cut)).trim().toUpperCase().replace(/Ё/g, 'Е')
    if (head === 'НИЧЕГО') {
      recognized++
      continue
    }
    const kind = BY_LABEL.get(head)
    const body = cut < 0 ? '' : row.slice(cut + 1).trim()
    if (!kind || !body) continue
    recognized++
    out.push({ kind, text: body })
  }
  return recognized > 0 ? out : null
}

/**
 * Правила, которым модель не может возразить: строка отдельно от остальных.
 *  - запреты памяти (write-guard): в конспект не попадает то, что кот не вправе хранить;
 *  - основание: не меньше половины содержательных слов строки есть в источнике (реплики куска и прошлый конспект) —
 *    модель пересказывает своими словами, но выдуманное или подсказанное атакой дело так не пройдёт;
 *  - длина и число строк.
 */
export function vetSummary(lines: readonly SummaryLine[], source: readonly string[]): SummaryLine[] {
  const known = contentWords(source.join(' '))
  const out: SummaryLine[] = []
  for (const l of lines) {
    const text = l.text.trim()
    if (!text || text.length > SUMMARY_LIMITS.lineChars || !lineSafe({ ...l, text })) continue
    const words = contentWords(text)
    if (words.length === 0 || stemHits(words, known) * 2 < words.length) continue
    out.push({ kind: l.kind, text })
  }
  return out.slice(0, SUMMARY_LIMITS.lines)
}

