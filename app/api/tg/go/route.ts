import { onGo } from '@/lib/tg/bot'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { sign } from '@/lib/tg/telegram'

export const dynamic = 'force-dynamic'

/**
 * Кнопка «Сесть рядом» в боте ведёт сюда: отмечаем, что человек откликнулся (бот снова пишет раз в день, а не реже),
 * и сразу перекидываем на сессию с его шагом. Подпись — чтобы чужая ссылка не «оживляла» чужой профиль.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const chat = Number(url.searchParams.get('c'))
  const step = (url.searchParams.get('s') ?? '').trim()
  const deps = liveDeps(siteOf(req))
  const signed = Number.isSafeInteger(chat) && url.searchParams.get('t') === sign(String(chat))
  const target = signed
    ? await onGo(deps, chat, step).catch(() => `${deps.site}/app/session`)
    : `${deps.site}/app/session?${new URLSearchParams({ step: step.slice(0, 120) }).toString()}`
  return Response.redirect(target, 302)
}
