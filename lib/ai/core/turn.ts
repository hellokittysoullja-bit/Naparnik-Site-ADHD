/**
 * Контекст хода — сквозной идентификатор и происхождение запроса (Hermes: correlation IDs в observer-хуках,
 * OpenAI Agents SDK: trace_id/span_id). Один ход = один TurnContext, его получают все хуки, middleware и инструменты.
 * Текста человека здесь нет намеренно: контекст уходит в журналы.
 */
export type Channel = 'web' | 'telegram' | 'eval'

/** Задачи обвязки. Опечатка в имени — ошибка компиляции, а не молчаливый маршрут по умолчанию (аудит 12.11) */
export type TaskName = 'chat' | 'session-voice' | 'breakdown' | 'onboarding-first-step' | 'memory-extract' | 'recall' | 'test'

export type TurnContext = {
  /** уникален на ход: связывает все события журнала одного ответа */
  readonly turnId: string
  /** разговор (тред): у веба — устройство/вкладка, у бота — чат; необязателен для разовых задач */
  readonly sessionId?: string
  readonly channel: Channel
  /** имя задачи: chat, session-voice, breakdown, onboarding-suggest… */
  readonly task: TaskName
  readonly startedAt: number
}

export function newTurn(init: { task: TaskName; channel?: Channel; sessionId?: string; now?: number }): TurnContext {
  return Object.freeze({
    turnId: crypto.randomUUID(),
    sessionId: init.sessionId,
    channel: init.channel ?? 'web',
    task: init.task,
    startedAt: init.now ?? Date.now(),
  })
}
