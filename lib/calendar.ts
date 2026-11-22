/**
 * Файл календаря на завтра. В браузере собирается на устройстве и никуда не уходит: пока нет бота, это единственное
 * настоящее напоминание, которое мы можем дать, ничего не обещая сверх этого.
 *
 * Мини-апп в Telegram (21.11) файл из памяти страницы скачать не даёт — только по адресу (web_app_request_file_download).
 * Там файл собирает /api/ics по времени и словам «когда»; текст шага на сервер не уходит (адреса попадают в журнал
 * запросов), поэтому в Telegram у события общее название.
 */
export const ICS_TITLE = '2 минуты с Напарником'

const pad = (n: number) => String(n).padStart(2, '0')
/** «плавающее» местное время: календарь покажет ровно выбранный час в поясе устройства */
export const icsStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

/** start — уже готовая отметка icsStamp (местное время без пояса) */
export function icsText(start: string, when: string, title: string, origin: string, now = new Date()): string {
  const y = +start.slice(0, 4)
  const mo = +start.slice(4, 6)
  const d = +start.slice(6, 8)
  const h = +start.slice(9, 11)
  const mi = +start.slice(11, 13)
  const end = icsStamp(new Date(y, mo - 1, d, h, mi + 2))
  const esc = (t: string) => t.replace(/[\;,]/g, (ch) => `\\${ch}`).replace(/\n/g, '\\n')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Naparnik//RU',
    'BEGIN:VEVENT',
    `UID:${now.getTime()}@naparnik`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Когда ${when} — ${origin}/app/session`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Бронь завтрашней сессии: файл календаря с напоминанием в момент начала. */
export function downloadIcs(when: string, time: string, title = ICS_TITLE) {
  const [h, m] = time.split(':').map(Number)
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(h, m, 0, 0)
  const at = icsStamp(start)
  const tg = (window as unknown as { __tg?: { post: (t: string, d?: unknown) => void; ok: (v: string) => boolean } }).__tg
  if (tg) {
    // слова «когда» человек мог написать сам («после пары», с запятыми) — на сервер их не шлём: общее «завтра»
    const url = `${window.location.origin}/api/ics?${new URLSearchParams({ at, w: 'завтра' })}`
    if (tg.ok('8.0')) tg.post('web_app_request_file_download', { url, file_name: 'naparnik.ics' })
    else tg.post('web_app_open_link', { url })
    return
  }
  const url = URL.createObjectURL(new Blob([icsText(at, when, title, window.location.origin)], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'naparnik.ics'
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
