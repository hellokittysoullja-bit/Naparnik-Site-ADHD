/**
 * Клиентские вызовы обвязки для экранов без чата (знакомство). Правило продукта: кот не молчит и не тормозит —
 * если обвязка не ответила за отведённое время или вернула заготовку, экран берёт свою мгновенную подсказку.
 */
export type FirstStepAnswer = { kind: 'step'; step: string } | { kind: 'care'; reply: string } | null

/** Первый крошечный шаг для своего дела человека (дробление, берётся первый из трёх шагов) */
export async function firstStepFor(
  task: string,
  context: { sphere?: string; blocker?: string },
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<FirstStepAnswer> {
  // сервер даёт дроблению 8 с на обе модели (lib/ai/agents/breakdown.ts) — ждём чуть дольше, иначе годный ответ
  // страхующей модели на 6–8-й секунде выбрасывался (аудит 12.11)
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 9000)
  try {
    const res = await fetch('/api/breakdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, context }),
      signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
    })
    if (!res.ok) return null
    const data = (await res.json()) as { steps?: string[] | null; reply?: string; source?: string }
    if (typeof data.reply === 'string') return { kind: 'care', reply: data.reply }
    // заготовка обвязки («Открыть то, что нужно для дела») хуже подсказки сферы — экран возьмёт свою
    if (data.source !== 'model' || !Array.isArray(data.steps) || typeof data.steps[0] !== 'string') return null
    return { kind: 'step', step: data.steps[0].slice(0, 80) }
  } catch {
    return null
  }
}
