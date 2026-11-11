/**
 * Общая защита AI-маршрутов (app/api/*). Каждый вызов модели стоит денег и квоты ключа: без этих проверок любой
 * скрипт мог гонять /api/companion как бесплатный Gemini-прокси (тело до 4,5 МБ ≈ миллион токенов за запрос), а
 * free-tier квота кончалась бы за минуты — и ИИ выключался бы у всех, незаметно (скриптовый фолбэк всё прятал).
 *
 * Клиент на любой не-2xx уходит в скриптовый ответ напарника — поэтому отказ здесь никогда не ломает интерфейс.
 */

/** Пустой ответ с кодом: наружу — никаких подробностей, стек только в логах сервера. */
export const fail = (status: number, headers?: HeadersInit) => new Response(null, { status, headers })

/**
 * Тело JSON с потолком размера. (1) Только `application/json`: наши клиенты шлют его всегда, а «простые» запросы
 * (text/plain, формы) — то, чем чужая страница стучится без предварительного запроса браузера. (2) Потолок проверяем
 * и по заявленной длине, и по фактической — и читаем поток по кускам: без Content-Length (chunked) раньше тело
 * целиком ложилось в память, прежде чем его мерили.
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') throw fail(415)
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > maxBytes) throw fail(413)
  const chunks: Uint8Array[] = []
  let size = 0
  if (req.body) {
    const reader = req.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        void reader.cancel().catch(() => {})
        throw fail(413)
      }
      chunks.push(value)
    }
  }
  const buf = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    buf.set(c, at)
    at += c.byteLength
  }
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
 * Чужой сайт не должен гонять наш API из браузеров своих посетителей. Современные браузеры шлют Sec-Fetch-Site;
 * Safari до 16.4 его не шлёт, но шлёт Origin на любом POST — сверяем его хост с нашим (Origin: null — песочница или
 * чужой редирект — тоже отказ). curl не шлёт ни того, ни другого: от скриптов защищают лимит и потолки выше.
 */
export function sameOrigin(req: Request): void {
  const site = req.headers.get('sec-fetch-site')
  if (site !== null && site !== 'same-origin') throw fail(403)
  const origin = req.headers.get('origin')
  if (origin === null) return
  let from: string
  try {
    from = new URL(origin).host
  } catch {
    throw fail(403)
  }
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? new URL(req.url).host
  if (from !== host) throw fail(403)
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
