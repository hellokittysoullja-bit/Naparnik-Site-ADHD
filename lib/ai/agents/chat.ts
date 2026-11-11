import type { ModelMessage, TextStreamPart, ToolSet } from 'ai'
import { emit } from '../core/hooks'
import { streamTurn } from '../core/stream-turn'
import type { TurnContext } from '../core/turn'
import type { MemoryProvider, MemoryWrite } from '../memory/provider'
import { renderMemory } from '../memory/render'
import type { MemorySnapshot } from '../memory/schema'
import { assemble } from '../prompt/assemble'
import { KNOWLEDGE } from '../knowledge/catalog'
import { renderKnowledge, selectKnowledge } from '../knowledge/select'
import { fitConversation } from '../prompt/context-budget'
import { CHAT_SYSTEM, FOCUS_CHAT_SYSTEM, situation } from '../prompt/tasks/chat'
import { rememberFactInput, savePlanInput, tools } from '../tools/catalog'

type Part = TextStreamPart<ToolSet>

/**
 * Агент «разговор с котом» — одна точка для всех каналов (веб-чат сейчас, бот потом). Канал отвечает только за
 * доставку: превращает свои сообщения в ModelMessage и поток частей — в свой формат (channels/*).
 */
export type ChatMode = 'companion' | 'focus'

export const CHAT_LIMITS = {
  // замер 11.11 (5 запросов на модель): первое слово у Gemini 2.5 Flash 1,9–6,8 с, у DeepSeek V4 Flash 2,4–21,5 с —
  // ждём точки фиксации до 12 с, потом заготовки
  commitTimeoutMs: 12_000,
  totalTimeoutMs: 25_000, // < maxDuration маршрута (30 с)
  hedgeAfterMs: 2_000,
  // реплика 1–3 предложения; запас на вызов инструмента и на модели, у которых рассуждение не выключается целиком
  // (сравнение 11.11: при 600 Gemini обрывалась на полуслове)
  maxOutputTokens: 1024,
  maxChars: 700,
  // история разговора: ~6 тыс. токенов ≈ 40–60 реплик кота и человека
  historyTokens: 6_000,
} as const

const { historyTokens: HISTORY_TOKENS, ...TURN_LIMITS } = CHAT_LIMITS
const MAX_AUTO_ROUNDS = 2
const MEMORY_PREFETCH_MS = 1500

/** память не должна держать ход: медленное или упавшее хранилище — разговор без памяти, а не зависший ответ */
async function prefetchWithin(memory: MemoryProvider, ctx: TurnContext, ms: number): Promise<MemorySnapshot | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      memory.prefetch(ctx),
      new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ms))),
    ])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

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
  const snapshot = await prefetchWithin(input.memory, input.ctx, MEMORY_PREFETCH_MS)
  const { instructions, messages } = assemble({
    taskSystem: input.mode === 'focus' ? FOCUS_CHAT_SYSTEM : CHAT_SYSTEM,
    memory: renderMemory(snapshot),
    situation: situation(input.clientHour),
    // знания под реплику (каталог пуст до утверждения владельцем — тогда блока нет)
    knowledge: renderKnowledge(selectKnowledge(KNOWLEDGE, [input.userTexts.at(-1) ?? ''])),
    // бюджет истории (prompt/context-budget.ts): сайт укладывается и так, боту с длинной историей — обязательно
    conversation: fitConversation(input.conversation, HISTORY_TOKENS),
  })
  const stream = streamTurn({
    ctx: input.ctx,
    instructions,
    messages,
    // после двух автокругов подряд — без инструментов: модель, зовущая инструмент на каждый ход, иначе гоняла бы
    // платные запросы сама (security-ai.md дефект 13)
    tools: (input.autoRounds ?? 0) >= MAX_AUTO_ROUNDS ? undefined : tools.forTask('chat'),
    // кризис — по двум последним репликам человека: фразу делят на два сообщения («не хочу» / «жить»), а более
    // ранние уже получили свой ответ; латинские слова — из всего разговора
    userTexts: input.userTexts.slice(-2),
    echoTexts: input.userTexts,
    ...TURN_LIMITS,
    signal: input.signal,
  })
  return stream.pipeThrough(memoryLifecycle(input.ctx, input.memory))
}

/**
 * Шаг «после хода» жизненного цикла памяти (Hermes agent/memory_provider.py: sync_turn): принятые вызовы
 * инструментов памяти → записи → поставщик памяти, когда ход закончился. Поток ответа проходит насквозь без
 * изменений; сбой памяти ответ не ломает (fail-open). У памяти на устройстве записи исполняет клиент — здесь они
 * только попадают в журнал; у серверного хранилища (бот, база) — записываются этим шагом.
 */
function memoryLifecycle(ctx: TurnContext, memory: MemoryProvider): TransformStream<Part, Part> {
  const writes: MemoryWrite[] = []
  let handed = false
  // записи отдаются поставщику ровно один раз — и когда ход закончился, и когда человек закрыл вкладку посреди
  // ответа (flush при отмене не вызывается): уже показанный вызов инструмента не должен потеряться
  const handOver = async () => {
    if (handed || writes.length === 0 || !memory.onTurnEnd) return
    handed = true
    try {
      await memory.onTurnEnd(ctx, writes)
    } catch {
      emit({ type: 'memory.write', kind: 'error', accepted: false }, ctx)
    }
  }
  return new TransformStream<Part, Part>({
    transform(part, controller) {
      if (part.type === 'tool-call' && !('invalid' in part && part.invalid)) {
        const w = toMemoryWrite(part.toolName, part.input)
        if (w) {
          writes.push(w)
          // «предложено», а не «записано»: событие уходит до конца хода (журнал хода его видит), а принимает
          // запись хранилище — устройство или сервер
          emit({ type: 'memory.proposed', kind: w.kind }, ctx)
        }
      }
      controller.enqueue(part)
    },
    flush: handOver,
    cancel: handOver,
  } as Transformer<Part, Part> & { cancel: () => Promise<void> })
}

/** Вызов инструмента → запись памяти. Вход уже проверен схемой инструмента (tools/catalog.ts) */
export function toMemoryWrite(tool: string, input: unknown): MemoryWrite | null {
  if (tool === 'rememberFact') {
    const r = rememberFactInput.safeParse(input)
    return r.success ? { kind: 'fact', text: r.data.fact } : null
  }
  if (tool === 'savePlan') {
    const r = savePlanInput.safeParse(input)
    return r.success ? { kind: 'plan', task: r.data.task, firstStep: r.data.firstStep, startTime: r.data.startTime } : null
  }
  return null
}
