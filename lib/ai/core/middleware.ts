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
  /** через сколько мс без фиксации запускать следующую модель */
  hedgeAfterMs: number
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
  messages: structuredClone(r.messages) as ModelMessage[],
  chain: r.chain.map((s) => ({ ...s })),
  tools: r.tools ? { ...r.tools } : undefined,
  hedgeAfterMs: r.hedgeAfterMs,
})

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

/** Сбой звена до next — звено пропускается; next одноразовый; ошибки ниже по цепочке — как есть */
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
          let called = false
          const doGenerate = () => {
            if (called) throw new Error(`middleware ${mw.name}: next called twice`)
            called = true
            return opts.doGenerate()
          }
          try {
            return await wrapGenerate({ ...opts, doGenerate })
          } catch (e) {
            if (called) throw e
            warnOnce(mw.name, 'wrapGenerate')
            return opts.doGenerate()
          }
        }
      : undefined,
    wrapStream: wrapStream
      ? async (opts) => {
          let called = false
          const doStream = () => {
            if (called) throw new Error(`middleware ${mw.name}: next called twice`)
            called = true
            return opts.doStream()
          }
          try {
            return await wrapStream({ ...opts, doStream })
          } catch (e) {
            if (called) throw e
            warnOnce(mw.name, 'wrapStream')
            return opts.doStream()
          }
        }
      : undefined,
  } as LanguageModelMiddleware
}

/** Модель, обёрнутая всеми execution-звеньями (без звеньев — та же модель, без лишнего слоя) */
export function withExecutionMiddleware(model: LanguageModel): LanguageModel {
  if (executionChain.length === 0 || typeof model === 'string') return model
  return wrapLanguageModel({ model, middleware: executionChain.map(failSafe) })
}

// ── Встроенные звенья ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Подозрение на взлом промпта → цепочка начинается с более устойчивой модели (security-ai.md R9). Флаг injection
 * раньше только писался в журнал; теперь он меняет ход. Цепочку задают модели (models.ts: robust).
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
