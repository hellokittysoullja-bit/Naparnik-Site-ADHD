import { tick } from '@/lib/tg/bot'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { verifyQStash } from '@/lib/tg/qstash'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Раз в 15 минут QStash зовёт сюда: разослать напоминания тем, у кого подошёл час. Без подписи QStash — 401. */
export async function POST(req: Request) {
  const body = await req.text()
  const site = siteOf(req)
  // подпись годится только для этого адреса: вызов, подписанный для другого получателя того же аккаунта, не пройдёт
  if (!verifyQStash(req.headers.get('upstash-signature'), body, { url: `${site}/api/tg/tick` })) return new Response(null, { status: 401 })
  const sent = await tick(liveDeps(site))
  return Response.json({ sent })
}
