'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

/**
 * Обезличенная статистика Vercel. В аналитику уходит только путь: без параметров и без фрагмента адреса — там шаги и
 * ответы теста (/sdvg-test: ответы ВОЗ во фрагменте), метки ролика и текст шага сессии. Ничего из этого видеть ей не
 * нужно (research/14, приватность).
 */
function pathOnly(event: BeforeSendEvent): BeforeSendEvent {
  try {
    const u = new URL(event.url)
    return { ...event, url: `${u.origin}${u.pathname}` }
  } catch {
    return event
  }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={pathOnly} />
}
