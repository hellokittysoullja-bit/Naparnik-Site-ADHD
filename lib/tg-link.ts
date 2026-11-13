/**
 * Связка сайта с ботом в Telegram, сторона браузера (сервер — lib/tg/link.ts, lib/tg/site.ts). Жетон устройства
 * лежит в localStorage: по нему сайт передаёт боту план и узнаёт, придёт ли напоминание. Без бота или без жетона
 * всё здесь молча ничего не делает: сайт от бота не зависит.
 *
 * Файл попадает в общий код страниц (его зовёт lib/memory.ts при сохранении плана), поэтому без зависимостей.
 */
const KEY = 'naparnik:tg'

export type TgState = {
  /** бот есть и умеет напоминать (сервер ответил) */
  available: boolean
  /** этот браузер связан с чатом */
  linked: boolean
  /** напоминания в боте включены и час выбран */
  active: boolean
}

type Stored = { token?: string; state?: TgState; at?: number }

const OFF: TgState = { available: false, linked: false, active: false }
const FRESH_MS = 5 * 60_000

function read(): Stored {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Stored
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function write(s: Stored) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
    window.dispatchEvent(new CustomEvent('naparnik:tg'))
  } catch {
    /* без хранилища привязка просто не запомнится */
  }
}

/** Последнее известное состояние без сети (для первого кадра и для тела запроса к коту) */
export function peekTgState(): TgState {
  if (typeof window === 'undefined') return OFF
  return read().state ?? OFF
}

/** смещение от UTC в минутах, как у бота (Москва = 180) */
const tz = () => -new Date().getTimezoneOffset()

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** Спросить сервер, есть ли бот и связан ли этот браузер. force — не смотреть на давность прошлого ответа */
let inFlight: Promise<TgState> | null = null

export function refreshTgState(force = false): Promise<TgState> {
  const s = read()
  if (!force && s.state && s.at && Date.now() - s.at < FRESH_MS) return Promise.resolve(s.state)
  // один запрос на всех, кто спросил одновременно (несколько карточек плана, возврат на вкладку)
  inFlight ??= (async () => {
    try {
      const r = await post<{ available?: boolean; linked?: boolean; active?: boolean }>('/api/tg/status', { token: s.token })
      // сеть не ответила — оставляем прежнее знание: кот не должен перестать обещать из-за одного сбоя
      if (!r) return s.state ?? OFF
      const state: TgState = { available: r.available === true, linked: r.linked === true, active: r.active === true }
      write({ ...read(), state, at: Date.now() })
      return state
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export type PlanForBot = { task?: string; firstStep?: string; startTime?: string }

/** Начать привязку: адрес бота с одноразовым кодом. null — бота нет */
export async function beginTgLink(plan: PlanForBot = {}): Promise<string | null> {
  const r = await post<{ url?: string | null; token?: string }>('/api/tg/link', { plan: { ...plan, tz: tz() }, token: read().token })
  if (!r?.url || !r.token) return null
  // состояние станет «связан», когда человек откроет бота: проверим при возвращении на вкладку
  write({ ...read(), token: r.token, at: 0 })
  return r.url
}

/**
 * Сайт сохранил план: если браузер связан с ботом, бот позовёт на первый шаг. Сбой сети молча игнорируется, а ответ
 * сервера правит знание сайта: чат отвязали или напоминания выключены — строка «Напомню в Telegram» и обещание кота
 * исчезают сразу, а не через пять минут.
 */
export async function pushPlanToTg(plan: PlanForBot): Promise<void> {
  const s = read()
  if (!s.token || !s.state?.linked) return
  const r = await post<{ ok?: boolean; linked?: boolean; active?: boolean }>('/api/tg/plan', { token: s.token, plan: { ...plan, tz: tz() } })
  if (!r || typeof r.linked !== 'boolean') return
  // план не принят ботом (ok: false) — бот остался при старом шаге: «напомню» про этот план было бы неправдой
  write({ ...read(), state: { available: true, linked: r.linked, active: r.linked && r.ok === true && r.active === true }, at: r.ok ? Date.now() : 0 })
}

export async function unlinkTg(): Promise<void> {
  const s = read()
  if (s.token) await post('/api/tg/unlink', { token: s.token })
  write({ state: { ...(s.state ?? OFF), linked: false, active: false }, at: Date.now() })
}
