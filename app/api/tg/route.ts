import { after } from 'next/server'
import { handleUpdate, type TgUpdate } from '@/lib/tg/bot'
import { liveDeps, siteOf } from '@/lib/tg/deps'
import { sameSecret, webhookSecret } from '@/lib/tg/telegram'

export const dynamic = 'force-dynamic'
// ход кота — до 25 с (lib/ai/agents/chat.ts), запасное дробление — ещё до 3 с, плюс хранилище и Telegram
export const maxDuration = 60

/**
 * Вебхук бота: сюда Telegram пересылает каждое сообщение и нажатие кнопки. Чужие запросы отсекаются секретом
 * (выведен из токена, его же /api/tg/setup передал Telegram). Telegram получает 200 сразу, а ответ кота идёт после
 * (after: функция живёт до maxDuration): Telegram не держит соединение по 25 с хода кота, не считает вебхук медленным
 * и не повторяет апдейт. Повторы всё равно отсекает handleUpdate по update_id, а сообщения одного человека идут по
 * очереди через замок чата (lib/tg/store.ts lock).
 */
export async function POST(req: Request) {
  if (!sameSecret(req.headers.get('x-telegram-bot-api-secret-token'), webhookSecret())) {
    return new Response(null, { status: 401 })
  }
  const raw = await req.text().catch(() => '')
  if (!raw || raw.length > 64 * 1024) return new Response(null, { status: 200 })
  let update: TgUpdate
  try {
    update = JSON.parse(raw) as TgUpdate
  } catch {
    return new Response(null, { status: 200 })
  }
  const deps = liveDeps(siteOf(req))
  after(() => handleUpdate(update, deps).catch((e) => console.error('[tg] update', e)))
  return new Response(null, { status: 200 })
}
