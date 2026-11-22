import { z } from 'zod'
import { oneStep } from '@/lib/ai/agents/one-step'
import { newTurn } from '@/lib/ai/core/turn'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** «Не могу начать»: один шаг по ситуации и делу (lib/ai/agents/one-step.ts). Без дела и без модели — свои ступени */
export const maxDuration = 10

const Body = z.object({
  situation: z.enum(['study', 'work', 'home', 'other']),
  task: z.string().trim().max(200).optional().catch(undefined),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  avoid: z.array(z.string().trim().max(200)).max(12).optional().catch(undefined),
  energy: z.enum(['low', 'mid', 'high']).optional().catch(undefined),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'step', 20)
  const parsed = Body.safeParse(await readJsonBody(req, 8 * 1024))
  if (!parsed.success) return Response.json({ step: null }, { status: 400 })
  const { situation, task, level, avoid, energy } = parsed.data
  const r = await oneStep({ situation, task: task || undefined, level, avoid: avoid ?? [], energy, ctx: newTurn({ task: 'one-step' }), signal: req.signal })
  return Response.json(r)
})
