import { z } from 'zod'
import { stripInvisible } from '@/lib/ai/guards/normalize'
import { checkOutput } from '@/lib/ai/guards/output'
import { factRejection } from '@/lib/ai/memory/write-guard'
import { applyPlan, recentHistory } from './bot'
import { deviceOf, isToken, LINK_PREFIX, startLink } from './link'
import type { Store, TgUser } from './store'

/**
 * Сторона сайта в связке «сайт ↔ бот» (lib/tg/link.ts): начать привязку, узнать состояние, передать план, отвязаться.
 * Чистая логика над хранилищем: маршруты app/api/tg/* только проверяют запрос и зовут её.
 *
 * План приходит из браузера, то есть это недоверенный текст, который бот потом покажет человеку в напоминании:
 * длина режется, а дело с кризисом, ссылкой, телефоном, невидимыми символами или «указаниями коту» в бот не уходит
 * вовсе. Врач, документы, деньги — обычные дела человека, они проходят.
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

/** причины правил вывода кота, с которыми текст в бот не идёт: ссылка, телефон, «я ChatGPT», пусто */
const BLOCKING = new Set(['link', 'phone', 'identity', 'empty', 'length'])

function fieldOk(t: string) {
  if (stripInvisible(t) !== t) return false
  const why = factRejection(t)
  if (why === 'injection' || why === 'crisis') return false
  // ссылки и телефоны проверяем отдельно: factRejection называет первую причину («здоровье», «деньги») и до них не доходит
  const verdict = checkOutput(t, { maxChars: 400 })
  return verdict.ok || !BLOCKING.has(verdict.reason)
}

const planOk = (p: SitePlan) => [p.task, p.firstStep, p.startTime].every((t) => t === undefined || fieldOk(t))

/** дело про врача, документы или деньги — обычное дело человека; кризис, ссылки, телефоны и указания коту — нет */
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

/** придёт ли следующее напоминание само: не «Стоп», не пауза, час выбран */
const isActive = (u: TgUser, now: number) => !u.stopped && !u.quiet && u.hour != null && !(u.pausedUntil && u.pausedUntil > now)

export async function linkStatus(store: Store, token: unknown, now = Date.now()): Promise<LinkStatus> {
  const u = await userOf(store, token)
  if (!u) return { linked: false }
  return { linked: true, hour: u.hour ?? null, active: isActive(u, now) }
}

export type PushResult =
  | { ok: false; linked: boolean; hour: null; active: false }
  | { ok: true; linked: true; hour: number | null; active: boolean }

/**
 * Сайт сохранил план: бот позовёт на его первый шаг. linked: false — жетон больше ничего не значит (сайт обновит своё
 * знание); ok: false при linked: true — текст плана не прошёл проверку, бот остался при старом шаге.
 * «Стоп» и паузу план с сайта не снимает (их снимает человек в боте), но человек, который планирует на сайте, жив:
 * редкий режим (раз в 3–7 дней) и прощание сбрасываются.
 */
export async function pushPlan(store: Store, token: unknown, plan: SitePlan, reschedule: (u: TgUser) => Promise<void>, now = Date.now()): Promise<PushResult> {
  const u = await userOf(store, token)
  if (!u) return { ok: false, linked: false, hour: null, active: false }
  const p = cleanPlan(plan)
  if (!p.firstStep) return { ok: false, linked: true, hour: null, active: false }
  if (typeof p.tz === 'number') u.tz = Math.round(p.tz / 30) * 30
  applyPlan(u, p, { resume: false })
  u.lastActive = now
  u.ignored = 0
  u.quiet = false
  u.history = recentHistory(u, now)
  await store.saveUser(u)
  await reschedule(u)
  return { ok: true, linked: true, hour: u.hour ?? null, active: isActive(u, now) }
}

export async function unlink(store: Store, token: unknown): Promise<boolean> {
  const u = await userOf(store, token)
  if (!u) return false
  await store.bindDevice(u.device!, null)
  u.device = undefined
  await store.saveUser(u)
  return true
}
