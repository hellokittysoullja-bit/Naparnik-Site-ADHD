import { z } from 'zod'
import { factRejection } from '@/lib/ai/memory/write-guard'
import { applyPlan, hourOf } from './bot'
import { deviceOf, isToken, LINK_PREFIX, startLink } from './link'
import type { Store, TgUser } from './store'

/**
 * Сторона сайта в связке «сайт ↔ бот» (lib/tg/link.ts): начать привязку, узнать состояние, передать план, отвязаться.
 * Чистая логика над хранилищем: маршруты app/api/tg/* только проверяют запрос и зовут её.
 *
 * План приходит из браузера, то есть это недоверенный текст, который бот потом покажет человеку в напоминании:
 * длина режется, а дело с запрещённым содержанием (кризис, здоровье в подробностях, ссылки, «указания коту») в бот
 * не уходит вовсе — теми же правилами, что память кота.
 */
const text = (max: number) => z.string().trim().min(1).transform((s) => s.slice(0, max))

export const PlanSchema = z.object({
  task: text(200).optional(),
  firstStep: text(160).optional(),
  startTime: text(40).optional(),
  /** смещение от UTC в минутах (как у бота: Москва = 180) */
  tz: z.number().int().min(-720).max(840).optional(),
})
export type SitePlan = z.infer<typeof PlanSchema>

const planOk = (p: SitePlan) => [p.task, p.firstStep, p.startTime].every((t) => t === undefined || factRejection(t) === null || factRejection(t) === 'health' || factRejection(t) === 'documents' || factRejection(t) === 'money' || factRejection(t) === 'contact')

/** дело про врача, документы или деньги — обычное дело человека; кризис, ссылки и указания коту — нет */
export function cleanPlan(p: SitePlan): SitePlan {
  return planOk(p) ? p : { tz: p.tz }
}

export async function beginLink(store: Store, botName: string, plan: SitePlan, token?: string) {
  const { code, token: own } = await startLink(store, cleanPlan(plan), token)
  return { url: `https://t.me/${botName}?start=${LINK_PREFIX}${code}`, token: own }
}

async function userOf(store: Store, token: unknown): Promise<TgUser | null> {
  if (!isToken(token)) return null
  const device = deviceOf(token)
  const chat = await store.chatOfDevice(device)
  const u = chat === null ? null : await store.getUser(chat)
  // чат отвязали в боте или привязали к другому устройству — этот жетон больше ничего не значит
  return u && u.device === device ? u : null
}

export type LinkStatus = { linked: false } | { linked: true; hour: number | null; active: boolean }

export async function linkStatus(store: Store, token: unknown): Promise<LinkStatus> {
  const u = await userOf(store, token)
  if (!u) return { linked: false }
  return { linked: true, hour: u.hour ?? null, active: !u.stopped && !u.quiet && u.hour != null }
}

/** Сайт сохранил план: бот позовёт на его первый шаг. Возвращает час, в который напишет (null — времени нет) */
export async function pushPlan(store: Store, token: unknown, plan: SitePlan, reschedule: (u: TgUser) => Promise<void>): Promise<{ ok: boolean; hour: number | null }> {
  const u = await userOf(store, token)
  const p = cleanPlan(plan)
  if (!u || !p.firstStep) return { ok: false, hour: null }
  if (typeof p.tz === 'number') u.tz = Math.round(p.tz / 30) * 30
  applyPlan(u, p)
  await store.saveUser(u)
  await reschedule(u)
  return { ok: true, hour: hourOf(p.startTime) ?? u.hour ?? null }
}

export async function unlink(store: Store, token: unknown): Promise<boolean> {
  const u = await userOf(store, token)
  if (!u) return false
  await store.bindDevice(u.device!, null)
  u.device = undefined
  await store.saveUser(u)
  return true
}
