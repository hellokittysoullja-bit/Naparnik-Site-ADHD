import { ICS_TITLE, icsText } from '@/lib/calendar'
import { rateLimit } from '@/lib/api-guard'

/**
 * Файл календаря для мини-аппа в Telegram (lib/calendar.ts): там скачать можно только по адресу. Принимает только
 * время и короткое «когда»; ничего не хранит. Текста шага здесь нет намеренно — адрес попадает в журнал запросов.
 */
export const dynamic = 'force-dynamic'

const AT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})00$/
const WHEN = /^[\p{L}\p{N} .:-]{1,40}$/u

export async function GET(req: Request) {
  try {
    rateLimit(req, 'ics', 20)
  } catch (r) {
    return r as Response
  }
  const q = new URL(req.url).searchParams
  const at = q.get('at') ?? ''
  const when = (q.get('w') ?? 'завтра').trim()
  const m = AT.exec(at)
  if (!m || !WHEN.test(when) || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31 || +m[4] > 23 || +m[5] > 59) {
    return new Response('bad request', { status: 400 })
  }
  return new Response(icsText(at, when, ICS_TITLE, new URL(req.url).origin), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="naparnik.ics"',
      'cache-control': 'no-store',
    },
  })
}
