import { z } from 'zod'

/**
 * Снимок памяти о человеке — форма, в которой память входит в ход (ядро не знает, где она хранится).
 * Сейчас снимок присылает устройство (localStorage), значит это ДАННЫЕ ОТ НЕДОВЕРЕННОГО ИСТОЧНИКА: строгая форма,
 * потолки длины, обрезка вместо отказа (длинный шаг живого человека не должен выключать ИИ), а в промпт — только
 * через блок данных (render.ts), никогда в системную инструкцию.
 */
const clip = (n: number) => z.string().transform((s) => s.slice(0, n))

export const MEMORY_LIMITS = { notes: 6, starts: 5, finds: 3, field: 300 } as const

export const MemorySnapshotSchema = z.object({
  plan: z
    .object({ forDate: clip(40), task: clip(300), firstStep: clip(300), startTime: clip(40).optional() })
    .nullable(),
  recentStarts: z
    .array(z.object({ date: clip(40), label: clip(300), minutes: z.number().min(0).max(600), fromPlan: z.boolean() }))
    .max(MEMORY_LIMITS.starts),
  patterns: z.object({
    totalStarts: z.number().int().min(0).max(1_000_000),
    runningDays: z.number().int().min(0).max(100_000),
    favoriteHour: z.number().int().min(0).max(23).nullable(),
    lastStartDate: clip(40).nullable(),
    daysAway: z.number().int().min(0).max(100_000).nullable().optional(),
  }),
  notes: z.array(clip(MEMORY_LIMITS.field)).max(MEMORY_LIMITS.notes),
  recentFinds: z
    .array(z.object({ name: clip(80), rarity: clip(20), date: clip(40) }))
    .max(MEMORY_LIMITS.finds)
    .optional(),
  companionName: clip(24).nullable().optional(),
})

export type MemorySnapshot = z.infer<typeof MemorySnapshotSchema>

/** Чужая форма → разговор без памяти, а не отказ (иначе ИИ молчал бы, пока странная запись не уйдёт) */
export function parseSnapshot(raw: unknown): MemorySnapshot | null {
  const r = MemorySnapshotSchema.nullable().safeParse(raw ?? null)
  return r.success ? r.data : null
}
