import type { ModelMessage, TextStreamPart, ToolSet } from 'ai'
import { emit } from '../core/hooks'
import { streamTurn } from '../core/stream-turn'
import type { TurnContext } from '../core/turn'
import { asksToForget, asksToForgetAll, asksToRemember, forgetMatches, forgetsLast } from '../memory/facts'
import { prefetchWithin, type MemoryProvider, type MemoryWrite } from '../memory/provider'
import { memoryWords, renderMemory, renderSkills } from '../memory/render'
import { factRejection, writeAllowed } from '../memory/write-guard'
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
  const snapshot = await prefetchWithin(input.memory, input.ctx)
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
  // просят запомнить то, что кот не хранит: память на этот ход не предлагается вовсе (иначе модель звала её, вызов
  // отбрасывали правила, и на повтор уходило 3–4 с — набор задач 12.11), а инструкция говорит это прямо
  const unstorable = unstorableAsk(input.userTexts.at(-1) ?? '')
  const allTools = tools.forTask('chat')
  const stream = streamTurn({
    ctx: input.ctx,
    instructions: unstorable ? `${instructions}\n\n${UNSTORABLE_NOTE}` : instructions,
    messages,
    // после двух автокругов подряд — без инструментов: модель, зовущая инструмент на каждый ход, иначе гоняла бы
    // платные запросы сама (security-ai.md дефект 13)
    tools:
      (input.autoRounds ?? 0) >= MAX_AUTO_ROUNDS
        ? undefined
        : unstorable
          ? Object.fromEntries(Object.entries(allTools).filter(([name]) => name !== 'memory'))
          : allTools,
    // кризис — по двум последним репликам человека: фразу делят на два сообщения («не хочу» / «жить»), а более
    // ранние уже получили свой ответ; латинские слова — из всего разговора
    userTexts: input.userTexts.slice(-2),
    echoTexts: input.userTexts,
    // названия латиницей из памяти («пишу в Overleaf», сказано неделю назад) коту тоже можно повторять: без этого
    // ответ по памяти браковался как «чужой язык», и память делала кота хуже, а не лучше
    echoExtra: memoryWords(snapshot),
    toolCheck: memoryToolCheck({ facts: snapshot?.facts?.length ?? 0, userTexts: input.userTexts, factTexts: snapshot?.facts?.map((f) => f.text) }),
    // «забыл/запомнил/сохранил» — только если это правда случилось: в этом ответе или в автокруге после инструмента
    claims: { unlocks: CLAIM_UNLOCKS, fromStart: actedSinceUser(input.conversation) },
    // здороваться — только в начале разговора или в ответ на приветствие (правило владельца 12.11; модели
    // здоровались посреди разговора вопреки промпту — набор задач)
    noGreeting: input.conversation.some((m) => m.role === 'assistant') && !GREETS.test(input.userTexts.at(-1) ?? ''),
    // явная просьба «запомни» / «забудь» — первый шаг обязан вызвать память (Hermes: маршрутизация намерения до
    // модели); после результата инструмента (автокруг) — уже нет, иначе модель вызывала бы его по кругу
    // согласие начать на предложение кота («Готов?» → «ок, давай») — кнопка старта обязательна: набор задач 12.11,
    // модель отвечала «Отлично, открывай!» без кнопки, и человеку нечего было нажать
    requiredTool:
      actedSinceUser(input.conversation).length > 0 || input.conversation.at(-1)?.role !== 'user'
        ? undefined
        : explicitMemoryAsk(input.userTexts.at(-1) ?? '')
          ? unstorableAsk(input.userTexts.at(-1) ?? '')
            ? undefined
            : memoryAskTool(input.userTexts.at(-1) ?? '', lastCatText(input.conversation))
          : acceptsStart(input.userTexts.at(-1) ?? '', lastCatText(input.conversation))
            ? 'startFocus'
            : undefined,
    ...TURN_LIMITS,
    signal: input.signal,
  })
  return stream.pipeThrough(memoryLifecycle(input.ctx, input.memory, input.userTexts.at(-1) ?? ''))
}

/** Человек прямо просит сделать что-то с памятью */
export function explicitMemoryAsk(text: string): boolean {
  return asksToRemember(text) || asksToForget(text)
}

/**
 * Какой инструмент исполняет явное «запиши / запомни / забудь». Обязательным передаётся ровно один инструмент:
 * провайдеры соблюдают обязательный вызов надёжно только при одном инструменте (замер 12.11). «Так и запиши» в
 * разговоре о плане на завтра — это план (savePlan), остальное — память. «Забудь» — всегда память.
 */
export function memoryAskTool(userText: string, catText: string): 'memory' | 'savePlan' {
  if (asksToForget(userText)) return 'memory'
  // план — только когда кот сам спрашивал про план (шаг, время) в прошлой реплике: «запомни, что у меня завтра
  // экзамен» — событие для памяти, а не план, и согласованный план оно затирать не должно (аудит 12.11)
  return PLAN_TALK.test(catText) && !ABOUT_SELF.test(userText) ? 'savePlan' : 'memory'
}

const PLAN_TALK = /(?<!\p{L})(?:завтра|план\p{L}*|во\s+сколько|к\s+какому\s+часу|с\s+какого\s+(?:\p{L}+\s+)?шага)(?!\p{L})/iu
// «запомни, что я…» — о себе, даже если рядом время («я лучше работаю утром»)
const ABOUT_SELF = /(?<!\p{L})(?:что\s+(?:я|у\s+меня|мне|мой|моя|мо[ёе])|у\s+меня\s+(?:завтра|сегодня|в\s+\p{L}+)|я\s+(?:лучше|всегда|обычно|никогда|люблю|не\s+люблю|пишу|учусь|работаю))(?!\p{L})/iu

/**
 * Просят запомнить то, что кот не хранит (ярлык, здоровье, деньги, контакты): вызов памяти не требуется — правильный
 * ответ здесь слова («такое не записываю, ярлыки делу не помогают»). Набор задач 12.11: обе модели так и отвечали, а
 * обвязка отбрасывала эти ответы как «не вызвал обязательный инструмент», и человек получал заготовку.
 */
const UNSTORABLE_NOTE =
  'Человек просит запомнить то, что ты не хранишь (здоровье и лекарства, ярлыки о себе, деньги, контакты, документы). Память не трогай. Одной тёплой фразой скажи, что такое не запоминаешь, без слов «запомню», «учту», «записал», и вернись к делу одним коротким вопросом.'

export function unstorableAsk(userText: string): boolean {
  if (!asksToRemember(userText) || asksToForget(userText)) return false
  const reason = factRejection(userText)
  return reason !== null && reason !== 'injection'
}

/** текст последней реплики кота перед репликой человека */
export function lastCatText(conversation: readonly ModelMessage[]): string {
  for (let i = conversation.length - 1; i >= 0; i--) {
    const m = conversation[i]
    if (m.role !== 'assistant') continue
    if (typeof m.content === 'string') return m.content
    return m.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ')
  }
  return ''
}

const START_OFFER = /(?:готов[аы]?|начн[её]м|начинаем|попробуем|погнали|поехали|запускаем|стартуем|сядем)\s*[?!.]*\s*$/iu
const YES = /^(?:ну\s+)?(?:да|ага|ок(?:ей)?|okay|ok|давай|готов[аы]?|погнали|поехали|го|можно|начинаем|начнём|начнем|хорошо|ладно)(?=$|[\s,.!])/iu
const NOT_NOW = /(?:^|[\s,])(?:не|нет|потом|позже|завтра|подожди|стоп|сначала)(?=$|[\s,.!?])|\?/iu

/**
 * Человек соглашается начать прямо сейчас на предложение кота: кот спросил «Готов?» / «Начнём?», ответ короткий и
 * без оговорок («ок, давай, готов прямо сейчас»). «Давай, но сначала чай» и «а что если не выйдет?» — не согласие.
 */
export function acceptsStart(userText: string, catText: string): boolean {
  const t = userText.trim()
  if (!t || t.length > 60 || !START_OFFER.test(catText.trim())) return false
  return YES.test(t) && !NOT_NOW.test(t)
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
        // «забудь это» без темы — о только что записанном: какой это факт, знает устройство (policy.toFactOp latestId)
        return text === undefined || asksToForgetAll(last) || forgetsLast(last) || forgetMatches(text, last)
      }
      case 'replace':
      case 'add':
        if (m.op === 'replace' && !refOk) return false
        return writeAllowed(m.text ?? '', m.evidence ?? last.slice(0, 200), grounds, { explicit: asksToRemember(last) })
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
