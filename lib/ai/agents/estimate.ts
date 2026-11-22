import { readyPlan } from './breakdown'
import { calibratePlan, estimateDeal, estimateTitle, splitMinutes } from './step-time'

/**
 * «Оценить время» — как кнопка Estimator у goblin.tools, только без модели (владелец 18.11: «как база микрошагов,
 * автономная»): дело из базы получает свои минуты, оценённые вручную, любой другой шаг — время самого похожего шага
 * базы (step-time.ts). Мгновенно, без сети к модели и без расходов; сумма — время всего дела.
 *
 * 22.11 (владелец: «у любого дела абсолютно»): дело узнаётся тем же поиском, что разбивка, — «Пойти к психиатру»
 * получает минуты плана «Сходить к психиатру», даже если название осталось словами человека. Дело без шагов получает
 * время целиком (`total`): план из базы — его сумма, иначе время самых похожих дел базы.
 */
export function estimate(input: { task: string; steps: string[] }): number[] {
  const known = readyPlan(input.task)?.value
  const raw = estimateDeal(input.task, input.steps, known)
  // шаги своего плана уже с поправкой; остальные — по сырым минутам похожих шагов, им поправка суммы нужна
  const own = new Set(known?.steps ?? [])
  if (input.steps.every((s) => own.has(s))) return raw
  return calibratePlan(input.steps, raw)
}

/**
 * Время всего дела: `work` — твоё время (с коротким ожиданием рядом), `wait` — долгое ожидание (сохнет ночь, решение
 * налоговой). Шаги есть — по шагам; шагов нет — план из базы или похожие дела базы.
 */
export function estimateTotal(input: { task: string; steps: string[] }): { work: number; wait: number } {
  if (input.steps.length) return splitMinutes(input.steps, estimate(input))
  const hit = readyPlan(input.task)
  const m = hit?.value.minutes
  if (hit && m?.length === hit.value.steps.length && m.every((x) => typeof x === 'number' && x > 0)) return splitMinutes(hit.value.steps, m as number[])
  return { work: estimateTitle(input.task), wait: 0 }
}
