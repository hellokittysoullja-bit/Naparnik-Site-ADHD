/**
 * Форма конспекта разговора: виды строк, подписи, пределы. Отдельный файл без зависимостей: его импортирует
 * lib/memory.ts (через lib/chat-summary.ts), а тот попадает в общий код всех страниц. Схема zod и проверки содержания
 * (memory/summary.ts) сюда попадать не должны: 13.11 они утяжелили первую загрузку каждой страницы на 36 КБ.
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

export type SummarizeLine = { role: 'user' | 'cat'; text: string }

/** Проверка формы без zod, для записи на устройстве: содержание проверяет сервер при чтении (memory/summary.ts) */
export function isSummaryLines(v: unknown): v is SummaryLine[] {
  return (
    Array.isArray(v) &&
    v.length <= SUMMARY_LIMITS.lines &&
    v.every(
      (l) =>
        !!l &&
        typeof l === 'object' &&
        (SUMMARY_KINDS as readonly string[]).includes((l as SummaryLine).kind) &&
        typeof (l as SummaryLine).text === 'string' &&
        (l as SummaryLine).text.length <= SUMMARY_LIMITS.lineChars,
    )
  )
}
