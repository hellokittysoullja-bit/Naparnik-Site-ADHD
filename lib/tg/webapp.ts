import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Данные запуска мини-аппа (initData): Telegram подписывает их ключом бота, поэтому сервер точно знает, кто открыл
 * мини-апп, без входа и паролей (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
 * Подпись: HMAC-SHA256 от строк «ключ=значение» всех полей, кроме hash, по алфавиту через перевод строки; ключ —
 * HMAC-SHA256(токен бота) с солью «WebAppData». Старше суток — не принимаем: украденная строка недолго годится.
 */
export const INIT_MAX_AGE_S = 24 * 3600

/** «ключ=значение» по алфавиту ключей (не всей строки: «a1=» иначе встал бы раньше «a=») */
const byKey = (f: [string, string][]) => f.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`)

export type WebAppUser = { id: number; firstName?: string }

export function verifyInitData(raw: string, botToken: string, nowMs = Date.now(), maxAgeS = INIT_MAX_AGE_S): WebAppUser | null {
  if (!raw || raw.length > 4096 || !botToken) return null
  let params: URLSearchParams
  try {
    params = new URLSearchParams(raw)
  } catch {
    return null
  }
  const hash = params.get('hash')
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null
  const fields: [string, string][] = []
  params.forEach((v, k) => {
    if (k !== 'hash') fields.push([k, v])
  })
  const pairs = byKey(fields)
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calc = createHmac('sha256', secret).update(pairs.join('\n')).digest()
  const given = Buffer.from(hash, 'hex')
  if (given.length !== calc.length || !timingSafeEqual(given, calc)) return null
  const auth = Number(params.get('auth_date'))
  if (!Number.isFinite(auth) || auth <= 0 || nowMs / 1000 - auth > maxAgeS || auth - nowMs / 1000 > 300) return null
  try {
    const u = JSON.parse(params.get('user') ?? 'null') as { id?: unknown; first_name?: unknown } | null
    if (!u || typeof u.id !== 'number' || !Number.isSafeInteger(u.id) || u.id <= 0) return null
    return { id: u.id, firstName: typeof u.first_name === 'string' ? u.first_name : undefined }
  } catch {
    return null
  }
}

/** подписать initData (для тестов: так же, как Telegram) */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const pairs = byKey(Object.entries(fields))
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex')
  const q = new URLSearchParams(fields)
  q.set('hash', hash)
  return q.toString()
}
