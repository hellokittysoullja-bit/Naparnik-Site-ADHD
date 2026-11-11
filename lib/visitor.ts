/**
 * Анонимный посетитель и источник перехода — общее для proxy.ts, /api/visit и клиента (без зависимостей от Node и React).
 *
 * `nid` — случайный ID посетителя, как `logged_out_uuid` у Duolingo (проверено 08.11: сервер ставит его новому
 * посетителю на 1 год). Ставит его СЕРВЕР (POST /api/visit, httpOnly): Safari живёт cookie, записанные скриптом, ~7 дней,
 * серверные — нет. Это удобство, не источник истины: из встроенного браузера Instagram/TikTok в Safari переносится
 * только адрес, поэтому шаг и ответы воронки живут в адресе (research/13, план «школа 1», фаза 0–1).
 *
 * Источник (`utm_*`, `src`) — первый и последний вход, чтобы считать, какой ролик приводит людей и деньги.
 * Текст задачи, почта, имя в адрес и в эти cookie не попадают никогда.
 */

export const NID_COOKIE = 'nid'
export const HOME_COOKIE = 'naparnik_home'
export const FIRST_TOUCH_COOKIE = 'n_ft'
export const LAST_TOUCH_COOKIE = 'n_lt'

export const YEAR_S = 31_536_000
export const ATTRIBUTION_MAX_AGE_S = 90 * 86_400

/** Параметры источника, которые протягиваются через все шаги воронки до сохранения прогресса */
export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src'] as const
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number]
export type Attribution = Partial<Record<AttributionKey, string>>

/** Разовые параметры переезда со старого домена на новый (proxy.ts): переносят анонимный ID и метку «свой» */
export const HANDOFF_NID = '_nid'
export const HANDOFF_HOME = '_home'

/** Старый адрес сайта: когда появится свой домен, отсюда — постоянный редирект на CANONICAL_HOST */
export const LEGACY_HOST = 'adhd-naparnik.vercel.app'

const NID_RE = /^[A-Za-z0-9_-]{22}$/

export function isNid(v: string | null | undefined): v is string {
  return typeof v === 'string' && NID_RE.test(v)
}

/** 128 случайных бит в base64url — 22 символа, только латиница, цифры, «-» и «_» */
export function newNid(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Значение метки: латиница, цифры, точка, дефис, подчёркивание; не длиннее 64 символов. Всё остальное отбрасываем:
// в метку может прийти что угодно, а она уходит в cookie, аналитику и профиль.
const VALUE_RE = /^[A-Za-z0-9._-]{1,64}$/

export function readAttribution(params: URLSearchParams): Attribution {
  const out: Attribution = {}
  for (const key of ATTRIBUTION_KEYS) {
    const raw = params.get(key)
    if (raw == null) continue
    const v = raw.trim().toLowerCase()
    if (VALUE_RE.test(v)) out[key] = v
  }
  return out
}

export function hasAttribution(a: Attribution): boolean {
  return Object.keys(a).length > 0
}

/** Значение для cookie: JSON (Next сам кодирует его при записи и раскодирует при чтении) */
export function encodeAttribution(a: Attribution): string {
  return JSON.stringify({ ...a, t: Date.now() })
}

/** Обратное к encodeAttribution; битое или чужое значение — пусто */
export function decodeAttribution(raw: string | undefined): Attribution & { t?: number } {
  if (!raw) return {}
  try {
    const text = raw.startsWith('%') ? decodeURIComponent(raw) : raw
    const obj = JSON.parse(text) as Record<string, unknown>
    const params = new URLSearchParams()
    for (const key of ATTRIBUTION_KEYS) if (typeof obj[key] === 'string') params.set(key, obj[key] as string)
    const out: Attribution & { t?: number } = readAttribution(params)
    if (typeof obj.t === 'number' && Number.isFinite(obj.t)) out.t = obj.t
    return out
  } catch {
    return {}
  }
}

/**
 * Добавить к внутренней ссылке источник из текущего адреса (только наши ключи). Так метка ролика доходит до
 * сохранения прогресса, даже если человек по пути открыл ссылку в Safari: туда переносится только адрес.
 */
export function withAttribution(href: string, from: string): string {
  const a = readAttribution(new URLSearchParams(from))
  if (!hasAttribution(a)) return href
  const [path, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  for (const [k, v] of Object.entries(a)) if (!params.has(k)) params.set(k, v as string)
  const q = params.toString()
  return q ? `${path}?${q}` : path
}
