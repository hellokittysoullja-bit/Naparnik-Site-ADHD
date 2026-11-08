import { NextResponse, type NextRequest } from 'next/server'
import {
  ATTRIBUTION_MAX_AGE_S,
  FIRST_TOUCH_COOKIE,
  HANDOFF_HOME,
  HANDOFF_NID,
  HOME_COOKIE,
  LAST_TOUCH_COOKIE,
  NID_COOKIE,
  YEAR_S,
  encodeAttribution,
  hasAttribution,
  isNid,
  newNid,
  readAttribution,
} from '@/lib/visitor'
import { entryVariantKey } from '@/content/entry-variants'

/**
 * Серверный шаг перед страницей (Next 16: proxy.ts — бывший middleware). Работает НЕ на каждом запросе — только когда
 * нужен (matcher ниже): у посетителя ещё нет `nid`, в адресе метка ролика (`utm_*`, `src`) или разовый перенос со
 * старого домена (`_nid`). Остальные запросы, включая лендинг вернувшегося, идут прямо из CDN, как раньше.
 *
 * 1. `nid` — анонимный ID на 1 год, httpOnly (как `logged_out_uuid` Duolingo); серверный, поэтому Safari его не режет.
 * 2. Источник — первый вход (`n_ft`, не перезаписывается) и последний (`n_lt`), 90 дней, httpOnly.
 * 3. `/?src=<ключ>` — лендинг с заголовком этого ролика (content/entry-variants.ts), адрес не меняется.
 * 4. Переезд на свой домен: next.config.mjs уводит со старого адреса с `?_nid=…&_home=1`; здесь ID и метка «свой»
 *    ставятся на новом домене, а разовые параметры убираются из адреса.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl
  const secure = url.protocol === 'https:' || process.env.NODE_ENV === 'production'
  const base = { path: '/', sameSite: 'lax' as const, secure, httpOnly: true }

  // 4. Перенос со старого домена: ставим перенесённое и открываем тот же адрес без служебных параметров
  if (url.searchParams.has(HANDOFF_NID) || url.searchParams.has(HANDOFF_HOME)) {
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

  // Сервер дальше по цепочке (API, страницы) видит тот же nid уже в этом запросе
  let nid = request.cookies.get(NID_COOKIE)?.value
  const fresh = !isNid(nid)
  if (fresh) nid = newNid()
  const headers = new Headers(request.headers)
  headers.set('x-nid', nid as string)

  // 3. Заголовок под ролик: только на лендинге и только для известного ключа
  const variant = url.pathname === '/' ? entryVariantKey(url.searchParams.get('src')) : null
  const res = variant
    ? NextResponse.rewrite(new URL(`/v/${variant}${url.search}`, url), { request: { headers } })
    : NextResponse.next({ request: { headers } })

  // 1. Анонимный ID
  if (fresh) res.cookies.set({ name: NID_COOKIE, value: nid as string, maxAge: YEAR_S, ...base })

  // 2. Источник перехода: первый — один раз, последний — каждый раз, когда в адресе есть метка
  const attribution = readAttribution(url.searchParams)
  if (hasAttribution(attribution)) {
    const value = encodeAttribution(attribution)
    if (!request.cookies.has(FIRST_TOUCH_COOKIE)) {
      res.cookies.set({ name: FIRST_TOUCH_COOKIE, value, maxAge: ATTRIBUTION_MAX_AGE_S, ...base })
    }
    res.cookies.set({ name: LAST_TOUCH_COOKIE, value, maxAge: ATTRIBUTION_MAX_AGE_S, ...base })
  }
  return res
}

// Страницы — без API, статики Next и файлов с расширением (шрифты, кот, видео сцены, robots, sitemap).
// Значения — литералы: Next читает matcher на этапе сборки, переменные не понимает.
export const config = {
  matcher: [
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', missing: [{ type: 'cookie', key: 'nid' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'src' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'utm_source' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'utm_medium' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'utm_campaign' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'utm_content' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: 'utm_term' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_nid' }] },
    { source: '/((?!api|_next/static|_next/image|.*\\..*).*)', has: [{ type: 'query', key: '_home' }] },
  ],
}
