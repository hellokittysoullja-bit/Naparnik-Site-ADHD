/**
 * «Полено» — раскрытие разбивки в Фокусе (владелец 16.11, переделано по записи владельца 17.11: «бревно должно разорваться
 * на кусочки и каждый кусочек — это слово, которое собирается красиво; плавно, как в играх»).
 *
 * Два акта на одном и том же экране Фокуса, без копии экрана:
 *  1. Удар. Кот крупно сидит над поленом (раскладка «ожидание»: реплика → кот → полено → «первый шаг · дело»). Кот
 *     приседает, лапа (вырезана из эталона) замахивается и бьёт; на ударе — «стоп-кадр» лапы, вспышка, ударная волна,
 *     щепки, пыль; трещины разбегаются от места удара ровно по границам будущих кусков и разгораются; полено дрожит.
 *  2. Раскол. Экран за один синхронный кадр встаёт в раскладку «дело» (карточка первого шага, строки шагов), а кот,
 *     пузырь и подпись плавно переезжают на свои места (FLIP). Полено взрывается: кусков ровно столько, сколько слов в
 *     видимых шагах; каждый кусок летит по баллистической дуге с вращением, в полёте переворачивается — с изнанки на нём
 *     выжжено слово — и садится точно на это слово в карточке или строке; на посадке дерево сгорает искрами, остаётся
 *     настоящий текст. Потом праздник: кот прыгает, конфетти.
 *
 * Плавность: всё движение — WAAPI по transform и opacity (идёт в потоке композитора, не зависит от занятости страницы);
 * траектории посчитаны заранее и разложены на 40 ключевых кадров, поэтому дуги гладкие при 60 и 120 Гц.
 * Настоящий текст шагов всё время в DOM (диктор читает его); летают копии (aria-hidden). «Уменьшить движение» — без сцены.
 * Короче с опытом (темп ×1 / ×0,75 / ×0,5), тап — сразу итог.
 * Урок (knowledge/lessons.md, 16.11): у узла несколько анимаций одного свойства — начало держит только первая (fill both),
 * следующие — forwards, иначе поздняя перебивает раннюю ещё до своего старта.
 */

import { celebrate, preloadConfetti } from './confetti'

const PAW = '/mascot/reveal/paw.webp'
const PRINT = '/mascot/reveal/print-cat.svg'

/** темп по стажу: первые разы — вся сцена, потом быстрее (привыкание, «Google приучил к долям секунды») */
export function revealSpeed(nth: number) {
  return nth <= 3 ? 1 : nth <= 10 ? 0.75 : 0.5
}

/** сколько кусков будет у полена: по слову шагов, но не больше 24 (2 ряда по 12 — кусок не мельче ~30 px) */
export const MAX_PIECES = 24
/** кусков-табличек на слова: у КАЖДОГО видимого слова свой летящий кусок (владелец 19.11: ни одно слово не встаёт позже
 *  соседей); клеток разреза полена — не больше MAX_PIECES, на длинных планах несколько кусков вылетают из одной клетки */
export const MAX_WORDS = 96
export const wordCount = (texts: string[]) => Math.min(MAX_WORDS, texts.reduce((n, t) => n + (t.match(/\S+/g)?.length ?? 0), 0))

type WordBox = {
  text: string
  /** табличка слова на экране */
  x: number
  y: number
  w: number
  h: number
  /** где в табличке сам текст и каким шрифтом */
  tx: number
  ty: number
  th: number
  font: string
  /** сама табличка в разметке: показывается в тот кадр, когда на неё садится кусок */
  sp: HTMLElement
  /** строка шага, которой принадлежит слово */
  el: HTMLElement
  visible: boolean
}

/** Слова шага — деревянные таблички (.wood-word, владелец 17.11: таблички остаются, не превращаются в текст). Табличка,
 *  ушедшая за line-clamp или ниже края списка, помечена невидимой: её кусок долетит до конца строки и угаснет */
function wordBoxes(el: HTMLElement, clip: DOMRect | null): WordBox[] {
  const er = el.getBoundingClientRect()
  const top = clip ? clip.top : -Infinity
  const bottom = clip ? clip.bottom : Infinity
  const r = document.createRange()
  return [...el.querySelectorAll<HTMLElement>('.wood-word')].map((sp) => {
    const b = sp.getBoundingClientRect()
    r.selectNodeContents(sp)
    const t = r.getBoundingClientRect()
    const font = getComputedStyle(sp).font
    const visible = b.width > 0 && b.right <= er.right + 1 && b.top >= er.top - 1 && b.bottom <= er.bottom + 1 && b.top >= top - 1 && b.bottom <= bottom + 1
    if (visible) return { text: sp.textContent ?? '', x: b.left, y: b.top, w: b.width, h: b.height, tx: t.left - b.left, ty: t.top - b.top, th: t.height, font, sp, el, visible }
    const hh = b.height || 20
    const below = er.bottom > bottom
    return { text: sp.textContent ?? '', x: below ? er.left + 24 : er.right - 14, y: (below ? bottom : er.bottom) - hh, w: 12, h: hh, tx: 0, ty: 0, th: hh, font, sp, el, visible: false }
  })
}

const rect = (el: Element | null) => el?.getBoundingClientRect() ?? new DOMRect()
const SPRING = 'cubic-bezier(.2,1.35,.35,1)'
const OUT = 'cubic-bezier(.05,.7,.1,1)'
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

function div(layer: HTMLElement, style: Partial<CSSStyleDeclaration>, before?: Node | null) {
  const d = document.createElement('div')
  Object.assign(d.style, { position: 'absolute', left: '0', top: '0', ...style })
  if (before !== undefined) layer.insertBefore(d, before)
  else layer.appendChild(d)
  return d
}

/* ───────────────────────────── «Полено» ───────────────────────────── */

/** Полено сбоку: кора с прожилками, сучок, спил с годовыми кольцами справа. Рисуется под размер карточки дела. */
function logSvg(w: number, h: number, seed: number, shade?: LogShade) {
  const r = h / 2
  const capRx = h * 0.3
  // узор коры у всех полен один (полено ожидания, полено сцены, куски): seed отвечает только за id градиентов —
  // раньше узор шёл от него же, и на «Сейчас расколю!» полено подменялось другим (сучок и прожилки прыгали, владелец 19.11)
  let rnd = 7
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  const grain: string[] = []
  for (let i = 0; i < 11; i++) {
    const y = h * (0.14 + 0.72 * (i / 10)) + (rand() - 0.5) * 4
    const x0 = capRx * 0.4 + rand() * w * 0.12
    const x1 = w - capRx * 1.3 - rand() * w * 0.1
    const amp = 1 + rand() * 2.2
    let d = `M${x0.toFixed(1)},${y.toFixed(1)}`
    for (let x = x0; x < x1; x += 26) d += ` Q${(x + 13).toFixed(1)},${(y + (rand() - 0.5) * amp * 2).toFixed(1)} ${(x + 26).toFixed(1)},${(y + (rand() - 0.5) * amp).toFixed(1)}`
    grain.push(`<path d="${d}" fill="none" stroke="${i % 3 ? '#2a170b' : '#c08a5a'}" stroke-opacity="${i % 3 ? 0.45 : 0.28}" stroke-width="${i % 3 ? 1.4 : 1}" stroke-linecap="round"/>`)
  }
  // сучок — ниже полосы с резьбой слов: раньше он стоял на буквах («Покушать» с пятном на «ь», владелец 17.11)
  const kx = w * (0.3 + rand() * 0.2)
  const ky = h * 0.84
  const rings = [0.82, 0.64, 0.47, 0.31, 0.16].map((k) => `<ellipse cx="${w - capRx}" cy="${r}" rx="${capRx * k}" ry="${r * k * 0.92}" fill="none" stroke="#b07a46" stroke-opacity=".75" stroke-width="1.2"/>`).join('')
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">
    <defs>
      <linearGradient id="rvBark${seed}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8d5b36"/><stop offset=".22" stop-color="#a36d43"/><stop offset=".5" stop-color="#6e4428"/><stop offset=".85" stop-color="#4a2c18"/><stop offset="1" stop-color="#33200f"/>
      </linearGradient>
      <radialGradient id="rvShade${seed}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".6" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="rvCut${seed}" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#f3cf98"/><stop offset=".7" stop-color="#deac70"/><stop offset="1" stop-color="#c38a52"/></radialGradient>
    </defs>
    <ellipse cx="${w / 2}" cy="${h + 5}" rx="${w * 0.46}" ry="6" fill="#000" fill-opacity=".35"/>
    <path d="M${capRx},0 H${w - capRx} V${h} H${capRx} A${capRx} ${r} 0 0 1 ${capRx},0 Z" fill="url(#rvBark${seed})"/>
    ${grain.join('')}
    <ellipse cx="${kx}" cy="${ky}" rx="7" ry="4.5" fill="#3d2414"/><ellipse cx="${kx}" cy="${ky}" rx="4" ry="2.4" fill="none" stroke="#b07a46" stroke-opacity=".6"/>
    <path d="M${capRx},2 H${w - capRx}" stroke="#d6a070" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="${w - capRx}" cy="${r}" rx="${capRx}" ry="${r}" fill="url(#rvCut${seed})" stroke="#3a2212" stroke-width="3"/>
    ${rings}
    ${shade ? `<ellipse cx="${shade.x.toFixed(1)}" cy="8" rx="${shade.rx.toFixed(1)}" ry="6" fill="url(#rvShade${seed})"/>` : ''}
    <circle cx="${w - capRx}" cy="${r}" r="1.8" fill="#8a5a32"/>
  </svg>`
}

/** Тень кота, который сидит над поленом, — падает на кору сверху (x — центр, rx — полуширина, в px полена) */
export type LogShade = { x: number; rx: number }

/** Тень кота на коре: где у обёртки кота лапы (46 % ширины) и какой ширины тень */
export function catShade(cat: DOMRect, log: DOMRect): LogShade {
  return { x: cat.left + cat.width * 0.46 - log.left, rx: cat.width * 0.25 }
}

/** Полено в элементе host: картинка коры + слова человека резьбой. Один рисунок для полена ожидания (в разметке Фокуса)
 *  и для полена сцены — смена одного на другое незаметна. seed — свой у каждого куска: id градиентов в документе не
 *  повторяются (иначе Safari брал градиент чужого, скрытого полена и красил кусок чёрным — «тёмный кусок», 17.11) */
export function drawLog(host: HTMLElement, w: number, h: number, text: string, font: string, seed: number, shade?: LogShade) {
  host.innerHTML = logSvg(w, h, seed, shade)
  const carve = document.createElement('p')
  carve.textContent = text
  carve.dataset.rvCarve = ''
  Object.assign(carve.style, {
    position: 'absolute', left: `${h * 0.3 + 10}px`, right: `${h * 0.6 + 6}px`, top: '50%', transform: 'translateY(-50%)', margin: '0',
    font, color: '#ffe9cc', textShadow: '0 1px 0 rgba(0,0,0,.55), 0 -1px 0 rgba(255,210,150,.15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    // резьба жирная и по центру коры (владелец 17.11); обводка тем же цветом — жирнее самого жирного начертания шрифта
    fontWeight: '800', textAlign: 'center', webkitTextStroke: '0.7px #ffe9cc',
  } as Partial<CSSStyleDeclaration>)
  host.appendChild(carve)
  return carve
}

/* ───────────────────────────── Сцена ───────────────────────────── */

/** Раскладка «ожидание»: что стоит на экране до раскола */
export type StageRefs = {
  /** обёртка кота (приседание, прыжок) */
  cat: HTMLElement
  /** тело кота внутри обёртки: на нём переезд с крупного места на маленькое */
  catBody: HTMLElement
  bubble: HTMLElement
  /** место полена под котом */
  slot: HTMLElement
  /** дело словами человека: шрифт и текст резьбы */
  source: HTMLElement
  /** полено уже ждало удара на экране (дробление шло с сервера): сцена встаёт на его место без проявления */
  fromWait: boolean
}

/** Раскладка «дело» — появляется в момент раскола */
export type FinalRefs = {
  card: HTMLElement | null
  /** тексты шагов в порядке чтения: заголовок карточки, потом строки */
  texts: HTMLElement[]
  bullets: HTMLElement[]
  /** прокручиваемый список остальных шагов */
  list: HTMLElement | null
  stamp0: HTMLElement | null
  /** строка над карточкой: карта штампов и настройка */
  labelRow: HTMLElement | null
}

type Run = (el: Element, kf: Keyframe[], from: number, to: number, o?: KeyframeAnimationOptions) => Animation

type Cell = { poly: string; pts: [number, number][]; cx: number; cy: number }

/** Полено колется на клетки: 1 ряд до 7 кусков, 2 ряда больше. Разрезы — ломаные, общие у соседей (без щелей);
 *  внешние края вынесены за полено, чтобы в кусок попали спил, тень и кора */
function cells(M: number, w: number, h: number, seed: number) {
  let rnd = seed
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  const R = M > 7 ? 2 : 1
  const perRow = R === 1 ? [M] : [Math.ceil(M / 2), Math.floor(M / 2)]
  // горизонтальный разрез (2 ряда): ломаная поперёк полена
  const hPts: [number, number][] = []
  if (R === 2) for (let i = 0; i <= 8; i++) hPts.push([(-24 + ((w + 48) * i) / 8), h * 0.5 + (i === 0 || i === 8 ? 0 : (rand() - 0.5) * 9)])
  const yH = (x: number) => {
    for (let i = 1; i < hPts.length; i++) {
      const [x0, y0] = hPts[i - 1]
      const [x1, y1] = hPts[i]
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
    return h * 0.5
  }
  const edge = (xa: number, xb: number, top: boolean, row: number): [number, number][] => {
    // верхний/нижний край клетки между xa и xb: снаружи полена — за его край, внутри — по горизонтальному разрезу
    if ((top && row === 0) || (!top && row === R - 1)) return [[xa, top ? -14 : h + 14], [xb, top ? -14 : h + 14]]
    const pts: [number, number][] = [[xa, yH(xa)]]
    for (const [x, y] of hPts) if (x > Math.min(xa, xb) && x < Math.max(xa, xb)) pts.push([x, y])
    pts.push([xb, yH(xb)])
    if (xa > xb) pts.sort((p, q) => q[0] - p[0])
    else pts.sort((p, q) => p[0] - q[0])
    return pts
  }
  const out: Cell[] = []
  const cuts: { pts: [number, number][]; row: number; j: number }[] = []
  perRow.forEach((n, row) => {
    const top = (x: number) => (row === 0 ? -14 : yH(x))
    const bot = (x: number) => (row === R - 1 ? h + 14 : yH(x))
    // вертикальные разрезы ряда: зигзаг из 5 точек
    const vs: [number, number][][] = []
    for (let j = 1; j < n; j++) {
      const x = (w * j) / n + (rand() - 0.5) * (w / n) * 0.3
      const pts: [number, number][] = []
      for (let s = 0; s <= 4; s++) {
        const xs = x + (s === 0 || s === 4 ? 0 : (rand() - 0.5) * 10)
        const y0 = top(x)
        const y1 = bot(x)
        pts.push([xs, y0 + ((y1 - y0) * s) / 4])
      }
      vs.push(pts)
      cuts.push({ pts, row, j })
    }
    for (let j = 0; j < n; j++) {
      const left = j ? vs[j - 1] : [[-24, top(-24)], [-24, bot(-24)]] as [number, number][]
      const right = j < n - 1 ? vs[j] : [[w + 24, top(w + 24)], [w + 24, bot(w + 24)]] as [number, number][]
      const xlT = left[0][0]
      const xrT = right[0][0]
      const xlB = left[left.length - 1][0]
      const xrB = right[right.length - 1][0]
      const poly: [number, number][] = [
        ...edge(xlT, xrT, true, row),
        ...right.slice(1, -1),
        ...edge(xrB, xlB, false, row),
        ...[...left].reverse().slice(1, -1),
      ]
      const inX = (x: number) => Math.max(0, Math.min(w, x))
      const inY = (y: number) => Math.max(0, Math.min(h, y))
      const cx = poly.reduce((a, p) => a + inX(p[0]), 0) / poly.length
      const cy = poly.reduce((a, p) => a + inY(p[1]), 0) / poly.length
      out.push({ poly: poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(','), pts: poly, cx, cy })
    }
  })
  return { cells: out, cuts: cuts.map((c) => c.pts), hPts }
}

type Scene = {
  run: Run
  f: number
  layer: HTMLElement
  stage: StageRefs
  M: number
  /** кусков-табличек: по одному на слово на экране */
  P: number
}

/** Акт 1: удар. Возвращает всё, что нужно расколу */
function strike(s: Scene) {
  const { run, f, layer, stage } = s
  const T = (ms: number) => ms * f
  const cat = rect(stage.catBody)
  const slot = rect(stage.slot)
  const L = { x: slot.left, y: slot.top, w: slot.width, h: slot.height }
  const font = getComputedStyle(stage.source).font
  const carveText = stage.source.textContent ?? ''

  // полено, трещины и отпечаток лежат в месте полена на странице, ПОД котом: кот сидит на полене, и его лапы должны быть
  // поверх коры (слой сцены над страницей закрывал бы их). Координаты — те же экранные: контейнер сдвинут на -L
  const under = div(stage.slot, { left: `${-L.x}px`, top: `${-L.y}px`, width: '0', height: '0' })
  // полено ожидания (в разметке) уступает место полену сцены — иначе выглядывало бы из-под него на ударе и дрожи
  const waitLog = stage.slot.querySelector<HTMLElement>('[data-rv-waitlog]')
  if (waitLog) waitLog.style.visibility = 'hidden'
  const log = div(under, { left: `${L.x}px`, top: `${L.y}px`, width: `${L.w}px`, height: `${L.h}px`, transformOrigin: '50% 100%' })
  // номер рисунка — не 7, как у полена ожидания: оба лежат в разметке, и одинаковые id градиентов Safari красит чёрным
  drawLog(log, L.w, L.h, carveText, font, 6, catShade(rect(stage.cat), slot))
  if (stage.fromWait) run(log, [{ opacity: 1 }, { opacity: 1 }], 0, 1)
  else run(log, [{ opacity: 0, transform: 'scale(.9,.55)' }, { opacity: 1, transform: 'scale(1.04,1.1)', offset: 0.6 }, { opacity: 1, transform: 'none' }], 0, T(200), { easing: SPRING })

  const tImp = T(430)
  const tSplit = T(860)
  // кот готовится: приседает (предвосхищение), потом вытягивается вслед за ударом
  run(stage.cat, [
    { transform: 'none' },
    { transform: 'translateY(6px) scale(1.06,.9)', offset: 0.55 },
    { transform: 'translateY(-5px) scale(.96,1.06)', offset: 0.8 },
    { transform: 'none' },
  ], T(40), tImp + T(90), { easing: 'ease-in-out' })

  // лапа: выезжает от кота, замах выше места удара, резкий удар, стоп-кадр 60 мс, отскок назад
  const hit = { x: L.x + L.w * 0.5, y: L.y + 4 }
  // лапа поменьше (владелец 17.11)
  const pw = Math.max(44, Math.min(62, cat.width * 0.33))
  const paw = document.createElement('img')
  paw.src = PAW
  paw.alt = ''
  Object.assign(paw.style, { position: 'absolute', left: '0', top: '0', width: `${pw}px`, willChange: 'transform' })
  layer.appendChild(paw)
  const from = { x: cat.left + cat.width * 0.62, y: cat.bottom - pw * 0.45 }
  const lift = { x: hit.x + 8, y: hit.y - pw * 1.2 }
  const P = (p: { x: number; y: number }, rot: number, sc: number, o = 1): Keyframe => ({ transform: `translate(${p.x - pw / 2}px, ${p.y - pw / 2}px) rotate(${rot}deg) scale(${sc})`, opacity: o })
  const down = { x: hit.x, y: hit.y - pw * 0.28 }
  run(paw, [P(from, -30, 0.5, 0), { ...P({ x: (from.x + lift.x) / 2 + 30, y: Math.min(from.y, lift.y) - 24 }, -10, 0.85), offset: 0.55 }, P(lift, 8, 1)], T(90), tImp - T(70), { easing: 'cubic-bezier(.3,0,.3,1)' })
  run(paw, [P(lift, 8, 1), { ...P({ x: lift.x, y: lift.y - 12 }, 13, 1.05), offset: 0.45 }, P(down, 0, 1.14)], tImp - T(70), tImp, { easing: 'cubic-bezier(.75,0,.95,.45)' })
  run(paw, [P(down, 0, 1.14), { ...P({ x: down.x, y: down.y + 2 }, 0, 1.2), offset: 0.3 }, P(down, 0, 1.18)], tImp, tImp + 60, { easing: 'linear' })
  run(paw, [P(down, 0, 1.18), { ...P({ x: down.x - 6, y: down.y - 26 }, -12, 1.05), offset: 0.35 }, P(from, -30, 0.5, 0)], tImp + 60, tImp + 60 + T(220), { easing: 'cubic-bezier(.3,0,.5,1)' })

  // удар: полено сплющивается и подпрыгивает
  run(log, [
    { transform: 'none' },
    { transform: 'translateY(4px) scale(1.05,.84)', offset: 0.22 },
    { transform: 'translateY(-6px) scale(.98,1.06)', offset: 0.6 },
    { transform: 'none' },
  ], tImp, tImp + T(150), { easing: 'ease-out' })
  // вспышка и ударная волна от места удара
  const flash = div(layer, { left: `${hit.x - 90}px`, top: `${hit.y - 70}px`, width: '180px', height: '140px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,252,230,.95), rgba(255,200,110,.55) 45%, rgba(255,160,60,0))', opacity: '0' })
  run(flash, [{ transform: 'scale(.25)', opacity: 1 }, { transform: 'scale(1.25)', opacity: 0 }], tImp, tImp + T(230), { fill: 'forwards', easing: OUT })
  const ring = div(layer, { left: `${hit.x - 24}px`, top: `${hit.y - 24}px`, width: '48px', height: '48px', borderRadius: '50%', border: '3px solid rgba(255,232,190,.95)', opacity: '0' })
  run(ring, [{ transform: 'scale(.5, .25)', opacity: 1 }, { transform: 'scale(5.5, 1.9)', opacity: 0 }], tImp, tImp + T(380), { fill: 'forwards', easing: OUT })
  const dust = div(under, { left: `${hit.x - 70}px`, top: `${L.y + L.h - 34}px`, width: '140px', height: '64px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(230,200,160,.5), transparent)', opacity: '0' }, log)
  run(dust, [{ transform: 'scale(.3,.2)', opacity: 0.9 }, { transform: 'scale(2.4,1.1)', opacity: 0 }], tImp, tImp + T(260), { fill: 'forwards', easing: OUT })
  // щепки: баллистика с вращением, 7 ключевых кадров
  for (let k = 0; k < 22; k++) {
    const bark = k % 3 === 0
    const sz = 4 + (k % 5) * 1.6
    const chip = div(layer, {
      left: `${hit.x - sz / 2}px`, top: `${hit.y + L.h * 0.25}px`, width: `${sz}px`, height: `${sz * 0.55}px`, opacity: '0',
      background: bark ? '#5a3620' : k % 2 ? '#e8bb84' : '#c98f58', borderRadius: '1px', clipPath: 'polygon(0 30%, 70% 0, 100% 60%, 30% 100%)',
    })
    const a = -Math.PI / 2 + (k / 21 - 0.5) * 2.8
    const v = 60 + ((k * 37) % 80)
    const kf: Keyframe[] = []
    for (let i = 0; i <= 8; i++) {
      const u = i / 8
      kf.push({ transform: `translate(${Math.cos(a) * v * 1.5 * u}px, ${Math.sin(a) * v * u + 240 * u * u}px) rotate(${(k % 2 ? 1 : -1) * 620 * u}deg)`, opacity: u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1 })
    }
    run(chip, kf, tImp, tImp + T(300) + (k % 3) * 30, { fill: 'forwards', easing: 'linear' })
  }

  // трещины — ровно по границам будущих кусков; разбегаются от места удара и разгораются. Каждая трещина — свой
  // маленький <svg>, а движение у него — только масштаб и прозрачность (видеокарта): раньше анимировались штрихи внутри
  // SVG, и браузер перерисовывал их на процессоре каждый кадр
  const geo = cells(s.M, L.w, L.h, 11 + s.M)
  const cracks = div(under, {})
  const lines = [...geo.cuts, ...(geo.hPts.length ? [geo.hPts] : [])]
  lines.forEach((pts, li) => {
    const horizontal = li >= geo.cuts.length
    const P = pts.map(([x, y]) => [Math.max(0, Math.min(L.w, x)), Math.max(0, Math.min(L.h, y))] as [number, number])
    const pad = 8
    const x0 = Math.min(...P.map((p) => p[0])) - pad
    const y0 = Math.min(...P.map((p) => p[1])) - pad
    const x1 = Math.max(...P.map((p) => p[0])) + pad
    const y1 = Math.max(...P.map((p) => p[1])) + pad
    const d = P.map(([x, y], i) => `${i ? 'L' : 'M'}${(x - x0).toFixed(1)},${(y - y0).toFixed(1)}`).join(' ')
    const mk = (stroke: string, width: number, op: number) => {
      const el = div(cracks, { left: `${L.x + x0}px`, top: `${L.y + y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px`, opacity: '0', willChange: 'transform, opacity' })
      el.innerHTML = `<svg width="${x1 - x0}" height="${y1 - y0}" style="display:block;overflow:visible"><path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${op}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      return el
    }
    const glow = mk('#ff9a3c', 12, 0.85)
    const core = mk('#ffe6b0', 2.4, 1)
    const mx = P.reduce((acc, p) => acc + p[0], 0) / P.length
    const tc = tImp + T(20) + (Math.abs(L.x + mx - hit.x) / L.w) * T(160)
    // вертикальная трещина растёт сверху (от места удара) вниз, горизонтальная — от места удара в стороны
    const origin = horizontal ? `${hit.x - L.x - x0}px 50%` : '50% 0'
    for (const el of [glow, core]) {
      el.style.transformOrigin = origin
      run(el, [{ transform: horizontal ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], tc, tc + T(90), { easing: 'ease-out' })
    }
    run(core, [{ opacity: 0 }, { opacity: 1 }], tc, tc + 1)
    // сигнал «сейчас развалится»: свечение разгорается до самого раскола
    run(glow, [{ opacity: 0 }, { opacity: 0.3, offset: 0.1 }, { opacity: 1 }], tc, tSplit, { easing: 'ease-in' })
  })
  // угольки поднимаются из трещин
  geo.cuts.forEach((pts, i) => {
    const [x, y] = pts[2]
    for (let e = 0; e < 3; e++) {
      const em = div(layer, { left: `${L.x + x - 2}px`, top: `${L.y + y - 2}px`, width: '4px', height: '4px', borderRadius: '50%', background: '#ffcf70', boxShadow: '0 0 6px 2px rgba(255,150,50,.7)', opacity: '0' })
      const te = tImp + T(80) + e * T(70) + i * T(25)
      run(em, [{ transform: 'translate(0,0) scale(1)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(${(e - 1) * 16}px, ${-46 - e * 20}px) scale(.3)`, opacity: 0 }], te, te + T(380), { easing: 'ease-out' })
    }
  })
  // полено дрожит всё сильнее — сейчас лопнет
  const shake: Keyframe[] = []
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * 2.2
    shake.push({ transform: i === 12 ? 'none' : `translate(${(i % 2 ? 1 : -1) * a}px, ${(i % 3 === 0 ? -1 : 0.5) * a * 0.5}px) rotate(${(i % 2 ? -1 : 1) * a * 0.25}deg)` })
  }
  run(log, shake, tImp + T(170), tSplit, { easing: 'linear' })

  // отпечаток лапы на месте удара — подаренный первый штамп; при расколе улетает в карту штампов и там исчезает
  const ps = 24
  const print = div(under, {
    left: `${hit.x - ps / 2}px`, top: `${L.y + L.h * 0.16 - ps / 2}px`, width: `${ps}px`, height: `${(ps * 91) / 100}px`, opacity: '0',
    background: `url(${PRINT}) center / contain no-repeat`,
  } as Partial<CSSStyleDeclaration>)
  run(print, [{ transform: 'scale(1.6) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 0.95 }], tImp, tImp + T(60), { fill: 'forwards', easing: 'cubic-bezier(.6,0,.4,1)' })

  // кора кусков рисуется заранее, пока лапа замахивается (на главном потоке тогда ничего не движется): в кадр раскола
  // остаётся только расставить куски — раньше их рисование давало задержку ~0,1 с на слабом телефоне
  const holder = div(layer, { display: 'none' })
  const faces: HTMLElement[] = []
  const prepare = () => {
    for (let i = faces.length; i < geo.cells.length; i++) {
      // слой куска — размером со свой кусок, а не со всё полено: меньше памяти видеокарты и быстрее сборка кадра
      const c = geo.cells[i % geo.cells.length]
      const bx = Math.max(-24, Math.min(...c.pts.map((p) => p[0])))
      const by = Math.max(-14, Math.min(...c.pts.map((p) => p[1])))
      const bw = Math.min(L.w + 24, Math.max(...c.pts.map((p) => p[0]))) - bx
      const bh = Math.min(L.h + 14, Math.max(...c.pts.map((p) => p[1]))) - by
      const face = div(holder, { width: `${bw}px`, height: `${bh}px`, overflow: 'hidden', clipPath: `polygon(${c.pts.map(([x, y]) => `${(x - bx).toFixed(1)}px ${(y - by).toFixed(1)}px`).join(',')})` })
      face.dataset.bx = String(bx)
      face.dataset.by = String(by)
      const art = div(face, { left: `${-bx}px`, top: `${-by}px`, width: `${L.w}px`, height: `${L.h}px` })
      drawLog(art, L.w, L.h, carveText, font, 100 + i)
      faces.push(face)
    }
  }
  const prep = window.setTimeout(prepare, T(140))

  return { L, log, cracks, geo, print, under, font, carveText, tImp, tSplit, faces, prepare, prep }
}

/** Акт 2: раскол. Экран уже в раскладке «дело»; куски полена летят и становятся словами шагов */
function shatter(s: Scene, a: ReturnType<typeof strike>, before: { catBody: DOMRect; bubble: DOMRect }, fin: FinalRefs) {
  const { run, f, layer, stage } = s
  const T = (ms: number) => ms * f
  const { L, tSplit } = a
  const at = tSplit
  // сначала все замеры новой раскладки, потом все вставки: чередование заставляло браузер пересчитывать вёрстку на
  // каждом слове (кадр раскола на слабом телефоне стоял ~0,1 с)
  const body = rect(stage.catBody)
  const bub = rect(stage.bubble)
  const clip = fin.list ? rect(fin.list) : null
  const allWords = fin.texts.flatMap((el, j) => wordBoxes(el, j ? clip : null))
  // куски — только словам, которые видно: слово за обрезкой строки раньше летело и гасло полупрозрачным у края (19.11)
  const onScreen = allWords.filter((b) => b.visible)
  const words = onScreen.slice(0, s.P)
  // запас на случай, если слов на экране больше MAX_WORDS: лишние встают вместе с последними кусками
  const extra = onScreen.slice(s.P)
  const s0 = fin.stamp0 ? rect(fin.stamp0) : null
  const pr = rect(a.print)
  window.clearTimeout(a.prep)
  a.prepare()
  // полено и трещины исчезают в кадр раскола — их место занимают куски
  run(a.log, [{ opacity: 1 }, { opacity: 0 }], at, at + 1)
  run(a.cracks, [{ opacity: 1 }, { opacity: 0 }], at, at + 1)

  // кот и пузырь переезжают со своих мест «ожидания» на места «дела» (FLIP)
  const k = body.width / Math.max(1, before.catBody.width)
  run(stage.catBody, [
    { transform: `translate(${before.catBody.left - body.left}px, ${before.catBody.top - body.top}px) scale(1)` },
    { transform: `scale(${k})` },
  ], at, at + T(560), { easing: 'cubic-bezier(.3,1.2,.4,1)', fill: 'backwards' })
  run(stage.bubble, [{ transform: `translate(${before.bubble.left - bub.left}px, ${before.bubble.top - bub.top}px)` }, { transform: 'none' }], at, at + T(480), { easing: 'cubic-bezier(.3,1.15,.4,1)', fill: 'backwards' })

  // взрыв: вспышка, дым, угли
  const C = { x: L.x + L.w / 2, y: L.y + L.h * 0.55 }
  const boom = div(layer, { left: `${C.x - 160}px`, top: `${C.y - 90}px`, width: '320px', height: '180px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,250,225,.9), rgba(255,190,90,.45) 45%, rgba(255,150,50,0))', opacity: '0' })
  run(boom, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.3)', opacity: 0 }], at, at + T(300), { fill: 'forwards', easing: OUT })
  for (let i = 0; i < 6; i++) {
    const sz = 60 + i * 12
    const puff = div(layer, { left: `${L.x + (L.w * (i + 0.5)) / 6 - sz / 2}px`, top: `${L.y + L.h / 2 - sz / 2}px`, width: `${sz}px`, height: `${sz}px`, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(205,185,160,.35), rgba(205,185,160,0))', opacity: '0' }, layer.firstChild)
    run(puff, [{ transform: 'scale(.4)', opacity: 0.9 }, { transform: `translate(${(i - 2.5) * 8}px, -30px) scale(1.8)`, opacity: 0 }], at, at + T(700), { fill: 'forwards', easing: OUT })
  }
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + (i % 3) * 0.2
    const dist = 70 + ((i * 53) % 90)
    const em = div(layer, { left: `${C.x - 2}px`, top: `${C.y - 2}px`, width: '4px', height: '4px', borderRadius: '50%', background: i % 2 ? '#ffd27a' : '#ff9f45', boxShadow: '0 0 6px 2px rgba(255,150,50,.6)', opacity: '0' })
    const kf: Keyframe[] = []
    for (let j = 0; j <= 6; j++) {
      const u = j / 6
      kf.push({ transform: `translate(${Math.cos(ang) * dist * Math.sqrt(u) * 1.4}px, ${Math.sin(ang) * dist * Math.sqrt(u) * 0.8 + 90 * u * u}px) scale(${1 - u * 0.7})`, opacity: u < 0.1 ? u * 10 : 1 - u })
    }
    run(em, kf, at, at + T(520) + (i % 4) * 40, { fill: 'forwards', easing: 'linear' })
  }

  // слова видимых шагов в порядке чтения — каждое станет куском полена
  const N = words.length
  const D = T(660)
  const stagger = N > 1 ? Math.min(T(55), T(480) / (N - 1)) : 0
  const landAt = (i: number) => at + D + i * stagger
  const firstOf = new Map<HTMLElement, number>()
  const O = { x: L.x + L.w * 0.5, y: L.y + L.h * 0.9 }
  let rnd = 97 + N
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)

  const plateAt = (b: WordBox) => {
    const box = div(layer, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, opacity: '0' })
    const plate = div(box, { width: `${b.w}px`, height: `${b.h}px`, padding: '0', margin: '0' })
    plate.className = 'wood-word'
    const word = document.createElement('span')
    word.textContent = b.text
    Object.assign(word.style, { position: 'absolute', left: `${b.tx}px`, top: `${b.ty}px`, font: b.font, lineHeight: `${b.th}px`, whiteSpace: 'pre' })
    plate.appendChild(word)
    return box
  }
  // подмена копии на настоящую табличку — у КАЖДОГО слова в свой кадр, сразу после его шлепка, пока слово ещё в
  // вспышке посадки. Раньше вся строка подменялась разом, когда садилось её последнее слово: копия стоит на долю пикселя
  // иначе, и уже севшие слова строки «щёлкали» позже (покадровая проверка, 19.11)
  const swap = (b: WordBox, box: HTMLElement, t: number) => {
    run(b.sp, [{ opacity: 0 }, { opacity: 1 }], t, t + 1)
    run(box, [{ opacity: 1 }, { opacity: 0 }], t, t + 1)
  }
  extra.forEach((b, k) => {
    const tL = landAt(Math.max(0, N - 1)) - T(60) + k * Math.min(stagger, T(25))
    const box = plateAt(b)
    run(box, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1.04,.9)', offset: 0.55 }, { opacity: 1, transform: 'none' }], tL, tL + T(170), { fill: 'forwards', easing: 'ease-out' })
    swap(b, box, tL + T(170))
  })

  words.forEach((b, i) => {
    const cell = a.geo.cells[i % a.geo.cells.length]
    const tL = landAt(i)
    if (!firstOf.has(b.el)) firstOf.set(b.el, tL)
    // кусок: контейнер стоит на слове; в начале сдвинут так, что его центр — центр клетки полена
    const box = div(layer, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, transformOrigin: '50% 50%', willChange: 'transform' })
    // лицо — та же кора полена, вырезанная по клетке. Коры — по клетке на кусок (≤ MAX_PIECES): на длинном плане
    // остальные слова вылетают из тех же клеток сразу табличками — 90 копий коры замораживали слабый телефон на 0,3–0,6 с
    const front = a.faces[i] as HTMLElement | undefined
    if (front) {
      Object.assign(front.style, { left: `${b.w / 2 - (cell.cx - Number(front.dataset.bx))}px`, top: `${b.h / 2 - (cell.cy - Number(front.dataset.by))}px` })
      box.appendChild(front)
    }
    // изнанка — та же деревянная табличка, что останется на экране (.wood-word), со словом на своём месте
    const back = div(box, { width: `${b.w}px`, height: `${b.h}px`, opacity: front ? '0' : '1' })
    const plate = div(back, { width: `${b.w}px`, height: `${b.h}px`, padding: '0', margin: '0' })
    plate.className = 'wood-word'
    const word = document.createElement('span')
    word.textContent = b.text
    Object.assign(word.style, { position: 'absolute', left: `${b.tx}px`, top: `${b.ty}px`, font: b.font, lineHeight: `${b.th}px`, whiteSpace: 'pre' })
    plate.appendChild(word)

    // траектория: баллистика от взрыва (скорость + тяжесть + вращение), плавно переходящая в самонаведение на слово
    const c0 = { x: L.x + cell.cx, y: L.y + cell.cy }
    const tg = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
    let dx = c0.x - O.x
    let dy = c0.y - O.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    // разлёт — вверх и в стороны, но куски не улетают за край экрана: горизонтальную скорость ограничивает запас до края
    const sp = 140 + rand() * 160
    const room = dx < 0 ? c0.x - 12 : window.innerWidth - 12 - c0.x
    const vx = Math.sign(dx) * Math.min(Math.abs(dx * sp), Math.max(0, room) / 0.32)
    const vy = dy * sp - (420 + rand() * 220)
    const g = 2300
    const spin = (i % 2 ? 1 : -1) * (320 + rand() * 520)
    const dur = (D + i * stagger) / 1000
    const kf: Keyframe[] = []
    const S = 40
    for (let j = 0; j <= S; j++) {
      const u = j / S
      const t = u * dur
      const bx = c0.x + vx * t
      const by = c0.y + vy * t + 0.5 * g * t * t
      const e = u < 0.14 ? 0 : easeInOut((u - 0.14) / 0.86)
      const x = bx * (1 - e) + tg.x * e
      const y = by * (1 - e) + tg.y * e
      const rot = spin * t * (1 - e)
      // переворот куска (2D-«карточка»): ребром в середине, дальше видна изнанка со словом
      const fx = u >= 0.2 && u <= 0.42 ? Math.max(0.03, Math.abs(Math.cos((Math.PI * (u - 0.2)) / 0.22))) : 1
      kf.push({ transform: `translate(${(x - tg.x).toFixed(2)}px, ${(y - tg.y).toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${fx.toFixed(3)}, 1)` })
    }
    run(box, kf, at, tL, { easing: 'linear' })
    const flipAt = at + (tL - at) * 0.31
    if (front) {
      run(front, [{ opacity: 1 }, { opacity: 0 }], flipAt, flipAt + 1)
      run(back, [{ opacity: 0 }, { opacity: 1 }], flipAt, flipAt + 1)
    }
    if (!b.visible) {
      // слово за краем строки: кусок долетает до конца строки и гаснет
      run(box, [{ opacity: 1 }, { opacity: 0 }], tL - T(120), tL, { easing: 'ease-in' })
      return
    }
    // посадка: шлепок, вспышка, дерево сгорает, остаётся настоящий текст
    // шлепок без наезда на соседей: растяжение по ширине — не больше зазора между табличками (раньше 1,2 — сосед будто
    // дёргался, когда садилось слово рядом, 19.11)
    const sq = 1 + Math.min(0.12, 3.5 / Math.max(1, b.w))
    run(box, [{ transform: `scale(${sq.toFixed(3)},.84)` }, { transform: 'scale(.98,1.05)', offset: 0.5 }, { transform: 'none' }], tL, tL + T(170), { easing: 'ease-out' })
    const glow = div(layer, { left: `${tg.x - 40}px`, top: `${tg.y - 22}px`, width: '80px', height: '44px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,220,140,.85), rgba(255,160,60,0))', opacity: '0' }, box)
    run(glow, [{ transform: 'scale(.4)', opacity: 0.95 }, { transform: 'scale(1.5)', opacity: 0 }], tL, tL + T(260), { fill: 'forwards', easing: OUT })
    swap(b, box, tL + T(170))
    for (let e = 0; e < (front ? 4 : 0); e++) {
      const sx = e % 2 ? b.x + b.w : b.x
      const em = div(layer, { left: `${sx - 2}px`, top: `${tg.y - 2}px`, width: '3px', height: '3px', borderRadius: '50%', background: '#ffd27a', boxShadow: '0 0 5px 2px rgba(255,150,50,.6)', opacity: '0' })
      run(em, [{ transform: 'none', opacity: 1 }, { transform: `translate(${(e % 2 ? 1 : -1) * (10 + e * 5)}px, ${-12 - e * 7}px) scale(.3)`, opacity: 0 }], tL, tL + T(320), { fill: 'forwards', easing: 'ease-out' })
    }
  })

  // карточка проявляется к прилёту первого слова; точки строк — к прилёту первого слова строки; настоящий текст — когда
  // все его слова сели (копии исчезают в тот же кадр — они стоят ровно на нём)
  const title = fin.texts[0]
  const tCard = firstOf.get(title) ?? at + D
  if (fin.card) run(fin.card, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], tCard - T(160), tCard + T(40), { easing: OUT })
  // строка со штампами — к прилёту отпечатка
  if (fin.labelRow) run(fin.labelRow, [{ opacity: 0 }, { opacity: 1 }], at + T(260), at + T(420), { easing: OUT })
  // отпечаток лапы с полена улетает в карту штампов и исчезает в ней — там загорается первый штамп («дело разломано»)
  if (fin.stamp0 && s0) {
    const ddx = s0.left + s0.width / 2 - (pr.left + pr.width / 2)
    const ddy = s0.top + s0.height / 2 - (pr.top + pr.height / 2)
    const tS = at + T(420)
    run(a.print, [
      { transform: 'scale(1) rotate(-12deg)', opacity: 0.95 },
      { transform: `translate(${ddx * 0.5 + 30}px, ${ddy * 0.5 - 40}px) scale(1.4) rotate(-50deg)`, offset: 0.5 },
      { transform: `translate(${ddx}px, ${ddy}px) scale(.62) rotate(-12deg)`, opacity: 1 },
    ], at, tS, { easing: 'cubic-bezier(.5,0,.4,1)' })
    run(a.print, [{ opacity: 1 }, { opacity: 0 }], tS, tS + 1)
    run(fin.stamp0, [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], tS, tS + T(200), { easing: SPRING })
  } else run(a.print, [{ opacity: 0.95 }, { opacity: 0 }], at, at + T(160))
  fin.texts.forEach((el, j) => {
    // строка видна с раскола, но её таблички — каждая с посадки своего куска (swap выше); таблички за обрезкой строки
    // и так не видны
    run(el, [{ opacity: 1 }, { opacity: 1 }], at, at + 1)
    const bullet = j > 0 ? fin.bullets[j - 1] : null
    const t0 = firstOf.get(el) ?? at + D
    if (bullet) run(bullet, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], t0 - T(40), t0 + T(100), { easing: SPRING })
  })
}

/** Длина всей сцены (мс) — известна заранее: по ней сцена объявляет конец */
function sceneLength(M: number, f: number) {
  const N = Math.max(1, M)
  const stagger = N > 1 ? Math.min(55, 480 / (N - 1)) : 0
  return (860 + 660 + (N - 1) * stagger + 300 + 20) * f
}

/**
 * Сыграть «Полено». split() вызывается в момент раскола: он синхронно (flushSync) переводит экран в раскладку «дело» и
 * возвращает её элементы. Возвращает обещание конца и пропуск (тап — сразу итог). Слой сам убирается.
 */
export function playLogReveal(
  stage: StageRefs,
  nth: number,
  hooks: { pieces: number; onImpact: () => void; split: () => FinalRefs | null },
): { finished: Promise<void>; skip: () => void; stop: () => void } {
  const f = revealSpeed(nth)
  const M = Math.max(1, Math.min(MAX_PIECES, hooks.pieces))
  const P = Math.max(1, Math.min(MAX_WORDS, hooks.pieces))
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '60', pointerEvents: 'none', overflow: 'hidden' })
  document.body.append(layer)
  const list: Animation[] = []
  const t0 = performance.now()
  const seen = new WeakMap<Element, Set<string>>()
  const run: Run = (el, kf, from, to, o) => {
    const props = new Set(kf.flatMap((k) => Object.keys(k).filter((p) => p !== 'offset' && p !== 'easing' && p !== 'composite')))
    const had = seen.get(el) ?? new Set<string>()
    const fill: FillMode = [...props].some((p) => had.has(p)) ? 'forwards' : 'both'
    props.forEach((p) => had.add(p))
    seen.set(el, had)
    // время сцены — от её начала: акт 2 создаётся позже, отрицательная задержка сразу ставит анимацию на нужный момент
    const born = performance.now() - t0
    const a = el.animate(kf, { duration: Math.max(1, to - from), delay: from - born, fill, easing: 'ease', ...o })
    // метка «когда создана» — по ней покадровая проверка ставит любую анимацию на один и тот же момент сцены
    a.id = `rv:${Math.round(born)}`
    list.push(a)
    return a
  }
  const scene: Scene = { run, f, layer, stage, M, P }
  const act1 = strike(scene)
  const end = run(layer, [{ opacity: 1 }, { opacity: 1 }], 0, sceneLength(P, f))
  const impact = window.setTimeout(hooks.onImpact, act1.tImp)
  let didSplit = false
  const doSplit = () => {
    if (didSplit) return
    didSplit = true
    window.clearTimeout(splitTimer)
    const before = { catBody: rect(stage.catBody), bubble: rect(stage.bubble) }
    // отпечаток лапы улетает в карту штампов — переносим его из места полена (оно сейчас исчезнет) в слой сцены
    layer.appendChild(act1.print)
    const fin = hooks.split()
    if (fin) shatter(scene, act1, before, fin)
  }
  const splitTimer = window.setTimeout(doSplit, Math.max(0, act1.tSplit - (performance.now() - t0)))
  const cleanup = () => {
    window.clearTimeout(act1.prep)
    window.clearTimeout(impact)
    window.clearTimeout(splitTimer)
    for (const a of list) a.cancel()
    layer.replaceChildren()
    act1.under.remove()
    layer.remove()
  }
  // слой убирает stop(): сначала экран снимает «сцена идёт» (иначе на кадр всё было бы скрыто — пустой кадр в конце)
  const finished = end.finished.then(() => {}, () => {})
  return {
    finished,
    skip: () => {
      doSplit()
      for (const a of [...list]) a.finish()
    },
    // экран уходит посреди сцены: убрать слой, ничего не переключая (переключение из размонтирования React не любит)
    stop: () => {
      didSplit = true
      cleanup()
    },
  }
}

/** Праздник как у Duolingo: кот приседает и высоко прыгает (тень остаётся на земле и сжимается), конфетти на весь экран */
export function celebrateCat(cat: HTMLElement, avoid: (Element | null)[] = []) {
  const r = cat.getBoundingClientRect()
  // конфетти летит ПОЗАДИ пузыря-квитанции: её читают ровно в этот момент (17.11 — рой бумажек закрывал текст)
  celebrate({ x: r.left + r.width / 2, y: r.top + r.height * 0.35 }, avoid.filter(Boolean).map((e) => e!.getBoundingClientRect()))
  const sh = cat.querySelector('.cat-shadow') as HTMLElement | null
  const h = Math.max(36, Math.min(64, r.height * 0.3))
  cat.animate(
    [
      { transform: 'translateY(0) scale(1,1)' },
      { transform: 'translateY(4px) scale(1.08,.88)', offset: 0.14 },
      { transform: `translateY(-${h * 0.9}px) scale(.94,1.08)`, offset: 0.42 },
      { transform: `translateY(-${h}px) scale(1,1)`, offset: 0.52 },
      { transform: 'translateY(0) scale(1.1,.86)', offset: 0.8 },
      { transform: 'translateY(0) scale(.97,1.03)', offset: 0.9 },
      { transform: 'translateY(0) scale(1,1)' },
    ],
    { duration: 900, easing: 'cubic-bezier(.33,0,.4,1)' },
  )
  sh?.animate(
    [
      { translate: '0 0', scale: '1' },
      { translate: '0 -4px', scale: '1.06 1', offset: 0.14 },
      { translate: `0 ${h * 0.9}px`, scale: '.62', opacity: 0.6, offset: 0.42 },
      { translate: `0 ${h}px`, scale: '.58', opacity: 0.55, offset: 0.52 },
      { translate: '0 0', scale: '1.05 1', opacity: 1, offset: 0.8 },
      { translate: '0 0', scale: '1' },
    ],
    { duration: 900, easing: 'cubic-bezier(.33,0,.4,1)' },
  )
}

/** Которая по счёту разбивка у человека (для длины сцены). Удобство одного устройства: без хранилища — «первая». */
export function nextBreakCount(): number {
  try {
    const n = Number(localStorage.getItem('naparnik:breaks') ?? '0') + 1
    localStorage.setItem('naparnik:breaks', String(n))
    return n
  } catch {
    return 1
  }
}

/** Лапа и отпечаток — заранее, чтобы на первом ударе они уже были (оба файла крошечные: 20 КБ и 1 КБ) */
export function preloadReveal() {
  preloadConfetti('/mascot/reveal/print.webp') // конфетти красит силуэт лапы сам
  const stamp = typeof window !== 'undefined' ? new Image() : null
  if (stamp) stamp.src = PRINT
  if (typeof window !== 'undefined') {
    const im = new Image()
    im.src = PAW
  }
}
