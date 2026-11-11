import { tool, type ToolSet } from 'ai'
import type { z } from 'zod'

/**
 * Реестр инструментов (Hermes tools/registry.py: инструмент = запись в таблице, а не код в цикле; OpenAI Agents SDK:
 * FunctionTool со схемой). Каждая запись объявляет:
 *  - схему входа (zod) — ЕДИНСТВЕННОЕ место, где решается, что модель может передать: длина, форма, запреты;
 *  - где исполняется: 'client' — на устройстве человека (память живёт там), 'server' — здесь;
 *  - каким задачам доступен: модель задачи видит только свои инструменты (OWASP LLM06, excessive agency).
 * Новый инструмент — новая запись; ни цикл, ни маршруты не меняются.
 */
export type ToolSpec<I = unknown> = {
  readonly name: string
  readonly description: string
  readonly input: z.ZodType<I>
  readonly executor: 'client' | 'server'
  /** задачи, которым инструмент виден */
  readonly tasks: readonly string[]
  /**
   * только для executor: 'client' — что модель видит как результат. Результат присылает браузер, значит это
   * недоверенный текст: сервер подставляет свой (security-ai.md R11)
   */
  readonly clientResult?: string
  /** только для executor: 'server' */
  readonly execute?: (input: I) => Promise<unknown>
}

export class ToolRegistry {
  private readonly specs = new Map<string, ToolSpec<never>>()

  register<I>(spec: ToolSpec<I>): this {
    if (this.specs.has(spec.name)) throw new Error(`tool registered twice: ${spec.name}`)
    if (spec.executor === 'server' && !spec.execute) throw new Error(`server tool without execute: ${spec.name}`)
    if (spec.executor === 'client' && spec.execute) throw new Error(`client tool must not execute on server: ${spec.name}`)
    if (spec.executor === 'client' && !spec.clientResult) throw new Error(`client tool without clientResult: ${spec.name}`)
    this.specs.set(spec.name, spec as unknown as ToolSpec<never>)
    return this
  }

  get(name: string): ToolSpec<unknown> | undefined {
    return this.specs.get(name) as ToolSpec<unknown> | undefined
  }

  namesFor(task: string): string[] {
    return [...this.specs.values()].filter((s) => s.tasks.includes(task)).map((s) => s.name)
  }

  /** Набор для AI SDK: клиентские — без execute (вызов уходит на устройство), серверные — с execute */
  forTask(task: string): ToolSet {
    const out: ToolSet = {}
    for (const s of this.specs.values()) {
      if (!s.tasks.includes(task)) continue
      const spec = s as unknown as ToolSpec<unknown>
      out[spec.name] = spec.execute
        ? tool({ description: spec.description, inputSchema: spec.input, execute: spec.execute })
        : tool({ description: spec.description, inputSchema: spec.input })
    }
    return out
  }
}
