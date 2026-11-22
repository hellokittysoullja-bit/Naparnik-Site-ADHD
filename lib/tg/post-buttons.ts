/**
 * Кнопки под постом канала (22.11, владелец: «прикреплённая CTA-кнопка к посту, кодом, любого цвета»). В Telegram кнопку
 * под постом может поставить только бот, поэтому владелец пишет Напарнику в личку:
 *
 *   /button https://t.me/канал/45
 *   🐾 Разбить своё дело | зелёный | апп
 *   Написать коту | синий | бот
 *
 * и бот ставит кнопки под этот пост (уже опубликованный и закреплённый — тоже). «/button <ссылка> убрать» снимает их.
 * Ключей нет: бот спрашивает у Telegram, админ ли написавший в этом канале. Сам бот должен быть админом канала с правом
 * «Редактировать сообщения». Цвета — какие даёт Telegram (Bot API 9.4): зелёный, синий, красный и обычный.
 */
import type { Send } from './bot'

export type PostButton = { text: string; url: string; style?: 'success' | 'primary' | 'danger' }
export type ButtonCommand =
  | { kind: 'set'; chat: string; message: number; rows: PostButton[][] }
  | { kind: 'clear'; chat: string; message: number }
  | { kind: 'error'; reply: string }

export const BUTTON_HELP =
  'Кнопки под постом канала. Пришли так:\n\n' +
  '/button https://t.me/канал/45\n' +
  '🐾 Разбить своё дело | зелёный | апп\n' +
  'Написать коту | синий | бот\n\n' +
  'Каждая строка — кнопка: текст | цвет | куда. Две кнопки в один ряд — через «;;» в одной строке.\n' +
  'Цвет: зелёный, синий, красный или обычный (других Telegram не даёт).\n' +
  'Куда: бот (чат со мной), апп (мини-апп) или любая ссылка https://…\n' +
  'Снять кнопки: /button https://t.me/канал/45 убрать\n\n' +
  'Ссылка на пост: зажми пост → «Копировать ссылку». Я должен быть админом канала с правом «Редактировать сообщения».'

const COLORS: Record<string, PostButton['style'] | null> = {
  зеленый: 'success', зелёный: 'success', green: 'success', success: 'success',
  синий: 'primary', голубой: 'primary', blue: 'primary', primary: 'primary',
  красный: 'danger', red: 'danger', danger: 'danger',
  обычный: null, серый: null, нет: null, default: null, gray: null, grey: null,
}

/** t.me/канал/45, t.me/c/1234567890/45 (закрытый канал), с https:// и без, с ?single и т. п. */
export function parsePostLink(s: string): { chat: string; message: number } | null {
  const m = s.trim().match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:(c)\/(\d+)|([A-Za-z][A-Za-z0-9_]{3,31}))\/(\d+)(?:[/?#].*)?$/i)
  if (!m) return null
  const message = Number(m[4])
  if (!Number.isSafeInteger(message) || message <= 0) return null
  return { chat: m[1] ? `-100${m[2]}` : `@${m[3]}`, message }
}

function target(where: string, bot: string): string | null {
  const w = where.trim()
  if (!w || /^(бот|bot|чат|в бота)$/i.test(w)) return `https://t.me/${bot}?start=channel`
  if (/^(апп|ап|app|мини-?апп|miniapp|mini app|сайт)$/i.test(w)) return `https://t.me/${bot}?startapp=channel`
  if (/^https:\/\/\S+$/i.test(w) || /^tg:\/\/\S+$/i.test(w)) return w
  return null
}

function button(raw: string, bot: string): PostButton | string {
  const [text = '', color = '', where = ''] = raw.split('|').map((p) => p.trim())
  if (!text) return `Пустой текст кнопки в строке «${raw.trim()}».`
  if (text.length > 64) return `Текст кнопки длиннее 64 знаков: «${text}».`
  const key = color.toLowerCase()
  if (key && !(key in COLORS)) return `Не знаю цвет «${color}». Есть: зелёный, синий, красный, обычный.`
  const url = target(where, bot)
  if (!url) return `Не понял, куда ведёт кнопка: «${where}». Напиши бот, апп или ссылку https://…`
  const style = key ? COLORS[key] : null
  return style ? { text, url, style } : { text, url }
}

export function parseButtonCommand(text: string, bot: string): ButtonCommand {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const head = (lines.shift() ?? '').replace(/^\/(button|buttons|кнопка|кнопки)(@\w+)?/i, '').trim()
  const [link = '', ...rest] = head.split(/\s+/)
  const post = parsePostLink(link)
  if (!post) return { kind: 'error', reply: BUTTON_HELP }
  if (/^(убрать|удалить|снять|clear|remove)$/i.test(rest.join(' '))) return { kind: 'clear', ...post }
  if (rest.length) lines.unshift(rest.join(' '))
  if (!lines.length) return { kind: 'error', reply: BUTTON_HELP }
  const rows: PostButton[][] = []
  for (const line of lines.slice(0, 10)) {
    const row: PostButton[] = []
    for (const part of line.split(';;').slice(0, 4)) {
      const b = button(part, bot)
      if (typeof b === 'string') return { kind: 'error', reply: b }
      row.push(b)
    }
    rows.push(row)
  }
  return { kind: 'set', ...post, rows }
}

/** Ответ Telegram (lib/tg/telegram.ts tg): результат или null; для понятной ошибки — описание, если оно есть */
type Member = { status?: string; can_edit_messages?: boolean }

export async function postButtons(send: Send, userId: number, text: string): Promise<string> {
  const me = (await send('getMe', {})) as { username?: string } | null
  if (!me?.username) return 'Не достучался до Telegram. Попробуй ещё раз через минуту.'
  const cmd = parseButtonCommand(text, me.username)
  if (cmd.kind === 'error') return cmd.reply
  // править посты канала может только его админ: проверяет сам Telegram, ключи не нужны
  const member = (await send('getChatMember', { chat_id: cmd.chat, user_id: userId })) as Member | null
  if (!member) return 'Не вижу этот канал. Добавь меня в админы канала с правом «Редактировать сообщения» и пришли ещё раз.'
  if (member.status !== 'creator' && member.status !== 'administrator') return 'Ставить кнопки могут только админы этого канала.'
  const markup = cmd.kind === 'clear' ? { inline_keyboard: [] } : { inline_keyboard: cmd.rows }
  const ok = await send('editMessageReplyMarkup', { chat_id: cmd.chat, message_id: cmd.message, reply_markup: markup })
  if (!ok) {
    return 'Telegram не дал поменять пост. Проверь: я админ канала с правом «Редактировать сообщения», ссылка ведёт на пост, а кнопки не те же самые, что уже стоят.'
  }
  return cmd.kind === 'clear' ? 'Готово: кнопки под постом сняты.' : 'Готово: кнопки под постом стоят. Открой канал и проверь.'
}
