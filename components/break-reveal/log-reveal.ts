/**
 * «Полено» — раскрытие разбивки в Фокусе (владелец 16.11: «там, где ломается деревяшка… улучшить и добавить конфетти»,
 * затем «делай в основную ветку и бревно тоже»). Анимация идёт ПОВЕРХ настоящих элементов экрана Фокуса — карточки
 * первого шага, строк остальных шагов, кота: отдельной копии экрана нет, поэтому после сцены ничего не прыгает.
 *
 * Ход: дело становится поленом (кора, спил с кольцами, слова человека светлой резьбой) → кот приседает, лапа (вырезана из
 * эталона, public/mascot/reveal/paw.webp) хлопает сверху → щепки, пыль, светящиеся трещины по местам будущих кусков,
 * угольки (сигнал «сейчас развалится») → полено колется на столько кусков, сколько шагов на экране, на каждом обломок
 * слов человека → куски летят на места шагов и растворяются, шаг «выжигается» буквами-угольками → отпечаток лапы с места
 * удара улетает в карту штампов (подаренный первый штамп). Потом праздник: кот прыгает, конфетти на весь экран.
 *
 * Приёмы (research/28-breakdown-reveal/report.md): работу делает персонаж; слова человека видны и становятся шагами;
 * сигнал перед раскрытием; квитанция после (реплика кота); короче с опытом — 1,3 / 0,9 / 0,6 с; тап — сразу итог;
 * подаренный прогресс. Настоящий текст шагов всё время в DOM; летают копии (aria-hidden). «Уменьшить движение» — без сцены.
 * Урок (knowledge/lessons.md, 16.11): у узла несколько анимаций одного свойства — начало держит только первая (fill both),
 * следующие — forwards, иначе поздняя перебивает раннюю ещё до своего старта.
 */

import { celebrate, preloadConfetti } from './confetti'

const PAW = '/mascot/reveal/paw.webp'
const PRINT = '/mascot/reveal/print.webp'

/** длительность по стажу: первые разы — вся сцена, потом короче (привыкание, «Google приучил к долям секунды») */
export function revealMs(nth: number) {
  return nth <= 3 ? 1300 : nth <= 10 ? 900 : 600
}


type Box = { ch: string; x: number; y: number; w: number; h: number }

/** где на экране стоит каждая буква текста (через Range — сам текст не режем на span'ы, диктор читает его целиком) */
function charBoxes(el: Element): Box[] {
  const out: Box[] = []
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const r = document.createRange()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.textContent ?? ''
    for (let i = 0; i < s.length; i++) {
      if (!s[i].trim()) continue
      r.setStart(n, i)
      r.setEnd(n, i + 1)
      const b = r.getBoundingClientRect()
      if (b.width) out.push({ ch: s[i], x: b.left, y: b.top, w: b.width, h: b.height })
    }
  }
  return out
}

const rect = (el: Element | null) => el?.getBoundingClientRect() ?? new DOMRect()
const SPRING = 'cubic-bezier(.2,1.35,.35,1)'
const OUT = 'cubic-bezier(.05,.7,.1,1)'

/** Буква-копия поверх страницы тем же шрифтом, что и настоящая */
function ghostLetter(layer: HTMLElement, b: Box, font: string, color: string) {
  const d = document.createElement('span')
  d.textContent = b.ch
  Object.assign(d.style, {
    position: 'absolute',
    left: `${b.x}px`,
    top: `${b.y}px`,
    font,
    color,
    lineHeight: `${b.h}px`,
    whiteSpace: 'pre',
    willChange: 'transform, opacity',
  })
  layer.appendChild(d)
  return d
}

type Ctx = {
  T: number
  nth: number
  layer: HTMLElement
  svg: SVGSVGElement
  cat: HTMLElement
  /** место карточки первого шага: в нём ждало полено и в нём оно колется */
  slot: HTMLElement
  /** полено уже ждало удара в разметке (дробление шло с сервера) — сцена встаёт на его место без проявления */
  fromWait: boolean
  card: HTMLElement
  source: HTMLElement
  texts: HTMLElement[]
  bullets: HTMLElement[]
  more: HTMLElement | null
  stamp0: HTMLElement
  anims: Animation[]
  at: (f: number) => number
  run: (el: Element, kf: Keyframe[], from: number, to: number, o?: KeyframeAnimationOptions) => Animation
  onImpact: () => void
}

const NS = 'http://www.w3.org/2000/svg'
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}


/* ───────────────────────────── «Полено» ───────────────────────────── */

/** Полено сбоку: кора с прожилками, сучок, спил с годовыми кольцами справа. Рисуется под размер карточки дела. */
function logSvg(w: number, h: number, seed: number) {
  const r = h / 2
  const capRx = h * 0.3
  let rnd = seed
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
      <radialGradient id="rvCut${seed}" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#f3cf98"/><stop offset=".7" stop-color="#deac70"/><stop offset="1" stop-color="#c38a52"/></radialGradient>
    </defs>
    <ellipse cx="${w / 2}" cy="${h + 5}" rx="${w * 0.46}" ry="6" fill="#000" fill-opacity=".35"/>
    <path d="M${capRx},0 H${w - capRx} V${h} H${capRx} A${capRx} ${r} 0 0 1 ${capRx},0 Z" fill="url(#rvBark${seed})"/>
    ${grain.join('')}
    <ellipse cx="${kx}" cy="${ky}" rx="7" ry="4.5" fill="#3d2414"/><ellipse cx="${kx}" cy="${ky}" rx="4" ry="2.4" fill="none" stroke="#b07a46" stroke-opacity=".6"/>
    <path d="M${capRx},2 H${w - capRx}" stroke="#d6a070" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="${w - capRx}" cy="${r}" rx="${capRx}" ry="${r}" fill="url(#rvCut${seed})" stroke="#3a2212" stroke-width="3"/>
    ${rings}
    <circle cx="${w - capRx}" cy="${r}" r="1.8" fill="#8a5a32"/>
  </svg>`
}

/** Полено в элементе host: картинка коры + слова человека резьбой. Один рисунок для полена ожидания (в разметке Фокуса)
 *  и для полена сцены — смена одного на другое незаметна. seed — свой у каждого куска: id градиентов в документе не
 *  повторяются (иначе Safari брал градиент чужого, скрытого полена и красил кусок чёрным — «тёмный кусок», 17.11) */
export function drawLog(host: HTMLElement, w: number, h: number, text: string, font: string, seed: number) {
  host.innerHTML = logSvg(w, h, seed)
  const carve = document.createElement('p')
  carve.textContent = text
  carve.dataset.rvCarve = ''
  Object.assign(carve.style, {
    position: 'absolute', left: `${h * 0.3 + 10}px`, right: `${h * 0.6 + 6}px`, top: '50%', transform: 'translateY(-50%)', margin: '0',
    font, color: '#ffe9cc', textShadow: '0 1px 0 rgba(0,0,0,.55), 0 -1px 0 rgba(255,210,150,.15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  })
  host.appendChild(carve)
  return carve
}

/** высота полена под место карточки: тот же расчёт у полена ожидания и у сцены */
export const logHeight = (slotH: number) => Math.max(56, Math.min(72, slotH + 4))

function playLog(c: Ctx) {
  const { run } = c
  const short = c.nth > 10
  const cat = rect(c.cat)
  const slot = rect(c.slot)
  const h = logHeight(slot.height)
  const w = slot.width
  const L = { x: slot.left, y: slot.top + (slot.height - h) / 2 }
  const scs = getComputedStyle(c.source)

  // 1 · дело становится поленом. Если полено уже ждало удара в разметке (дробление шло с сервера), сцена берёт его
  // место без проявления — та же картинка в той же точке; иначе (готовые шаги) полено вырастает из карточки
  const log = document.createElement('div')
  Object.assign(log.style, { position: 'absolute', left: `${L.x}px`, top: `${L.y}px`, width: `${w}px`, height: `${h}px`, transformOrigin: '50% 100%' })
  const carve = drawLog(log, w, h, c.source.textContent ?? '', scs.font, 7)
  c.layer.appendChild(log)
  const fromWait = c.fromWait
  const t0 = 0
  const tLog = fromWait ? 0.001 : short ? 0.04 : 0.14
  const tImp = short ? 0.12 : 0.32
  if (fromWait) {
    run(log, [{ opacity: 1 }, { opacity: 1 }], 0, 0.001)
  } else {
    run(log, [
      { opacity: 0, transform: 'scale(.92, .6)' },
      { opacity: 1, transform: 'scale(1.03, 1.08)', offset: 0.6 },
      { opacity: 1, transform: 'scale(1)' },
    ], t0, tLog, { easing: SPRING })
  }

  // 2 · кот готовится и хлопает лапой сверху по середине полена
  const hit = { x: L.x + w * 0.5, y: L.y + 4 }
  const pw = Math.min(80, cat.width * 0.6)
  run(c.cat, [
    { transform: 'none' },
    { transform: 'translateY(5px) scale(1.05,.92)', offset: 0.5 },
    { transform: 'translateY(-4px) scale(.97,1.05)', offset: 0.85 },
    { transform: 'none' },
  ], short ? 0 : 0.08, tImp + 0.06, { easing: 'ease-in-out' })
  const paw = document.createElement('img')
  paw.src = PAW
  paw.alt = ''
  Object.assign(paw.style, { position: 'absolute', left: '0', top: '0', width: `${pw}px`, willChange: 'transform' })
  c.layer.appendChild(paw)
  const from = { x: cat.left + cat.width * 0.6, y: cat.bottom - pw * 0.4 }
  const lift = { x: hit.x + 6, y: hit.y - pw * 1.15 }
  const P = (p: { x: number; y: number }, rot: number, s: number, o = 1): Keyframe => ({ transform: `translate(${p.x - pw / 2}px, ${p.y - pw / 2}px) rotate(${rot}deg) scale(${s})`, opacity: o })
  const tUp = short ? 0.02 : 0.16
  run(paw, [P(from, -30, 0.5, 0), { ...P({ x: (from.x + lift.x) / 2 + 30, y: Math.min(from.y, lift.y) - 20 }, -10, 0.85), offset: 0.55 }, P(lift, 8, 1)], tUp, tImp - 0.05, { easing: 'cubic-bezier(.3,0,.3,1)' })
  // замах: на миг зависает выше, потом резко вниз
  run(paw, [P(lift, 8, 1), { ...P({ x: lift.x, y: lift.y - 10 }, 12, 1.04), offset: 0.35 }, P({ x: hit.x, y: hit.y - pw * 0.28 }, 0, 1.12)], tImp - 0.05, tImp, { easing: 'cubic-bezier(.7,0,.9,.5)' })
  run(paw, [
    P({ x: hit.x, y: hit.y - pw * 0.28 }, 0, 1.12),
    { ...P({ x: hit.x, y: hit.y - pw * 0.22 }, 0, 1.18), offset: 0.2 },
    P(from, -30, 0.5, 0),
  ], tImp, tImp + 0.14, { easing: 'cubic-bezier(.4,0,.6,1)' })

  // 3 · удар: полено подпрыгивает и сплющивается, щепки, пыль, светящиеся трещины по местам будущих кусков
  c.onImpact()
  run(log, [
    { transform: 'scale(1)' },
    { transform: 'translateY(3px) scale(1.04,.86)', offset: 0.25 },
    { transform: 'translateY(-5px) scale(.98,1.05)', offset: 0.6 },
    { transform: 'scale(1)' },
  ], tImp, tImp + 0.1, { easing: 'ease-out' })
  const dust = document.createElement('div')
  Object.assign(dust.style, { position: 'absolute', left: `${hit.x - 60}px`, top: `${L.y + h - 30}px`, width: '120px', height: '60px', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(230,200,160,.45), transparent)' })
  c.layer.insertBefore(dust, log)
  run(dust, [{ transform: 'scale(.3,.2)', opacity: 0.9 }, { transform: 'scale(2.2,1)', opacity: 0 }], tImp, tImp + 0.18, { easing: OUT })
  for (let k = 0; k < 16; k++) {
    const chip = document.createElement('div')
    const bark = k % 3 === 0
    const sz = 4 + (k % 4) * 2
    Object.assign(chip.style, {
      position: 'absolute', left: `${hit.x - sz / 2}px`, top: `${hit.y + h * 0.3}px`, width: `${sz}px`, height: `${sz * 0.55}px`,
      background: bark ? '#5a3620' : k % 2 ? '#e2b27a' : '#c98f58', borderRadius: '1px', clipPath: 'polygon(0 30%, 70% 0, 100% 60%, 30% 100%)',
    })
    c.layer.appendChild(chip)
    const a = -Math.PI / 2 + ((k / 15) - 0.5) * 2.6
    const v = 50 + (k * 37) % 70
    const dx = Math.cos(a) * v * 1.4
    const dy = Math.sin(a) * v
    const kf: Keyframe[] = []
    for (let s = 0; s <= 6; s++) {
      const u = s / 6
      kf.push({ transform: `translate(${dx * u}px, ${dy * u + 220 * u * u}px) rotate(${(k % 2 ? 1 : -1) * 540 * u}deg)`, opacity: u > 0.75 ? 1 - (u - 0.75) * 4 : 1 })
    }
    run(chip, kf, tImp, tImp + 0.26 + (k % 3) * 0.03, { easing: 'linear' })
  }

  // куски: первый — в карточку первого шага, остальные — на строки видимых шагов (на «ещё N» куска нет: это не шаг)
  const N = 1 + c.texts.length - 1
  // где на полене стоят буквы резьбы: трещина проходит МЕЖДУ буквами, слово колется ровно по ней (17.11: «Покуш» и «ать»
  // налезали друг на друга, буквы резались пополам)
  const lr = log.getBoundingClientRect()
  const letters = charBoxes(carve).map((b) => ({ l: b.x - lr.left, r: b.x - lr.left + b.w }))
  const gaps: number[] = []
  for (let i = 1; i < letters.length; i++) gaps.push((letters[i - 1].r + letters[i].l) / 2)
  const textL = letters.length ? letters[0].l : 0
  const textR = letters.length ? letters[letters.length - 1].r : 0
  const cuts: number[] = []
  for (let k = 1; k < N; k++) {
    let x = (w * k) / N
    if (letters.length && x > textL - 3 && x < textR + 3 && gaps.length) {
      const prev = cuts.length ? cuts[cuts.length - 1] : 0
      const best = gaps.filter((g) => g > prev + 28).sort((a, b) => Math.abs(a - x) - Math.abs(b - x))[0]
      if (best !== undefined && Math.abs(best - x) < w / N / 2) x = best
    }
    cuts.push(x)
  }
  // трещины: зигзаг сверху и снизу, а в полосе букв — ровно по разрезу; общий для двух соседних кусков, без щели
  const zig: number[][] = cuts.map((x, k) => {
    const pts: number[] = []
    for (let s = 0; s <= 5; s++) pts.push(s === 2 || s === 3 ? x : x + (s % 2 ? 5 : -5) + (((k + 1) * 13 + s * 7) % 5) - 2)
    return pts
  })
  const cracks = svgEl('g', {})
  c.svg.appendChild(cracks)
  zig.forEach((pts, i) => {
    const d = pts.map((x, s) => `${s ? 'L' : 'M'}${L.x + x},${L.y + (h * s) / 5}`).join(' ')
    const glow = svgEl('path', { d, fill: 'none', stroke: '#ff9a3c', 'stroke-width': 7, 'stroke-opacity': 0.35, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    const core = svgEl('path', { d, fill: 'none', stroke: '#ffe2a8', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
    cracks.append(glow, core)
    const len = h * 1.3
    // трещины расходятся от места удара наружу
    const order = Math.abs(i + 1 - N / 2)
    const tc = tImp + 0.01 + order * 0.025
    for (const p of [glow, core]) {
      p.setAttribute('stroke-dasharray', `${len} ${len}`)
      run(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], tc, tc + 0.06, { easing: 'ease-out' })
    }
    // сигнал «сейчас развалится»: свечение трещин разгорается
    run(glow, [{ strokeOpacity: 0.35, strokeWidth: 7 }, { strokeOpacity: 0.85, strokeWidth: 12 }], tc + 0.06, short ? 0.24 : 0.46, { easing: 'ease-in' })
  })
  // угольки поднимаются из трещин
  zig.forEach((pts, i) => {
    for (let e = 0; e < 3; e++) {
      const em = document.createElement('div')
      Object.assign(em.style, { position: 'absolute', left: `${L.x + pts[2] - 2}px`, top: `${L.y + h * 0.4}px`, width: '4px', height: '4px', borderRadius: '50%', background: '#ffcf70', boxShadow: '0 0 6px 2px rgba(255,150,50,.7)' })
      c.layer.appendChild(em)
      const te = tImp + 0.05 + e * 0.04 + i * 0.02
      run(em, [{ transform: 'translate(0,0) scale(1)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translate(${(e - 1) * 14}px, ${-40 - e * 18}px) scale(.3)`, opacity: 0 }], te, te + 0.3, { easing: 'ease-out' })
    }
  })
  run(cracks, [{ opacity: 1 }, { opacity: 0 }], short ? 0.24 : 0.46, short ? 0.25 : 0.47)
  run(log, [{ opacity: 1 }, { opacity: 0 }], short ? 0.24 : 0.46, short ? 0.241 : 0.461)

  // 4 · полено раскалывается: каждый кусок (с кусочком тех же слов) отскакивает, потом летит на место своего шага
  const tSplit = short ? 0.24 : 0.46
  const tFly = short ? 0.32 : 0.56
  for (let k = 0; k < N; k++) {
    const left = k ? zig[k - 1] : null
    const right = k < N - 1 ? zig[k] : null
    const poly: string[] = []
    if (left) for (let s = 0; s <= 5; s++) poly.push(`${left[s]}px ${(h * s) / 5}px`)
    else poly.push(`-20px -10px`, `-20px ${h + 10}px`)
    if (right) for (let s = 5; s >= 0; s--) poly.push(`${right[s]}px ${(h * s) / 5}px`)
    else poly.push(`${w + 20}px ${h + 10}px`, `${w + 20}px -10px`)
    // порядок: левый край сверху вниз, правый снизу вверх — замкнутый контур куска
    const ordered = left ? poly : [poly[0], poly[1], ...poly.slice(2)]
    const piece = document.createElement('div')
    Object.assign(piece.style, { position: 'absolute', left: `${L.x}px`, top: `${L.y}px`, width: `${w}px`, height: `${h}px`, clipPath: `polygon(${ordered.join(',')})` })
    drawLog(piece, w, h, carve.textContent ?? '', scs.font, 100 + k)
    // кусок со словами человека (первый) — поверх остальных: соседний кусок, летящий к своей строке, проходит позади
    // и не закрывает слова (17.11)
    c.layer.insertBefore(piece, k === 0 ? null : c.layer.firstChild)
    const xl = left ? left[2] : 0
    const xr = right ? right[2] : w
    const cx = (xl + xr) / 2
    piece.style.transformOrigin = `${cx}px ${h / 2}px`
    const mid = (N - 1) / 2
    // раскол: куски расходятся на 16 px и чуть поворачиваются — соседние не налезают друг на друга
    const sep = `translate(${(k - mid) * 16}px, ${-8 - Math.abs(k - mid) * 2}px) rotate(${(k - mid) * 2.5}deg)`
    run(piece, [{ opacity: 0 }, { opacity: 1 }], tSplit, tSplit + 0.001)
    run(piece, [{ transform: 'none' }, { transform: sep }], tSplit, tFly, { easing: SPRING })
    // цель — сам текст шага: первый кусок ложится на заголовок карточки, остальные — на свои строки, и превращаются в них
    const to = rect(c.texts[k])
    const tx = to.left + to.width / 2 - (L.x + cx)
    const ty = to.top + to.height / 2 - (L.y + h / 2)
    // кусок не раздувается (раздутый первый кусок висел над карточкой полупрозрачным «призраком», 17.11): только сжимается
    // до размера строки
    const sx = Math.min(1, Math.max(0.3, to.width / Math.max(30, xr - xl)))
    const sy = Math.min(1, Math.max(0.28, (to.height * 1.3) / h))
    const tk = tFly + k * 0.04
    const tArr = tk + 0.2
    run(piece, [
      { transform: sep, opacity: 1 },
      { transform: `translate(${tx * 0.5}px, ${ty * 0.5 - 22}px) rotate(${(k - mid) * -4}deg) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, opacity: 1, offset: 0.5 },
      // на строку кусок садится ровно, уже растворяясь: буквы шага загораются на его месте, не под деревом
      { transform: `translate(${tx * 0.94}px, ${ty * 0.97}px) rotate(0deg) scale(${sx}, ${sy})`, opacity: 0.8, offset: 0.82 },
      { transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(${sx}, ${sy})`, opacity: 0 },
    ], tk, tArr, { easing: 'cubic-bezier(.3,0,.25,1)' })
    // 5 · на месте кусок «выжигает» шаг: буквы загораются угольком слева направо и остывают в обычный текст
    if (k === 0) run(c.card, [{ opacity: 0 }, { opacity: 1 }], tArr - 0.02, tArr + 0.04, { easing: OUT })
    if (k > 0 && c.bullets[k - 1]) run(c.bullets[k - 1], [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], tArr - 0.02, tArr + 0.06, { easing: SPRING })
    burnIn(c, c.texts[k], tArr - 0.02, Math.min(0.12, 0.004 * (c.texts[k].textContent?.length ?? 10)), 0.14)
    if (k === N - 1 && c.more) run(c.more, [{ opacity: 0 }, { opacity: 1 }], tArr + 0.04, tArr + 0.14, { easing: OUT })
  }

  // отпечаток лапы остался на месте удара — он и есть подаренный первый штамп
  const print = document.createElement('div')
  // отпечаток — у верхнего края полена, над словами: на середине он закрывал буквы («курс◉вую», 17.11)
  const ps = 24
  const py = L.y + h * 0.17
  Object.assign(print.style, {
    position: 'absolute', left: `${hit.x - ps / 2}px`, top: `${py - ps / 2}px`, width: `${ps}px`, height: `${(ps * 91) / 100}px`,
    background: '#a0ec2a', WebkitMaskImage: `url(${PRINT})`, maskImage: `url(${PRINT})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
  })
  c.layer.appendChild(print)
  run(print, [{ transform: 'scale(1.8) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 0.95 }], tImp, tImp + 0.05, { easing: 'cubic-bezier(.6,0,.4,1)' })
  const s0 = rect(c.stamp0)
  const tS = 0.8
  const dx = s0.left + s0.width / 2 - hit.x
  const dy = s0.top + s0.height / 2 - py
  run(print, [
    { transform: 'scale(1) rotate(-12deg)', opacity: 0.95 },
    { transform: `translate(${dx * 0.5 + 30}px, ${dy * 0.5 - 30}px) scale(1.4) rotate(-40deg)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.62) rotate(-12deg)`, opacity: 1 },
  ], tS - 0.14, tS + 0.08, { easing: 'cubic-bezier(.5,0,.4,1)' })
  run(print, [{ opacity: 1 }, { opacity: 0 }], tS + 0.08, tS + 0.081)
}

/** Буквы шага загораются на своём месте угольком (свечение) и остывают до обычного цвета текста */
function burnIn(c: Ctx, el: HTMLElement, t0: number, span: number, dur: number) {
  const cs = getComputedStyle(el)
  const boxes = charBoxes(el)
  const step = boxes.length > 1 ? span / (boxes.length - 1) : 0
  boxes.forEach((b, j) => {
    const g = ghostLetter(c.layer, b, cs.font, cs.color)
    const tj = t0 + step * j
    c.run(g, [
      { opacity: 0, color: '#fff4c2', textShadow: '0 0 10px rgba(255,170,60,1), 0 0 2px #fff', transform: 'translateY(3px) scale(1.25)' },
      { opacity: 1, color: '#ffc46b', textShadow: '0 0 8px rgba(255,140,40,.9)', transform: 'translateY(-1px) scale(1.08)', offset: 0.35 },
      { opacity: 1, color: cs.color, textShadow: '0 0 0 rgba(255,140,40,0)', transform: 'none' },
    ], tj, tj + dur, { easing: 'ease-out' })
    c.run(g, [{ opacity: 1 }, { opacity: 0 }], t0 + span + dur, t0 + span + dur + 0.001)
  })
  c.run(el, [{ opacity: 0 }, { opacity: 1 }], t0 + span + dur, t0 + span + dur + 0.001)
}


export type LogRevealRefs = Omit<Ctx, 'T' | 'nth' | 'layer' | 'svg' | 'anims' | 'at' | 'run' | 'onImpact'>

/** Сыграть «Полено» поверх экрана. Возвращает обещание конца и пропуск (тап — сразу итог). Слой сам убирается. */
export function playLogReveal(refs: LogRevealRefs, nth: number, onImpact: () => void): { finished: Promise<void>; skip: () => void } {
  const T = revealMs(nth)
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '60', pointerEvents: 'none', overflow: 'hidden' })
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement
  svg.setAttribute('aria-hidden', 'true')
  Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '59', pointerEvents: 'none', overflow: 'visible' })
  document.body.append(svg, layer)
  const list: Animation[] = []
  const at = (f: number) => f * T
  const seen = new WeakMap<Element, Set<string>>()
  const run: Ctx['run'] = (el, kf, from, to, o) => {
    const props = new Set(kf.flatMap((k) => Object.keys(k).filter((p) => p !== 'offset' && p !== 'easing' && p !== 'composite')))
    const had = seen.get(el) ?? new Set<string>()
    const fill: FillMode = [...props].some((p) => had.has(p)) ? 'forwards' : 'both'
    props.forEach((p) => had.add(p))
    seen.set(el, had)
    const a = el.animate(kf, { duration: Math.max(1, at(to - from)), delay: at(from), fill, easing: o?.easing ?? 'ease', ...o })
    list.push(a)
    return a
  }
  const timer = window.setTimeout(onImpact, at(nth > 10 ? 0.12 : 0.32))
  playLog({ ...refs, T, nth, layer, svg, anims: list, at, run, onImpact: () => {} })
  const cleanup = () => {
    window.clearTimeout(timer)
    for (const a of list) a.cancel()
    layer.replaceChildren()
    layer.parentNode?.removeChild(layer)
    svg.parentNode?.removeChild(svg)
  }
  const finished = Promise.all(list.map((a) => a.finished)).then(cleanup, cleanup)
  return {
    finished,
    skip: () => {
      for (const a of list) a.finish()
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
  preloadConfetti(PRINT)
  if (typeof window !== 'undefined') {
    const im = new Image()
    im.src = PAW
  }
}
