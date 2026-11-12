import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware, type ModelMessage, type ToolSet } from 'ai'
import type { InputVerdict } from '../guards/input'
import type { ModelStep } from '../models'
import type { TurnContext } from './turn'

/**
 * Middleware хода — второй контракт рядом с наблюдателями (hooks.ts): наблюдатель только смотрит, middleware
 * МЕНЯЕТ ход. Разделение и семантика — как у Hermes (hermes_cli/middleware.py:162-216, docs middleware.md):
 *
 *  - request (Hermes llm_request): переписать запрос до вызова — инструкцию, сообщения, цепочку моделей, набор
 *    инструментов. Получает КОПИЮ: правка на месте не протекает в исходный запрос и в следующий ход
 *    (test_request_middleware_in_place_mutation_does_not_leak). Сбой звена — звено пропускается, ход идёт дальше
 *    (fail-open), сообщение в журнал — один раз на звено.
 *  - execution (Hermes llm_execution): обернуть сам вызов модели. Строится на штатном механизме AI SDK
 *    (wrapLanguageModel/LanguageModelMiddleware) с той же семантикой отказа: сбой звена ДО вызова next — звено
 *    пропускается; ошибка ниже по цепочке (модель, сеть) пробрасывается как есть; next вызывается не больше одного раза.
 *
 * Порядок применения — порядок регистрации; встроенные звенья — в конце файла.
 */
export type TurnRequest = {
  instructions: string
  messages: ModelMessage[]
  chain: ModelStep[]
  tools?: ToolSet
  /** обязательный инструмент на этом ходе (маршрутизация по явной просьбе: «запомни», «забудь») */
  requiredTool?: string
  /** через сколько мс без фиксации запускать следующую модель */
  hedgeAfterMs: number
  /** задержка только перед ВТОРОЙ моделью (адаптивная страховка: 0, когда основная стабильно медленная) */
  firstHedgeMs?: number
}

export type RequestInfo = { ctx: TurnContext; input: InputVerdict }

export type RequestMiddleware = {
  readonly name: string
  onRequest(req: TurnRequest, info: RequestInfo): TurnRequest | void
}

export type ExecutionMiddleware = {
  readonly name: string
  readonly wrap: LanguageModelMiddleware
}

const requestChain: RequestMiddleware[] = []
const executionChain: ExecutionMiddleware[] = []
const warned = new Set<string>()

function warnOnce(name: string, phase: string) {
  if (warned.has(name)) return
  warned.add(name)
  console.warn(JSON.stringify({ t: 'ai-middleware-error', name, phase }))
}

export function registerRequestMiddleware(mw: RequestMiddleware): () => void {
  requestChain.push(mw)
  return () => void requestChain.splice(requestChain.indexOf(mw) >>> 0, 1)
}

export function registerExecutionMiddleware(mw: ExecutionMiddleware): () => void {
  executionChain.push(mw)
  return () => void executionChain.splice(executionChain.indexOf(mw) >>> 0, 1)
}

// глубокая копия сообщений: звено, поправившее вложенное содержимое и упавшее, не оставляет правку в запросе.
// Модели (ModelStep.model) — объекты провайдера, их не клонируем: звенья меняют порядок цепочки, а не модели
const copy = (r: TurnRequest): TurnRequest => ({
  instructions: r.instructions,
  messages: cloneMessages(r.messages),
  chain: r.chain.map((s) => ({ ...s })),
  tools: r.tools ? { ...r.tools } : undefined,
  requiredTool: r.requiredTool,
  hedgeAfterMs: r.hedgeAfterMs,
  firstHedgeMs: r.firstHedgeMs,
})

/** глубокая копия; содержимое, которое нельзя клонировать (URL, поток), копируется по ссылке — ход не падает */
function cloneMessages(messages: ModelMessage[]): ModelMessage[] {
  try {
    return structuredClone(messages)
  } catch {
    return messages.map((m) => ({ ...m }) as ModelMessage)
  }
}

export function applyRequestMiddleware(req: TurnRequest, info: RequestInfo): TurnRequest {
  let cur = copy(req)
  for (const mw of [...requestChain]) {
    try {
      const draft = copy(cur)
      cur = mw.onRequest(draft, info) ?? draft
    } catch {
      warnOnce(mw.name, 'request') // звено пропущено, cur — результат предыдущих звеньев
    }
  }
  return cur
}

/**
 * Семантика отказа как у Hermes (_run_execution_chain, hermes_cli/middleware.py:162-216):
 *  - сбой звена ДО next — звено пропускается, вызов идёт дальше;
 *  - ошибка ниже по цепочке (модель, сеть) — пробрасывается как есть;
 *  - сбой звена ПОСЛЕ успешного next — результат next возвращается (ответ модели не теряется из-за звена);
 *  - next одноразовый.
 */
function failSafe(mw: ExecutionMiddleware): LanguageModelMiddleware {
  const { wrapGenerate, wrapStream, transformParams, ...rest } = mw.wrap
  return {
    ...rest, // overrideProvider / overrideModelId / overrideSupportedUrls — как у звена
    specificationVersion: 'v4',
    transformParams: transformParams
      ? async (opts) => {
          try {
            return await transformParams(opts)
          } catch {
            warnOnce(mw.name, 'transformParams')
            return opts.params
          }
        }
      : undefined,
    wrapGenerate: wrapGenerate
      ? async (opts) => {
          const next = once(mw.name, opts.doGenerate)
          try {
            return await wrapGenerate({ ...opts, doGenerate: next.call })
          } catch (e) {
            return recover(mw.name, 'wrapGenerate', next, e, opts.doGenerate)
          }
        }
      : undefined,
    wrapStream: wrapStream
      ? async (opts) => {
          const next = once(mw.name, opts.doStream)
          try {
            return await wrapStream({ ...opts, doStream: next.call })
          } catch (e) {
            return recover(mw.name, 'wrapStream', next, e, opts.doStream)
          }
        }
      : undefined,
  } as LanguageModelMiddleware
}

type Once<R> = { call: () => PromiseLike<R>; called: boolean; settled?: { ok: true; value: R } | { ok: false; error: unknown } }

function once<R>(name: string, fn: () => PromiseLike<R>): Once<R> {
  const state: Once<R> = {
    called: false,
    call: () => {
      if (state.called) throw new Error(`middleware ${name}: next called twice`)
      state.called = true
      return Promise.resolve(fn()).then(
        (value) => {
          state.settled = { ok: true, value }
          return value
        },
        (error) => {
          state.settled = { ok: false, error }
          throw error
        },
      )
    },
  }
  return state
}

function recover<R>(name: string, phase: string, next: Once<R>, error: unknown, fn: () => PromiseLike<R>): PromiseLike<R> | R {
  if (!next.called) {
    warnOnce(name, phase)
    return fn() // звено упало до next — пропускаем его
  }
  if (next.settled?.ok) {
    warnOnce(name, phase)
    return next.settled.value // звено упало после успешного next — ответ модели сохраняем
  }
  throw error // упала модель (или звено вызвало next дважды) — как есть
}

/** Модель, обёрнутая всеми execution-звеньями (без звеньев — та же модель, без лишнего слоя) */
export function withExecutionMiddleware(model: LanguageModel): LanguageModel {
  if (executionChain.length === 0 || typeof model === 'string') return model
  return wrapLanguageModel({ model, middleware: executionChain.map(failSafe) })
}

// ── Встроенные звенья ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Подозрение на взлом промпта → цепочка начинается с более устойчивой модели (security-ai.md R9). Флаг injection
 * раньше только писался в журнал; звено готово менять ход. ВНИМАНИЕ: сейчас ни у одной модели в models.ts нет
 * пометки robust (устойчивость выбранной пары не замерена), поэтому в продакшене звено ничего не делает — оно
 * начнёт работать, когда замер атак покажет, какая модель устойчивее, и ей поставят пометку.
 */
registerRequestMiddleware({
  name: 'robust-first-on-injection',
  onRequest(req, { input }) {
    if (!input.injection) return
    const robust = req.chain.filter((s) => s.robust)
    if (robust.length === 0 || req.chain[0]?.robust) return
    req.chain = [...robust, ...req.chain.filter((s) => !s.robust)]
    return req
  },
})
