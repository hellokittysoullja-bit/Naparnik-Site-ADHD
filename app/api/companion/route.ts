import { createUIMessageStreamResponse, toUIMessageStream } from 'ai'
import { z } from 'zod'
import { chatTurn } from '@/lib/ai/agents/chat'
import { fromWeb } from '@/lib/ai/channels/web'
import { HARNESS_UNAVAILABLE } from '@/lib/ai/core/stream-turn'
import { newTurn } from '@/lib/ai/core/turn'
import { ClientSnapshotMemory } from '@/lib/ai/memory/provider'
import { fail, handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

/**
 * Чат с котом — веб-канал обвязки (lib/ai). Маршрут только принимает запрос и доставляет поток: модель, проверки,
 * память и инструменты — в агенте чата (lib/ai/agents/chat.ts), общем для всех каналов.
 */
export const maxDuration = 30

const MAX_BODY = 128 * 1024 // 30 реплик кириллицей с инструментами ≈ 20–40 КБ; запас ×3

const BodySchema = z.object({
  messages: z.array(z.unknown()).max(200),
  mode: z.enum(['companion', 'focus']).default('companion'),
  // память проверяется отдельно (memory/schema.ts): одно странное поле не должно выключать ИИ целиком
  memory: z.unknown().optional(),
  clientHour: z.number().int().min(0).max(23).optional(),
  // конспект прошлой части разговора (lib/chat-summary.ts): форма проверяется в агенте, странное поле даёт ход без него
  summary: z.object({ lines: z.unknown(), madeOn: z.string().max(40).optional() }).optional().catch(undefined),
  // связан ли браузер с ботом (lib/tg-link.ts): от этого зависит, вправе ли кот обещать «напишу первым»
  reminders: z.enum(['on', 'off']).optional().catch(undefined),
  // id разговора от useChat — связывает ходы одного разговора в журнале
  id: z.string().max(64).optional(),
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'companion', 20)
  const parsed = BodySchema.safeParse(await readJsonBody(req, MAX_BODY))
  if (!parsed.success) return fail(400)
  const input = await fromWeb(parsed.data.messages)
  if (!input) return fail(400)

  const stream = await chatTurn({
    ctx: newTurn({ task: 'chat', channel: 'web', sessionId: parsed.data.id }),
    memory: new ClientSnapshotMemory(parsed.data.memory),
    mode: parsed.data.mode,
    clientHour: parsed.data.clientHour,
    summary: parsed.data.summary,
    reminders: parsed.data.reminders ?? 'off',
    ...input,
    signal: req.signal, // человек закрыл вкладку — генерация останавливается
  })

  return createUIMessageStreamResponse({
    // клиенту — только маркер: он перейдёт на заготовки (lib/scripted-companion), подробности — в журнале хода
    stream: toUIMessageStream({ stream, onError: () => HARNESS_UNAVAILABLE }),
  })
})
