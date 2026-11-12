import { aboutAny, contentWords } from '@/lib/ai/memory/stems'

/**
 * Список забытого на устройстве (аудит 12.11, research/21-agent-audit/2-memory.md §1–2, 5). «Забудь X» раньше
 * убирало факт, но сказанное человеком оставалось в переписке, уходило модели каждым ходом, возвращалось в архив и
 * в память через фоновое ревью. Теперь у каждой просьбы есть запись: тема (содержательные слова) и момент просьбы.
 * Реплика считается забытой, если она старше просьбы и касается темы; сказанное ПОСЛЕ просьбы — обычный разговор
 * (человек вправе заговорить о том же снова). «Забудь всё» — запись без темы: забыто всё, что старше.
 *
 * На экране переписка остаётся как была — это журнал человека; забытое не видит кот: модель, ревью, архив, поиск.
 */
export type Tomb = { words: string[] | null; at: string }

const KEY = 'naparnik:forgotten'
const MAX = 60

export function peekForgotten(): Tomb[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (t): t is Tomb =>
        !!t &&
        typeof t === 'object' &&
        typeof (t as Tomb).at === 'string' &&
        ((t as Tomb).words === null || (Array.isArray((t as Tomb).words) && (t as Tomb).words!.every((w) => typeof w === 'string'))),
    )
  } catch {
    return []
  }
}

/** записать забытое: тексты фактов или слова просьбы; null — «забудь всё». Возвращает, удалось ли сохранить */
export function addForgotten(texts: readonly string[] | null, now = new Date().toISOString()): boolean {
  const fresh: Tomb[] = texts === null ? [{ words: null, at: now }] : texts.map((t) => ({ words: contentWords(t), at: now })).filter((t) => t.words.length > 0)
  if (fresh.length === 0) return true
  // «забудь всё» покрывает все прежние записи
  const kept = texts === null ? [] : peekForgotten()
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...kept, ...fresh].slice(-MAX)))
    return true
  } catch {
    return false
  }
}

/** реплика с меткой времени `at` забыта? Без метки (ещё не сохранена — только что сказана) — нет */
export function isForgotten(text: string, at: string | undefined, tombs: readonly Tomb[] = peekForgotten()): boolean {
  if (!at || tombs.length === 0) return false
  const older = tombs.filter((t) => at < t.at)
  if (older.some((t) => t.words === null)) return true
  return aboutAny(
    text,
    older.map((t) => t.words ?? []),
  )
}
