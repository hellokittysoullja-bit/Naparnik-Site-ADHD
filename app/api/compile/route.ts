import { z } from 'zod'
import { compile } from '@/lib/ai/agents/compile'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/** «Вывали всё, что в голове» → список дел, как Compiler у goblin.tools, без модели (lib/ai/agents/compile.ts) */
export const maxDuration = 10

const Body = z.object({ text: z.string().trim().min(1).max(4000) })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'compile', 60)
  const parsed = Body.safeParse(await readJsonBody(req, 16 * 1024))
  if (!parsed.success) return Response.json({ items: [] }, { status: 400 })
  return Response.json({ items: compile(parsed.data.text) })
})
