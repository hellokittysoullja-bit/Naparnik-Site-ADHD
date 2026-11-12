import { streamText, type ModelMessage, type TextStreamPart, type ToolSet } from 'ai'
import { CRISIS_REPLY } from '../crisis'
import { checkInput } from '../guards/input'
import { checkOutput, echoWords, leakPrint, mentionsMedical, tidy, toolArgsOk, type ClaimKind, type OutputOpts } from '../guards/output'
import { modelChain, type ModelStep } from '../models'
import { emit, type AttemptResult } from './hooks'
import './latency' // наблюдатель задержек и адаптивная страховка подключаются вместе с ядром
import { applyRequestMiddleware, withExecutionMiddleware, type TurnRequest } from './middleware'
import { SentenceGuard } from './stream-guard'
import type { TurnContext } from './turn'

/**
 * Ход с потоковым ответом (чат на Доме, будущий бот). Тот же контракт, что у runTurn, но ответ печатается по мере
 * генерации:
 *  1) проверка входа: кризис → проверенный ответ без модели;
 *  2) страхующие попытки (hedged requests): основная модель стартует сразу, следующая — если за hedgeAfterMs нет
 *     «точки фиксации» или первая уже негодна;
 *  3) ТОЧКА ФИКСАЦИИ — первое предложение, прошедшее проверку (stream-guard.ts), или правильный вызов инструмента.
 *     До неё смена модели невидима человеку; первая зафиксировавшаяся попытка побеждает, остальные отменяются;
 *  4) после фиксации текст идёт по предложениям через ту же проверку; нарушение — обрезка, не показ;
 *  5) никто не зафиксировался за commitTimeoutMs — часть 'error' с кодом HARNESS_UNAVAILABLE: канал сам решает,
 *     чем заменить (веб — заготовками lib/scripted-companion на устройстве);
 *  6) рассуждения модели и служебные части человеку не уходят.
 * Каждый шаг публикуется наблюдателям (hooks.ts) с turnId — без текстов.
 */
export const HARNESS_UNAVAILABLE = 'companion-unavailable'

type Part = TextStreamPart<ToolSet>

export type StreamTurnInput = {
  ctx: TurnContext
  instructions: string
  messages: ModelMessage[]
  tools?: ToolSet
  /** тексты человека этого хода: проверка входа (кризис, взлом) */
  userTexts: string[]
  /** откуда брать разрешённые латинские слова (по умолчанию userTexts) */
  echoTexts?: string[]
  /** сколько ждать точки фиксации (все попытки вместе) */
  commitTimeoutMs: number
  /** потолок всего хода, включая допечатку после фиксации */
  totalTimeoutMs: number
  hedgeAfterMs: number
  maxOutputTokens: number
  maxChars: number
  /**
   * Правило фиксации. По умолчанию — первое проверенное предложение (чат печатает по мере генерации).
   * whole — разовые задачи (голос сессии, дробление): ответ держится целиком, проверяется и принимается задачей
   * (accept) — только тогда фиксируется; негодный ответ тихо уходит следующей модели.
   */
  whole?: { accept: (text: string) => boolean; internal?: boolean }
  /**
   * Проверка вызова инструмента по смыслу хода, сверх схемы: то, что знает только агент (какой список памяти видела
   * модель, что сказал человек). false — вызов отбрасывается так же, как негодный по схеме
   */
  toolCheck?: (name: string, input: unknown) => boolean
  /**
   * Действия, о которых кот вправе говорить в прошедшем времени («забыл», «сохранил»), только если они случились:
   * вызов одного из tools в этой попытке или (allowedFromStart) результат такого вызова уже в истории хода
   */
  claims?: { unlocks: Readonly<Record<string, readonly ClaimKind[]>>; fromStart: readonly ClaimKind[] }
  signal?: AbortSignal
}

export type TurnOutcome = { outcome: 'model' | 'fallback' | 'crisis' | 'aborted'; model?: string }

// Человеку не уходят: рассуждения модели, служебное и ПОТОКОВЫЙ ввод инструмента (tool-input-*): клиенту хватает
// готового вызова, а негодный вызов мы отбрасываем целиком — его частичный ввод не должен успеть уйти
const DROP = new Set<Part['type']>([
  'reasoning-start', 'reasoning-delta', 'reasoning-end', 'reasoning-file', 'raw', 'source', 'file',
  'tool-input-start', 'tool-input-delta', 'tool-input-end', 'tool-error',
])

function finishPart(): Part {
  return {
    type: 'finish',
    finishReason: 'stop',
    rawFinishReason: undefined,
    totalUsage: {
      inputTokens: undefined,
      inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
      outputTokens: undefined,
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      totalTokens: undefined,
    },
  } as Part
}

/** Готовый текст одной репликой (кризис, тесты каналов) */
export function cannedStream(text: string): Part[] {
  const id = 'canned'
  return [
    { type: 'start' } as Part,
    { type: 'text-start', id } as Part,
    { type: 'text-delta', id, text } as Part,
    { type: 'text-end', id } as Part,
    finishPart(),
  ]
}

type Usage = { in?: number; out?: number; cached?: number }
const usageOf = (part: Part & { type: 'finish' }): Usage => ({
  in: part.totalUsage?.inputTokens,
  out: part.totalUsage?.outputTokens,
  cached: part.totalUsage?.inputTokenDetails?.cacheReadTokens,
})

/** сбой проверки агента — вызов не проходит (fail-closed: лучше не записать, чем записать непроверенное) */
function safeCheck(check: (name: string, input: unknown) => boolean, name: string, input: unknown): boolean {
  try {
    return check(name, input)
  } catch {
    return false
  }
}

class Attempt {
  readonly ctrl = new AbortController()
  readonly t0 = Date.now()
  readonly guard: SentenceGuard
  buffer: Part[] = []
  committed = false
  dead = false
  openText: string | null = null
  toolCalled = false
  usage: Usage = {}
  /** text-end, отложенный до причины остановки */
  endedText: Part | null = null
  /** режим whole: весь текст ответа до проверки */
  private full = ''
  /** форма ошибки провайдера для журнала (без тела запроса и ответа) */
  errorStatus?: number

  constructor(
    readonly step: ModelStep,
    private readonly opts: OutputOpts,
    private readonly whole?: { accept: (text: string) => boolean; internal?: boolean },
    /** человек сам назвал лекарство — его слова в плане не нарушение */
    private readonly personMedical = false,
    private readonly toolCheck?: (name: string, input: unknown) => boolean,
    private readonly claimUnlocks: Readonly<Record<string, readonly ClaimKind[]>> = {},
  ) {
    // заявление «забыл/сохранил» проверяется по этой попытке: её собственный вызов инструмента его разрешает —
    // только своё: план не разрешает «забыл про диплом» (аудит 12.11)
    const base = opts.claim
    this.guard = new SentenceGuard(base ? { ...opts, claim: { allowed: (k) => base.allowed(k) || this.acted.has(k) } } : opts)
  }

  /** какие заявления уже правда в этой попытке (вызов инструмента прошёл все проверки) */
  private readonly acted = new Set<ClaimKind>()

  /** режим whole: проверить и принять ответ целиком в конце генерации */
  private finishWhole(finish: Part): { out: Part[]; fail?: AttemptResult; done?: boolean } {
    const text = tidy(this.full)
    // служебная задача (выжимка памяти): ответ не показывается человеку, задача сама проверяет каждую строку теми же
    // правилами — одна негодная строка не должна губить весь ответ
    if (!this.whole!.internal) {
      const verdict = checkOutput(text, this.opts)
      if (!verdict.ok) return { out: [], fail: verdict.reason }
    } else if (text.length > this.opts.maxChars) return { out: [], fail: 'length' }
    let accepted = false
    try {
      accepted = this.whole!.accept(text)
    } catch {
      accepted = false // разбор задачи упал — ответ негоден, а не «попытка пропала» (находка аудита 12.11)
    }
    if (!accepted) return { out: [], fail: 'parse' }
    this.committed = true
    const id = 'whole'
    return {
      out: [{ type: 'text-start', id } as Part, { type: 'text-delta', id, text } as Part, { type: 'text-end', id } as Part, finish],
      done: true,
    }
  }

  /**
   * Одна часть потока модели → что показать человеку. Возвращает 'fail' с причиной, если попытка негодна.
   * Чистая логика без ввода-вывода — проверяется юнит-тестами.
   */
  handle(part: Part, onTool: (tool: string, valid: boolean) => void): { out: Part[]; fail?: AttemptResult; done?: boolean } {
    const out: Part[] = []
    if (DROP.has(part.type)) return { out }
    if (this.whole) {
      if (part.type === 'text-delta') this.full += part.text
      else if (part.type === 'error') return this.failWith(part.error)
      else if (part.type === 'abort') return { out, fail: 'timeout' }
      else if (part.type === 'finish') {
        this.usage = usageOf(part)
        // оборванный по длине ответ не принимается: «Ты уже начал, и это главное, давай теперь» нельзя показывать
        // (самопроверка 12.11: у чата такая защита была, у разовых задач — нет)
        if (part.finishReason === 'length') return { out, fail: 'length' }
        return this.finishWhole(part)
      }
      return { out }
    }
    switch (part.type) {
      case 'text-start': {
        // второй текстовый блок в том же шаге: сначала закрыть первый (иначе его конец терялся, а хвост уходил
        // под чужим id — находка аудита 12.11)
        const closed = this.closeText(false)
        if (closed.fail) return closed
        this.openText = part.id
        out.push(...closed.out, part)
        return { out }
      }
      case 'text-delta': {
        const s = this.guard.push(part.text)
        if (s.kind === 'violation') return { out, fail: s.reason }
        if (s.kind === 'release') {
          out.push({ ...part, text: s.text })
          this.committed = true
        }
        return { out }
      }
      case 'text-end':
        // остаток текста выпускаем, только когда известна причина остановки (finish-step): обрыв по лимиту длины
        // оставил бы на экране недописанное предложение
        this.endedText = part
        return { out }
      case 'finish-step': {
        const closed = this.closeText(part.finishReason === 'length')
        if (closed.fail) return closed
        out.push(...closed.out, part)
        return { out }
      }
      case 'tool-call': {
        const valid = !('invalid' in part && part.invalid)
        onTool(part.toolName, valid)
        // негодный вызов человеку не уходит: клиент AI SDK считает вызов с ошибкой «завершённым» и сам шлёт
        // историю заново — модель повторяла бы вызов платной петлёй (находка аудита 12.11)
        if (!valid) return { out }
        // аргументы пишет модель и их увидит человек (карточка плана, кнопка, «запомнил: …») — это тоже вывод кота:
        // та же проверка, что у текста. Раньше ссылка или доза в аргументе шли мимо правил (находка аудита 12.11)
        if (!toolArgsOk(part.input, { echo: this.opts.echo, medical: this.personMedical })) {
          onTool(part.toolName, false)
          return { out }
        }
        if (this.toolCheck && !safeCheck(this.toolCheck, part.toolName, part.input)) {
          onTool(part.toolName, false)
          return { out }
        }
        this.toolCalled = true // до закрытия текста: пустой текст рядом с вызовом — норма
        const unlocks = this.claimUnlocks[part.toolName]
        if (unlocks?.length) {
          for (const k of unlocks) this.acted.add(k)
          // придержанное «Запомнил.» теперь правда — выпускаем его до вызова: текст уже закончен — закрываем
          // его сейчас, ещё идёт — выпускаем законченные предложения
          if (this.endedText) {
            const closed = this.closeText(false)
            if (closed.fail) return closed
            out.push(...closed.out)
          } else {
            const held = this.guard.push('')
            if (held.kind === 'violation') return { out, fail: held.reason }
            if (held.kind === 'release' && this.openText) out.push({ type: 'text-delta', id: this.openText, text: held.text } as Part)
          }
        }
        out.push(part)
        this.toolCalled = true
        this.committed = true
        return { out }
      }
      case 'error':
        return this.failWith(part.error)
      case 'abort':
        return { out, fail: 'timeout' }
      case 'finish': {
        this.usage = usageOf(part)
        const closed = this.closeText(part.finishReason === 'length') // если finish-step не пришёл
        if (closed.fail) return closed
        out.push(...closed.out)
        if (!this.committed) return { out, fail: 'empty' }
        out.push(part)
        return { out, done: true }
      }
      default:
        out.push(part)
        return { out }
    }
  }

  private failWith(error: unknown): { out: Part[]; fail: AttemptResult } {
    const status = (error as { statusCode?: unknown } | null)?.statusCode
    if (typeof status === 'number') this.errorStatus = status
    return { out: [], fail: 'error' }
  }

  /** закрыть отложенный текст: выпустить остаток (или отбросить недописанное при обрыве по длине) */
  closeText(truncated: boolean): { out: Part[]; fail?: AttemptResult } {
    const end = this.endedText
    if (!end) return { out: [] }
    this.endedText = null
    if (truncated) this.guard.dropUnfinished()
    const out: Part[] = []
    const s = this.guard.end()
    if (s.kind === 'violation') {
      // пустой текст рядом с вызовом инструмента — нормально (кот молча показал кнопку)
      if (!(s.reason === 'empty' && this.toolCalled)) return { out, fail: s.reason }
    }
    if (s.kind === 'release') {
      out.push({ type: 'text-delta', id: (end as { id: string }).id, text: s.text } as Part)
      this.committed = true
    }
    out.push(end)
    this.openText = null
    return { out }
  }

  /** обрезка после фиксации: закрыть открытый текст и завершить поток так, чтобы клиент не ждал */
  cutParts(): Part[] {
    const out: Part[] = []
    if (this.openText) out.push({ type: 'text-end', id: this.openText } as Part)
    out.push(finishPart())
    return out
  }
}

/** Ход: поток частей для канала + итог хода (чем кончилось и какая модель ответила) */
export function raceTurn(input: StreamTurnInput): { stream: ReadableStream<Part>; result: Promise<TurnOutcome> } {
  let race: Race | undefined
  let resolve: (r: TurnOutcome) => void = () => {}
  const result = new Promise<TurnOutcome>((r) => (resolve = r))
  const stream = new ReadableStream<Part>({
    start(controller) {
      race = new Race(input, controller, resolve)
      race.start()
    },
    // потребитель отменил поток (вкладка закрыта, обрыв) — остановить все попытки
    cancel() {
      race?.cancel()
    },
  })
  return { stream, result }
}

export function streamTurn(input: StreamTurnInput): ReadableStream<Part> {
  return raceTurn(input).stream
}

type Outcome = TurnOutcome['outcome']

/**
 * Гонка страхующих попыток одного хода. Состояние хода — в полях; каждый переход — отдельный метод с одним
 * смыслом: finishWinner (победитель закончил или оборван), failLoser (попытка негодна до фиксации), giveUp
 * (никто не зафиксировался), cancel (потребитель ушёл). turn.end и close — ровно один раз на любом пути.
 */
class Race {
  private readonly ctx: TurnContext
  private readonly attempts: Attempt[] = []
  private winner: Attempt | null = null
  private launched = 0
  /** исход решён: новые попытки не запускаются, части проигравших игнорируются */
  private settled = false
  private closed = false
  private turnEnded = false
  private hedgeTimer?: ReturnType<typeof setTimeout>
  private commitTimer?: ReturnType<typeof setTimeout>
  private detach = () => {}
  private req!: TurnRequest
  private guardOpts!: OutputOpts
  private all!: AbortSignal
  private personMedical = false

  constructor(
    private readonly input: StreamTurnInput,
    private readonly controller: ReadableStreamDefaultController<Part>,
    private readonly onSettled: (r: TurnOutcome) => void,
  ) {
    this.ctx = input.ctx
  }

  start(): void {
    const { input, ctx } = this
    emit({ type: 'turn.start' }, ctx)
    const verdict = checkInput(input.userTexts)
    emit({ type: 'guard.input', crisis: verdict.crisis, injection: verdict.injection }, ctx)
    if (verdict.crisis) {
      this.write(cannedStream(CRISIS_REPLY))
      return this.settle('crisis')
    }
    // middleware запроса (Hermes llm_request): может переставить цепочку, поправить инструкцию и набор инструментов
    this.req = applyRequestMiddleware(
      { instructions: input.instructions, messages: input.messages, chain: modelChain(ctx.task), tools: input.tools, hedgeAfterMs: input.hedgeAfterMs },
      { ctx, input: verdict },
    )
    this.guardOpts = {
      maxChars: input.maxChars,
      echo: echoWords(input.echoTexts ?? input.userTexts),
      leak: leakPrint(this.req.instructions),
      claim: input.claims ? { allowed: (k: ClaimKind) => input.claims!.fromStart.includes(k) } : undefined,
    }
    this.personMedical = mentionsMedical(input.echoTexts ?? input.userTexts)
    const total = AbortSignal.timeout(input.totalTimeoutMs)
    this.all = input.signal ? AbortSignal.any([input.signal, total]) : total
    // уже отменённый сигнал событие 'abort' не пошлёт — проверяем сразу (иначе ход висел до таймера)
    if (this.all.aborted || this.req.chain.length === 0) return this.giveUp()
    const onAbort = () => this.onAbort()
    this.all.addEventListener('abort', onAbort, { once: true })
    this.detach = () => this.all.removeEventListener('abort', onAbort)
    this.commitTimer = setTimeout(() => this.giveUp(), input.commitTimeoutMs)
    this.launchNext()
  }

  /** потребитель отменил поток: писать некуда, попытки останавливаем */
  cancel(): void {
    this.closed = true
    for (const a of this.attempts) this.endAttempt(a, 'cancelled')
    this.settle('aborted', this.winner ?? undefined)
  }

  // ── переходы ──────────────────────────────────────────────────────────────────────────────────────────────

  private launchNext(): void {
    clearTimeout(this.hedgeTimer)
    const chain = this.req.chain
    if (this.winner || this.settled || this.launched >= chain.length || this.all.aborted) return this.giveUpIfExhausted()
    const a = new Attempt(chain[this.launched++], this.guardOpts, this.input.whole, this.personMedical, this.input.toolCheck, this.input.claims?.unlocks)
    this.attempts.push(a)
    emit({ type: 'model.start', model: a.step.id, hedge: this.launched > 1 }, this.ctx)
    void this.run(a)
    if (this.launched < chain.length) this.hedgeTimer = setTimeout(() => this.launchNext(), this.req.hedgeAfterMs)
  }

  private async run(a: Attempt): Promise<void> {
    const onTool = (tool: string, valid: boolean) => emit({ type: 'tool.call', tool, executor: 'client', valid }, this.ctx)
    try {
      const result = streamText({
        model: withExecutionMiddleware(a.step.model),
        instructions: this.req.instructions,
        messages: this.req.messages,
        tools: this.req.tools,
        maxOutputTokens: this.input.maxOutputTokens,
        maxRetries: 0,
        abortSignal: AbortSignal.any([this.all, a.ctrl.signal]),
        onError: () => {}, // ошибка придёт частью 'error' и попадёт в журнал хода; второй лог не нужен
      })
      for await (const part of result.stream as AsyncIterable<Part>) {
        if (a.dead || this.settled) return
        const r = a.handle(part, onTool)
        if (r.fail) return this.fail(a, r.fail)
        if (a !== this.winner) {
          a.buffer.push(...r.out)
          if (!a.committed) continue
          if (this.winner) return this.endAttempt(a, 'cancelled') // опоздал: победитель уже печатает
          this.promote(a)
        } else this.write(r.out)
        if (r.done) return this.finishWinner(a, 'ok')
      }
      this.fail(a, 'error') // поток кончился без finish (обрыв)
    } catch {
      if (a.dead) return
      const timedOut = this.all.aborted
      if (a === this.winner) this.finishWinner(a, timedOut ? 'timeout' : 'error')
      else {
        this.endAttempt(a, timedOut ? 'timeout' : 'error')
        if (!timedOut) this.launchNext()
        this.giveUpIfExhausted()
      }
    }
  }

  /** попытка первой прошла точку фиксации: её буфер уходит человеку, остальные отменяются */
  private promote(a: Attempt): void {
    this.winner = a
    emit({ type: 'model.commit', model: a.step.id, ms: Date.now() - a.t0 }, this.ctx)
    clearTimeout(this.hedgeTimer)
    clearTimeout(this.commitTimer)
    for (const other of this.attempts) if (other !== a) this.endAttempt(other, 'cancelled')
    this.write(a.buffer)
    a.buffer = []
  }

  private fail(a: Attempt, result: AttemptResult): void {
    if (a.dead) return
    if (a === this.winner) return this.finishWinner(a, result)
    // до фиксации: человек ничего не видел — тихо берём следующую модель
    this.endAttempt(a, result)
    this.launchNext()
    this.giveUpIfExhausted()
  }

  /**
   * Победитель закончил: 'ok' — сам; иначе оборван (нарушение после фиксации, ошибка, таймаут, отмена человеком) —
   * показанное оставляем, открытый текст закрываем, поток завершаем так, чтобы клиент не ждал.
   */
  private finishWinner(a: Attempt, result: AttemptResult, outcome: Outcome = 'model'): void {
    this.endAttempt(a, result)
    if (result !== 'ok') this.write(a.cutParts())
    this.settle(outcome, a)
  }

  /** никто не зафиксировался: канал получает маркер недоступности и берёт заготовку */
  private giveUp(): void {
    if (this.settled || this.winner) return
    for (const a of this.attempts) this.endAttempt(a, 'timeout')
    if (this.input.signal?.aborted) return this.settle('aborted')
    this.write([{ type: 'error', error: new Error(HARNESS_UNAVAILABLE) } as Part])
    this.settle('fallback')
  }

  private giveUpIfExhausted(): void {
    if (!this.winner && this.launched >= this.req.chain.length && this.attempts.every((a) => a.dead)) this.giveUp()
  }

  /** сработал сигнал: человек отменил запрос или вышло общее время хода */
  private onAbort(): void {
    const w = this.winner
    if (!w || w.dead) return this.giveUp()
    const byPerson = this.input.signal?.aborted === true
    this.finishWinner(w, byPerson ? 'cancelled' : 'timeout', byPerson ? 'aborted' : 'model')
  }

  // ── примитивы ─────────────────────────────────────────────────────────────────────────────────────────────

  private endAttempt(a: Attempt, result: AttemptResult): void {
    if (a.dead) return
    a.dead = true
    a.ctrl.abort()
    emit(
      {
        type: 'model.end', model: a.step.id, ms: Date.now() - a.t0, result, committed: a.committed, status: a.errorStatus,
        inTokens: a.usage.in, outTokens: a.usage.out, cachedTokens: a.usage.cached,
      },
      this.ctx,
    )
  }

  /** исход хода: turn.end и закрытие потока — ровно один раз */
  private settle(outcome: Outcome, a?: Attempt): void {
    this.settled = true
    clearTimeout(this.hedgeTimer)
    clearTimeout(this.commitTimer)
    this.detach()
    if (!this.turnEnded) {
      this.turnEnded = true
      emit(
        { type: 'turn.end', outcome, model: a?.step.id, ms: Date.now() - this.ctx.startedAt, inTokens: a?.usage.in, outTokens: a?.usage.out },
        this.ctx,
      )
      this.onSettled({ outcome, model: a?.step.id })
    }
    if (this.closed) return
    this.closed = true
    try {
      this.controller.close()
    } catch {
      /* уже закрыт или отменён */
    }
  }

  /** запись не бросает: поток мог быть отменён потребителем раньше, чем дошёл сигнал отмены */
  private write(parts: Part[]): void {
    if (this.closed) return
    try {
      for (const p of parts) this.controller.enqueue(p)
    } catch {
      this.closed = true
    }
  }
}
