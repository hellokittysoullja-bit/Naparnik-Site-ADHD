import { handleUpdate, type TgUpdate } from '@/lib/tg/bot'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { sameSecret, webhookSecret } from '@/lib/tg/telegram'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Вебхук бота: сюда Telegram пересылает каждое сообщение и нажатие кнопки. Чужие запросы отсекаются секретом
 * (выведен из токена, его же /api/tg/setup передал Telegram). Отвечаем 200 всегда: иначе Telegram будет
 * повторять апдейт снова и снова, а ошибку мы и так пишем в лог.
 */
export async function POST(req: Request) {
  if (!sameSecret(req.headers.get('x-telegram-bot-api-secret-token'), webhookSecret())) {
    return new Response(null, { status: 401 })
  }
  try {
    const raw = await req.text()
    if (raw.length > 64 * 1024) return new Response(null, { status: 200 })
    await handleUpdate(JSON.parse(raw) as TgUpdate, liveDeps(siteOf(req)))
  } catch (e) {
    console.error('[tg] update', e)
  }
  return new Response(null, { status: 200 })
}
