import type { ModelMessage, TextStreamPart, ToolSet } from 'ai'
import { streamTurn } from '../core/stream-turn'
import type { TurnContext } from '../core/turn'
import type { MemoryProvider } from '../memory/provider'
import { renderMemory } from '../memory/render'
import { assemble } from '../prompt/assemble'
import { CHAT_SYSTEM, FOCUS_CHAT_SYSTEM, situation } from '../prompt/tasks/chat'
import { tools } from '../tools/catalog'

/**
 * Агент «разговор с котом» — одна точка для всех каналов (веб-чат сейчас, бот потом). Канал отвечает только за
 * доставку: превращает свои сообщения в ModelMessage и поток частей — в свой формат (channels/*).
 */
export type ChatMode = 'companion' | 'focus'

export const CHAT_LIMITS = {
  // замер 11.11: первый годный кусок у Haiku 2,8–6,5 с, у DeepSeek 7–19 с — ждём до 12 с, потом заготовки
  commitTimeoutMs: 12_000,
  totalTimeoutMs: 25_000, // < maxDuration маршрута (30 с)
  hedgeAfterMs: 2_000,
  // реплика 1–3 предложения; запас на вызов инструмента и на модели, у которых рассуждение не выключается целиком
  // (сравнение 11.11: при 600 Gemini обрывалась на полуслове)
  maxOutputTokens: 1024,
  maxChars: 700,
} as const

const MAX_AUTO_ROUNDS = 2

export async function chatTurn(input: {
  ctx: TurnContext
  memory: MemoryProvider
  mode: ChatMode
  clientHour?: number
  conversation: ModelMessage[]
  /** тексты человека в разговоре, последний — текущая реплика */
  userTexts: string[]
  /** ответов кота подряд без реплики человека (клиент сам шлёт повтор после инструмента) */
  autoRounds?: number
  signal?: AbortSignal
}): Promise<ReadableStream<TextStreamPart<ToolSet>>> {
  const snapshot = await input.memory.prefetch(input.ctx)
  const { instructions, messages } = assemble({
    taskSystem: input.mode === 'focus' ? FOCUS_CHAT_SYSTEM : CHAT_SYSTEM,
    memory: renderMemory(snapshot),
    situation: situation(input.clientHour),
    conversation: input.conversation,
  })
  const last = input.userTexts.at(-1) ?? ''
  return streamTurn({
    ctx: input.ctx,
    instructions,
    messages,
    // после двух автокругов подряд — без инструментов: модель, зовущая инструмент на каждый ход, иначе гоняла бы
    // платные запросы сама (security-ai.md дефект 13)
    tools: (input.autoRounds ?? 0) >= MAX_AUTO_ROUNDS ? undefined : tools.forTask('chat'),
    // кризис — по текущей реплике (прошлую уже обработали); латинские слова — из всего разговора
    userTexts: [last],
    echoTexts: input.userTexts,
    ...CHAT_LIMITS,
    signal: input.signal,
  })
}
