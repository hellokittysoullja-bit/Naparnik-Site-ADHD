import { z } from 'zod'
import { breakdown } from '@/lib/ai/agents/breakdown'
import { newTurn } from '@/lib/ai/core/turn'
import { ClientSnapshotMemory } from '@/lib/ai/memory/provider'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * Разбивка дела на шаги до конца — веб-адаптер задачи lib/ai/agents/breakdown.ts. Зовут Фокус («Раздроби») и знакомство
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
  // «Ещё мельче» для одного шага: всё дело и соседние шаги, чтобы подшаги были внутри дела и не повторяли план
  // (у гоблина цепочка родителей — главное, что делает глубокое дробление осмысленным). Странное поле — без него
  parent: z.string().trim().max(120).optional().catch(undefined),
  siblings: z.array(z.string().trim().max(120)).max(12).optional().catch(undefined),
  // «Ещё мельче»: план из базы человек уже видел — нужен другой, его пишет модель
  more: z.boolean().optional().catch(undefined),
})

const ENERGY = { low: 'мало', mid: 'средне', high: 'много' } as const
const FINENESS = { fine: 'мельче', normal: undefined, coarse: 'крупнее' } as const

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'breakdown', 10)
  const parsed = Body.safeParse(await readJsonBody(req, MAX_BODY))
  if (!parsed.success) return Response.json({ steps: null }, { status: 400 })
  const { task, context, memory, energy, fineness, parent, siblings, more } = parsed.data
  const extra = {
    'Это часть дела': parent || undefined,
    'Соседние шаги': parent && siblings?.length ? siblings.filter(Boolean).join('; ') : undefined,
    'Силы сейчас': energy ? ENERGY[energy] : undefined,
    'Размер шагов': fineness ? FINENESS[fineness] : undefined,
  }
  const hasExtra = Object.values(extra).some(Boolean)
  const r = await breakdown({
    task,
    memory: new ClientSnapshotMemory(memory),
    context: context ? { Сфера: context.sphere, 'Что мешает': context.blocker, ...extra } : hasExtra ? extra : undefined,
    ctx: newTurn({ task: context ? 'onboarding-first-step' : 'breakdown' }),
    signal: req.signal,
    again: more === true,
  })
  if (r.kind === 'care') return Response.json({ steps: null, reply: r.reply })
  // дело не понято (набор букв): экран просит написать словами, а не показывает общие шаги
  if (r.kind === 'unclear') return Response.json({ steps: null, unclear: true })
  return Response.json({ steps: r.steps, minutes: r.minutes, wait: r.wait, source: r.source, title: r.title })
})
