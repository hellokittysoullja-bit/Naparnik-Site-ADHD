import { z } from 'zod'
import { EXTRACT_LIMITS, extractMemory } from '@/lib/ai/agents/memory-extract'
import { newTurn } from '@/lib/ai/core/turn'
import { FACT_CATEGORIES, FACT_LIMITS, type FactCategory } from '@/lib/ai/memory/facts'
import { SKILL_LIMITS } from '@/lib/ai/memory/skills'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * Фоновая выжимка памяти — веб-адаптер lib/ai/agents/memory-extract.ts. Устройство присылает свои факты (в том
 * порядке, в каком будет переводить номера обратно) и затихший кусок разговора; ответ — проверенные операции.
 * Сервер ничего не хранит: память живёт на устройстве (решение владельца 12.11).
 */
export const maxDuration = 20

const clip = (n: number) => z.string().transform((s) => s.slice(0, n))

const Body = z.object({
  facts: z
    .array(z.object({ category: z.enum(FACT_CATEGORIES as [FactCategory, ...FactCategory[]]), text: clip(FACT_LIMITS.text) }))
    .max(FACT_LIMITS.active),
  skills: z
    .array(z.object({ name: clip(SKILL_LIMITS.name), when: clip(SKILL_LIMITS.when) }))
    .max(SKILL_LIMITS.active)
    .optional(),
  lines: z
    .array(z.object({ role: z.enum(['user', 'cat']), text: z.string() }))
    .min(1)
    .max(EXTRACT_LIMITS.lines)
    .transform((ls) => ls.map((l) => ({ ...l, text: l.text.slice(0, l.role === 'user' ? EXTRACT_LIMITS.userText : EXTRACT_LIMITS.catText) }))),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  // одна выжимка на затихший разговор; запас на несколько вкладок и повтор после сбоя сети
  rateLimit(req, 'memory', 6)
  const parsed = Body.safeParse(await readJsonBody(req, 24 * 1024))
  if (!parsed.success) return Response.json({ ops: [] }, { status: 400 })
  const r = await extractMemory({ ...parsed.data, ctx: newTurn({ task: 'memory-extract' }), signal: req.signal })
  // 503 — модели не ответили: устройство оставит кусок разговора на следующую попытку
  return Response.json({ ops: r.ops }, { status: r.ok ? 200 : 503 })
})
