import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * true — компонент монтируется на клиенте БЕЗ гидратации (переход внутри приложения), false — гидратация
 * статического HTML. React сам выбирает снимок: при гидратации — серверный (false), иначе — клиентский (true).
 *
 * Зачем: данные экранов живут в localStorage. При гидратации первый рендер обязан совпасть с HTML (там данных нет —
 * скелетон), а при переходе по табу совпадать не с чем — можно прочитать память сразу в инициализаторе useState
 * и показать готовый экран в первом же кадре (lib/memory.ts, peek*).
 */
export function useClientMount(): boolean {
  return useSyncExternalStore(noop, () => true, () => false)
}
