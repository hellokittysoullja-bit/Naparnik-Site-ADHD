import { estimateDeal } from './step-time'

/**
 * «Оценить время» в «Делах» — как кнопка Estimator у goblin.tools, только без модели (владелец 18.11: «как база
 * микрошагов, автономная»): дело из базы получает свои минуты, оценённые вручную, любой другой шаг — время самого
 * похожего шага базы (step-time.ts). Мгновенно, без сети к модели и без расходов; сумма — время всего дела.
 */
export function estimate(input: { task: string; steps: string[] }): number[] {
  return estimateDeal(input.task, input.steps)
}
