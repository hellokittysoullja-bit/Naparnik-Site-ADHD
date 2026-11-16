'use client'

import { useEffect } from 'react'
import { hasAttribution } from '@/lib/visitor'
import { CONSENT_EVENT, currentAttribution, forgetPendingAttribution, hasCookieConsent } from '@/lib/cookie-consent'

const SEEN = 'naparnik:visit'

/**
 * Анонимный ID и источник перехода ставит сервер (`POST /api/visit`) — после загрузки страницы и в простое, чтобы
 * запрос не спорил с первым экраном за сеть и поток (research/19 §1.3). Раньше это делал proxy.ts в ответе на саму
 * страницу — функция на первом визите каждого нового посетителя.
 *
 * Повторно — только когда в адресе метка ролика (обновить «последний вход») или устройство забыло, что уже было.
 * Наружу уходят только параметры источника (`utm_*`, `src`); фрагмент адреса (ответы теста) — никогда.
 *
 * Только после «Понятно» в плашке cookie (16.11, lib/cookie-consent.ts): без согласия метка посетителя не ставится,
 * а источник перехода ждёт на устройстве.
 */
export function VisitBeacon() {
  useEffect(() => {
    // источник запоминаем сразу (на устройстве), отправляем — только с согласием
    const attribution = currentAttribution()
    if (!hasCookieConsent()) {
      const onConsent = () => {
        window.removeEventListener(CONSENT_EVENT, onConsent)
        send(currentAttribution())
      }
      window.addEventListener(CONSENT_EVENT, onConsent)
      return () => window.removeEventListener(CONSENT_EVENT, onConsent)
    }
    let seen = false
    try {
      seen = window.localStorage.getItem(SEEN) === '1'
    } catch {
      /* хранилище недоступно — спросим сервер, он сам не перезапишет существующий ID */
    }
    if (seen && !hasAttribution(attribution)) return

    let idle = 0
    let timer = 0
    const schedule = () => {
      // Safari до 26 не знает requestIdleCallback
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(() => send(attribution), { timeout: 2000 })
      else timer = setTimeout(() => send(attribution), 300) as unknown as number
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      window.removeEventListener('load', schedule)
      if (idle) window.cancelIdleCallback(idle)
      if (timer) clearTimeout(timer)
    }
  }, [])
  return null
}

function send(attribution: ReturnType<typeof currentAttribution>) {
  void fetch('/api/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a: attribution }),
    credentials: 'same-origin',
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) return
      forgetPendingAttribution()
      try {
        window.localStorage.setItem(SEEN, '1')
      } catch {
        /* не страшно: в следующий раз спросим ещё раз */
      }
    })
    .catch(() => {})
}
