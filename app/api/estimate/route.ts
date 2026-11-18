import { z } from 'zod'
import { estimate } from '@/lib/ai/agents/estimate'
import { newTurn } from '@/lib/ai/core/turn'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** «Оценить» в «Делах»: минуты на каждый шаг (lib/ai/agents/estimate.ts) */
export const maxDuration = 15

const Body = z.object({
  task: z.string().trim().min(1).max(200),
  steps: z.array(z.string().trim().min(1).max(200)).min(1).max(24),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'estimate', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 16 * 1024))
  if (!parsed.success) return Response.json({ minutes: null }, { status: 400 })
  const { task, steps } = parsed.data
  const minutes = await estimate({ task, steps, ctx: newTurn({ task: 'estimate' }), signal: req.signal })
  return Response.json({ minutes })
})
