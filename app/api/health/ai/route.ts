import { aiHealth } from '@/lib/ai/health'
import { handle, rateLimit } from '@/lib/api-guard'

/**
 * Состояние ИИ для владельца и внешнего монитора (lib/ai/health.ts). Открывается в браузере:
 *   200 — ИИ отвечает; в теле `ai`: ok | low (баланс подходит к концу) | degraded (основной поставщик выключен, работает запасной)
 *   503 — ИИ выключен: баланс кончился, ключ не принят или поставщики не настроены. Кот отвечает заготовками.
 * `?strict=1` — 503 и на low / degraded: так монитор, который смотрит только на код ответа, предупредит заранее.
 * Сумм, ключей и имён моделей в ответе нет. Баланс спрашивается у поставщика не чаще раза в 5 минут.
 */
export const maxDuration = 10
export const dynamic = 'force-dynamic'

export const GET = handle(async (req) => {
  rateLimit(req, 'health', 30)
  const health = await aiHealth()
  const strict = new URL(req.url).searchParams.get('strict') === '1'
  const bad = health.ai === 'down' || health.ai === 'unconfigured' || (strict && health.ai !== 'ok')
  return Response.json(health, { status: bad ? 503 : 200, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
})
