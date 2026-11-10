/**
 * Файл календаря на завтра. Собирается в браузере и никуда не уходит: пока нет бота, это единственное настоящее
 * напоминание, которое мы можем дать, ничего не обещая сверх этого.
 */

/** Бронь завтрашней сессии: файл календаря с напоминанием в момент начала. Собирается в браузере, никуда не уходит. */
export function downloadIcs(when: string, time: string, title = '2 минуты с Напарником') {
  const [h, m] = time.split(':').map(Number)
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(h, m, 0, 0)
  const end = new Date(start.getTime() + 2 * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  // «плавающее» местное время: календарь покажет ровно выбранный час в поясе устройства
  const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
  const esc = (t: string) => t.replace(/[\\;,]/g, (ch) => `\\${ch}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Naparnik//RU',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@naparnik`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Когда ${when} — ${window.location.origin}/app/session`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(title)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'naparnik.ics'
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
