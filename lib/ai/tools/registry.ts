import { jsonSchema, tool, type ToolSet } from 'ai'
import { z } from 'zod'

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

/**
 * Приведение входа инструмента до проверки схемой (Hermes: coercion): модели часто заполняют необязательные поля
 * пустой строкой или null («ref": "", "until": null) — по схеме такой вызов негоден, и честное «Запомнил» человек не
 * увидел бы (живой прогон 12.11). Пустое на верхнем уровне = поля нет. Схему для модели это не меняет.
 */
export function coerceToolInput(v: unknown): unknown {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== ''))
}

/** Схема для AI SDK: та же JSON-схема, что дала бы zod (её видит модель), проверка — после приведения */
export function toolSchema<I>(input: z.ZodType<I>) {
  return jsonSchema<I>(z.toJSONSchema(input, { io: 'input', target: 'draft-7' }) as Parameters<typeof jsonSchema>[0], {
    validate: (value) => {
      const r = input.safeParse(coerceToolInput(value))
      return r.success ? { success: true, value: r.data } : { success: false, error: r.error }
    },
  })
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
      const inputSchema = toolSchema(spec.input)
      out[spec.name] = spec.execute
        ? tool({ description: spec.description, inputSchema, execute: spec.execute })
        : tool({ description: spec.description, inputSchema })
    }
    return out
  }
}
