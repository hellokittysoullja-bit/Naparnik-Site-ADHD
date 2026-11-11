/**
 * Перенос анонимного ID и метки «свой» со старого адреса на свой домен (план «школа 1», фаза 0) — подписанным жетоном.
 *
 * Раньше переносили голым `?_nid=<ID>&_home=1`, и proxy ставил его любому, кто открыл такую ссылку, — на любом домене,
 * даже без переезда (research/19-perf-security/security-audit.md §2.2: фиксация ID). Теперь:
 * - жетон выдаёт только функция на СТАРОМ адресе (app/api/handoff) из cookie самого человека;
 * - внутри — ID, метка, срок (5 минут) и домен назначения; подпись HMAC-SHA256 серверным секретом VISIT_SECRET;
 * - принимает только proxy на домене CANONICAL_HOST; чужой, просроченный, подделанный или без секрета — игнорируется.
 * WebCrypto — работает и в Node, и в proxy.
 */
import { isNid } from '@/lib/visitor'

export const HANDOFF_TOKEN = '_t'
export const HANDOFF_TTL_MS = 5 * 60_000
const CLOCK_SKEW_MS = 60_000

export type Handoff = { nid: string | null; home: boolean; host: string; exp: number }

const enc = new TextEncoder()
const b64url = (bytes: Uint8Array) => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Секрет короче 32 символов не принимаем: подпись коротким секретом подбирается */
export function usableSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= 32
}

export async function signHandoff(h: Handoff, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ n: h.nid, h: h.home ? 1 : 0, d: h.host, e: h.exp })))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)))
  return `${body}.${b64url(sig)}`
}

/** Жетон → данные, только если подпись верна, срок не вышел и домен назначения — этот. Иначе null. */
export async function verifyHandoff(
  token: string | null,
  secret: string | undefined,
  host: string,
  now = Date.now(),
): Promise<Handoff | null> {
  if (!token || !usableSecret(secret) || token.length > 512) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(body))
    if (!ok) return null
    const o = JSON.parse(new TextDecoder().decode(fromB64url(body))) as { n?: unknown; h?: unknown; d?: unknown; e?: unknown }
    // жетон подписывает одна машина, проверяет другая: минута запаса на расхождение часов, иначе при отставании
    // часов проверяющей свежий жетон считался бы «из будущего» и человек молча терял ID
    if (typeof o.e !== 'number' || o.e < now || o.e > now + HANDOFF_TTL_MS + CLOCK_SKEW_MS) return null
    if (typeof o.d !== 'string' || o.d !== host.toLowerCase()) return null
    const nid = isNid(o.n as string) ? (o.n as string) : null
    return { nid, home: o.h === 1, host: o.d, exp: o.e }
  } catch {
    return null
  }
}
