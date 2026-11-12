import { z } from 'zod'
import { recall, RECALL_LIMITS } from '@/lib/ai/agents/recall'
import { newTurn } from '@/lib/ai/core/turn'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * Вспоминание прошлых разговоров — веб-адаптер lib/ai/agents/recall.ts. Устройство нашло куски в своём архиве
 * (lib/chat-archive.ts) и присылает их сжать; сервер ничего не хранит и не пишет в журнал тексты.
 */
export const maxDuration = 15

const clip = (n: number) => z.string().transform((s) => s.slice(0, n))

const Body = z.object({
  query: clip(RECALL_LIMITS.query),
  episodes: z
    .array(
      z.object({
        at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        lines: z.array(z.object({ role: z.enum(['user', 'cat']), text: clip(RECALL_LIMITS.text) })).max(RECALL_LIMITS.lines),
      }),
    )
    .max(RECALL_LIMITS.episodes),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'recall', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 16 * 1024))
  if (!parsed.success) return Response.json({ summary: null }, { status: 400 })
  const summary = await recall({ ...parsed.data, ctx: newTurn({ task: 'recall' }), signal: req.signal })
  return Response.json({ summary })
})
