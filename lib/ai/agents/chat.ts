import type { ModelMessage, TextStreamPart, ToolSet } from 'ai'
import { emit } from '../core/hooks'
import { streamTurn } from '../core/stream-turn'
import type { TurnContext } from '../core/turn'
import { asksToForget, asksToForgetAll, asksToRemember, forgetMatches } from '../memory/facts'
import type { MemoryProvider, MemoryWrite } from '../memory/provider'
import { renderMemory, renderSkills } from '../memory/render'
import { writeAllowed } from '../memory/write-guard'
import type { MemorySnapshot } from '../memory/schema'
import { assemble } from '../prompt/assemble'
import { KNOWLEDGE } from '../knowledge/catalog'
import { renderKnowledge, selectKnowledge } from '../knowledge/select'
import { fitConversation } from '../prompt/context-budget'
import { CHAT_SYSTEM, FOCUS_CHAT_SYSTEM, situation } from '../prompt/tasks/chat'
import { memoryInput, savePlanInput, tools } from '../tools/catalog'
import { DEVICE_REFUSED } from '../channels/web'
import { GREETS, type ClaimKind } from '../guards/output'

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
    skills: renderSkills(snapshot, input.userTexts.at(-1) ?? ''),
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
    toolCheck: memoryToolCheck({ facts: snapshot?.facts?.length ?? 0, userTexts: input.userTexts, factTexts: snapshot?.facts?.map((f) => f.text) }),
    // «забыл/запомнил/сохранил» — только если это правда случилось: в этом ответе или в автокруге после инструмента
    claims: { unlocks: CLAIM_UNLOCKS, fromStart: actedSinceUser(input.conversation) },
    // здороваться — только в начале разговора или в ответ на приветствие (правило владельца 12.11; модели
    // здоровались посреди разговора вопреки промпту — набор задач)
    noGreeting: input.conversation.some((m) => m.role === 'assistant') && !GREETS.test(input.userTexts.at(-1) ?? ''),
    // явная просьба «запомни» / «забудь» — первый шаг обязан вызвать память (Hermes: маршрутизация намерения до
    // модели); после результата инструмента (автокруг) — уже нет, иначе модель вызывала бы его по кругу
    requiredTool: explicitMemoryAsk(input.userTexts.at(-1) ?? '') && !actedSinceUser(input.conversation).includes('memory') ? 'memory' : undefined,
    ...TURN_LIMITS,
    signal: input.signal,
  })
  return stream.pipeThrough(memoryLifecycle(input.ctx, input.memory, input.userTexts.at(-1) ?? ''))
}

/** Человек прямо просит сделать что-то с памятью */
export function explicitMemoryAsk(text: string): boolean {
  return asksToRemember(text) || asksToForget(text)
}

/** какой инструмент делает правдой какое заявление: память — «забыл/запомнил» и «записал», план — только «записал» */
const CLAIM_UNLOCKS: Readonly<Record<string, readonly ClaimKind[]>> = { memory: ['memory', 'save'], savePlan: ['save'] }

/** Что уже правда после последней реплики человека: результаты инструментов памяти и плана (автокруг клиента) */
export function actedSinceUser(conversation: readonly ModelMessage[]): ClaimKind[] {
  let i = conversation.length - 1
  while (i >= 0 && conversation[i].role !== 'user') i--
  const out = new Set<ClaimKind>()
  for (const m of conversation.slice(i + 1)) {
    if (m.role !== 'tool' || !Array.isArray(m.content)) continue
    for (const p of m.content) {
      // отказ устройства — действия не было
      if (p.type !== 'tool-result' || JSON.stringify(p.output).includes(DEVICE_REFUSED)) continue
      for (const k of CLAIM_UNLOCKS[p.toolName] ?? []) out.add(k)
    }
  }
  return [...out]
}

/**
 * Проверка вызова памяти по смыслу хода (сверх схемы, которая уже отсекла запрещённое содержание):
 *  - номер факта — из показанного списка;
 *  - «забыть» — только если человек в последней реплике сам попросил;
 *  - новый или изменённый факт обоснован словами человека в этом разговоре (Hermes background_review.py:370-396
 *    «сохраняй только то, что обосновано репликой»): модель не запишет то, что придумала сама или прочла в памяти.
 * Устройство повторяет первые две проверки само: оно знает свой список точнее.
 */
export function memoryToolCheck(turn: { facts: number; userTexts: readonly string[]; factTexts?: readonly string[] }) {
  const last = turn.userTexts.at(-1) ?? ''
  const grounds = turn.userTexts.slice(-6)
  return (name: string, raw: unknown): boolean => {
    if (name !== 'memory') return true
    const r = memoryInput.safeParse(raw)
    if (!r.success) return false
    const m = r.data
    const refOk = m.ref !== undefined && Number(m.ref) < turn.facts
    switch (m.op) {
      case 'forgetAll':
        return asksToForgetAll(last)
      case 'forget': {
        if (!refOk || !asksToForget(last)) return false
        const text = turn.factTexts?.[Number(m.ref)]
        return text === undefined || asksToForgetAll(last) || forgetMatches(text, last)
      }
      case 'replace':
      case 'add':
        if (m.op === 'replace' && !refOk) return false
        return writeAllowed(m.text ?? '', m.evidence ?? last.slice(0, 200), grounds)
    }
  }
}

/**
 * Шаг «после хода» жизненного цикла памяти (Hermes agent/memory_provider.py: sync_turn): принятые вызовы
 * инструментов памяти → записи → поставщик памяти, когда ход закончился. Поток ответа проходит насквозь без
 * изменений; сбой памяти ответ не ломает (fail-open). У памяти на устройстве записи исполняет клиент — здесь они
 * только попадают в журнал; у серверного хранилища (бот, база) — записываются этим шагом.
 */
function memoryLifecycle(ctx: TurnContext, memory: MemoryProvider, lastUserText: string): TransformStream<Part, Part> {
  const writes: MemoryWrite[] = []
  let handed = false
  // записи отдаются поставщику ровно один раз — и когда ход закончился, и когда человек закрыл вкладку посреди
  // ответа (flush при отмене не вызывается): уже показанный вызов инструмента не должен потеряться
  const handOver = async () => {
    if (handed || writes.length === 0 || !memory.onTurnEnd) return
    handed = true
    try {
      await memory.onTurnEnd(ctx, writes, { lastUserText })
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
  if (tool === 'memory') {
    const r = memoryInput.safeParse(input)
    return r.success ? { kind: 'memory', input: r.data } : null
  }
  if (tool === 'savePlan') {
    const r = savePlanInput.safeParse(input)
    return r.success ? { kind: 'plan', task: r.data.task, firstStep: r.data.firstStep, startTime: r.data.startTime } : null
  }
  return null
}
