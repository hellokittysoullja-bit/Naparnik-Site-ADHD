/**
 * Закрыть экранную клавиатуру и дождаться, пока экран встанет на место (17.11, запись владельца: «Разломать на шаг»
 * открывал Фокус с ещё открытой клавиатурой, и экран дёргался 3–4 раза, пока она уезжала и переезжала строка Safari).
 * Клавиатура открыта, если видимая область заметно ниже окна; тогда ждём, пока visualViewport перестанет меняться
 * (90 мс тишины), но не дольше 450 мс. Без клавиатуры (компьютер) — сразу.
 */
export function settleKeyboard(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  const el = document.activeElement as HTMLElement | null
  const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  const vv = window.visualViewport
  const open = typing && !!vv && vv.height < window.innerHeight - 120
  if (typing) el!.blur()
  if (!open || !vv) return Promise.resolve()
  return new Promise((resolve) => {
    let quiet = 0
    const done = () => {
      vv.removeEventListener('resize', onResize)
      window.clearTimeout(quiet)
      window.clearTimeout(cap)
      resolve()
    }
    const onResize = () => {
      window.clearTimeout(quiet)
      quiet = window.setTimeout(done, 90)
    }
    const cap = window.setTimeout(done, 450)
    vv.addEventListener('resize', onResize)
  })
}
