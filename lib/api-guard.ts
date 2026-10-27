/**
 * Общая защита AI-маршрутов (app/api/*). Каждый вызов модели стоит денег и квоты ключа: без этих проверок любой
 * скрипт мог гонять /api/companion как бесплатный Gemini-прокси (тело до 4,5 МБ ≈ миллион токенов за запрос), а
 * free-tier квота кончалась бы за минуты — и ИИ выключался бы у всех, незаметно (скриптовый фолбэк всё прятал).
 *
 * Клиент на любой не-2xx уходит в скриптовый ответ напарника — поэтому отказ здесь никогда не ломает интерфейс.
 */

/** Пустой ответ с кодом: наружу — никаких подробностей, стек только в логах сервера. */
export const fail = (status: number, headers?: HeadersInit) => new Response(null, { status, headers })

/** Тело с потолком размера: проверяем и заявленную длину, и фактическую (заголовок можно подделать). */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > maxBytes) throw fail(413)
  const buf = await req.arrayBuffer()
  if (buf.byteLength > maxBytes) throw fail(413)
  try {
    return JSON.parse(new TextDecoder().decode(buf))
  } catch {
    throw fail(400)
  }
}

/**
 * Лимит запросов на IP: скользящее окно в памяти экземпляра функции. Это не распределённый счётчик — у каждого
 * тёплого экземпляра свой, — но цикл из одного источника он режет сразу, бесплатно и без внешних сервисов.
 * Глобальный потолок — правило Vercel Firewall (Rate Limit на /api/*) и квота/бюджет ключа в Google Cloud.
 */
const hits = new Map<string, number[]>()
function clientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
export function rateLimit(req: Request, bucket: string, limit: number, windowMs = 60_000): void {
  const now = Date.now()
  const key = `${bucket}:${clientIp(req)}`
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    const retry = Math.ceil((windowMs - (now - recent[0])) / 1000)
    throw fail(429, { 'Retry-After': String(retry) })
  }
  recent.push(now)
  hits.set(key, recent)
  // память не растёт бесконечно: изредка выметаем остывшие ключи
  if (hits.size > 5000) {
    for (const [k, ts] of hits) if (now - ts[ts.length - 1] >= windowMs) hits.delete(k)
  }
}

/**
 * Чужой сайт не должен гонять наш API из браузеров своих посетителей. Браузеры всегда шлют Sec-Fetch-Site;
 * curl — нет, от скриптов защищают лимит и потолки выше.
 */
export function sameOrigin(req: Request): void {
  const site = req.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin') throw fail(403)
}

/** Обёртка: брошенный Response — это ответ; всё прочее — 500 без тела. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req)
    } catch (e) {
      if (e instanceof Response) return e
      console.error('[api]', e)
      return fail(500)
    }
  }
}
