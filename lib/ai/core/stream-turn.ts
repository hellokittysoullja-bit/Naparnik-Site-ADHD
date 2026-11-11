import { streamText, type ModelMessage, type TextStreamPart, type ToolSet } from 'ai'
import { CRISIS_REPLY } from '../crisis'
import { checkInput } from '../guards/input'
import { echoWords, leakPrint, type OutputOpts } from '../guards/output'
import { modelChain, type ModelStep } from '../models'
import { emit, type AttemptResult } from './hooks'
import './latency' // наблюдатель задержек и адаптивная страховка подключаются вместе с ядром
import { applyRequestMiddleware, withExecutionMiddleware } from './middleware'
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
  signal?: AbortSignal
}

const DROP = new Set<Part['type']>(['reasoning-start', 'reasoning-delta', 'reasoning-end', 'reasoning-file', 'raw', 'source', 'file'])

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

class Attempt {
  readonly ctrl = new AbortController()
  readonly t0 = Date.now()
  readonly guard: SentenceGuard
  buffer: Part[] = []
  committed = false
  dead = false
  openText: string | null = null
  toolCalled = false
  usage: { in?: number; out?: number } = {}

  constructor(
    readonly step: ModelStep,
    opts: OutputOpts,
  ) {
    this.guard = new SentenceGuard(opts)
  }

  /**
   * Одна часть потока модели → что показать человеку. Возвращает 'fail' с причиной, если попытка негодна.
   * Чистая логика без ввода-вывода — проверяется юнит-тестами.
   */
  handle(part: Part, onTool: (tool: string, valid: boolean) => void): { out: Part[]; fail?: AttemptResult; done?: boolean } {
    const out: Part[] = []
    if (DROP.has(part.type)) return { out }
    switch (part.type) {
      case 'text-start':
        this.openText = part.id
        out.push(part)
        return { out }
      case 'text-delta': {
        const s = this.guard.push(part.text)
        if (s.kind === 'violation') return { out, fail: s.reason }
        if (s.kind === 'release') {
          out.push({ ...part, text: s.text })
          this.committed = true
        }
        return { out }
      }
      case 'text-end': {
        const s = this.guard.end()
        if (s.kind === 'violation') {
          // пустой текст рядом с вызовом инструмента — нормально (кот молча показал кнопку)
          if (!(s.reason === 'empty' && this.toolCalled)) return { out, fail: s.reason }
        }
        if (s.kind === 'release') {
          out.push({ type: 'text-delta', id: part.id, text: s.text } as Part)
          this.committed = true
        }
        out.push(part)
        this.openText = null
        return { out }
      }
      case 'tool-call': {
        const valid = !('invalid' in part && part.invalid)
        onTool(part.toolName, valid)
        out.push(part)
        if (valid) {
          this.toolCalled = true
          this.committed = true
        }
        return { out }
      }
      case 'error':
        return { out, fail: 'error' }
      case 'abort':
        return { out, fail: 'timeout' }
      case 'finish':
        this.usage = { in: part.totalUsage?.inputTokens, out: part.totalUsage?.outputTokens }
        if (!this.committed) return { out, fail: 'empty' }
        out.push(part)
        return { out, done: true }
      default:
        out.push(part)
        return { out }
    }
  }

  /** обрезка после фиксации: закрыть открытый текст и завершить поток так, чтобы клиент не ждал */
  cutParts(): Part[] {
    const out: Part[] = []
    if (this.openText) out.push({ type: 'text-end', id: this.openText } as Part)
    out.push(finishPart())
    return out
  }
}

export function streamTurn(input: StreamTurnInput): ReadableStream<Part> {
  const { ctx } = input
  return new ReadableStream<Part>({
    start(controller) {
      let closed = false
      let detach = () => {}
      // таймеры объявлены до close(): кризисный путь закрывает поток раньше, чем они заведены
      const timers: { hedge?: ReturnType<typeof setTimeout>; commit?: ReturnType<typeof setTimeout> } = {}
      const write = (parts: Part[]) => {
        if (closed) return
        for (const p of parts) controller.enqueue(p)
      }
      const close = () => {
        if (closed) return
        closed = true
        detach()
        clearTimeout(timers.hedge)
        clearTimeout(timers.commit)
        controller.close()
      }

      emit({ type: 'turn.start' }, ctx)
      const verdict = checkInput(input.userTexts)
      emit({ type: 'guard.input', crisis: verdict.crisis, injection: verdict.injection }, ctx)
      const endTurn = (outcome: 'model' | 'fallback' | 'crisis' | 'aborted', a?: Attempt) =>
        emit(
          { type: 'turn.end', outcome, model: a?.step.id, ms: Date.now() - ctx.startedAt, inTokens: a?.usage.in, outTokens: a?.usage.out },
          ctx,
        )

      if (verdict.crisis) {
        write(cannedStream(CRISIS_REPLY))
        endTurn('crisis')
        close()
        return
      }

      // middleware запроса (Hermes llm_request): может переставить цепочку, поправить инструкцию и набор инструментов
      const req = applyRequestMiddleware(
        { instructions: input.instructions, messages: input.messages, chain: modelChain(ctx.task), tools: input.tools, hedgeAfterMs: input.hedgeAfterMs },
        { ctx, input: verdict },
      )
      const chain = req.chain
      const guardOpts: OutputOpts = {
        maxChars: input.maxChars,
        echo: echoWords(input.echoTexts ?? input.userTexts),
        leak: leakPrint(req.instructions),
      }
      const total = AbortSignal.timeout(input.totalTimeoutMs)
      const all = input.signal ? AbortSignal.any([input.signal, total]) : total
      const attempts: Attempt[] = []
      let winner: Attempt | null = null
      let launched = 0
      let settled = false

      const endAttempt = (a: Attempt, result: AttemptResult) => {
        if (a.dead) return
        a.dead = true
        a.ctrl.abort()
        emit({ type: 'model.end', model: a.step.id, ms: Date.now() - a.t0, result, inTokens: a.usage.in, outTokens: a.usage.out }, ctx)
      }

      const giveUp = () => {
        if (settled) return
        settled = true
        clearTimeout(timers.hedge)
        clearTimeout(timers.commit)
        for (const a of attempts) endAttempt(a, 'timeout')
        if (input.signal?.aborted) {
          endTurn('aborted')
          close()
          return
        }
        write([{ type: 'error', error: new Error(HARNESS_UNAVAILABLE) } as Part])
        endTurn('fallback')
        close()
      }

      const maybeExhausted = () => {
        if (!winner && launched >= chain.length && attempts.every((a) => a.dead)) giveUp()
      }

      timers.commit = setTimeout(() => {
        if (!winner) giveUp()
      }, input.commitTimeoutMs)

      const onAbort = () => {
        if (winner && !winner.dead) {
          endAttempt(winner, 'timeout')
          write(winner.cutParts())
          endTurn('model', winner)
          close()
        } else giveUp()
      }
      all.addEventListener('abort', onAbort, { once: true })
      detach = () => all.removeEventListener('abort', onAbort)

      const launchNext = () => {
        clearTimeout(timers.hedge)
        if (winner || settled || launched >= chain.length || all.aborted) return maybeExhausted()
        const a = new Attempt(chain[launched++], guardOpts)
        attempts.push(a)
        emit({ type: 'model.start', model: a.step.id, hedge: launched > 1 }, ctx)
        void run(a)
        if (launched < chain.length) timers.hedge = setTimeout(launchNext, req.hedgeAfterMs)
      }

      const run = async (a: Attempt) => {
        const onTool = (tool: string, valid: boolean) => emit({ type: 'tool.call', tool, executor: 'client', valid }, ctx)
        try {
          const result = streamText({
            model: withExecutionMiddleware(a.step.model),
            instructions: req.instructions,
            messages: req.messages,
            tools: req.tools,
            maxOutputTokens: input.maxOutputTokens,
            maxRetries: 0,
            abortSignal: AbortSignal.any([all, a.ctrl.signal]),
            onError: () => {}, // ошибка придёт частью 'error' и попадёт в журнал хода; второй лог не нужен
          })
          for await (const part of result.stream as AsyncIterable<Part>) {
            if (a.dead || settled) return
            const r = a.handle(part, onTool)
            if (r.fail) {
              if (a === winner) {
                // после фиксации: показанное оставляем, дальше не печатаем
                endAttempt(a, r.fail)
                write(a.cutParts())
                endTurn('model', a)
                settled = true
                clearTimeout(timers.commit)
                close()
              } else {
                endAttempt(a, r.fail)
                launchNext()
                maybeExhausted()
              }
              return
            }
            if (a === winner) write(r.out)
            else {
              a.buffer.push(...r.out)
              if (a.committed && !winner) {
                winner = a
                emit({ type: 'model.commit', model: a.step.id, ms: Date.now() - a.t0 }, ctx)
                clearTimeout(timers.hedge)
                clearTimeout(timers.commit)
                for (const other of attempts) if (other !== a) endAttempt(other, 'cancelled')
                write(a.buffer)
                a.buffer = []
              } else if (a.committed) {
                endAttempt(a, 'cancelled') // опоздал: победитель уже печатает
                return
              }
            }
            if (r.done && a === winner) {
              endAttempt(a, 'ok')
              endTurn('model', a)
              settled = true
              close()
              return
            }
          }
          // поток кончился без finish (обрыв) — как ошибка
          if (!a.dead) {
            if (a === winner) {
              endAttempt(a, 'error')
              write(a.cutParts())
              endTurn('model', a)
              settled = true
              close()
            } else {
              endAttempt(a, 'error')
              launchNext()
              maybeExhausted()
            }
          }
        } catch {
          if (a.dead) return
          const timedOut = all.aborted
          if (a === winner) {
            endAttempt(a, timedOut ? 'timeout' : 'error')
            write(a.cutParts())
            endTurn('model', a)
            settled = true
            close()
            return
          }
          endAttempt(a, timedOut ? 'timeout' : 'error')
          if (!timedOut) launchNext()
          maybeExhausted()
        }
      }

      if (chain.length === 0) giveUp()
      else launchNext()
    },
  })
}
