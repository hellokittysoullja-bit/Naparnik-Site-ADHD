/**
 * Журнал хода (Hermes observer-hooks, OpenAI Agents SDK tracing): одна строка JSON на ход — задача, модель, время,
 * токены, переключения, срабатывания проверок. Без текста человека и без ответа модели (CLAUDE.md: приватность).
 * Ошибка журнала никогда не роняет ответ (fail-open).
 */
export type TraceEvent = {
  task: string
  outcome: 'model' | 'fallback' | 'crisis' | 'budget'
  model?: string
  ms: number
  attempts: Array<{ model: string; ms: number; result: string }>
  injection?: boolean
  inTokens?: number
  outTokens?: number
}

export function trace(e: TraceEvent): void {
  try {
    console.info(JSON.stringify({ t: 'ai', ...e }))
  } catch {
    /* журнал не мешает ответу */
  }
}
