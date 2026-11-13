import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Проверка подписи QStash без SDK: заголовок Upstash-Signature — JWT HS256, подписанный текущим или следующим
 * ключом (QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY — их прописывает Vercel при подключении Upstash).
 * В теле токена: iss «Upstash», получатель (sub — адрес, куда QStash шлёт), срок жизни и sha256 тела запроса —
 * подделать вызов «разошли напоминания» нельзя, и подпись для другого адреса сюда не подойдёт.
 */
export function verifyQStash(signature: string | null, body: string, opts: { url?: string; now?: number } = {}): boolean {
  const now = opts.now ?? Date.now()
  const keys = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY].filter(Boolean) as string[]
  if (!signature || keys.length === 0) return false
  const parts = signature.split('.')
  if (parts.length !== 3) return false
  const [head, payload, sig] = parts
  const okSig = keys.some((k) => {
    const want = createHmac('sha256', k).update(`${head}.${payload}`).digest('base64url')
    const a = Buffer.from(want)
    const b = Buffer.from(sig)
    return a.length === b.length && timingSafeEqual(a, b)
  })
  if (!okSig) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      iss?: string
      sub?: string
      exp?: number
      nbf?: number
      body?: string
    }
    const sec = Math.floor(now / 1000)
    if (claims.iss !== 'Upstash') return false
    if (opts.url && claims.sub !== opts.url) return false
    if (typeof claims.exp !== 'number' || sec > claims.exp + 5) return false
    if (claims.nbf && sec < claims.nbf - 5) return false
    const hash = createHash('sha256').update(body).digest('base64url')
    return (claims.body ?? '').replace(/=+$/, '') === hash
  } catch {
    return false
  }
}

/** Расписание «каждые 15 минут» на /api/tg/tick. Один и тот же id — повторная настройка не плодит дубликатов. */
export async function ensureSchedule(destination: string): Promise<'ok' | 'no-token' | 'error'> {
  const token = process.env.QSTASH_TOKEN
  if (!token) return 'no-token'
  const base = (process.env.QSTASH_URL ?? 'https://qstash.upstash.io').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/v2/schedules/${destination}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Upstash-Cron': '*/15 * * * *',
        'Upstash-Schedule-Id': 'naparnik-bot-tick',
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (!res.ok) console.error('[qstash] schedule', res.status, await res.text())
    return res.ok ? 'ok' : 'error'
  } catch (e) {
    console.error('[qstash] schedule', e)
    return 'error'
  }
}
