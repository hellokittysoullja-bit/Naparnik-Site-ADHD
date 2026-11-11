import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fail, handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'
import {
  ATTRIBUTION_MAX_AGE_S,
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  NID_COOKIE,
  YEAR_S,
  encodeAttribution,
  hasAttribution,
  isNid,
  newNid,
  readAttribution,
} from '@/lib/visitor'

/**
 * Анонимный ID и источник перехода — после первой отрисовки, а не в ответе на саму страницу (research/19 §1.3):
 * HTML первого визита идёт прямо из CDN, без функции. Ставит СЕРВЕР (httpOnly, как `app/api/home`): cookie от скрипта
 * Safari держит ~7 дней.
 *
 * Идентичность — только из cookie `nid`: заголовок `x-nid` или поле тела от клиента не читаются никогда.
 * Тело — только параметры источника из адреса (`utm_*`, `src`); их значения ещё раз чистит readAttribution.
 */
const Body = z.object({ a: z.record(z.string(), z.string()).optional() })

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'visit', 20)
  const parsed = Body.safeParse(await readJsonBody(req, 1024))
  if (!parsed.success) return fail(400)
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(parsed.data.a ?? {})) params.set(k, v)
  const attribution = readAttribution(params)

  const cookies = parseCookies(req.headers.get('cookie'))
  const secure = process.env.NODE_ENV === 'production'
  const base = { path: '/', sameSite: 'lax' as const, secure, httpOnly: true }
  const res = new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

  if (!isNid(cookies.get(NID_COOKIE))) {
    res.cookies.set({ name: NID_COOKIE, value: newNid(), maxAge: YEAR_S, ...base })
  }
  // первый вход — один раз, последний — каждый раз, когда в адресе есть метка
  if (hasAttribution(attribution)) {
    const value = encodeAttribution(attribution)
    if (!cookies.has(FIRST_TOUCH_COOKIE)) {
      res.cookies.set({ name: FIRST_TOUCH_COOKIE, value, maxAge: ATTRIBUTION_MAX_AGE_S, ...base })
    }
    res.cookies.set({ name: LAST_TOUCH_COOKIE, value, maxAge: ATTRIBUTION_MAX_AGE_S, ...base })
  }
  return res
})

function parseCookies(header: string | null): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out.set(part.slice(0, i).trim(), part.slice(i + 1).trim())
  }
  return out
}
