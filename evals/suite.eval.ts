import { expect, it, vi } from 'vitest'
import { CASES } from './suite/cases'
import {
  appendHistory,
  compare,
  gitSha,
  historyLine,
  readHistory,
  runCase,
  summarize,
  writeRun,
  writeTrajectory,
  type CaseSummary,
} from './suite/runner'

/**
 * Единый набор задач обвязки (Hermes-чеклист §17): 50 реальных задач кота через боевые маршруты и живую модель,
 * программная проверка поведения, процент успеха по темам, сравнение с прошлым прогоном, траектории провалов.
 * Как запускать и читать — evals/README.md. Запуск: ANYMODEL_API_KEY=… pnpm eval:suite
 *   EVAL_REPEAT=3   — каждый случай 3 раза, нестабильные помечаются;
 *   EVAL_ONLY=memory — только случаи, чей id или тема совпали (такой прогон не пишется в history.jsonl);
 *   EVAL_STRICT=1   — прогон падает при любом провале (по умолчанию — только при пропущенном кризисе).
 */
const REPEAT = Math.max(1, Number(process.env.EVAL_REPEAT) || 1)
const ONLY = process.env.EVAL_ONLY ? new RegExp(process.env.EVAL_ONLY, 'iu') : null

it('набор задач кота', { timeout: 60 * 60_000 }, async () => {
  expect(process.env.ANYMODEL_API_KEY, 'нужен ANYMODEL_API_KEY').toBeTruthy()
  expect(new Set(CASES.map((c) => c.id)).size, 'id случаев повторяются').toBe(CASES.length)
  const logs: string[] = []
  vi.spyOn(console, 'info').mockImplementation((s: unknown) => void logs.push(String(s)))

  const cases = CASES.filter((c) => !ONLY || ONLY.test(c.id) || ONLY.test(c.category))
  const sha = gitSha()
  const summaries: CaseSummary[] = []
  for (const c of cases) {
    const runs = []
    for (let i = 0; i < REPEAT; i++) {
      const r = await runCase(c, logs)
      runs.push(r)
      if (r.verdict === 'fail') writeTrajectory(sha, c, r, i)
      console.log(`${r.verdict.padEnd(5)} ${c.id.padEnd(32)} ${String(r.ms).padStart(6)} мс  ${r.reason ?? ''}`)
    }
    summaries.push(summarize(c.id, c.category, runs))
  }

  const line = historyLine(summaries, sha, REPEAT)
  const stamp = line.date.replace(/[:.]/g, '-').slice(0, 19)
  writeRun(`${stamp}-${sha}.json`, {
    ...line,
    only: process.env.EVAL_ONLY ?? null,
    results: summaries.map((s) => ({
      id: s.id,
      category: s.category,
      status: s.status,
      runs: s.runs.map((r) => ({ ...r, parts: undefined })),
    })),
  })
  const history = readHistory()
  const prev = history.filter((h) => h.cases >= cases.length).at(-1)
  console.log(`\n${compare(prev, line, cases.map((c) => c.id))}`)
  // частичный прогон не точка сравнения: процент по пяти случаям не сравним с полным набором
  if (!ONLY) appendHistory(line)

  const bad = summaries.filter((s) => s.status !== 'pass' && s.status !== 'infra')
  if (bad.length) {
    console.log('\nПровалы:')
    for (const s of bad) {
      const r = s.runs.find((x) => x.verdict === 'fail')!
      console.log(`- ${s.id} [${s.status}]: ${r.reason}\n  ответ: ${r.reply.replaceAll('\n', ' ') || '—'}${r.tools.length ? `\n  вызовы: ${JSON.stringify(r.tools)}` : ''}${r.ops ? `\n  операции: ${JSON.stringify(r.ops)}` : ''}`)
    }
  }

  // пропущенный кризис — провал прогона всегда
  const crisisMiss = summaries.filter((s) => s.category === 'crisis' && s.status !== 'pass' && s.status !== 'infra').map((s) => s.id)
  expect(crisisMiss, 'кризис пропущен').toEqual([])
  if (process.env.EVAL_STRICT) expect(bad.map((s) => s.id)).toEqual([])
})
