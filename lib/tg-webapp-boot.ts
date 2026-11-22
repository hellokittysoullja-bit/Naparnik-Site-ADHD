/**
 * Мини-апп в Telegram, ранний запуск (21.11, владелец: «сайт 1:1 в боте»). Внутри Telegram открывается тот же сайт —
 * те же страницы и код; этот скрипт только знакомит его с Telegram. Он стоит встроенным в самом начале <head>
 * (app/layout.tsx), поэтому успевает до первой отрисовки:
 *  - узнать, что страница открыта в Telegram, и запомнить параметры запуска (они приходят во фрагменте адреса один раз,
 *    при переходах по сайту их уже нет) — затем убрать их из адреса: там имя и номер человека;
 *  - поставить html[data-tg] и поля экрана, которые сообщает Telegram (--tg-sat/--tg-sab → --sat/--sab в globals.css);
 *  - раскрыть окно на всю высоту, выключить «смахнуть вниз — закрыть» (иначе закрывал бы круг времени, ленту и полено),
 *    покрасить шапку и низ Telegram в цвет сцены;
 *  - сказать Telegram «готово», только когда первый кадр готов (после снятия html[data-hold], lib/first-frame.ts):
 *    до этого Telegram держит свою заставку, и человек не видит пустого кадра.
 * Остальное (кнопка «Назад», ссылки, облачная память) — в lib/tg-webapp-runtime.ts, он грузится только в Telegram.
 *
 * Протокол — тот же, что у официального telegram-web-app.js (его подключить нельзя и не нужно: чужой скрипт с
 * telegram.org запрещён CSP и стоил бы запроса на каждом запуске): в приложениях Telegram события уходят в
 * window.TelegramWebviewProxy.postEvent, а приходят в window.Telegram.WebView.receiveEvent; в Telegram в браузере
 * (web.telegram.org, страница во фрейме) — postMessage с родителем.
 *
 * Без внешних ссылок и импортов: в HTML уходит её исходный текст (tgBootScript). Вне Telegram — ничего не делает.
 */
export type TgBridge = {
  /** параметры запуска: tgWebAppData, tgWebAppVersion, tgWebAppPlatform… */
  p: Record<string, string>
  post: (type: string, data?: unknown) => void
  on: (type: string, fn: (data: unknown) => void) => () => void
  /** версия Bot API клиента не ниже v («7.7») */
  ok: (v: string) => boolean
  iframe: boolean
}

export const TG_ORIGIN = 'https://web.telegram.org'
/** цвет шапки и низа Telegram до того, как код страницы выберет свой (lib/tg-webapp-runtime.ts) */
export const TG_DEFAULT_COLOR = '#060c1f'

export function tgBoot(w: Window, d: Document, ORIGIN: string, COLOR: string): void {
  try {
    const W = w as unknown as Record<string, unknown> & { Telegram?: Record<string, unknown> }
    const h = d.documentElement
    const KEY = 'naparnik:tgwa'
    let p: Record<string, string> = {}
    const hash = w.location.hash
    if (hash.indexOf('tgWebApp') >= 0) {
      const q = new URLSearchParams(hash.slice(1))
      const rest = new URLSearchParams()
      q.forEach((v, k) => {
        if (k.indexOf('tgWebApp') === 0) p[k] = v
        else rest.append(k, v)
      })
      try {
        w.sessionStorage.setItem(KEY, JSON.stringify(p))
      } catch {
        /* без sessionStorage параметры живут до первого перехода с перезагрузкой — сайт всё равно работает */
      }
      const r = rest.toString()
      try {
        w.history.replaceState(w.history.state, '', w.location.pathname + w.location.search + (r ? '#' + r : ''))
      } catch {
        /* адрес не поменять — не страшно */
      }
    } else {
      try {
        p = JSON.parse(w.sessionStorage.getItem(KEY) || '{}') || {}
      } catch {
        p = {}
      }
    }
    const proxy = W.TelegramWebviewProxy as { postEvent?: (t: string, d: string) => void } | undefined
    let iframe = false
    try {
      iframe = w.parent !== w
    } catch {
      iframe = true
    }
    // В Telegram — только при параметрах запуска И канале к Telegram: чужая ссылка с «#tgWebApp…» в обычном браузере
    // ничего не включает
    if (!p.tgWebAppVersion || !(proxy && typeof proxy.postEvent === 'function') && !iframe) return

    const subs: Record<string, ((data: unknown) => void)[]> = {}
    const receive = (type: string, data: unknown) => {
      const list = subs[type]
      if (list) for (const fn of list.slice()) {
        try {
          fn(data)
        } catch {
          /* один подписчик не роняет остальных */
        }
      }
    }
    const post = (type: string, data?: unknown) => {
      const body = data === undefined ? '' : data
      try {
        if (proxy && typeof proxy.postEvent === 'function') proxy.postEvent(type, JSON.stringify(body))
        else if (iframe) w.parent.postMessage(JSON.stringify({ eventType: type, eventData: body }), ORIGIN)
      } catch {
        /* Telegram не принял событие — сайт работает и без него */
      }
    }
    const on = (type: string, fn: (data: unknown) => void) => {
      if (!subs[type]) subs[type] = []
      subs[type].push(fn)
      return () => {
        subs[type] = (subs[type] || []).filter((f) => f !== fn)
      }
    }
    const num = (v: string) => v.split('.').map((x) => parseInt(x, 10) || 0)
    const ok = (v: string) => {
      const a = num(p.tgWebAppVersion || '6.0')
      const b = num(v)
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0)
      }
      return true
    }
    // приёмник событий от приложений Telegram — те же имена, что у официального скрипта
    if (!W.Telegram) W.Telegram = {}
    const T = W.Telegram as Record<string, unknown>
    if (!T.WebView) T.WebView = {}
    const WV = T.WebView as Record<string, unknown>
    WV.receiveEvent = receive
    W.TelegramGameProxy_receiveEvent = receive
    W.TelegramGameProxy = { receiveEvent: receive }
    if (iframe) {
      w.addEventListener('message', (e: MessageEvent) => {
        if (e.source !== w.parent || e.origin !== ORIGIN) return
        let m: { eventType?: string; eventData?: unknown } | null = null
        try {
          m = JSON.parse(e.data)
        } catch {
          return
        }
        if (!m || !m.eventType) return
        if (m.eventType === 'reload_iframe') {
          post('iframe_will_reload')
          w.location.reload()
        } else receive(m.eventType, m.eventData)
      })
      post('iframe_ready', { reload_supported: true })
    }
    const bridge: TgBridge = { p, post, on, ok, iframe }
    W.__tg = bridge
    h.setAttribute('data-tg', p.tgWebAppPlatform || 'unknown')

    // поля экрана: системные (вырез, «домой») плюс кнопки Telegram поверх окна
    const area = { s: { top: 0, bottom: 0 }, c: { top: 0, bottom: 0 } }
    const px = (v: unknown) => (typeof v === 'number' && v >= 0 && v < 400 ? v : 0)
    const put = () => {
      h.style.setProperty('--tg-sat', area.s.top + area.c.top + 'px')
      h.style.setProperty('--tg-sab', area.s.bottom + area.c.bottom + 'px')
    }
    const inset = (k: 's' | 'c') => (data: unknown) => {
      const o = (data || {}) as { top?: unknown; bottom?: unknown }
      area[k] = { top: px(o.top), bottom: px(o.bottom) }
      put()
    }
    on('safe_area_changed', inset('s'))
    on('content_safe_area_changed', inset('c'))

    post('web_app_expand')
    // на телефоне — во весь экран, как зрелые мини-аппы (Bot API 8.0): шапки Telegram нет, его «Назад», «Закрыть» и «⋯»
    // плавают поверх, а их место сайт оставляет пустым через --tg-sat (поля content_safe_area). На компьютере окно
    // мини-аппа остаётся окном: полный экран там занял бы весь монитор
    const mobile = /^(ios|android|android_x)$/.test(p.tgWebAppPlatform || '')
    if (mobile && ok('8.0') && p.tgWebAppFullscreen !== '1') post('web_app_request_fullscreen')
    if (mobile) h.setAttribute('data-tg-fs', '')
    if (ok('7.7')) post('web_app_setup_swipe_behavior', { allow_vertical_swipe: false })
    if (ok('6.9')) post('web_app_set_header_color', { color: COLOR })
    if (ok('6.1')) post('web_app_set_background_color', { color: COLOR })
    if (ok('7.10')) post('web_app_set_bottom_bar_color', { color: COLOR })
    if (ok('8.0')) {
      post('web_app_request_safe_area')
      post('web_app_request_content_safe_area')
    }

    // «готово» — после первого готового кадра: без html[data-hold] и после двух кадров браузера (первый — отрисовка)
    let sent = false
    const ready = () => {
      if (sent) return
      sent = true
      post('web_app_ready')
    }
    const frame = () => {
      if (h.hasAttribute('data-hold')) return
      if (typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(() => w.requestAnimationFrame(ready))
      else ready()
    }
    const whenParsed = () => {
      frame()
      if (!sent && typeof MutationObserver === 'function') {
        const mo = new MutationObserver(() => {
          if (!h.hasAttribute('data-hold')) {
            mo.disconnect()
            frame()
          }
        })
        mo.observe(h, { attributes: true, attributeFilter: ['data-hold'] })
      }
    }
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', whenParsed)
    else whenParsed()
    // страховка: заставка Telegram не висит дольше 3 с, что бы ни случилось со страницей
    w.setTimeout(ready, 3000)
  } catch {
    /* вне Telegram или старый клиент — обычный сайт */
  }
}

export function tgBootScript(): string {
  return `(${tgBoot.toString()})(window,document,${JSON.stringify(TG_ORIGIN)},${JSON.stringify(TG_DEFAULT_COLOR)})`
}
