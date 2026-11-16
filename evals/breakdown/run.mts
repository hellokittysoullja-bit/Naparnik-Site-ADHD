// Живой прогон разбивки: ANYMODEL_API_KEY=… npx tsx --tsconfig tsconfig.json evals/breakdown/run.mts [out.json]
import { writeFileSync } from 'node:fs'
import { BREAKDOWN_FALLBACK, BREAKDOWN_SYSTEM, breakdown, parseBreakdownAnswer, type BreakdownResult } from '@/lib/ai/agents/breakdown'
import { dataMessage } from '@/lib/ai/context'
import { BREAK_CASES } from './tasks'
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// Судья — другая, более сильная модель (не та, что разбивает): объективная оценка «доведено ли до конца»
const JUDGE = process.env.BREAK_JUDGE ?? 'ag/claude-sonnet-4-6'
const am = createOpenAICompatible({ name: 'judge', baseURL: 'https://anymodel.org/v1', apiKey: process.env.ANYMODEL_API_KEY ?? '' })
async function judge(task: string, steps: string[]): Promise<string[]> {
  const plan = steps.map((x, i) => `${i + 1}. ${x}`).join('\n')
  const prompt = [
    `Ты проверяешь план дела для человека с СДВГ (эталон: goblin.tools Magic ToDo). Дело: «${task}». План:`,
    plan,
    '',
    'Ищи ТОЛЬКО серьёзные проблемы, из-за которых план плохой:',
    '1) план не доводит дело до результата: обрывается на начале, большое дело сужено до одного сегодняшнего кусочка, последний шаг не завершает дело',
    '2) нет главного действия дела',
    '3) дело понято неправильно (сленг, мат, шутки, опечатки поняты не так, как человек имел в виду)',
    '4) порядок шагов явно нелогичен',
    '5) ошибка или опечатка в русском слове, повелительное наклонение вместо инфинитива',
    '6) пустой общий шаг без конкретики («подготовиться», «определить цели»)',
    'НЕ придирайся к мелочам: детали режима, «два действия в одном шаге» для естественной пары, «можно было бы мельче», вкусовщина.',
    'Ответь ТОЛЬКО JSON {"problems": [коротко по-русски]}, пустой массив, если серьёзных проблем нет.',
  ].join('\n')
  try {
    const r = await generateText({ model: am.chatModel(JUDGE), prompt, maxOutputTokens: 600 })
    const m = r.text.match(/\{[\s\S]*\}/)
    const j = m ? (JSON.parse(m[0]) as { problems?: string[] }) : { problems: ['не JSON'] }
    return (j.problems ?? []).map((x) => `судья: ${x}`)
  } catch (e) {
    return [`судья недоступен: ${(e as Error).message.slice(0, 60)}`]
  }
}

// Сравнение моделей: CANDIDATE=<id AnyModel> — та же инструкция и тот же разбор, без обвязки (только для выбора модели)
const CANDIDATE = process.env.CANDIDATE
async function candidate(task: string): Promise<BreakdownResult> {
  try {
    const r = await generateText({ model: am.chatModel(CANDIDATE!), system: BREAKDOWN_SYSTEM, prompt: dataMessage({ Дело: task }), maxOutputTokens: 1500, temperature: 0.3, providerOptions: { judge: { reasoning_effort: 'none' } } })
    return parseBreakdownAnswer(r.text) ?? { kind: 'steps', steps: BREAKDOWN_FALLBACK, source: 'fallback' }
  } catch {
    return { kind: 'steps', steps: BREAKDOWN_FALLBACK, source: 'fallback' }
  }
}

const VERB = /(ть|ться|ти|чь|чься|сь|ся)$/u
const GENERIC = /^(подготовиться|определить(ся)?|собраться с мыслями|начать|продолжить|сделать дело|настроиться|проанализировать|рассмотреть)\b/iu
const OPEN_END = /^(начать|продолжить|повторить|приступить|открыть)\b|первое предложение|первую строку/iu

async function one(c: (typeof BREAK_CASES)[number]) {
  const t0 = Date.now()
  const r = CANDIDATE ? await candidate(c.task) : await breakdown({ task: c.task })
  const ms = Date.now() - t0
  const issues: string[] = []
  if (c.expect === 'unclear') {
    if (r.kind !== 'unclear') issues.push(`ждали «не понял», пришло ${r.kind}`)
  } else if (r.kind !== 'steps') issues.push(`ждали шаги, пришло ${r.kind}`)
  else {
    if (r.source !== 'model') issues.push('заготовка вместо модели')
    const n = r.steps.length
    if (n < 3 || n > 8) issues.push(`шагов ${n}`)
    r.steps.forEach((st, i) => {
      const first = st.split(/\s+/)[0].toLowerCase().replace(/[^\p{L}]/gu, '')
      if (!VERB.test(first)) issues.push(`шаг ${i + 1} не с глагола: «${st}»`)
      if (GENERIC.test(st)) issues.push(`общий шаг: «${st}»`)
      if (st.split(/\s+/).length > 9) issues.push(`длинный шаг: «${st}»`)
    })
    if (OPEN_END.test(r.steps[n - 1])) issues.push(`конец не завершает: «${r.steps[n - 1]}»`)
    if (!process.env.NO_JUDGE) issues.push(...(await judge(c.task, r.steps)))
  }
  return { ...c, ms, kind: r.kind, steps: r.kind === 'steps' ? r.steps : [], minutes: r.kind === 'steps' ? r.minutes : undefined, wait: r.kind === 'steps' ? r.wait : undefined, issues }
}

async function main() {
  const out: Awaited<ReturnType<typeof one>>[] = []
  const queue = [...BREAK_CASES]
  await Promise.all(Array.from({ length: Number(process.env.CONC ?? 6) }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) out.push(await one(c))
  }))
  out.sort((a, b) => BREAK_CASES.findIndex((x) => x.task === a.task) - BREAK_CASES.findIndex((x) => x.task === b.task))
  const bad = out.filter((o) => o.issues.length)
  for (const o of out) {
    console.log(`\n### [${o.group}] ${o.task} — ${o.kind} ${o.ms}мс${o.issues.length ? '  ⚠ ' + o.issues.join('; ') : ''}`)
    o.steps.forEach((st, i) => console.log(`  ${i + 1}. ${o.wait?.[i] ? '[пока ждёшь] ' : ''}${st}${o.minutes?.[i] ? ` · ${o.minutes[i]}` : ''}`))
  }
  const ms = out.map((o) => o.ms).sort((a, b) => a - b)
  console.log(`\nИТОГ: ${out.length - bad.length}/${out.length} без замечаний; медиана ${ms[ms.length >> 1]} мс, p90 ${ms[Math.floor(ms.length * 0.9)]} мс`)
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 2))
}
main()
