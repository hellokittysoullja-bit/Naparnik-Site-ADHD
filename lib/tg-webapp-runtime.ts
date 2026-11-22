import { loadManifest, restore, shouldRestore, sync, syncable, type Cloud, type Manifest } from './tg-cloud'
import { tgBridge, tgInvoke, tgOpenLink } from './tg-webapp'
import type { TgBridge } from './tg-webapp-boot'

/**
 * Мини-апп в Telegram, всё, что нужно после загрузки кода (21.11). Грузится только внутри Telegram
 * (components/tg-webapp.tsx), в браузере этого кода нет вовсе. Сайт остаётся тем же; здесь — то, чего у Telegram нет
 * своего или что в его окне ведёт себя иначе:
 *  1. «Назад». В окне Telegram нет кнопки браузера и свайпа назад, а Android-кнопка «назад» закрывает мини-апп.
 *     Сайт ведёт историю (знакомство, разбивка, переходы) — поэтому, пока в истории есть куда вернуться, в шапке
 *     Telegram стоит его кнопка «Назад» и делает то же, что «назад» браузера. На первом экране — «Закрыть».
 *  2. Ссылки наружу: t.me — самим Telegram, остальные — во внешнем браузере (иначе окно мини-аппа уходит с сайта).
 *  3. Цвет шапки и низа Telegram — цвет верха и низа текущего экрана.
 *  4. Идёт сессия Фокуса — закрытие окна спрашивает подтверждение (смахнуть окно случайно легко).
 *  5. Память в облаке Telegram (lib/tg-cloud.ts).
 */

// ——— 1. «Назад» ———
type St = Record<string, unknown> | null

function startBack(tg: TgBridge) {
  if (!tg.ok('6.1')) return
  const h = window.history
  const idxOf = (s: unknown) => (s && typeof s === 'object' && typeof (s as St)!.__tgi === 'number' ? ((s as St)!.__tgi as number) : null)
  let idx = idxOf(h.state) ?? 0
  let shown: boolean | null = null
  const show = () => {
    const v = idx > 0
    if (v === shown) return
    shown = v
    tg.post('web_app_setup_back_button', { is_visible: v })
  }
  const withIdx = (s: unknown, i: number) => ({ ...(s && typeof s === 'object' ? (s as object) : {}), __tgi: i })
  const push = h.pushState.bind(h)
  const replace = h.replaceState.bind(h)
  // номер записи в истории живёт в самой записи: «назад», «вперёд» и перезагрузка его не теряют
  h.pushState = (s: unknown, t: string, u?: string | URL | null) => {
    idx += 1
    push(withIdx(s, idx), t, u)
    show()
  }
  h.replaceState = (s: unknown, t: string, u?: string | URL | null) => {
    replace(withIdx(s, idx), t, u)
  }
  replace(withIdx(h.state, idx), '')
  window.addEventListener('popstate', (e) => {
    idx = idxOf(e.state) ?? 0
    show()
  })
  tg.on('back_button_pressed', () => {
    if (idx > 0) h.back()
  })
  show()
}

// ——— 2. Ссылки наружу ———
function startLinks() {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.hasAttribute('download')) return
      if (tgOpenLink(a.href)) e.preventDefault()
    },
    true,
  )
  const open = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url && tgOpenLink(String(url))) return null
    return open(url, target, features)
  }) as typeof window.open
}

// ——— 3. Цвет шапки ———
/** верх и низ экранов с ночной сценой (лендинг, знакомство, Дом, Фокус, переписка) — средний цвет верхней и нижней
 * строки кадра на 390×844 (21.11: верх #070d20 у лендинга и #050b1e у приложения, низ #040d0a…#0a0e0a) */
export const SCENE_TOP = '#060c1f'
export const SCENE_BOTTOM = '#070d0a'

/** низ нижнего меню /app (.glass-nav в globals.css — полупрозрачный, поверх неба экрана) */
const NAV_BOTTOM = 'oklch(0.17 0.008 130 / 0.68)'

/** цвет css в hex; с base — css, положенный поверх base (для полупрозрачного) */
const toHex = (() => {
  let ctx: CanvasRenderingContext2D | null = null
  return (css: string, base?: string): string | null => {
    try {
      ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      if (!ctx) return null
      ctx.clearRect(0, 0, 1, 1)
      if (base) {
        ctx.fillStyle = base
        ctx.fillRect(0, 0, 1, 1)
      }
      ctx.fillStyle = '#000'
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      if (a === 0) return null
      return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
    } catch {
      return null
    }
  }
})()

function startColors(tg: TgBridge) {
  if (!tg.ok('6.9')) return
  let last = ''
  const paint = () => {
    // экраны с ночной сценой узнаются по самой сцене в DOM; остальные (Мир, «Дела») стоят на небе общего фона —
    // берём первый и последний цвет видимого слоя неба (небо по часу, components/app-backdrop.tsx)
    const scene = document.querySelector('[data-night-scene]')
    let top = SCENE_TOP
    let bottom = SCENE_BOTTOM
    if (!scene) {
      const sky = [...document.querySelectorAll<HTMLElement>('[data-sky-layer]')].find((el) => el.style.opacity === '1')
      const stops = sky?.style.background.match(/(?:oklch|rgba?|lab|hsl)\([^)]*\)|#[0-9a-f]{3,8}/gi)
      top = (stops && toHex(stops[0])) || toHex(getComputedStyle(document.body).backgroundColor) || SCENE_TOP
      bottom = (stops && toHex(stops[stops.length - 1])) || top
    }
    // под нижним меню Telegram на iPhone рисует свою панель (место своих кнопок) — красим её цветом меню, иначе она
    // светлой полосой торчит под полоской «домой» (скриншот владельца 22.11)
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Основная навигация"]')
    if (nav) {
      const cs = getComputedStyle(nav)
      if (cs.visibility !== 'hidden' && Number(cs.opacity) > 0.5) bottom = toHex(NAV_BOTTOM, bottom) || bottom
    }
    const key = top + bottom
    if (key === last) return
    last = key
    tg.post('web_app_set_header_color', { color: top })
    tg.post('web_app_set_background_color', { color: top })
    if (tg.ok('7.10')) tg.post('web_app_set_bottom_bar_color', { color: bottom })
  }
  let raf = 0
  const later = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(paint)
  }
  new MutationObserver(later).observe(document.body, { childList: true, subtree: false, attributes: true })
  window.addEventListener('popstate', later)
  const push = history.pushState
  history.pushState = function (...a: Parameters<History['pushState']>) {
    push.apply(this, a)
    later()
  }
  paint()
  // экран дорисовывается после перехода (сцена монтируется кодом) — ещё раз, когда всё встало
  window.setInterval(paint, 1500)
}

// ——— 4. Подтверждение закрытия во время сессии ———
function startClosing(tg: TgBridge) {
  if (!tg.ok('6.2')) return
  let on: boolean | null = null
  const check = () => {
    let active = false
    try {
      // законченная сессия хранится как "null" (lib/memory.ts clearActiveSession) — это не идущая сессия
      const v = JSON.parse(window.localStorage.getItem('naparnik:activeSession') ?? 'null') as unknown
      active = !!v && typeof v === 'object'
    } catch {
      active = false
    }
    if (active === on) return
    on = active
    tg.post('web_app_setup_closing_behavior', { need_confirmation: active })
  }
  window.addEventListener('naparnik:memory', check)
  window.setInterval(check, 5000)
  check()
}

// ——— 5. Память в облаке ———
export const cloud: Cloud = {
  get: (keys) => tgInvoke<Record<string, string>>('getStorageValues', { keys }).then((r) => (r && typeof r === 'object' ? r : {})),
  set: (key, value) => tgInvoke('saveStorageValue', { key, value }).then(() => undefined),
  del: (keys) => tgInvoke('deleteStorageValues', { keys }).then(() => undefined),
}

/** память устройства; null — хранилище не читается (тогда облако не трогаем: пустой ответ стёр бы копию) */
function localMemory(): Record<string, string> | null {
  const out: Record<string, string> = {}
  try {
    const ls = window.localStorage
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && syncable(k)) {
        const v = ls.getItem(k)
        if (v !== null) out[k] = v
      }
    }
  } catch {
    return null
  }
  return out
}

const RESTORED = 'naparnik:tgRestored'

async function startCloud(tg: TgBridge) {
  if (!tg.ok('6.9')) return
  let partial = false
  let man: Manifest
  try {
    const got = await loadManifest(cloud)
    const local = localMemory()
    if (!local) return
    let once = false
    try {
      once = window.sessionStorage.getItem(RESTORED) === '1'
    } catch {
      once = true
    }
    if (!once && shouldRestore(local, got)) {
      const back = await restore(cloud, got!)
      let wrote = 0
      for (const [k, v] of Object.entries(back)) {
        if (k in local) continue
        try {
          window.localStorage.setItem(k, v)
          wrote++
        } catch {
          /* место кончилось — вернём, что влезло */
        }
      }
      if (wrote < Object.keys(back).filter((k) => !(k in local)).length) partial = true
      if (wrote > 0) {
        try {
          window.sessionStorage.setItem(RESTORED, '1')
        } catch {
          /* без sessionStorage перезагрузка всё равно одна: память уже не пуста */
        }
        // экраны прочитали пустую память при загрузке — открываем заново, уже со своей (вернувшийся — сразу Дом)
        const home = 'naparnik:starts' in back || 'naparnik:onboarding' in back
        const here = window.location.pathname
        window.location.replace(home && (here === '/' || here === '/app/start') ? '/app' : window.location.href)
        return
      }
    }
    man = got ?? { v: 1, k: {} }
  } catch {
    // облако не ответило — копируем с нуля в следующий раз, сайт работает и так
    return
  }
  let busy = false
  let again = false
  let timer = 0
  const run = async () => {
    if (busy) {
      again = true
      return
    }
    busy = true
    try {
      const local = localMemory()
      // хранилище не читается или возврат из облака лёг не целиком (кончилось место) — не стираем копию. «Забудь всё»
      // сюда не попадает: там память читается, и пропавшие ключи удаляются из облака, как и должны
      if (!local || partial) return
      // оглавление — свежее из облака: прерванная запись или второе устройство не оставляют кусков, о которых никто не знает
      man = (await loadManifest(cloud)) ?? man
      man = await sync(cloud, local, man)
    } catch {
      /* сеть или лимит Telegram — следующая запись попробует снова */
    } finally {
      busy = false
      if (again) {
        again = false
        void run()
      }
    }
  }
  const soon = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(run, 1500)
  }
  window.addEventListener('naparnik:memory', soon)
  window.addEventListener('naparnik:tg', soon)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      window.clearTimeout(timer)
      void run()
    }
  })
  // часть экранов пишет в память мимо lib/memory.ts — раз в 15 с сверяем, отпечатки не дают писать лишнего
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void run()
  }, 15_000)
  void run()
}

let started = false
export function startTelegram() {
  const tg = tgBridge()
  if (!tg || started) return
  started = true
  startBack(tg)
  startLinks()
  startColors(tg)
  startClosing(tg)
  void startCloud(tg)
}
