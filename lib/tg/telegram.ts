import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Тонкая обёртка над Telegram Bot API. Токен живёт только в переменной окружения Vercel (TELEGRAM_BOT_TOKEN) —
 * в коде и в чате его нет. Без токена все вызовы молча возвращают null: сайт от бота не зависит.
 */
const API = 'https://api.telegram.org'

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

/** Итог вызова Bot API: результат или код ошибки (403 — человек заблокировал бота, 429 — слишком часто) */
export type TgResult<T> = { ok: true; result: T } | { ok: false; code: number; description: string; retryAfter?: number }

/** Сколько ждать одного ответа Telegram: зависший запрос не должен съесть время всей функции (maxDuration) */
const CALL_TIMEOUT_MS = 10_000
/** «Too Many Requests»: ждём, сколько сказал Telegram, но не дольше — дальше уже не ответ, а очередь */
const MAX_RETRY_AFTER_S = 5

/**
 * Вызов Bot API, устойчивый к сбоям (как у крупных ботов): таймаут на запрос; 429 — пауза retry_after и повтор
 * (до двух раз); 5xx и обрыв сети — один повтор через 400 мс. Ошибки 4xx, кроме 429, не повторяются: запрос
 * неверен (сообщение удалено, бот заблокирован) и повтор ничего не изменит.
 */
export async function tgCall<T = unknown>(method: string, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<TgResult<T>> {
  const token = botToken()
  if (!token) return { ok: false, code: 0, description: 'no token' }
  let last: TgResult<T> = { ok: false, code: 0, description: 'not sent' }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchImpl(`${API}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number; parameters?: { retry_after?: number } }
      if (json.ok) return { ok: true, result: json.result as T }
      const code = json.error_code ?? res.status
      const retryAfter = json.parameters?.retry_after
      last = { ok: false, code, description: json.description ?? String(res.status), retryAfter }
      if (code === 429 && attempt < 2 && (retryAfter ?? 1) <= MAX_RETRY_AFTER_S) {
        await new Promise((r) => setTimeout(r, (retryAfter ?? 1) * 1000))
        continue
      }
      if (code >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 400))
        continue
      }
      break
    } catch (e) {
      last = { ok: false, code: 0, description: String(e) }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400))
        continue
      }
      break
    }
  }
  // «message is not modified» — правка тем же текстом, не ошибка; остальное пишем в лог без тела запроса
  if (!/not modified/i.test(last.ok ? '' : last.description)) console.error(`[tg] ${method}: ${last.ok ? '' : `${last.code} ${last.description}`}`)
  return last
}

/** Человек заблокировал бота или удалил аккаунт: писать ему бессмысленно, напоминания надо снять */
export function isGone(r: TgResult<unknown>): boolean {
  return !r.ok && r.code === 403 && /blocked|deactivated|kicked|not found/i.test(r.description)
}

/** Ответ Telegram или null (нет токена, сеть, ошибка API — пишем в лог и не роняем обработку) */
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const r = await tgCall<T>(method, body)
  return r.ok ? (r.result ?? (true as T)) : null
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
