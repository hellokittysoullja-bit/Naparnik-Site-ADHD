import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { POST as breakdownRoute } from '@/app/api/breakdown/route'
import { POST as chatRoute } from '@/app/api/companion/route'
import { POST as memoryRoute } from '@/app/api/memory/route'
import { POST as voiceRoute } from '@/app/api/session-voice/route'
import { registerExecutionMiddleware } from '@/lib/ai/core/middleware'
import { explicitForgetOps } from '@/lib/memory-sync'
import { honestClaims, memoryWritesClean, noGreetingMidway, speech, type ExtractOp, type Reply, type ToolCall } from './checks'
import type { Case, Category } from './cases'

/**
 * Прогон набора: настоящий запрос к боевому маршруту → ответ + журнал хода → вердикт.
 * Вердикты: pass, fail, infra (провайдер не ответил: часть error / 503 / обе попытки по времени — вне процента).
 */
export type Verdict = 'pass' | 'fail' | 'infra'

export type Attempt = { model: string; ms: number; result: string; status?: number }
export type Journal = { outcome?: string; model?: string; ms?: number; attempts?: Attempt[]; injection?: boolean; task?: string }

export type RunResult = {
  verdict: Verdict
  reason: string | null
  outcome?: string
  model?: string
  ms: number
  reply: string
  steps?: string[] | null
  tools: ToolCall[]
  ops?: ExtractOp[]
  attempts: Attempt[]
  /** для траектории провала */
  parts: unknown[]
  /** сырые ответы моделей по попыткам (до проверок обвязки) */
  raw: RawAttempt[]
}

export const RESULTS_DIR = 'evals/results'
export const HISTORY = join(RESULTS_DIR, 'history.jsonl')

// ── сырой ответ модели ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Что модель сказала на самом деле — до проверок обвязки. Журнал хода текстов не хранит (приватность), а без них
 * провал «length» или «empty» не разобрать. Звено только смотрит: поток проходит без изменений. Только в прогоне
 * набора, в продукте его нет. Случаи идут по одному, поэтому общий буфер на случай.
 */
export type RawAttempt = { model: string; text: string; toolCalls: { toolName: string; input: string }[]; finish?: string; usage?: unknown }
const raw: RawAttempt[] = []
registerExecutionMiddleware({
  name: 'eval-capture',
  wrap: {
    specificationVersion: 'v4',
    wrapStream: async ({ doStream, model }) => {
      const r = await doStream()
      const rec: RawAttempt = { model: model.modelId, text: '', toolCalls: [] }
      raw.push(rec)
      const tap = new TransformStream<Record<string, unknown>, Record<string, unknown>>({
        transform(part, controller) {
          if (part.type === 'text-delta') rec.text += String(part.delta ?? '')
          if (part.type === 'tool-call') rec.toolCalls.push({ toolName: String(part.toolName), input: String(part.input) })
          if (part.type === 'finish') {
            rec.finish = JSON.stringify(part.finishReason)
            rec.usage = part.usage
          }
          controller.enqueue(part)
        },
      })
      return { ...r, stream: (r.stream as unknown as ReadableStream<Record<string, unknown>>).pipeThrough(tap) as unknown as typeof r.stream }
    },
  },
})

// ── запрос ──────────────────────────────────────────────────────────────────────────────────────────────────

const HANDLERS = { chat: chatRoute, voice: voiceRoute, breakdown: breakdownRoute, memory: memoryRoute } as const

// у каждого запроса свой адрес: лимит запросов на адрес (lib/api-guard.ts) не должен влиять на поведение кота
let ipSeq = 0
function req(body: unknown): Request {
  const n = ipSeq++
  return new Request('https://naparnik.test/api/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-for': `198.18.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`,
    },
    body: JSON.stringify(body),
  })
}

/** Поток UI-сообщений чата → текст, вызовы инструментов, признак ошибки, все части (для траектории) */
async function readChat(res: Response) {
  let text = ''
  let streamError = false
  const tools: ToolCall[] = []
  const parts: unknown[] = []
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data: {')) continue
    const c = JSON.parse(line.slice(6)) as { type: string; delta?: string; toolName?: string; input?: Record<string, unknown> }
    parts.push(c)
    if (c.type === 'text-delta') text += c.delta ?? ''
    if (c.type === 'tool-input-available' && c.toolName) tools.push({ name: c.toolName, input: c.input ?? {} })
    if (c.type === 'error') streamError = true
  }
  return { text, tools, streamError, parts }
}

const lastUserText = (c: Case): string => {
  if (c.route === 'chat') {
    const msgs = c.body.messages as { parts: { text: string }[] }[]
    return msgs.at(-1)?.parts[0]?.text ?? ''
  }
  if (c.route === 'memory') return ((c.body.lines as { role: string; text: string }[]).filter((l) => l.role === 'user').at(-1)?.text) ?? ''
  return String(c.body.task ?? '')
}

// ── вердикт ─────────────────────────────────────────────────────────────────────────────────────────────────

// сбой провайдера, а не поведение модели: время, сеть, 429 и 5xx, а также доступ и оплата у провайдера (401, 402,
// 403: 12.11 прогон упал на 402 Payment Required у обеих моделей посреди набора); другой 4xx на наш запрос — дефект обвязки
const INFRA_RESULTS = new Set(['timeout', 'error', 'cancelled'])
const isInfraAttempt = (a: Attempt) => INFRA_RESULTS.has(a.result) && !(a.result === 'error' && a.status && a.status >= 400 && a.status < 500 && a.status !== 408 && a.status !== 429 && a.status !== 401 && a.status !== 402 && a.status !== 403)

/** Ход не дал ответа модели: инфраструктура (все попытки — время/сеть) или поведение (негодный ответ) */
function noModelAnswer(j: Journal | undefined): { infra: boolean; why: string } {
  const atts = j?.attempts ?? []
  const why = atts.map((a) => `${a.model.split('/').pop()}:${a.result}${a.status ? `(${a.status})` : ''}`).join(', ') || 'нет попыток'
  return { infra: atts.length === 0 || atts.every(isInfraAttempt), why }
}

export async function runCase(c: Case, logs: string[]): Promise<RunResult> {
  logs.length = 0
  raw.length = 0
  const t0 = Date.now()
  const res = await HANDLERS[c.route](req(c.body))

  let reply: Reply
  let parts: unknown[] = []
  let streamError = false
  const base = { route: c.route, status: res.status, userText: lastUserText(c), hasHistory: c.route === 'chat' && (c.body.messages as unknown[]).length > 1 }
  if (c.route === 'chat') {
    const r = await readChat(res)
    parts = r.parts
    streamError = r.streamError
    reply = { ...base, text: r.text, tools: r.tools }
  } else {
    const data = (await res.json()) as { text?: string | null; steps?: string[] | null; reply?: string; source?: string; ops?: ExtractOp[] }
    parts = [data]
    const text = data.reply ?? data.text ?? (data.steps ? data.steps.join(' / ') : '')
    reply = { ...base, text, steps: data.steps, source: data.source, tools: [], ops: data.ops }
  }
  // время до последнего байта ответа (у чата — весь поток, а не только заголовки)
  const ms = Date.now() - t0
  const journal = logs
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l) as Journal & { t?: string })
    .find((e) => e.t === 'ai')
  reply.outcome = journal?.outcome

  const out = (verdict: Verdict, reason: string | null): RunResult => ({
    verdict,
    reason,
    outcome: journal?.outcome,
    model: journal?.model,
    ms,
    reply: reply.text,
    steps: reply.steps,
    tools: reply.tools,
    ops: reply.ops,
    attempts: journal?.attempts ?? [],
    parts,
    raw: raw.map((a) => ({ ...a, toolCalls: [...a.toolCalls] })),
  })

  if (res.status === 400) return out('fail', 'маршрут отклонил запрос (400): ошибка в случае или в схеме')

  // кризис: проверенный ответ без модели — ни сбой, ни заготовка не засчитываются
  if (c.crisis) {
    const why = c.check(reply)
    return out(why ? 'fail' : 'pass', why)
  }
  if (reply.outcome === 'crisis') return out('fail', 'кризисный ответ там, где кризиса нет')

  // нет ответа модели: в чате — часть error, в выжимке — 503, в голосе и дроблении — заготовка
  const noAnswer = streamError || res.status >= 500 || (reply.outcome !== undefined && reply.outcome !== 'model')
  if (noAnswer) {
    const { infra, why } = noModelAnswer(journal)
    if (infra) return out('infra', `провайдер не ответил: ${why}`)
    // подсказка для разбора: модель ответила только вызовом инструмента, который обвязка отклонила
    const onlyTools = raw.length > 0 && raw.every((a) => !a.text.trim() && a.toolCalls.length > 0)
    const hint = onlyTools ? `; модели ответили только вызовом ${[...new Set(raw.flatMap((a) => a.toolCalls.map((t) => t.toolName)))].join(', ')}, отклонённым обвязкой` : ''
    if (!c.fallbackOk) return out('fail', `заготовка вместо ответа модели: ${why}${hint}`)
    // атака: кот не повёлся, обвязка отбила — успех, но и заготовку проверяем той же проверкой
    const why2 = c.check(reply)
    return out(why2 ? 'fail' : 'pass', why2)
  }

  // общие правила речи и честности для всего, что сказала модель
  const common = c.route === 'chat' ? [speech, honestClaims, memoryWritesClean, noGreetingMidway] : c.route === 'voice' ? [speech] : []
  for (const rule of common) {
    // чат с одним вызовом инструмента и без текста — нормальный ход (текст придёт в автокруге)
    if (!reply.text && reply.tools.length) break
    const why = rule(reply)
    if (why) return out('fail', why)
  }
  if (c.route === 'chat' && !reply.text && !reply.tools.length) return out('fail', 'пустой ответ')
  const why = c.check(reply)
  if (why && c.deviceForget && c.route === 'chat') {
    // кот не забыл сам — устройство забывает по правилу без модели (lib/memory-sync.ts)
    const userText = String(((c.body.messages as Array<{ parts: Array<{ text?: string }> }>).at(-1)?.parts[0]?.text) ?? '')
    const facts = ((c.body.memory as { facts?: Array<{ text: string }> } | undefined)?.facts ?? []).map((f, i) => ({ id: String(i), text: f.text }))
    const ops = explicitForgetOps(userText, facts)
    const refs = ops.flatMap((o) => (o.op === 'forget' ? [o.id] : o.op === 'forgetAll' ? facts.map((f) => f.id) : []))
    if (c.deviceForget(refs)) return out('pass', `${why} в разговоре, но устройство забыло по правилу: ${refs.join(',')}`)
    return out('fail', `${why}; и правило устройства дало: ${refs.join(',') || 'ничего'}`)
  }
  if (why && c.review && c.route === 'chat') {
    // кот не записал сам — тот же кусок разговора через фоновое ревью (как сделает устройство через 90 с тишины)
    const userText = String(((c.body.messages as Array<{ parts: Array<{ text?: string }> }>).at(-1)?.parts[0]?.text) ?? '')
    const mem = c.body.memory as { facts?: Array<{ category: string; text: string }> } | undefined
    const r = await memoryRoute(
      new Request('https://naparnik.test/api/memory', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200)}` },
        body: JSON.stringify({ facts: mem?.facts ?? [], lines: [{ role: 'user', text: userText }, { role: 'cat', text: reply.text || '…' }], today: '2026-11-12' }),
      }),
    )
    if (r.status === 503) return out('infra', `${why}; ревью: провайдер не ответил`)
    const ops = ((await r.json()) as { ops?: ExtractOp[] }).ops ?? []
    if (c.review(ops)) return out('pass', `${why} в разговоре, но записал фоновым ревью: ${JSON.stringify(ops)}`)
    return out('fail', `${why}; и ревью не записало: ${JSON.stringify(ops)}`)
  }
  return out(why ? 'fail' : 'pass', why)
}

// ── запись итогов ───────────────────────────────────────────────────────────────────────────────────────────

export type CaseSummary = {
  id: string
  category: Category
  /** итог по повторам: pass — все годны; fail — все провалы; flaky — вперемешку; infra — все вне счёта */
  status: 'pass' | 'fail' | 'flaky' | 'infra'
  runs: RunResult[]
}

export type HistoryLine = {
  date: string
  sha: string
  passRate: number
  passed: number
  failed: number
  infra: number
  cases: number
  repeat: number
  byCategory: Record<string, { passed: number; failed: number; infra: number; rate: number | null }>
  /** случаи, которые не прошли (fail или flaky) — для «новых провалов» в следующем сравнении */
  failing: string[]
  flaky: string[]
}

export function gitSha(): string {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
    // правка промпта ещё не закоммичена — прогон помечается, чтобы его не спутали с прогоном коммита
    const dirty = execFileSync('git', ['status', '--porcelain', '--', 'lib', 'app', 'evals/suite', 'evals/suite.eval.ts'], { encoding: 'utf8' }).trim()
    return dirty ? `${sha}-dirty` : sha
  } catch {
    return 'nogit'
  }
}

export function summarize(id: string, category: Category, runs: RunResult[]): CaseSummary {
  const counted = runs.filter((r) => r.verdict !== 'infra')
  const status =
    counted.length === 0 ? 'infra' : counted.every((r) => r.verdict === 'pass') ? 'pass' : counted.every((r) => r.verdict === 'fail') ? 'fail' : 'flaky'
  return { id, category, status, runs }
}

export function historyLine(summaries: CaseSummary[], sha: string, repeat: number): HistoryLine {
  const runs = summaries.flatMap((s) => s.runs.map((r) => ({ cat: s.category, v: r.verdict })))
  const count = (v: Verdict, cat?: string) => runs.filter((r) => r.v === v && (!cat || r.cat === cat)).length
  const rate = (p: number, f: number) => (p + f ? Math.round((1000 * p) / (p + f)) / 10 : null)
  const byCategory: HistoryLine['byCategory'] = {}
  for (const cat of [...new Set(summaries.map((s) => s.category))]) {
    const p = count('pass', cat)
    const f = count('fail', cat)
    byCategory[cat] = { passed: p, failed: f, infra: count('infra', cat), rate: rate(p, f) }
  }
  const passed = count('pass')
  const failed = count('fail')
  return {
    date: new Date().toISOString(),
    sha,
    passRate: rate(passed, failed) ?? 0,
    passed,
    failed,
    infra: count('infra'),
    cases: summaries.length,
    repeat,
    byCategory,
    failing: summaries.filter((s) => s.status === 'fail' || s.status === 'flaky').map((s) => s.id),
    flaky: summaries.filter((s) => s.status === 'flaky').map((s) => s.id),
  }
}

export function readHistory(): HistoryLine[] {
  if (!existsSync(HISTORY)) return []
  return readFileSync(HISTORY, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as HistoryLine)
}

/** Сравнение с прошлым полным прогоном: процент по темам, новые провалы и починенное */
export function compare(prev: HistoryLine | undefined, now: HistoryLine, ids: string[], partial = false): string {
  const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${x}%`)
  const delta = (a: number | null | undefined, b: number | null | undefined) =>
    a === null || a === undefined || b === null || b === undefined ? '' : ` (${b - a >= 0 ? '+' : ''}${Math.round((b - a) * 10) / 10})`
  const lines = [`Итог ${now.sha}: ${pct(now.passRate)} (годно ${now.passed}, провал ${now.failed}, вне счёта ${now.infra})`]
  if (!prev) return [...lines, 'Прошлого прогона нет: этот станет точкой отсчёта.'].join('\n')
  // частичный прогон: общий процент несравним (другой набор случаев), сравниваются только темы
  lines.push(
    partial
      ? `Было ${prev.sha} от ${prev.date.slice(0, 16).replace('T', ' ')}: частичный прогон, сравнение только по темам`
      : `Было ${prev.sha} от ${prev.date.slice(0, 16).replace('T', ' ')}: ${pct(prev.passRate)}${delta(prev.passRate, now.passRate)}`,
  )
  lines.push('По темам:')
  for (const [cat, c] of Object.entries(now.byCategory)) {
    const p = prev.byCategory[cat]
    lines.push(`  ${cat.padEnd(10)} ${pct(p?.rate).padStart(6)} → ${pct(c.rate).padStart(6)}${delta(p?.rate, c.rate)}${c.infra ? `  [вне счёта ${c.infra}]` : ''}`)
  }
  const was = new Set(prev.failing)
  const newly = now.failing.filter((id) => !was.has(id))
  // починенное — только среди случаев, которые были и в прошлом наборе и прогнались сейчас
  const fixed = prev.failing.filter((id) => ids.includes(id) && !now.failing.includes(id))
  lines.push(newly.length ? `НОВЫЕ ПРОВАЛЫ: ${newly.join(', ')}` : 'Новых провалов нет.')
  if (fixed.length) lines.push(`Починилось: ${fixed.join(', ')}`)
  if (now.flaky.length) lines.push(`Нестабильные (то годно, то нет): ${now.flaky.join(', ')}`)
  return lines.join('\n')
}

export function writeRun(file: string, data: unknown) {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(join(RESULTS_DIR, file), JSON.stringify(data, null, 2))
}

export function appendHistory(line: HistoryLine) {
  mkdirSync(RESULTS_DIR, { recursive: true })
  appendFileSync(HISTORY, `${JSON.stringify(line)}\n`)
}

/** Траектория провала: запрос (секретов в нём нет — ключ живёт в окружении), все части ответа, журнал */
export function writeTrajectory(sha: string, c: Case, run: RunResult, i: number) {
  const dir = join(RESULTS_DIR, 'trajectories', sha)
  mkdirSync(dir, { recursive: true })
  const name = `${c.id}${i ? `.${i + 1}` : ''}.json`
  writeFileSync(
    join(dir, name),
    JSON.stringify({ id: c.id, category: c.category, route: c.route, note: c.note, verdict: run.verdict, reason: run.reason, request: c.body, parts: run.parts, modelRaw: run.raw, journal: { outcome: run.outcome, model: run.model, ms: run.ms, attempts: run.attempts } }, null, 2),
  )
}
