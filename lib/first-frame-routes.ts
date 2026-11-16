/** Адреса, где страница скрыта до готовности экрана, и предел ожидания (lib/first-frame.ts). Без React: их читает и
 * скрипт первого кадра, который собирается на сервере (lib/app-prepaint.ts). */
export const HOLD_MS = 1500

export const HOLD_ROUTES = ['/app/session', '/app/start', '/app/stuck', '/app/chat', '/app/deals', '/app/world'] as const
