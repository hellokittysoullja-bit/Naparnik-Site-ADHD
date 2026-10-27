/** Минимальный window.localStorage для тестов памяти: Map в роли хранилища, по флагу — бросает как Safari с блокировкой. */
export function installStorage() {
  const data = new Map<string, string>()
  const state = { blocked: false }
  const guard = () => {
    if (state.blocked) throw new DOMException('The operation is insecure.', 'SecurityError')
  }
  const localStorage = {
    getItem: (k: string) => (guard(), data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => (guard(), void data.set(k, String(v))),
    removeItem: (k: string) => (guard(), void data.delete(k)),
    clear: () => data.clear(),
  }
  const win = { localStorage, sessionStorage: localStorage, dispatchEvent: () => true }
  ;(globalThis as Record<string, unknown>).window = win
  return { data, state }
}
