import { NextResponse } from 'next/server'
import { handle, rateLimit, sameOrigin } from '@/lib/api-guard'
import { HOME_COOKIE } from '@/lib/visitor'

/**
 * Метка «уже свой» (`naparnik_home=1`) — её ставит СЕРВЕР, как сессию входа у Duolingo: по ней Vercel уводит с
 * лендинга и знакомства на /app ещё до загрузки страницы (next.config.mjs). Раньше метку писал скрипт
 * (document.cookie), а такие cookie Safari держит ~7 дней — через неделю вернувшийся снова видел кадр лендинга.
 * Серверная cookie живёт 400 дней (предел браузеров). В ней только «1», никаких данных; httpOnly не ставим:
 * клиент снимает метку сам, если стартов нет (lib/memory.ts, markHome).
 *
 * POST — поставить/продлить; DELETE — снять.
 */
const MAX_AGE_S = 400 * 86_400

function cookie(res: NextResponse, value: string, maxAge: number) {
  res.cookies.set({
    name: HOME_COOKIE,
    value,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  })
  return res
}

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'home', 30)
  return cookie(new NextResponse(null, { status: 204 }), '1', MAX_AGE_S)
})

export const DELETE = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'home', 30)
  return cookie(new NextResponse(null, { status: 204 }), '', 0)
})
