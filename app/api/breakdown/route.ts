import { z } from 'zod'
import { breakdown } from '@/lib/ai/agents/breakdown'
import { newTurn } from '@/lib/ai/core/turn'
import { ClientSnapshotMemory } from '@/lib/ai/memory/provider'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * «Раздроби мне задачу» — веб-адаптер задачи lib/ai/agents/breakdown.ts. Зовут Фокус («Раздроби») и знакомство
 * («Подскажи» со своим делом, lib/ai-client.ts) — у знакомства есть контекст: сфера и помеха (подписи ответов).
 */
export const maxDuration = 15

const MAX_BODY = 32 * 1024 // дело + снимок памяти (20 фактов, 8 навыков, 5 стартов ≈ 8–12 КБ кириллицей)

// дело длиннее 300 символов обрезаем, а не отклоняем: человек не должен получить отказ за подробность
const Body = z.object({
  task: z.string().trim().min(3).transform((s) => s.slice(0, 300)),
  context: z
    .object({ sphere: z.string().max(40).optional(), blocker: z.string().max(60).optional() })
    .optional(),
  // память человека (Фокус): проверяется отдельно, странное поле даёт дробление без памяти, а не отказ
  memory: z.unknown().optional(),
  // «сколько сил сейчас» и размер шагов — только ключи; подписи для модели подставляет сервер
  energy: z.enum(['low', 'mid', 'high']).optional().catch(undefined),
  fineness: z.enum(['fine', 'normal', 'coarse']).optional().catch(undefined),
})

const ENERGY = { low: 'мало', mid: 'средне', high: 'много' } as const
const FINENESS = { fine: 'мельче', normal: undefined, coarse: 'крупнее' } as const

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'breakdown', 10)
  const parsed = Body.safeParse(await readJsonBody(req, MAX_BODY))
  if (!parsed.success) return Response.json({ steps: null }, { status: 400 })
  const { task, context, memory, energy, fineness } = parsed.data
  const extra = { 'Силы сейчас': energy ? ENERGY[energy] : undefined, 'Размер шагов': fineness ? FINENESS[fineness] : undefined }
  const r = await breakdown({
    task,
    memory: new ClientSnapshotMemory(memory),
    context: context ? { Сфера: context.sphere, 'Что мешает': context.blocker, ...extra } : energy || fineness ? extra : undefined,
    ctx: newTurn({ task: context ? 'onboarding-first-step' : 'breakdown' }),
    signal: req.signal,
  })
  return Response.json(r.kind === 'care' ? { steps: null, reply: r.reply } : { steps: r.steps, minutes: r.minutes, source: r.source })
})
