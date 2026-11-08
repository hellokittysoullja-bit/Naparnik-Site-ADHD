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

export function trackEvent(name: FunnelEvent): void {
  try {
    track(name)
  } catch {
    /* аналитика не обязательна */
  }
}
