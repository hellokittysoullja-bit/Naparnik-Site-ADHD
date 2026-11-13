import { z } from 'zod'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import { unlink } from '@/lib/tg/site'
import { getStore } from '@/lib/tg/store'

/** Отвязать этот браузер от чата бота: план с сайта боту больше не уходит; напоминания выключаются в самом боте (/stop) */
export const dynamic = 'force-dynamic'

const Body = z.object({ token: z.string() })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'tg-unlink', 6)
  const parsed = Body.safeParse(await readJsonBody(req, 1024))
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 })
  return Response.json({ ok: await unlink(getStore().store, parsed.data.token) })
})
