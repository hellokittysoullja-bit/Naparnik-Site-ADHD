import { BLOCKER_KEYS, MOTIVE_KEYS, findsLabel, homeExample, homeHint } from './home-step'
import { LANDMARK_COUNT } from './island-elements'
import { RIDGE } from './sky'
import { HOLD_MS, HOLD_ROUTES } from './first-frame-routes'

/**
 * Первый кадр /app при обновлении — сразу свой (владелец 16.11, запись экрана: Дом на миг показывал «курсовая» или
 * «почта» и сферу «Дом», потом прыгал на «написать маме» и «Написать»).
 *
 * Страницы /app статические, а всё личное живёт только на устройстве (localStorage). Поэтому HTML всегда нёс вариант
 * «пустой памяти и ночи», а свой React ставил уже после загрузки кода: Дом менял пример в поле, сферу и строку над
 * кнопкой; фон — небо (днём ночь сменялась днём), ориентиры на гряде, луну и сияние; меню — точку «есть новое» у Мира
 * и минуты идущей сессии у Фокуса.
 *
 * Эта функция уходит в HTML встроенным скриптом в самом начале каркаса /app (app/app/layout.tsx) — до фона и экранов,
 * поэтому выполняется раньше, чем браузер нарисует хоть что-то из них, и не разрывает разбор HTML посередине. Она
 * читает память ТАК ЖЕ, как lib/memory.ts (те же гарды), и ставит атрибуты и CSS-переменные на <html>. Как они
 * выглядят, пока React не прочитал память сам, — описано рядом с разметкой (атрибуты [data-pre] в компонентах и
 * правила «первый кадр» в globals.css и app-backdrop.tsx). Узлы в DOM до гидратации не добавляются и текст не меняется:
 * React счёл бы это расхождением и пересоздал весь экран. Единственное, что меняется в разметке, — атрибут placeholder
 * поля Дома (его нельзя задать из CSS): его ставит наблюдатель за DOM в момент, когда парсер вставил поле, — до отрисовки.
 *
 * Паритет с React проверяет tests/unit/app-prepaint.test.ts. Нет хранилища, битая запись — как у lib/memory.ts:
 * вариант «пустой памяти», небо по часу ставится всё равно.
 */
export type PrepaintData = {
  /** строка над кнопкой Дома: «помеха|мотив» → текст */
  H: Record<string, string>
  /** пример в поле Дома по сфере ('' — без сферы) */
  E: Record<string, string>
  B: readonly string[]
  M: readonly string[]
  /** «находка», «находки», «находок» */
  W: string[]
  /** мест на гряде; стартов до луны */
  R: number
  LC: number
  /** адреса, где страница скрыта до готовности экрана (lib/first-frame.ts), и предел ожидания */
  HOLD: readonly string[]
  HM: number
}

export function prepaintData(): PrepaintData {
  const H: Record<string, string> = {}
  for (const b of ['', ...BLOCKER_KEYS]) for (const m of ['', ...MOTIVE_KEYS]) H[`${b}|${m}`] = homeHint({ blocker: b || undefined, motive: m || undefined })
  const E: Record<string, string> = { '': homeExample(null) }
  for (const s of ['study', 'work', 'home', 'message'] as const) E[s] = homeExample(s)
  const word = (n: number) => findsLabel(n).replace(/^\d+ /, '')
  return { H, E, B: BLOCKER_KEYS, M: MOTIVE_KEYS, W: [word(1), word(2), word(5)], R: RIDGE.length, LC: LANDMARK_COUNT, HOLD: HOLD_ROUTES, HM: HOLD_MS }
}

/* Без внешних ссылок и импортов: в HTML уходит её исходный текст (prepaintScript). */
export function prepaint(w: Window, d: Document, D: PrepaintData): void {
  const h = d.documentElement
  function J(k: string, f: unknown): unknown {
    let r
    try {
      r = w.localStorage.getItem(k)
    } catch {
      return f
    }
    if (r === null) return f
    try {
      return JSON.parse(r)
    } catch {
      return f
    }
  }
  function O(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
  }
  function S(v: unknown): v is string {
    return typeof v === 'string'
  }
  function N(v: unknown): v is number {
    return typeof v === 'number' && isFinite(v)
  }
  function set(k: string, on: boolean, v?: string) {
    if (on) h.setAttribute(k, v === undefined ? '' : v)
    else h.removeAttribute(k)
  }
  function css(k: string, v: string | null) {
    if (v === null) h.style.removeProperty(k)
    else h.style.setProperty(k, JSON.stringify(v))
  }
  // экран с содержимым только на устройстве: страница скрыта, пока он не готов (lib/first-frame.ts); предел — HM
  try {
    const path = w.location ? w.location.pathname.replace(/\/$/, '') : ''
    if (D.HOLD.indexOf(path) >= 0) {
      h.setAttribute('data-hold', '')
      const release = () => h.removeAttribute('data-hold')
      ;(w as unknown as { __nfReady?: () => void }).__nfReady = release
      w.setTimeout(release, D.HM)
    }
  } catch {
    /* без запрета — как раньше */
  }
  try {
    // небо по часу (lib/sky.ts, phaseForHour)
    const hr = new Date().getHours()
    set('data-sky', true, hr < 5 ? 'night' : hr < 9 ? 'dawn' : hr < 17 ? 'day' : hr < 21 ? 'dusk' : 'night')

    // старты и находки — гарды isStart / isFind из lib/memory.ts
    const st = J('naparnik:starts', [])
    let ns = 0
    if (Array.isArray(st))
      for (let i = 0; i < st.length; i++) {
        const x = st[i]
        if (O(x) && S(x.id) && S(x.date) && S(x.startedAt) && S(x.label) && N(x.minutes)) ns++
      }
    const fs = J('naparnik:finds', [])
    let nf = 0
    let aurora = false
    if (Array.isArray(fs))
      for (let j = 0; j < fs.length; j++) {
        const y = fs[j]
        if (O(y) && S(y.key) && S(y.name) && S(y.startId) && N(y.seed) && (y.rarity === 'common' || y.rarity === 'uncommon' || y.rarity === 'rare')) {
          nf++
          if (y.key === 'aurora') aurora = true
        }
      }

    // фон: ориентиры на гряде, луна (с 10-го старта, не в новолуние), сияние
    set('data-lm', true, String(Math.min(ns, D.R)))
    // Мир: сколько мест острова занято (island.tsx, count до LANDMARK_COUNT)
    set('data-island', true, String(Math.min(ns, D.LC)))
    let moon = false
    if (ns >= D.LC) {
      const syn = 29.530588853 * 86400000
      const ph = (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) % syn) + syn) % syn / syn
      const lit = 1 - Math.abs(ph * 2 - 1)
      if (lit > 0.06) {
        moon = true
        h.style.setProperty('--moon-dx', String((ph < 0.5 ? -1 : 1) * (1 - lit) * 1.9 * 6))
      }
    }
    set('data-moon', moon)
    set('data-aurora', aurora)

    // меню: «есть новое» у Мира (getUnseenWorldCount), минуты идущей сессии у Фокуса
    const seen = J('naparnik:worldSeen', 0)
    set('data-world-new', ns - (N(seen) ? seen : 0) > 0)
    const a = J('naparnik:activeSession', null)
    const left = O(a) && N(a.startedAt) && N(a.minutes) && S(a.task) && S(a.startId) ? Math.ceil((a.minutes * 60 - (Date.now() - a.startedAt) / 1000) / 60) : 0
    set('data-focus-left', left > 0)
    css('--focus-left', left > 0 ? left + 'м' : null)

    // Дом: ответы знакомства (peekProfile), находки
    let p: { sphere?: string; hanging?: string; blocker?: string; motive?: string } | null = null
    if (J('naparnik:profileForgotten', false) !== true) {
      const r = J('naparnik:onboarding', null)
      if (O(r)) {
        const g = function (k: string) {
          const v = r && (r as Record<string, unknown>)[k]
          return S(v) ? v.slice(0, 20) : undefined
        }
        const q = { sphere: g('sphere'), hanging: g('hanging'), blocker: g('blocker'), motive: g('motive') }
        if (q.sphere || q.hanging || q.blocker || q.motive) p = q
      }
    }
    const s = p && p.sphere && ['study', 'work', 'home', 'message'].indexOf(p.sphere) >= 0 ? p.sphere : ''
    const b = p && p.blocker && D.B.indexOf(p.blocker) >= 0 ? p.blocker : ''
    const m = p && p.motive && D.M.indexOf(p.motive) >= 0 ? p.motive : ''
    set('data-home-sphere', !!s, s)
    set('data-home-third', !!p && p.sphere === 'message', 'message')
    css('--home-hint', D.H[b + '|' + m])
    const u = nf % 100
    const o = nf % 10
    set('data-home-finds', nf > 0)
    css('--home-finds', nf > 0 ? nf + ' ' + (u >= 11 && u <= 14 ? D.W[2] : o === 1 ? D.W[0] : o >= 2 && o <= 4 ? D.W[1] : D.W[2]) : null)
    if (s) {
      // пример в поле — атрибут, его CSS не задаёт. Поля ещё нет в документе: ставим, как только парсер его вставит.
      // Наблюдатель срабатывает в той же задаче, что и вставка, — до любой отрисовки (кадр между ними невозможен);
      // обработчик кадра (requestAnimationFrame) для этого не годился: Chrome рисовал первый кадр раньше него
      const ex = D.E[s]
      const put = () => {
        const el = d.getElementById('home-task') as HTMLInputElement | null
        if (el) el.placeholder = ex
        return !!el
      }
      if (!put() && d.readyState === 'loading' && typeof MutationObserver === 'function') {
        const mo = new MutationObserver(() => {
          if (put()) mo.disconnect()
        })
        mo.observe(d.documentElement, { childList: true, subtree: true })
        d.addEventListener('DOMContentLoaded', () => mo.disconnect())
      }
    }
  } catch {
    /* как у lib/memory.ts: без памяти — вариант по умолчанию */
  }
}

export function prepaintScript(): string {
  return `(${prepaint.toString()})(window,document,${JSON.stringify(prepaintData()).replace(/</g, '\\u003c')})`
}
