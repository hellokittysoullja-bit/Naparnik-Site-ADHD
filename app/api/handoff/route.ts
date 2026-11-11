import { handle, rateLimit } from '@/lib/api-guard'
import { HANDOFF_TOKEN, HANDOFF_TTL_MS, signHandoff, usableSecret } from '@/lib/handoff'
import { HOME_COOKIE, NID_COOKIE, isNid } from '@/lib/visitor'

/**
 * Переезд на свой домен, шаг на СТАРОМ адресе (next.config.ts уводит сюда вернувшихся с cookie `nid` или «свой»).
 * Подписывает жетон из cookie самого человека (lib/handoff.ts) и уводит на CANONICAL_HOST тот же путь с теми же
 * параметрами. Статический redirect подписать не может — поэтому функция; срабатывает один раз на человека.
 * Нет CANONICAL_HOST — 404; нет секрета VISIT_SECRET — переезд без переноса (лучше потерять ID, чем принять чужой).
 */
export const dynamic = 'force-dynamic'

export const GET = handle(async (req) => {
  // Сюда приходит СТРАНИЦА (redirect из next.config.ts), а не запрос скрипта: отказ 429 был бы пустым белым экраном у
  // человека за общим IP оператора (CGNAT). Поэтому лимит режет только подпись (её и стоит беречь), а переезд идёт
  // всегда — сверх лимита без переноса ID, как без секрета.
  let limited = false
  try {
    rateLimit(req, 'handoff', 30)
  } catch {
    limited = true
  }
  const target = process.env.CANONICAL_HOST?.trim().toLowerCase()
  const url = new URL(req.url)
  if (!target || url.hostname === target) return new Response(null, { status: 404 })

  // только свой путь: «//evil.com» или «/\evil.com» браузер понял бы как чужой адрес
  const to = url.searchParams.get('to') ?? '/'
  const path = /^\/(?![/\\])/.test(to) ? to : '/'
  let dest = new URL(path, `https://${target}`)
  // Проверка первой строкой смотрит только на второй символ, а разбор адреса сначала выбрасывает табуляцию и переносы
  // строк: «/<TAB>/evil.example» проходил её и уводил на чужой сайт — вместе с подписанным жетоном человека.
  // Решает итог разбора: домен назначения обязан быть нашим.
  if (dest.host !== target) dest = new URL('/', `https://${target}`)
  for (const [k, v] of url.searchParams) if (k !== 'to' && !k.startsWith('_')) dest.searchParams.append(k, v)

  const cookies = new Map(
    (req.headers.get('cookie') ?? '').split(';').map((p) => {
      const i = p.indexOf('=')
      // кусок без «=» — не cookie: раньше из него получался ключ без последней буквы
      return (i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : ['', '']) as [string, string]
    }),
  )
  const nid = cookies.get(NID_COOKIE)
  const home = cookies.get(HOME_COOKIE) === '1'
  const secret = process.env.VISIT_SECRET
  if (!limited && usableSecret(secret) && (isNid(nid) || home)) {
    const token = await signHandoff(
      { nid: isNid(nid) ? nid : null, home, host: target, exp: Date.now() + HANDOFF_TTL_MS },
      secret,
    )
    dest.searchParams.set(HANDOFF_TOKEN, token)
  }
  // 307 и no-store: ответ свой у каждого человека, кэшировать его нельзя
  return new Response(null, { status: 307, headers: { Location: dest.toString(), 'Cache-Control': 'no-store' } })
})
