'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'
import { useReportWebVitals } from 'next/web-vitals'
import { trackVital } from '@/lib/events'

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
  // Web Vitals с настоящих телефонов (в т. ч. iPhone: Safari 26.2+ отдаёт LCP и INP) — библиотека web-vitals, которая
  // уже есть внутри Next (next/web-vitals), без новой зависимости; что именно уходит — lib/events.ts, vitalPayload
  useReportWebVitals(trackVital)
  return <Analytics beforeSend={pathOnly} />
}
