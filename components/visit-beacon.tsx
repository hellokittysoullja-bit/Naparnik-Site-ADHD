'use client'

import { useEffect } from 'react'
import { hasAttribution, readAttribution } from '@/lib/visitor'

const SEEN = 'naparnik:visit'

/**
 * Анонимный ID и источник перехода ставит сервер (`POST /api/visit`) — после загрузки страницы и в простое, чтобы
 * запрос не спорил с первым экраном за сеть и поток (research/19 §1.3). Раньше это делал proxy.ts в ответе на саму
 * страницу — функция на первом визите каждого нового посетителя.
 *
 * Повторно — только когда в адресе метка ролика (обновить «последний вход») или устройство забыло, что уже было.
 * Наружу уходят только параметры источника (`utm_*`, `src`); фрагмент адреса (ответы теста) — никогда.
 */
export function VisitBeacon() {
  useEffect(() => {
    const attribution = readAttribution(new URLSearchParams(window.location.search))
    let seen = false
    try {
      seen = window.localStorage.getItem(SEEN) === '1'
    } catch {
      /* хранилище недоступно — спросим сервер, он сам не перезапишет существующий ID */
    }
    if (seen && !hasAttribution(attribution)) return

    let idle = 0
    let timer = 0
    const send = () => {
      void fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: attribution }),
        credentials: 'same-origin',
        keepalive: true,
      })
        .then((res) => {
          if (!res.ok) return
          try {
            window.localStorage.setItem(SEEN, '1')
          } catch {
            /* не страшно: в следующий раз спросим ещё раз */
          }
        })
        .catch(() => {})
    }
    const schedule = () => {
      // Safari до 26 не знает requestIdleCallback
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(send, { timeout: 2000 })
      else timer = setTimeout(send, 300) as unknown as number
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
