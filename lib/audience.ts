/**
 * Возраст собеседника для обвязки ИИ (lib/ai/persona.ts): ответ на вопрос «тебе есть 18?» в тесте /sdvg-test.
 * Хранится только на устройстве; на сервер уходит одним словом adult/minor — без даты рождения и прочего.
 * Решение владельца 11.11: ИИ отвечает всем, для младших — бережный режим.
 */
const KEY = 'naparnik:audience'
export type ClientAudience = 'adult' | 'minor'

export function setAudience(adult: boolean): void {
  try {
    window.localStorage.setItem(KEY, adult ? 'adult' : 'minor')
  } catch {
    /* хранилище недоступно — обвязка ответит в общем режиме */
  }
}

export function getAudience(): ClientAudience | undefined {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'adult' || v === 'minor' ? v : undefined
  } catch {
    return undefined
  }
}
