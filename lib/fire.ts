import type { StartEntry } from '@/lib/memory'

/**
 * Огонь на хвосте (владелец 22.11, функция 3). Две разные шкалы:
 *  1. Уровень — по сумме всех начатых дел за всё время, никогда не падает (нет потерь и вины).
 *  2. Яркость — по последним дням: без активности огонь тускнеет до тёплого уголька, но не гаснет.
 * Вместо серии — мягкая цель недели «Огненные дни: N из 7», неделя обнуляется сама.
 */
export const LEVELS = [
  { name: 'Искра', from: 1 },
  { name: 'Огонёк', from: 10 },
  { name: 'Пламя', from: 30 },
  { name: 'Костёр', from: 75 },
  { name: 'Феникс', from: 150 },
] as const

export type FireLevel = (typeof LEVELS)[number]['name']

/** уровень по числу начатых дел; до первого — нет уровня */
export function levelOf(lit: number): FireLevel | null {
  let name: FireLevel | null = null
  for (const l of LEVELS) if (lit >= l.from) name = l.name
  return name
}

/** «Подожжено: 37 · Пламя»; новичку — пусто (до первого дела хвалить нечего) */
export function litLine(lit: number): string | null {
  const lvl = levelOf(lit)
  return lvl ? `Подожжено: ${lit} · ${lvl}` : null
}

const DAY = 86_400_000
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Яркость огня 0.25–1: сегодня начал — 1; каждый день без дела отнимает долю, но ниже уголька (0,25) не падает.
 * Возвращение после перерыва вспыхивает сразу — это делает экран, а не формула.
 */
export function brightnessOf(starts: readonly Pick<StartEntry, 'date'>[], now = new Date()): number {
  if (!starts.length) return 0.25
  const last = starts.reduce((m, s) => (s.date > m ? s.date : m), starts[0].date)
  const [y, mo, d] = last.split('-').map(Number)
  const days = Math.max(0, Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, mo - 1, d).getTime()) / DAY))
  return Math.max(0.25, 1 - days * 0.15)
}

/** «Огненные дни»: сколько разных дней этой недели (с понедельника) было хоть одно начатое дело */
export function fireDaysThisWeek(starts: readonly Pick<StartEntry, 'date'>[], now = new Date()): number {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const from = dayKey(monday)
  const today = dayKey(now)
  return new Set(starts.map((s) => s.date).filter((d) => d >= from && d <= today)).size
}
