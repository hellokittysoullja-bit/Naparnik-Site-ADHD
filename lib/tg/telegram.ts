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
  if (!got || !want || got.length !== want.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

/** Подпись ссылок «Сесть рядом» (чей клик — чтобы считать вернувшихся), подделать без токена нельзя */
export function sign(value: string): string {
  const token = botToken() ?? 'no-token'
  return createHmac('sha256', token).update(value).digest('base64url').slice(0, 16)
}
