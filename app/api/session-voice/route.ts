import { z } from 'zod'
import { MOMENTS, sessionVoice } from '@/lib/ai/agents/session-voice'
import { newTurn } from '@/lib/ai/core/turn'
import { ClientSnapshotMemory } from '@/lib/ai/memory/provider'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** Голос кота в сессии — веб-адаптер задачи lib/ai/agents/session-voice.ts */
export const maxDuration = 15

const MAX_BODY = 32 * 1024 // дело + снимок памяти (20 фактов, 8 навыков, 5 стартов ≈ 8–12 КБ кириллицей)

// enum, а не поиск по объекту: прежний momentPrompts['__proto__'] был «найден» и уходил в модель
const Body = z.object({
  moment: z.enum(MOMENTS),
  task: z.string().trim().min(1).transform((s) => s.slice(0, 300)),
  // длина сессии модели больше не передаётся (она провоцировала похвалу за минуты); поле принимается от страниц,
  // открытых до обновления
  minutes: z.number().int().min(1).max(240).optional(),
  // память проверяется отдельно (memory/schema.ts): странное поле даёт ход без памяти, а не отказ
  memory: z.unknown().optional(),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'session-voice', 30)
  const parsed = Body.safeParse(await readJsonBody(req, MAX_BODY))
  if (!parsed.success) return Response.json({ text: null }, { status: 400 })
  const { memory, moment, task } = parsed.data
  const text = await sessionVoice({ moment, task, memory: new ClientSnapshotMemory(memory), ctx: newTurn({ task: 'session-voice' }), signal: req.signal })
  return Response.json({ text })
})
