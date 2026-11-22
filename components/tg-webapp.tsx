'use client'

import { useEffect } from 'react'

/**
 * Мини-апп в Telegram: после загрузки страницы подключает lib/tg-webapp-runtime.ts — только если ранний скрипт
 * (lib/tg-webapp-boot.ts) узнал Telegram. В браузере это пустой эффект: кода мини-аппа в пакете страницы нет.
 */
export function TgWebApp() {
  useEffect(() => {
    if (!(window as unknown as { __tg?: unknown }).__tg) return
    void import('@/lib/tg-webapp-runtime').then((m) => m.startTelegram())
  }, [])
  return null
}
