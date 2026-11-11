/**
 * Лимит токенов на продукт в сутки — проверка ДО платного вызова (OpenAI Agents SDK: guardrails «до модели»;
 * OWASP LLM10 «неограниченное потребление»). Счётчик в памяти экземпляра функции: грубый, но бесплатный предохранитель;
 * настоящий общий потолок — в кабинете AnyModel и правило Vercel Firewall (research/19 §3.2). С базой — общий счётчик.
 */
const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAILY_TOKENS = 2_000_000

let windowStart = Date.now()
let used = 0

function limit(): number {
  const n = Number(process.env.AI_DAILY_TOKEN_LIMIT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_TOKENS
}

function roll() {
  if (Date.now() - windowStart >= DAY_MS) {
    windowStart = Date.now()
    used = 0
  }
}

export function budgetLeft(): boolean {
  roll()
  return used < limit()
}

export function spend(tokens: number | undefined): void {
  roll()
  if (typeof tokens === 'number' && Number.isFinite(tokens)) used += tokens
}
