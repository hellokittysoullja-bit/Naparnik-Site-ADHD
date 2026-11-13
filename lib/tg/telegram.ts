import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Тонкая обёртка над Telegram Bot API. Токен живёт только в переменной окружения Vercel (TELEGRAM_BOT_TOKEN) —
 * в коде и в чате его нет. Без токена все вызовы молча возвращают null: сайт от бота не зависит.
 */
const API = 'https://api.telegram.org'

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

/** Ответ Telegram или null (нет токена, сеть, ошибка API — пишем в лог и не роняем обработку) */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = botToken()
  if (!token) return null
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
    if (!json.ok) {
      console.error(`[tg] ${method}: ${json.description ?? res.status}`)
      return null
    }
    return json.result ?? null
  } catch (e) {
    console.error(`[tg] ${method}:`, e)
    return null
  }
}

/**
 * Секрет вебхука выводим из токена, а не храним отдельно: владельцу не нужно заводить ещё одну переменную.
 * Telegram присылает его в заголовке X-Telegram-Bot-Api-Secret-Token — чужие POST на /api/tg отбрасываются.
 */
export function webhookSecret(): string | null {
  const token = botToken()
  return token ? createHash('sha256').update(`${token}:webhook`).digest('hex').slice(0, 48) : null
}

export function sameSecret(got: string | null, want: string | null): boolean {
  if (!got || !want) return false
  // длину сравниваем у байтов: строка той же длины с не-латиницей иначе роняла сравнение исключением
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Подпись ссылок «Сесть рядом» (чей клик — чтобы считать вернувшихся), подделать без токена нельзя */
export function sign(value: string): string {
  const token = botToken()
  // без токена подписи нет вовсе (пустая строка ничему не равна в sameSecret): общеизвестный ключ подделал бы любой
  return token ? createHmac('sha256', token).update(value).digest('base64url').slice(0, 16) : ''
}

let username: string | null | undefined

/** Имя бота (@…) для ссылок на него: спрашиваем у Telegram один раз на экземпляр; null — токена нет или он не принят */
export async function botUsername(): Promise<string | null> {
  if (username !== undefined) return username
  const me = await tg<{ username?: string }>('getMe', {})
  // неудачу не запоминаем: токен могли добавить позже, а сеть могла моргнуть
  if (!me?.username) return null
  return (username = me.username)
}
