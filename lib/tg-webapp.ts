import type { TgBridge } from './tg-webapp-boot'

/**
 * Мини-апп в Telegram: маленькие помощники для кода страниц (без зависимостей, чтобы не тянуть лишнего в общий пакет).
 * Мост ставит ранний скрипт lib/tg-webapp-boot.ts; вне Telegram всё здесь молча ничего не делает.
 */
export function tgBridge(): TgBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { __tg?: TgBridge }).__tg ?? null
}

export const inTelegram = () => tgBridge() !== null

/** подписанные Telegram данные запуска (кто открыл мини-апп) — сервер проверяет подпись, lib/tg/webapp.ts */
export function tgInitData(): string | null {
  return tgBridge()?.p.tgWebAppData || null
}

const TG_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'])

/**
 * Ссылка наружу из мини-аппа. Ссылка на Telegram (бот, канал) открывается самим Telegram, иначе окно мини-аппа
 * ушло бы со страницы сайта на t.me; остальные — во внешнем браузере. false — не Telegram или ссылка своя.
 */
export function tgOpenLink(href: string): boolean {
  const tg = tgBridge()
  if (!tg) return false
  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.origin === window.location.origin) return false
  if (TG_HOSTS.has(url.hostname)) {
    if (!tg.ok('6.1')) return false
    tg.post('web_app_open_tg_link', { path_full: url.pathname + url.search })
    return true
  }
  tg.post('web_app_open_link', { url: url.href })
  return true
}

/** вызов метода Telegram с ответом (облачное хранилище и т. п.): custom_method_invoked по номеру запроса */
let seq = 0
export function tgInvoke<T = unknown>(method: string, params: Record<string, unknown>, timeoutMs = 6000): Promise<T> {
  const tg = tgBridge()
  if (!tg) return Promise.reject(new Error('not in telegram'))
  const id = `n${Date.now().toString(36)}${(seq++).toString(36)}`
  return new Promise<T>((resolve, reject) => {
    const off = tg.on('custom_method_invoked', (data) => {
      const d = (data ?? {}) as { req_id?: string; result?: unknown; error?: unknown }
      if (d.req_id !== id) return
      off()
      window.clearTimeout(timer)
      if (d.error) reject(new Error(String(d.error)))
      else resolve(d.result as T)
    })
    const timer = window.setTimeout(() => {
      off()
      reject(new Error('timeout'))
    }, timeoutMs)
    tg.post('web_app_invoke_custom_method', { req_id: id, method, params })
  })
}
