import { z } from 'zod'
import { breakdownTask } from '@/lib/breakdown'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

export const maxDuration = 15

/**
 * «Раздроби мне задачу»: task initiation — главный bottleneck СДВГ.
 * Большая задача пугает; 3 микрошага по 1-5 минут — нет.
 * Возвращает массив из 3 шагов, каждый начинается с глагола.
 */
// дело длиннее 300 символов обрезаем, а не отклоняем: человек не должен получить отказ за подробность
const Body = z.object({ task: z.string().trim().min(3).transform((s) => s.slice(0, 300)) })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'breakdown', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ steps: null }, { status: 400 })
  const { task } = parsed.data
  const { steps } = await breakdownTask(task, req.signal)
  // при сбое модели — универсальные микрошаги вместо молчания (тот же ответ, что был раньше)
  return Response.json({ steps })
})
