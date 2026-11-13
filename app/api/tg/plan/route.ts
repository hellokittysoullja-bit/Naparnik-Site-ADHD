import { z } from 'zod'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import { reschedule } from '@/lib/tg/bot'
import { PlanSchema, pushPlan } from '@/lib/tg/site'
import { getStore } from '@/lib/tg/store'

/** Сайт сохранил план на завтра: бот позовёт на его первый шаг в названное время */
export const dynamic = 'force-dynamic'

const Body = z.object({ token: z.string(), plan: PlanSchema })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'tg-plan', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 })
  const { store } = getStore()
  const r = await pushPlan(store, parsed.data.token, parsed.data.plan, (u) => reschedule({ store, now: () => Date.now() }, u))
  // всегда 200: «не связан» и «план не принят» — ответы, по которым сайт правит своё знание, а не сбой сети
  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } })
})
