import type { Sphere } from '@/lib/onboarding'

export type Tone = 'soft' | 'short' | 'humor'

/** Всё, что бот помнит о человеке. Тексты сообщений не храним — только текущее дело и шаг, чтобы звать по делу. */
export type TgUser = {
  id: number
  createdAt: number
  src?: string
  sphere?: Sphere
  task?: string
  steps?: string[]
  stepIdx?: number
  /** Час напоминания по местному времени (9–21) или null — «не надо» */
  hour?: number | null
  /** Смещение от UTC в минутах; по умолчанию Москва */
  tz: number
  tone?: Tone
  /** Чего бот ждёт текстом: время («сколько у тебя сейчас») или час напоминания */
  awaiting?: 'time' | 'hour' | null
  /** Напоминаний подряд без ответа — по нему бот пишет реже */
  ignored: number
  lastActive: number
  lastSent?: number
  pausedUntil?: number
  stopped?: boolean
  /** Попрощался после 3 недель тишины — до первого сообщения человека больше не пишет */
  quiet?: boolean
  variant: number
  clicks?: number
  /** план с сайта или из разговора с котом: о нём напоминание */
  plan?: { task: string; firstStep: string; startTime?: string }
  /** отпечаток устройства, с которым связан чат (lib/tg/link.ts): сайт присылает план по своему жетону */
  device?: string
  /**
   * последние реплики разговора с котом: чтобы кот понимал «да, давай» и «а другой шаг?». Не память о человеке:
   * не больше HISTORY_MAX реплик и не старше HISTORY_TTL_MS, потом стираются при следующем сообщении
   */
  history?: { who: 'user' | 'cat'; text: string; at: number }[]
}

/** Что сайт передал боту при привязке (живёт LINK_TTL_S секунд, читается один раз) */
export type LinkPayload = { device: string; task?: string; firstStep?: string; startTime?: string; tz?: number }

export const HISTORY_MAX = 12
export const HISTORY_TTL_MS = 24 * 3_600_000
export const LINK_TTL_S = 15 * 60

export interface Store {
  getUser(id: number): Promise<TgUser | null>
  saveUser(u: TgUser): Promise<void>
  /** стереть всё о человеке: запись, расписание, связь с устройством */
  deleteUser(u: TgUser): Promise<void>
  /** Поставить следующее напоминание (мс UTC) или снять, если null */
  schedule(id: number, at: number | null): Promise<void>
  /** Кому пора написать */
  due(now: number, limit: number): Promise<number[]>
  countSource(tag: string): Promise<void>
  /** одноразовый код привязки сайта к чату */
  putLink(code: string, payload: LinkPayload): Promise<void>
  /** прочитать и стереть код: второй раз тем же кодом привязаться нельзя */
  takeLink(code: string): Promise<LinkPayload | null>
  /** устройство → чат (null — отвязать) */
  bindDevice(device: string, chatId: number | null): Promise<void>
  chatOfDevice(device: string): Promise<number | null>
}

const KEY = (id: number) => `tg:u:${id}`
const DUE = 'tg:due'

/**
 * Upstash Redis через REST (без SDK): Vercel сам прописывает KV_REST_API_URL/KV_REST_API_TOKEN, когда владелец
 * подключает Upstash в разделе Storage; старые названия UPSTASH_REDIS_REST_* тоже понимаем.
 */
export class RedisStore implements Store {
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async cmd<T>(...args: (string | number)[]): Promise<T | null> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(args),
    })
    const json = (await res.json()) as { result?: T; error?: string }
    if (json.error) throw new Error(`redis: ${json.error}`)
    return json.result ?? null
  }

  async getUser(id: number) {
    const raw = await this.cmd<string>('GET', KEY(id))
    return raw ? (JSON.parse(raw) as TgUser) : null
  }
  async saveUser(u: TgUser) {
    await this.cmd('SET', KEY(u.id), JSON.stringify(u))
  }
  async deleteUser(u: TgUser) {
    await this.cmd('DEL', KEY(u.id))
    await this.cmd('ZREM', DUE, String(u.id))
    if (u.device) await this.cmd('DEL', `tg:dev:${u.device}`)
  }
  async schedule(id: number, at: number | null) {
    if (at === null) await this.cmd('ZREM', DUE, String(id))
    else await this.cmd('ZADD', DUE, at, String(id))
  }
  async due(now: number, limit: number) {
    const ids = await this.cmd<string[]>('ZRANGEBYSCORE', DUE, '-inf', now, 'LIMIT', 0, limit)
    return (ids ?? []).map(Number)
  }
  async countSource(tag: string) {
    await this.cmd('HINCRBY', 'tg:src', tag, 1)
  }
  async putLink(code: string, payload: LinkPayload) {
    await this.cmd('SET', `tg:link:${code}`, JSON.stringify(payload), 'EX', LINK_TTL_S)
  }
  async takeLink(code: string) {
    const raw = await this.cmd<string>('GETDEL', `tg:link:${code}`)
    return raw ? (JSON.parse(raw) as LinkPayload) : null
  }
  async bindDevice(device: string, chatId: number | null) {
    if (chatId === null) await this.cmd('DEL', `tg:dev:${device}`)
    else await this.cmd('SET', `tg:dev:${device}`, String(chatId))
  }
  async chatOfDevice(device: string) {
    const raw = await this.cmd<string>('GET', `tg:dev:${device}`)
    return raw ? Number(raw) : null
  }
}

/** Память без базы: для локальной проверки и тестов. На проде без Upstash бот отвечает, но напоминаний нет. */
export class MemoryStore implements Store {
  users = new Map<number, TgUser>()
  dueAt = new Map<number, number>()
  sources = new Map<string, number>()
  async getUser(id: number) {
    const u = this.users.get(id)
    return u ? structuredClone(u) : null
  }
  async saveUser(u: TgUser) {
    this.users.set(u.id, structuredClone(u))
  }
  async deleteUser(u: TgUser) {
    this.users.delete(u.id)
    this.dueAt.delete(u.id)
    if (u.device) this.devices.delete(u.device)
  }
  async schedule(id: number, at: number | null) {
    if (at === null) this.dueAt.delete(id)
    else this.dueAt.set(id, at)
  }
  async due(now: number, limit: number) {
    return [...this.dueAt].filter(([, at]) => at <= now).sort((a, b) => a[1] - b[1]).slice(0, limit).map(([id]) => id)
  }
  async countSource(tag: string) {
    this.sources.set(tag, (this.sources.get(tag) ?? 0) + 1)
  }
  links = new Map<string, { payload: LinkPayload; until: number }>()
  devices = new Map<string, number>()
  /** часы для тестов срока кода */
  now: () => number = () => Date.now()
  async putLink(code: string, payload: LinkPayload) {
    this.links.set(code, { payload, until: this.now() + LINK_TTL_S * 1000 })
  }
  async takeLink(code: string) {
    const hit = this.links.get(code)
    this.links.delete(code)
    return hit && hit.until > this.now() ? hit.payload : null
  }
  async bindDevice(device: string, chatId: number | null) {
    if (chatId === null) this.devices.delete(device)
    else this.devices.set(device, chatId)
  }
  async chatOfDevice(device: string) {
    return this.devices.get(device) ?? null
  }
}

const memory = new MemoryStore()

export function getStore(): { store: Store; persistent: boolean } {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return { store: new RedisStore(url, token), persistent: true }
  return { store: memory, persistent: false }
}
