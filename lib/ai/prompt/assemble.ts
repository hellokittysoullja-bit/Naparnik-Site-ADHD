import type { ModelMessage } from 'ai'
import { personaBase } from './persona'

/**
 * Сборка промпта ярусами (Hermes agent/system_prompt.py: stable → context → volatile; правило «системный промпт
 * байт-в-байт стабилен, изменчивое — только сообщениями»):
 *
 *  ярус 1, СИСТЕМА — характер кота + правила задачи. Одинаков у всех людей и во всех ходах задачи → провайдер
 *    кэширует префикс; snapshot-тест (tests/unit/prompt-surface.test.ts) ловит любое случайное изменение.
 *  ярус 2, ПАМЯТЬ — блок данных первым сообщением разговора: меняется редко (новый факт, план), префикс истории
 *    после него тоже стабилен.
 *  ярус 3, СИТУАЦИЯ — время суток и прочее изменчивое: сообщением прямо перед последней репликой человека, чтобы
 *    не сдвигать кэш всей истории.
 *
 * Данные человека никогда не попадают в ярус 1 (OWASP LLM01): там только наш текст.
 */
export type AssembleInput = {
  /** правила задачи (prompt/tasks/*) — только наш текст */
  taskSystem: string
  /** ярус 2: блок памяти (memory/render.ts) или данные задачи (context.ts dataMessage) */
  memory?: string
  /** ярус 3 */
  situation?: string
  /** знания под этот ход (knowledge/select.ts) — рядом с ситуацией, перед последней репликой человека */
  knowledge?: string
  /** история разговора (уже очищенная) или одно задание */
  conversation: ModelMessage[]
}

export type Assembled = { instructions: string; messages: ModelMessage[] }

export function systemFor(taskSystem: string): string {
  return `${personaBase}\n\n${taskSystem}`
}

export function assemble(input: AssembleInput): Assembled {
  const messages: ModelMessage[] = []
  if (input.memory) messages.push({ role: 'user', content: input.memory })
  const conv = input.conversation
  let lastUser = -1
  for (let i = conv.length - 1; i >= 0; i--) {
    if (conv[i].role === 'user') {
      lastUser = i
      break
    }
  }
  const volatile = [input.knowledge, input.situation].filter((x): x is string => !!x)
  conv.forEach((m, i) => {
    if (i === lastUser) for (const v of volatile) messages.push({ role: 'user', content: v })
    messages.push(m)
  })
  if (lastUser === -1) for (const v of volatile) messages.push({ role: 'user', content: v })
  return { instructions: systemFor(input.taskSystem), messages }
}
