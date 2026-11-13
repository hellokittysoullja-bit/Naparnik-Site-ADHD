import { z } from 'zod'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import { linkStatus } from '@/lib/tg/site'
import { getStore } from '@/lib/tg/store'
import { botToken } from '@/lib/tg/telegram'

/** Связан ли этот браузер с чатом бота и придёт ли напоминание. Жетон — в теле, не в адресе: адреса попадают в журналы */
export const dynamic = 'force-dynamic'

const Body = z.object({ token: z.string().optional() })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'tg-status', 20)
  const parsed = Body.safeParse(await readJsonBody(req, 1024))
  if (!parsed.success) return Response.json({ linked: false }, { status: 400 })
  const { store, persistent } = getStore()
  // бот «есть», только когда есть и токен, и постоянное хранилище: без хранилища он не запомнит, когда звать
  const available = persistent && botToken() !== null
  const status = available ? await linkStatus(store, parsed.data.token) : { linked: false as const }
  return Response.json({ available, ...status }, { headers: { 'Cache-Control': 'no-store' } })
})
