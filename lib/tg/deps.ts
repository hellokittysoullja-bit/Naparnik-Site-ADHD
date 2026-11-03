import { breakdownTask } from '@/lib/breakdown'
import { getStore } from './store'
import { sign, tg } from './telegram'
import type { Deps } from './bot'

/** Настоящие зависимости бота: Upstash (или память), Telegram API, дробление задач нейросетью */
export function liveDeps(site: string): Deps {
  return {
    store: getStore().store,
    send: (method, body) => tg(method, body),
    now: () => Date.now(),
    site,
    breakdown: (task) => breakdownTask(task),
    sign,
  }
}

/** Адрес сайта для ссылок: прод-домен, а на превью — адрес самого превью */
export function siteOf(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
}
