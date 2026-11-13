import { rateLimit } from '@/lib/api-guard'
import { getStore } from '@/lib/tg/store'
import { ensureSchedule } from '@/lib/tg/qstash'
import { botToken, tg, webhookSecret } from '@/lib/tg/telegram'
import { siteOf } from '@/lib/tg/deps'

export const dynamic = 'force-dynamic'

const COMMANDS = [
  { command: 'step', description: 'Новый шаг на 2 минуты' },
  { command: 'remind', description: 'Когда звать' },
  { command: 'tone', description: 'Как мне говорить' },
  { command: 'time', description: 'Твой часовой пояс' },
  { command: 'pause', description: 'Пауза на неделю' },
  { command: 'stop', description: 'Без напоминаний' },
  { command: 'forget', description: 'Стереть всё обо мне' },
  { command: 'help', description: 'Что я умею' },
]

/**
 * Подключение бота одним открытием ссылки: говорим Telegram, куда пересылать сообщения (вебхук на этот же сайт),
 * ставим меню команд и расписание напоминаний. Ключ не нужен: маршрут умеет только направить бота на наш же
 * адрес — чужой вызов ничего не меняет, а лимит не даёт им спамить.
 */
export async function GET(req: Request) {
  try {
    rateLimit(req, 'tg-setup', 5)
  } catch (r) {
    return r as Response
  }
  const lines: string[] = []
  if (!botToken()) {
    return text('Нет токена бота. В Vercel → Settings → Environment Variables добавь TELEGRAM_BOT_TOKEN и сделай Redeploy.')
  }
  const site = siteOf(req)
  const me = await tg<{ username: string }>('getMe', {})
  if (!me) return text('Telegram не принял токен. Проверь, что TELEGRAM_BOT_TOKEN скопирован целиком, и сделай Redeploy.')
  const hook = await tg('setWebhook', {
    url: `${site}/api/tg`,
    secret_token: webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  })
  await tg('setMyCommands', { commands: COMMANDS })
  lines.push(hook ? `✅ Бот @${me.username} подключён: отвечает на сообщения.` : '❌ Не удалось подключить вебхук — смотри логи Vercel.')
  const { persistent } = getStore()
  lines.push(
    persistent
      ? '✅ Память бота (Upstash Redis) подключена.'
      : '⚠️ Памяти нет: бот отвечает, но не помнит время напоминаний. Подключи Upstash Redis в Vercel → Storage.',
  )
  const schedule = await ensureSchedule(`${site}/api/tg/tick`)
  lines.push(
    schedule === 'ok'
      ? '✅ Напоминания по расписанию включены (QStash, каждые 15 минут).'
      : schedule === 'no-token'
        ? '⚠️ Напоминания не включены: подключи Upstash QStash в Vercel → Storage и открой эту ссылку ещё раз.'
        : '❌ QStash не принял расписание — смотри логи Vercel.',
  )
  lines.push(`\nОткрой бота: https://t.me/${me.username}`)
  return text(lines.join('\n'))
}

function text(body: string) {
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
