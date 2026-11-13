import { z } from 'zod'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import { isToken } from '@/lib/tg/link'
import { beginLink, PlanSchema } from '@/lib/tg/site'
import { getStore } from '@/lib/tg/store'
import { botUsername } from '@/lib/tg/telegram'

/**
 * Сайт начинает привязку к боту (lib/tg/link.ts): в ответ ссылка на бота с одноразовым кодом и жетон устройства.
 * Без бота или без постоянного хранилища привязки нет: 503, и сайт кнопку не показывает.
 */
export const dynamic = 'force-dynamic'

const Body = z.object({ plan: PlanSchema.optional(), token: z.string().optional() })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'tg-link', 6)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ url: null }, { status: 400 })
  const { store, persistent } = getStore()
  const bot = persistent ? await botUsername() : null
  if (!bot) return Response.json({ url: null }, { status: 503 })
  const token = isToken(parsed.data.token) ? parsed.data.token : undefined
  return Response.json(await beginLink(store, bot, parsed.data.plan ?? {}, token), { headers: { 'Cache-Control': 'no-store' } })
})
