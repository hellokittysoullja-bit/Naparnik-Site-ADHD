import { z } from 'zod'
import { FACT_CATEGORIES, FACT_LIMITS, type FactCategory } from './facts'

/**
 * Снимок памяти о человеке — форма, в которой память входит в ход (ядро не знает, где она хранится).
 * Сейчас снимок присылает устройство (localStorage), значит это ДАННЫЕ ОТ НЕДОВЕРЕННОГО ИСТОЧНИКА: строгая форма,
 * потолки длины, обрезка вместо отказа (длинный шаг живого человека не должен выключать ИИ), а в промпт — только
 * через блок данных (render.ts), никогда в системную инструкцию.
 */
const clip = (n: number) => z.string().transform((s) => s.slice(0, n))

export const MEMORY_LIMITS = { notes: 6, starts: 5, finds: 3, field: 300, facts: FACT_LIMITS.active } as const

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const oneOf = <T extends string>(values: readonly [T, ...T[]]) => z.enum(values).optional().catch(undefined)

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
    // выводы кода по стартам (ярус Т4) — с основанием «n из of», без него кот не вправе говорить «обычно»
    startWindow: z
      .object({ from: z.number().int().min(0).max(23), to: z.number().int().min(0).max(23), n: z.number().int().min(0), of: z.number().int().min(1) })
      .nullable()
      .optional()
      .catch(undefined),
    durations: z
      .array(z.object({ minutes: z.number().int().min(1).max(180), done: z.number().int().min(0), of: z.number().int().min(1) }))
      .max(3)
      .optional()
      .catch(undefined),
  }),
  // факты о человеке (ярус Т3): номер факта для модели — его место в этом списке (устройство помнит, какой id
  // стоял на каком месте). Прежнее поле notes принимается от старых версий страницы до обновления
  facts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES as [FactCategory, ...FactCategory[]]),
        text: clip(FACT_LIMITS.text),
        since: day.optional().catch(undefined),
      }),
    )
    .max(MEMORY_LIMITS.facts)
    .optional(),
  notes: z.array(clip(MEMORY_LIMITS.field)).max(MEMORY_LIMITS.notes).optional(),
  // ответы знакомства (ярус Т1) — ключи вариантов, подписи подставляет сервер (memory/render.ts)
  profile: z
    .object({
      sphere: oneOf(['study', 'work', 'home', 'message', 'unsure']),
      hanging: oneOf(['day', 'week', 'month', 'unknown']),
      blocker: oneOf(['where', 'phone', 'fear', 'boring', 'tired']),
      motive: oneOf(['relief', 'people', 'safety', 'rest', 'proof']),
    })
    .nullable()
    .optional()
    .catch(undefined),
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
