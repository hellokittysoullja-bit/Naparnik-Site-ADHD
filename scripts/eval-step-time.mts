// Проверка точности оценщика времени: каждое дело базы оценивается так, будто его плана в базе нет.
// Метрика — во сколько раз оценка отличается от ручной (|log2|): 0 — точно, 1 — вдвое.
import { GOBLIN_PLANS } from '../lib/ai/agents/breakdown-goblin'
import { GOBLIN_MINUTES } from '../lib/ai/agents/breakdown-minutes'
import { estimateStep } from '../lib/ai/agents/step-time'
const errs: number[] = []
let within2 = 0
for (const [title, steps] of Object.entries(GOBLIN_PLANS)) {
  const m = GOBLIN_MINUTES[title]
  steps.forEach((s, i) => {
    const e = estimateStep(s, title, title)
    const d = Math.abs(Math.log2(e / m[i]))
    errs.push(d)
    if (d <= 1) within2++
  })
}
errs.sort((a, b) => a - b)
const q = (p: number) => errs[Math.floor(errs.length * p)].toFixed(2)
console.log('steps', errs.length, 'within x2', ((100 * within2) / errs.length).toFixed(1) + '%', 'median|log2|', q(0.5), 'p75', q(0.75), 'p90', q(0.9))
