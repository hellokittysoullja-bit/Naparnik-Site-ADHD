import { z } from 'zod'
import { MOMENTS, sessionVoice } from '@/lib/ai/agents/session-voice'
import { newTurn } from '@/lib/ai/core/turn'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** Голос кота в сессии — веб-адаптер задачи lib/ai/agents/session-voice.ts */
export const maxDuration = 15

// enum, а не поиск по объекту: прежний momentPrompts['__proto__'] был «найден» и уходил в модель
const Body = z.object({
  moment: z.enum(MOMENTS),
  task: z.string().trim().min(1).transform((s) => s.slice(0, 300)),
  minutes: z.number().int().min(1).max(240).optional(),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'session-voice', 30)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ text: null }, { status: 400 })
  const text = await sessionVoice({ ...parsed.data, ctx: newTurn({ task: 'session-voice' }), signal: req.signal })
  return Response.json({ text })
})
