import { track } from '@vercel/analytics'

/**
 * Нейтральные события воронки (план «школа 1», фаза 10; тест /sdvg-test). Только имя события — без балла, диапазона,
 * ответов, имени и текста дела: это данные о здоровье (урок Cerebral, research/14). Когда подключим PostHog — тот же
 * вызов, без параметров результата.
 */
export type FunnelEvent =
  | 'test_started'
  | 'test_completed'
  | 'cta_clicked'
  | 'session_started'
  | 'session_completed'
  | 'share_clicked'

/**
 * Полевые замеры скорости (research/19 §1.2): только имя метрики, число, оценка и путь БЕЗ параметров и фрагмента —
 * в адресе шаги и ответы теста, метки ролика, текст шага сессии. Ни ID, ни элемента страницы (attribution) не шлём.
 */
export type VitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
const VITALS = new Set<string>(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])

export function vitalPayload(
  metric: { name: string; value: number; rating?: string },
  pathname: string,
): { name: string; data: { value: number; rating: string; path: string } } | null {
  if (!VITALS.has(metric.name) || !Number.isFinite(metric.value)) return null
  // CLS — доли единицы (три знака), остальное — целые миллисекунды
  const value = metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value)
  const rating = metric.rating === 'good' || metric.rating === 'needs-improvement' || metric.rating === 'poor' ? metric.rating : 'unknown'
  const path = (pathname.split(/[?#]/)[0] || '/').slice(0, 120)
  return { name: `vital_${metric.name}`, data: { value, rating, path } }
}

export function trackVital(metric: { name: string; value: number; rating?: string; navigationURL?: string }): void {
  try {
    // после мягкого перехода метрика может прийти, когда адрес уже другой: путь — той навигации, что мерили
    let pathname = window.location.pathname
    if (metric.navigationURL) pathname = new URL(metric.navigationURL, window.location.href).pathname
    const p = vitalPayload(metric, pathname)
    if (p) track(p.name, p.data)
  } catch {
    /* аналитика не обязательна */
  }
}

export function trackEvent(name: FunnelEvent): void {
  try {
    track(name)
  } catch {
    /* аналитика не обязательна */
  }
}
