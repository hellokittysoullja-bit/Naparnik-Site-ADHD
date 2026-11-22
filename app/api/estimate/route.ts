import { z } from 'zod'
import { estimate, estimateTotal } from '@/lib/ai/agents/estimate'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** «Оценить время» в «Делах»: минуты на каждый шаг из базы оценённых шагов (lib/ai/agents/step-time.ts), без модели */
export const maxDuration = 10

const Body = z.object({
  task: z.string().trim().min(1).max(200),
  // шагов может не быть: дело оценивается по названию (22.11, «у любого дела»)
  steps: z.array(z.string().trim().min(1).max(200)).max(24),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'estimate', 30)
  const parsed = Body.safeParse(await readJsonBody(req, 16 * 1024))
  if (!parsed.success) return Response.json({ minutes: null }, { status: 400 })
  // minutes — на каждый шаг; total — твоё время и долгое ожидание отдельно (у дела без шагов — по названию)
  return Response.json({ minutes: estimate(parsed.data), total: estimateTotal(parsed.data) })
})
