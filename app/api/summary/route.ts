import { z } from 'zod'
import { summarize } from '@/lib/ai/agents/summarize'
import { SUMMARY_LIMITS } from '@/lib/ai/memory/summary'
import { newTurn } from '@/lib/ai/core/turn'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * Конспект прошлой части разговора — веб-адаптер lib/ai/agents/summarize.ts. Устройство присылает прошлый конспект
 * и реплики, которые скоро выйдут из окна переписки; ответ — обновлённый конспект. Сервер ничего не хранит.
 */
export const maxDuration = 20

const Body = z.object({
  // форма конспекта проверяется в агенте (parseSummary): странное поле даёт конспект с нуля, а не отказ
  previous: z.unknown().optional(),
  lines: z
    .array(z.object({ role: z.enum(['user', 'cat']), text: z.string() }))
    .min(1)
    .max(SUMMARY_LIMITS.chunk)
    .transform((ls) => ls.map((l) => ({ ...l, text: l.text.slice(0, l.role === 'user' ? SUMMARY_LIMITS.userText : SUMMARY_LIMITS.catText) }))),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  // один конспект на ~12 реплик разговора; запас на повтор после сбоя и вторую вкладку
  rateLimit(req, 'summary', 6)
  const parsed = Body.safeParse(await readJsonBody(req, 32 * 1024))
  if (!parsed.success) return Response.json({ summary: null }, { status: 400 })
  const r = await summarize({ ...parsed.data, ctx: newTurn({ task: 'summarize' }), signal: req.signal })
  // 503 — модели не ответили: устройство оставит реплики на следующую попытку
  return Response.json({ summary: r.summary }, { status: r.ok ? 200 : 503 })
})
