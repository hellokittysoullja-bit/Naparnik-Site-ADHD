import type { ModelMessage } from 'ai'

/**
 * Бюджет контекста разговора (Hermes agent/context_compressor.py:259-299, 825-837: сначала подрезать старые
 * результаты инструментов без вызова модели, затем отрезать начало по токенам, хвост держать целиком; Letta —
 * скользящее окно, незавершённый вызов инструмента не резать). Без модели и без сети: детерминированно, мгновенно.
 *
 * Сайт и сейчас шлёт ≤ 30 реплик (~2 тыс. токенов) — правило нужно боту, у которого история длинная, и как
 * предохранитель от раздутого запроса. Сводку старой части моделью (как у Hermes) — после решения владельца о цене.
 */
const CHARS_PER_TOKEN = 3 // кириллица у современных токенизаторов ≈ 2,5–3,5 символа на токен — берём осторожно

export function estimateTokens(m: ModelMessage): number {
  return Math.ceil(JSON.stringify(m.content).length / CHARS_PER_TOKEN) + 4
}

const TOOL_NOTE = 'выполнено'

/** старые результаты инструментов → короткая отметка: модели важен факт вызова, а не текст подтверждения */
function pruneToolResults(m: ModelMessage): ModelMessage {
  if (m.role !== 'tool' || !Array.isArray(m.content)) return m
  return {
    ...m,
    content: m.content.map((p) =>
      p.type === 'tool-result' ? { ...p, output: { type: 'text' as const, value: TOOL_NOTE } } : p,
    ),
  } as ModelMessage
}

/**
 * Укладывает историю в бюджет. Инварианты (тесты в tests/unit/ai-context-budget.test.ts):
 *  - последняя реплика человека и всё после неё остаются всегда;
 *  - история начинается с реплики человека (не с ответа кота и не с результата инструмента без вызова);
 *  - вызов инструмента и его результат не разрываются.
 */
export function fitConversation(messages: ModelMessage[], budgetTokens: number, keepToolResults = 4): ModelMessage[] {
  const total = (ms: ModelMessage[]) => ms.reduce((n, m) => n + estimateTokens(m), 0)
  if (total(messages) <= budgetTokens) return messages

  // 1) подрезка старых результатов инструментов (последние keepToolResults не трогаем)
  let toolSeen = 0
  let out = [...messages]
    .reverse()
    .map((m) => (m.role === 'tool' && ++toolSeen > keepToolResults ? pruneToolResults(m) : m))
    .reverse()
  if (total(out) <= budgetTokens) return out

  // 2) отрезаем начало по границам «реплика человека»: так пары вызов/результат остаются целыми
  const lastUser = out.map((m) => m.role).lastIndexOf('user')
  const starts = out.map((m, i) => (m.role === 'user' && i <= lastUser ? i : -1)).filter((i) => i >= 0)
  for (const start of starts) {
    const tail = out.slice(start)
    if (total(tail) <= budgetTokens || start === lastUser) {
      out = tail
      break
    }
  }
  return out
}
