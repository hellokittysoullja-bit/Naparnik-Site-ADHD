import { createHash, randomBytes } from 'node:crypto'
import type { LinkPayload, Store } from './store'

/**
 * Привязка сайта к чату в Telegram без аккаунтов (как парные коды у мессенджеров на втором устройстве):
 *  1. сайт просит код: сервер выдаёт одноразовый код (15 минут) и жетон устройства; жетон остаётся в браузере;
 *  2. человек открывает бота по ссылке с кодом: бот читает код (один раз), связывает чат с отпечатком жетона и берёт
 *     то, что сайт передал при привязке (дело, шаг, время);
 *  3. дальше сайт по жетону сообщает боту новый план, узнаёт состояние и может отвязаться.
 * Сервер хранит только отпечаток жетона (sha256): по базе чужой жетон не восстановить. Кто знает жетон, тот владеет
 * напоминаниями этого чата, поэтому он не уходит ни в адреса, ни в журнал.
 */
export const LINK_PREFIX = 'l_'
const CODE_RE = /^[A-Za-z0-9_-]{22}$/
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export const deviceOf = (token: string) => createHash('sha256').update(`naparnik-tg-device:${token}`).digest('base64url')

export const isToken = (v: unknown): v is string => typeof v === 'string' && TOKEN_RE.test(v)

/** код из «/start l_<код>»; null — это не привязка (метка источника или пусто) */
export function linkCode(startPayload: string): string | null {
  if (!startPayload.startsWith(LINK_PREFIX)) return null
  const code = startPayload.slice(LINK_PREFIX.length)
  return CODE_RE.test(code) ? code : null
}

export type LinkStart = { code: string; token: string }

/** Сайт начинает привязку: код для ссылки на бота и жетон для браузера */
export async function startLink(store: Store, plan: Omit<LinkPayload, 'device'>, token?: string): Promise<LinkStart> {
  // повторная привязка с того же устройства — тот же жетон: чат остаётся связан с ним, если человек передумал
  const own = isToken(token) ? token : randomBytes(32).toString('base64url')
  const code = randomBytes(16).toString('base64url')
  await store.putLink(code, { ...plan, device: deviceOf(own) })
  return { code, token: own }
}
