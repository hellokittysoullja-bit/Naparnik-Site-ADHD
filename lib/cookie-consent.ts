/**
 * Согласие на cookie (16.11, чек-лист РКН 2026, раздел 4). Анонимную метку посетителя (`nid`) и источник перехода
 * сервер ставит только после явного «Разрешить и закрыть» в плашке (components/cookie-notice.tsx): «оставаясь на сайте, вы
 * соглашаетесь» согласием не считается. До нажатия метки источника из адреса (utm_*, src) лежат только на устройстве
 * (sessionStorage), чтобы не потерять, откуда человек пришёл, если он нажмёт «Разрешить и закрыть» уже на другой странице.
 */
import { hasAttribution, readAttribution, type Attribution } from '@/lib/visitor'

const KEY = 'naparnik:cookies'
const PENDING = 'naparnik:pendingAttribution'
export const CONSENT_EVENT = 'naparnik:cookie-consent'

export function hasCookieConsent(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function giveCookieConsent(): void {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    /* хранилище недоступно — согласие живёт до перезагрузки */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

/** Метки источника из текущего адреса, а если их нет — отложенные с первой страницы визита */
export function currentAttribution(): Attribution {
  const now = readAttribution(new URLSearchParams(window.location.search))
  try {
    if (hasAttribution(now)) {
      window.sessionStorage.setItem(PENDING, JSON.stringify(now))
      return now
    }
    const saved = JSON.parse(window.sessionStorage.getItem(PENDING) ?? 'null') as unknown
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      // форму проверяет тот же разбор, что и для адреса: чужие ключи и длинные значения отбрасываются
      const p = new URLSearchParams()
      for (const [k, v] of Object.entries(saved)) if (typeof v === 'string') p.set(k, v)
      return readAttribution(p)
    }
  } catch {
    /* sessionStorage недоступен — только адрес */
  }
  return now
}

export function forgetPendingAttribution(): void {
  try {
    window.sessionStorage.removeItem(PENDING)
  } catch {
    /* ничего */
  }
}
