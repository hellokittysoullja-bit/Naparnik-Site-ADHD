import { NextResponse, type NextRequest } from 'next/server'
import { HANDOFF_HOME, HANDOFF_NID, HOME_COOKIE, NID_COOKIE, YEAR_S, isNid } from '@/lib/visitor'

/**
 * Серверный шаг перед страницей (Next 16: proxy.ts — бывший middleware). Работает ТОЛЬКО на разовом переносе со
 * старого домена (`?_nid=…`, `?_home=1`): next.config.ts уводит со старого адреса с этими параметрами, здесь ID и
 * метка «свой» ставятся на новом домене, а параметры убираются из адреса.
 *
 * Первый визит нового посетителя сюда больше не попадает (research/19 §1.3: функция на каждом новом посетителе —
 * +15 мс медианы и выбросы холодного старта до +270 мс): `nid` и источник ставит `POST /api/visit` после первой
 * отрисовки (components/visit-beacon.tsx), лендинг под ролик (`?src=`) подставляют статические rewrites
 * (next.config.ts). Заголовок `x-nid` дальше по цепочке не передаётся: идентичность — только из cookie.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl
  const secure = url.protocol === 'https:' || process.env.NODE_ENV === 'production'
  const base = { path: '/', sameSite: 'lax' as const, secure, httpOnly: true }

  const carried = url.searchParams.get(HANDOFF_NID)
  const home = url.searchParams.get(HANDOFF_HOME) === '1'
  const clean = url.clone()
  clean.searchParams.delete(HANDOFF_NID)
  clean.searchParams.delete(HANDOFF_HOME)
  const res = NextResponse.redirect(clean, 307)
  if (isNid(carried) && !isNid(request.cookies.get(NID_COOKIE)?.value)) {
    res.cookies.set({ name: NID_COOKIE, value: carried, maxAge: YEAR_S, ...base })
  }
  // метку «свой» читает и клиент (снимает, когда стартов нет) — она не httpOnly, но ставит её сервер
  if (home) res.cookies.set({ name: HOME_COOKIE, value: '1', maxAge: 400 * 86_400, ...base, httpOnly: false })
  return res
}

// Страницы — без API, статики Next и файлов с расширением. Значения — литералы: Next читает matcher на этапе сборки.
export const config = {
  matcher: [
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_nid' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_home' }] },
  ],
}
