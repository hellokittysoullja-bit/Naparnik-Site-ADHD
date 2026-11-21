import { z } from 'zod'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { PlanSchema, linkWebApp } from '@/lib/tg/site'
import { getStore } from '@/lib/tg/store'
import { botToken } from '@/lib/tg/telegram'
import { verifyInitData } from '@/lib/tg/webapp'

/**
 * «Напоминать в Telegram» внутри мини-аппа: одно касание, без перехода в чат. Кто нажал — из подписанных Telegram данных
 * запуска (initData), не из запроса. Без бота или без постоянного хранилища — 503, как у /api/tg/link.
 */
export const dynamic = 'force-dynamic'

const Body = z.object({ initData: z.string().max(4096), plan: PlanSchema.optional(), token: z.string().optional() })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'tg-webapp-link', 6)
  const parsed = Body.safeParse(await readJsonBody(req, 8 * 1024))
  if (!parsed.success) return Response.json({ linked: false }, { status: 400 })
  const token = botToken()
  const { persistent } = getStore()
  if (!token || !persistent) return Response.json({ linked: false }, { status: 503 })
  const user = verifyInitData(parsed.data.initData, token)
  if (!user) return Response.json({ linked: false }, { status: 401 })
  const r = await linkWebApp(liveDeps(siteOf(req)), user.id, parsed.data.plan ?? {}, parsed.data.token)
  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } })
})
