import { tick } from '@/lib/tg/bot'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { verifyQStash } from '@/lib/tg/qstash'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Раз в 15 минут QStash зовёт сюда: разослать напоминания тем, у кого подошёл час. Без подписи QStash — 401. */
export async function POST(req: Request) {
  const body = await req.text()
  if (!verifyQStash(req.headers.get('upstash-signature'), body)) return new Response(null, { status: 401 })
  const sent = await tick(liveDeps(siteOf(req)))
  return Response.json({ sent })
}
