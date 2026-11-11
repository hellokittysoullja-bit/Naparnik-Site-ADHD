import { NextResponse, type NextRequest } from 'next/server'
import { HANDOFF_TOKEN, verifyHandoff } from '@/lib/handoff'
import { HANDOFF_HOME, HANDOFF_NID, HOME_COOKIE, NID_COOKIE, YEAR_S, isNid } from '@/lib/visitor'

/**
 * Серверный шаг перед страницей (Next 16: proxy.ts — бывший middleware). Работает ТОЛЬКО на разовом переносе со
 * старого домена: app/api/handoff на старом адресе выдаёт подписанный жетон `?_t=…` (lib/handoff.ts), здесь — на
 * домене CANONICAL_HOST — ID и метка «свой» ставятся, а жетон убирается из адреса.
 *
 * Жетон принимается, только если подпись верна (VISIT_SECRET), срок 5 минут не вышел и домен — наш новый. Голые
 * `?_nid=…&_home=1` прежнего формата ставили ID любому, кто открыл ссылку, на любом домене (фиксация ID,
 * research/19-perf-security/security-audit.md §2.2) — теперь они просто убираются из адреса.
 *
 * Первый визит нового посетителя сюда не попадает (research/19 §1.3): `nid` и источник ставит `POST /api/visit` после
 * первой отрисовки, лендинг под ролик (`?src=`) — статические rewrites (next.config.ts). Заголовок `x-nid` дальше по
 * цепочке не передаётся: идентичность — только из cookie.
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl
  const secure = url.protocol === 'https:' || process.env.NODE_ENV === 'production'
  const base = { path: '/', sameSite: 'lax' as const, secure, httpOnly: true }

  const token = url.searchParams.get(HANDOFF_TOKEN)
  const clean = url.clone()
  for (const k of [HANDOFF_TOKEN, HANDOFF_NID, HANDOFF_HOME]) clean.searchParams.delete(k)
  const res = NextResponse.redirect(clean, 307)

  const target = process.env.CANONICAL_HOST?.trim().toLowerCase()
  const host = (request.headers.get('host') ?? url.host).split(':')[0].toLowerCase()
  const carried = target && host === target ? await verifyHandoff(token, process.env.VISIT_SECRET, target) : null
  if (carried) {
    if (carried.nid && !isNid(request.cookies.get(NID_COOKIE)?.value)) {
      res.cookies.set({ name: NID_COOKIE, value: carried.nid, maxAge: YEAR_S, ...base })
    }
    // метку «свой» читает и клиент (снимает, когда стартов нет) — она не httpOnly, но ставит её сервер
    if (carried.home) res.cookies.set({ name: HOME_COOKIE, value: '1', maxAge: 400 * 86_400, ...base, httpOnly: false })
  }
  return res
}

// Страницы — без API, статики Next и файлов с расширением. Значения — литералы: Next читает matcher на этапе сборки.
export const config = {
  matcher: [
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_t' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_nid' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_home' }] },
  ],
}
