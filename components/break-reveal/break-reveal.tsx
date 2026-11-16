'use client'

/**
 * Раскрытие разбивки (владелец 16.11): человек нажал «Разломать» — план готов почти мгновенно, но кот секунду честно
 * «работает» над ЕГО словами, и дело на глазах превращается в шаги. Два варианта на выбор владельца:
 *   «Клубок» — слова дела сматываются в клубок, кот подталкивает его, клубок катится и разматывается нитью, а шаги
 *              «вытягиваются» из узелков на нити буква за буквой;
 *   «Лапой»  — кот замахивается и бьёт лапой (лапа вырезана из эталона, public/mascot/reveal/paw.webp) по карточке
 *              дела: трещина, отпечаток, карточка веером распадается на шаги, а буквы дела перелетают в буквы шагов.
 * После — праздник как у Duolingo: кот подпрыгивает, конфетти на весь экран, вибрация, квитанция «Разломал на N шагов».
 *
 * Приёмы (research/28-breakdown-reveal/report.md, владелец взял все):
 *  - работу делает персонаж, а не полоса («он постарался для меня», Buell & Norton; Efendić: медленная машина теряет);
 *  - слова человека видны всё время и становятся каркасом результата — никаких «Загрузка…»;
 *  - перед раскрытием сигнал «сейчас будет»: свечение клубка / трещина от удара;
 *  - квитанция усилия после: «Разломал на 5 шагов, первый — 2 минуты» (только правда);
 *  - короче с каждым разом (1–3-я разбивка 1,3 с, 4–10-я 0,9 с, дальше 0,6 с — только жест и раскрытие), тап
 *    по экрану — сразу результат;
 *  - подаренный прогресс (Nunes & Drèze, автомойка): карта штампов, первый штамп — отпечаток лапы за то, что дело уже
 *    разломано (это правда), первый шаг наполовину;
 *  - первый шаг сразу выделен и ведёт к действию; пустых кадров нет — каждый кадр что-то происходит с его словами.
 * Настоящий текст шагов всё время в DOM (диктор читает сразу); летают только копии букв (aria-hidden).
 * «Уменьшить движение» — сразу итог, без полёта и конфетти.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MascotDoll } from '@/components/mascot-doll'
import { Button } from '@/components/ui/button'
import type { MascotAction, MascotExpression } from '@/components/mascot-doll'
import { useReducedMotion } from '@/lib/reduced-motion'
import { hapticReaction, hapticReward } from '@/lib/haptics'
import { celebrate, preloadConfetti } from './confetti'

export type RevealStep = { text: string; minutes?: number; wait?: boolean }
export type RevealVariant = 'yarn' | 'paw' | 'log'

const PAW = '/mascot/reveal/paw.webp'
const PRINT = '/mascot/reveal/print.webp'

/** длительность по стажу: первые разы — вся сцена, потом короче (привыкание, «Google приучил к долям секунды») */
export function revealMs(nth: number) {
  return nth <= 3 ? 1300 : nth <= 10 ? 900 : 600
}

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10
  const b = n % 100
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many
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
// клубок после толчка срывается с места сразу и замедляется по мере того, как худеет (разматывается)
const ease = (t: number) => 1 - Math.pow(1 - t, 2.4)
const easeInv = (y: number) => {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 24; k++) {
    const m = (lo + hi) / 2
    if (ease(m) < y) lo = m
    else hi = m
  }
  return (lo + hi) / 2
}
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

/** Буквы шага приходят на свои места (из узелка, из буквы дела…): у каждой своя точка старта */
function landLetters(c: Ctx, el: HTMLElement, from: (b: Box, j: number) => { x: number; y: number; s?: number }, t0: number, span: number, dur: number) {
  const cs = getComputedStyle(el)
  const boxes = charBoxes(el)
  const step = boxes.length > 1 ? span / (boxes.length - 1) : 0
  boxes.forEach((b, j) => {
    const g = ghostLetter(c.layer, b, cs.font, cs.color)
    const o = from(b, j)
    const dx = o.x - (b.x + b.w / 2)
    const dy = o.y - (b.y + b.h / 2)
    c.run(
      g,
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${o.s ?? 0.25}) rotate(${(j % 2 ? 1 : -1) * 40}deg)`, opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 10}px) scale(1.15) rotate(${(j % 2 ? -1 : 1) * 8}deg)`, offset: 0.65 },
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      ],
      t0 + step * j,
      t0 + step * j + dur,
      { easing: 'cubic-bezier(.3,.6,.2,1)' },
    )
    // копия исчезает в тот же кадр, когда проявляется настоящий текст
    c.run(g, [{ opacity: 1 }, { opacity: 0 }], t0 + span + dur, t0 + span + dur + 0.001)
  })
  c.run(el, [{ opacity: 0 }, { opacity: 1 }], t0 + span + dur, t0 + span + dur + 0.001)
}

/* ───────────────────────────── «Клубок» ───────────────────────────── */

function yarnBall(size: number) {
  const d = document.createElement('div')
  Object.assign(d.style, { position: 'absolute', left: '0', top: '0', width: `${size}px`, height: `${size}px`, willChange: 'transform' })
  const strands = [
    'M6 40 C 18 8, 52 6, 62 26',
    'M4 30 C 24 48, 48 50, 63 36',
    'M14 12 C 30 34, 30 50, 22 62',
    'M34 2 C 50 22, 54 44, 44 63',
    'M10 50 C 26 28, 44 20, 60 16',
    'M20 6 C 10 26, 16 48, 34 62',
    'M2 22 C 22 26, 42 40, 52 60',
  ]
  d.innerHTML = `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="overflow:visible;display:block">
    <defs>
      <radialGradient id="rvYarnG" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffc39a"/><stop offset=".55" stop-color="#ff8a3d"/><stop offset="1" stop-color="#c4531c"/></radialGradient>
      <clipPath id="rvYarnC"><circle cx="32" cy="32" r="30"/></clipPath>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#rvYarnG)"/>
    <g clip-path="url(#rvYarnC)"><g data-spin style="transform-origin:32px 32px">
      ${strands.map((p, i) => `<path d="${p}" fill="none" stroke="${i % 2 ? '#ffd9bd' : '#b8501d'}" stroke-opacity="${i % 2 ? 0.75 : 0.55}" stroke-width="2.2" stroke-linecap="round"/>`).join('')}
    </g></g>
    <circle cx="32" cy="32" r="30" fill="none" stroke="#2a1608" stroke-width="2.4"/>
    <path d="M14 20 Q 20 12 30 10" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`
  return d
}

function playYarn(c: Ctx) {
  const { run } = c
  const short = c.nth > 10
  const cat = rect(c.cat)
  const R = 26
  const S = { x: cat.right + R * 0.35, y: cat.top + cat.height * 0.66 }

  // 1 · слова дела сматываются в клубок: каждая буква летит по спирали к клубку и наматывается
  const ball = yarnBall(R * 2)
  c.layer.appendChild(ball)
  const spin = ball.querySelector('[data-spin]') as SVGGElement
  const src = charBoxes(c.source)
  const scs = getComputedStyle(c.source)
  const p1a = short ? 0 : 0.02
  const p1b = short ? 0.1 : 0.28
  run(c.source, [{ opacity: 1 }, { opacity: 0 }], p1a, p1a + 0.001)
  if (!short) {
    src.forEach((b, j) => {
      const g = ghostLetter(c.layer, b, scs.font, scs.color)
      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2
      const dx = S.x - cx
      const dy = S.y - cy
      const ang = Math.atan2(-dy, -dx)
      const kf: Keyframe[] = []
      for (let k = 0; k <= 8; k++) {
        const u = k / 8
        // радиус вокруг клубка сжимается, угол докручивается — буква «наматывается»
        const rr = (1 - u) * Math.hypot(dx, dy)
        const a = ang + u * u * 4.2
        const x = S.x + Math.cos(a) * rr - cx
        const y = S.y + Math.sin(a) * rr * (1 - 0.2 * u) - cy
        kf.push({ transform: `translate(${x}px, ${y}px) scale(${1 - 0.75 * u}) rotate(${u * 300}deg)`, opacity: u > 0.85 ? 0 : 1 })
      }
      const d0 = p1a + (j / Math.max(1, src.length - 1)) * 0.1
      run(g, kf, d0, d0 + 0.2, { easing: 'cubic-bezier(.5,0,.6,1)' })
    })
  }
  run(ball, [
    { transform: `translate(${S.x - R}px, ${S.y - R}px) scale(0.15)`, opacity: 0 },
    { opacity: 1, offset: 0.2 },
    { transform: `translate(${S.x - R}px, ${S.y - R}px) scale(1)`, opacity: 1 },
  ], short ? 0 : 0.06, p1b, { easing: SPRING })
  run(spin, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-540deg)' }], short ? 0 : 0.06, p1b, { easing: 'cubic-bezier(.3,0,.3,1)' })

  // 2 · сигнал «сейчас будет»: кот подаётся к клубку, клубок пружинит и вспыхивает
  const p2b = short ? 0.16 : 0.36
  run(c.cat, [
    { transform: 'rotate(0deg) translateY(0)' },
    { transform: 'rotate(5deg) translateY(3px) scale(1.03,0.96)', offset: 0.45 },
    { transform: 'rotate(-2deg) translateY(-2px)', offset: 0.75 },
    { transform: 'rotate(0deg) translateY(0)' },
  ], p1b - 0.04, p2b + 0.02, { easing: 'ease-in-out' })
  const glow = document.createElement('div')
  Object.assign(glow.style, {
    position: 'absolute', left: `${S.x - R * 2}px`, top: `${S.y - R * 2}px`, width: `${R * 4}px`, height: `${R * 4}px`, borderRadius: '50%',
    background: 'radial-gradient(closest-side, rgba(255,190,120,.75), rgba(255,138,61,.25) 55%, transparent)',
  })
  c.layer.insertBefore(glow, ball)
  c.onImpact()
  run(glow, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.45 }, { transform: 'scale(1.5)', opacity: 0 }], p1b - 0.02, p2b + 0.08, { easing: OUT })

  // 3 · нить: путь от клубка через начало каждого шага; клубок катится по ней и худеет
  const pts: { x: number; y: number }[] = [S]
  const anchors: { x: number; y: number; el: HTMLElement }[] = []
  c.texts.forEach((t, i) => {
    const b = i === 0 ? charBoxes(t)[0] : null
    const a = i === 0 && b ? { x: b.x - 9, y: b.y + b.h / 2 } : (() => {
      const r = rect(c.bullets[i - 1])
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()
    anchors.push({ ...a, el: t })
  })
  if (c.more) {
    const r = rect(c.more)
    anchors.push({ x: r.left + 6, y: r.top + r.height / 2, el: c.more })
  }
  // нить провисает между узелками: промежуточные точки уводим в сторону
  let prev = S
  anchors.forEach((a, i) => {
    const mx = (prev.x + a.x) / 2 + (i === 0 ? 40 : i % 2 ? -14 : 14)
    const my = (prev.y + a.y) / 2
    pts.push({ x: mx, y: my }, { x: a.x, y: a.y })
    prev = a
  })
  // сглаженная кривая через точки (Catmull-Rom → кубические Безье)
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`
  }
  const thread = svgEl('path', { d, fill: 'none', stroke: '#ff8a3d', 'stroke-width': 2.6, 'stroke-linecap': 'round' })
  const fiber = svgEl('path', { d, fill: 'none', stroke: '#ffd9bd', 'stroke-width': 1.1, 'stroke-linecap': 'round', 'stroke-dasharray': '2 5', 'stroke-opacity': 0.9 })
  const mask = svgEl('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round' })
  const mid = `rvThreadM${Math.random().toString(36).slice(2, 7)}`
  const mk = svgEl('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: innerWidth, height: innerHeight })
  mk.appendChild(mask)
  const g = svgEl('g', { mask: `url(#${mid})`, 'data-thread': 1 })
  g.append(thread, fiber)
  c.svg.append(mk, g)
  const L = thread.getTotalLength()
  mask.setAttribute('stroke-dasharray', `${L} ${L}`)
  const p3a = p2b - 0.02
  const p3b = 0.88
  const K = 36
  const ballKf: Keyframe[] = []
  const maskKf: Keyframe[] = []
  for (let k = 0; k <= K; k++) {
    const u = k / K
    const l = ease(u) * L
    const p = thread.getPointAtLength(l)
    const s = 1 - 0.62 * ease(u)
    ballKf.push({ transform: `translate(${p.x - R}px, ${p.y - R}px) scale(${s})` })
    maskKf.push({ strokeDashoffset: `${L - l}` })
  }
  run(ball, ballKf, p3a, p3b, { easing: 'linear' })
  run(mask, maskKf, p3a, p3b, { easing: 'linear' })
  run(spin, [{ transform: 'rotate(-540deg)' }, { transform: `rotate(${-540 + (L / R) * 57}deg)` }], p3a, p3b, { easing: 'cubic-bezier(.65,0,.35,1)' })
  // клубок кончился: последний виток завязывается бантиком, клубок исчезает с искрой
  run(ball, [{ opacity: 1 }, { opacity: 0, transform: ballKf[K].transform + ' scale(0.2)' }], p3b, p3b + 0.06, { easing: 'ease-in' })

  // 4 · из каждого узелка вытягивается шаг: буквы выходят из нити и встают на места
  const total = p3b - p3a
  anchors.forEach((a, i) => {
    // где на нити этот узелок: длина пути до ближайшей точки
    let best = 0
    let bd = Infinity
    for (let l = 0; l <= L; l += 4) {
      const p = thread.getPointAtLength(l)
      const dd = (p.x - a.x) ** 2 + (p.y - a.y) ** 2
      if (dd < bd) {
        bd = dd
        best = l
      }
    }
    const tKnot = p3a + easeInv(best / L) * total
    const knot = document.createElement('div')
    Object.assign(knot.style, { position: 'absolute', left: `${a.x - 5}px`, top: `${a.y - 5}px`, width: '10px', height: '10px', borderRadius: '50%', background: '#ff8a3d', boxShadow: '0 0 0 2px #2a1608 inset, 0 0 12px rgba(255,138,61,.8)' })
    c.layer.appendChild(knot)
    run(knot, [{ transform: 'scale(0)' }, { transform: 'scale(1.7)', offset: 0.5 }, { transform: 'scale(1)' }], tKnot, tKnot + 0.1, { easing: SPRING })
    run(knot, [{ opacity: 1 }, { opacity: i < c.bullets.length + 1 ? 0 : 1 }], 1, 1.001)
    if (a.el === c.more) {
      run(c.more, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], tKnot, tKnot + 0.12, { easing: OUT })
      return
    }
    if (i > 0) run(c.bullets[i - 1], [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], tKnot + 0.02, tKnot + 0.1, { easing: SPRING })
    landLetters(c, a.el, () => ({ x: a.x, y: a.y, s: 0.2 }), tKnot + 0.01, Math.min(0.14, 0.006 * a.el.textContent!.length), 0.16)
  })
}

/* ───────────────────────────── «Лапой» ───────────────────────────── */

function playPaw(c: Ctx) {
  const { run } = c
  const short = c.nth > 10
  const cat = rect(c.cat)
  const card = rect(c.card)
  const hit = { x: card.left + card.width * 0.62, y: card.top + 14 }
  const pw = Math.min(84, cat.width * 0.62)

  // 1 · замах: кот приседает и подаётся к карточке
  const tA = short ? 0 : 0.0
  const tImp = short ? 0.14 : 0.3
  run(c.cat, [
    { transform: 'none' },
    { transform: 'translateY(4px) rotate(-6deg) scale(1.04,.94)', offset: 0.55 },
    { transform: 'translateY(-3px) rotate(4deg) scale(.98,1.04)', offset: 0.82 },
    { transform: 'none' },
  ], tA, tImp + 0.1, { easing: 'ease-in-out' })

  // 2 · удар лапой: лапа выныривает из-за кота, по дуге, со следом-шлейфом
  const start = { x: cat.left + cat.width * 0.62, y: cat.bottom - pw * 0.5 }
  const ctrl = { x: Math.max(start.x, hit.x) + 70, y: Math.min(start.y, hit.y) - 30 }
  const swoosh = svgEl('path', {
    d: `M${start.x},${start.y} Q${ctrl.x},${ctrl.y} ${hit.x},${hit.y}`,
    fill: 'none', stroke: '#f2f2ec', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-opacity': 0.55,
  })
  c.svg.appendChild(swoosh)
  const sl = swoosh.getTotalLength()
  swoosh.setAttribute('stroke-dasharray', `${sl} ${sl}`)
  const sA = short ? 0.02 : 0.14
  run(swoosh, [{ strokeDashoffset: sl, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: -sl * 0.6, opacity: 0 }], sA, tImp + 0.08, { easing: 'cubic-bezier(.4,0,.2,1)' })
  const q = (u: number) => ({
    x: (1 - u) ** 2 * start.x + 2 * (1 - u) * u * ctrl.x + u * u * hit.x,
    y: (1 - u) ** 2 * start.y + 2 * (1 - u) * u * ctrl.y + u * u * hit.y,
  })
  const pawKf = (lagU: number): Keyframe[] => {
    const kf: Keyframe[] = []
    for (let k = 0; k <= 10; k++) {
      const u = Math.max(0, k / 10 - lagU)
      const p = q(u)
      kf.push({ transform: `translate(${p.x - pw / 2}px, ${p.y - pw / 2}px) rotate(${-50 + 60 * u}deg) scale(${0.6 + 0.5 * u})`, opacity: k === 0 ? 0 : 1 })
    }
    return kf
  }
  const mkPaw = (op: number) => {
    const im = document.createElement('img')
    im.src = PAW
    im.alt = ''
    Object.assign(im.style, { position: 'absolute', left: '0', top: '0', width: `${pw}px`, opacity: String(op), willChange: 'transform' })
    c.layer.appendChild(im)
    return im
  }
  // шлейф — три полупрозрачные копии чуть позади (вместо размытия: фильтры на анимации дорогие на телефоне)
  ;[0.07, 0.035].forEach((lag, k) => {
    const ghost = mkPaw(0.1 + 0.08 * k)
    run(ghost, pawKf(lag), sA, tImp, { easing: 'cubic-bezier(.5,0,.75,0)' })
    run(ghost, [{ opacity: 0.2 }, { opacity: 0 }], tImp, tImp + 0.03)
  })
  const paw = mkPaw(1)
  run(paw, pawKf(0), sA, tImp, { easing: 'cubic-bezier(.5,0,.75,0)' })
  const end = q(1)
  run(paw, [
    { transform: `translate(${end.x - pw / 2}px, ${end.y - pw / 2}px) rotate(10deg) scale(1.1)` },
    { transform: `translate(${end.x - pw / 2}px, ${end.y - pw / 2 + 4}px) rotate(14deg) scale(1.16,1.0)`, offset: 0.25 },
    { transform: `translate(${start.x - pw / 2}px, ${start.y - pw / 2 + 10}px) rotate(-40deg) scale(.5)`, opacity: 0 },
  ], tImp, tImp + 0.12, { easing: 'cubic-bezier(.4,0,.6,1)' })

  // удар: карточка сплющивается, вспышка, искры, трещина через слова — сигнал «сейчас развалится»
  c.onImpact()
  run(c.card, [
    { transform: 'none' },
    { transform: 'translateY(3px) scale(1.03,.93)', offset: 0.3 },
    { transform: 'translateY(-2px) scale(.99,1.02) rotate(-1deg)', offset: 0.6 },
    { transform: 'none' },
  ], tImp, tImp + 0.1, { easing: 'ease-out' })
  const ring = document.createElement('div')
  Object.assign(ring.style, { position: 'absolute', left: `${hit.x - 40}px`, top: `${hit.y - 40}px`, width: '80px', height: '80px', borderRadius: '50%', border: '3px solid #f7c747' })
  c.layer.appendChild(ring)
  run(ring, [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.4)', opacity: 0 }], tImp, tImp + 0.12, { easing: OUT })
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.3
    const sp = document.createElement('div')
    Object.assign(sp.style, { position: 'absolute', left: `${hit.x - 1.5}px`, top: `${hit.y - 7}px`, width: '3px', height: '14px', borderRadius: '2px', background: k % 2 ? '#f7c747' : '#a0ec2a' })
    c.layer.appendChild(sp)
    const r1 = 18
    const r2 = 46 + (k % 3) * 8
    run(sp, [
      { transform: `translate(${Math.cos(a) * r1}px, ${Math.sin(a) * r1}px) rotate(${(a * 180) / Math.PI + 90}deg) scaleY(.4)`, opacity: 1 },
      { transform: `translate(${Math.cos(a) * r2}px, ${Math.sin(a) * r2}px) rotate(${(a * 180) / Math.PI + 90}deg) scaleY(1)`, opacity: 0 },
    ], tImp, tImp + 0.13, { easing: OUT })
  }
  const tb = rect(c.source)
  const crack = svgEl('polyline', {
    points: (() => {
      const n = 7
      const arr: string[] = []
      for (let k = 0; k <= n; k++) arr.push(`${hit.x + (tb.left - 6 - hit.x) * (k / n) + (k % 2 ? 4 : -4)},${hit.y + (tb.bottom + 2 - hit.y) * (k / n) + (k % 2 ? -5 : 5)}`)
      return arr.join(' ')
    })(),
    fill: 'none', stroke: '#f2f2ec', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  })
  c.svg.appendChild(crack)
  const cl = (crack as SVGPolylineElement).getTotalLength()
  crack.setAttribute('stroke-dasharray', `${cl} ${cl}`)
  run(crack, [{ strokeDashoffset: cl }, { strokeDashoffset: 0 }], tImp + 0.01, tImp + 0.07, { easing: 'ease-out' })
  run(crack, [{ opacity: 1 }, { opacity: 0 }], tImp + 0.16, tImp + 0.2)

  // отпечаток лапы остаётся на карточке — потом он станет подаренным первым штампом
  const print = document.createElement('div')
  const ps = 36
  Object.assign(print.style, {
    position: 'absolute', left: `${hit.x - ps / 2}px`, top: `${hit.y - ps / 2}px`, width: `${ps}px`, height: `${(ps * 91) / 100}px`,
    background: '#a0ec2a', WebkitMaskImage: `url(${PRINT})`, maskImage: `url(${PRINT})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
  })
  c.layer.appendChild(print)
  run(print, [{ transform: 'scale(1.9) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }], tImp, tImp + 0.06, { easing: 'cubic-bezier(.6,0,.4,1)' })

  // 3 · карточка распадается веером на столько карточек, сколько шагов, и каждая летит на своё место
  const targets: HTMLElement[] = [c.card, ...c.texts.slice(1).map((t) => t.parentElement as HTMLElement)]
  const tFanA = short ? 0.2 : 0.38
  const tFanB = short ? 0.3 : 0.5
  const tFly = short ? 0.62 : 0.8
  run(c.card, [{ opacity: 1 }, { opacity: 0 }], tFanA, tFanA + 0.001)
  run(c.source, [{ opacity: 1 }, { opacity: 0 }], tFanA, tFanA + 0.001)
  const extra = c.more ? 1 : 0
  const nCards = targets.length + extra
  const mid = (nCards - 1) / 2
  for (let i = 0; i < nCards; i++) {
    const to = i < targets.length ? rect(targets[i]) : rect(c.more)
    const k = document.createElement('div')
    Object.assign(k.style, {
      position: 'absolute', left: `${card.left}px`, top: `${card.top}px`, width: `${card.width}px`, height: `${card.height}px`,
      borderRadius: '16px', border: i === 0 ? '1px solid color-mix(in oklch, var(--primary) 40%, transparent)' : '1px solid rgba(255,255,255,.12)',
      background: 'color-mix(in oklch, var(--card) 92%, transparent)', zIndex: String(nCards - i),
    })
    // в веере каждая карточка ещё «дело»: на ней те же слова, что написал человек
    const tx = document.createElement('p')
    tx.textContent = c.source.textContent
    const scs = getComputedStyle(c.source)
    Object.assign(tx.style, { position: 'absolute', left: '16px', right: '16px', top: '14px', font: scs.font, color: scs.color, margin: '0' })
    k.appendChild(tx)
    run(tx, [{ opacity: 1 }, { opacity: 0 }], tFanB - 0.01, tFanB + 0.05)
    c.layer.insertBefore(k, c.layer.firstChild)
    const fan = `translate(${(i - mid) * 14}px, ${-Math.abs(i - mid) * 6 - 10}px) rotate(${(i - mid) * 7}deg)`
    run(k, [{ transform: 'none' }, { transform: fan }], tFanA, tFanB, { easing: SPRING })
    const t0 = tFanB + i * 0.035
    const last = i >= targets.length
    run(k, [
      { left: `${card.left}px`, top: `${card.top}px`, width: `${card.width}px`, height: `${card.height}px`, transform: fan, opacity: 1 },
      { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${Math.max(to.height, 20)}px`, transform: 'none', opacity: i === 0 ? 1 : last ? 0 : 0 },
    ], t0, Math.min(tFly + 0.06, t0 + 0.26), { easing: 'cubic-bezier(.3,1.2,.4,1)' })
    if (i === 0) run(k, [{ opacity: 1 }, { opacity: 0 }], Math.min(tFly + 0.06, t0 + 0.26), Math.min(tFly + 0.06, t0 + 0.26) + 0.001)
  }
  // настоящая карточка возвращается в тот же кадр, когда на её место прилетела верхняя карточка веера
  run(c.card, [{ opacity: 0 }, { opacity: 1 }], Math.min(tFly + 0.06, tFanB + 0.26), Math.min(tFly + 0.06, tFanB + 0.26) + 0.001)
  if (c.more) run(c.more, [{ opacity: 0 }, { opacity: 1 }], tFly, tFly + 0.1, { easing: OUT })

  // 4 · буквы дела перелетают в буквы шагов: одинаковые буквы переходят из дела в шаг, остальные рождаются из осколков
  const pool = charBoxes(c.source)
  c.texts.forEach((t, i) => {
    const used = new Set<number>()
    const t0 = tFanB + i * 0.05
    if (i > 0) run(c.bullets[i - 1], [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], t0 + 0.12, t0 + 0.2, { easing: SPRING })
    landLetters(c, t, (b) => {
      const want = b.ch.toLowerCase()
      let pick = pool.findIndex((p, k) => !used.has(k) && p.ch.toLowerCase() === want)
      if (pick < 0) pick = (Math.random() * pool.length) | 0
      used.add(pick)
      const p = pool[pick] ?? { x: card.left + card.width / 2, y: card.top + 20, w: 0, h: 0 }
      return { x: p.x + p.w / 2, y: p.y + p.h / 2, s: 1 }
    }, t0, Math.min(0.12, 0.005 * (t.textContent?.length ?? 10)), 0.2)
  })

  // 5 · отпечаток с карточки улетает в карту штампов — первый штамп подарен: дело уже разломано
  const s0 = rect(c.stamp0)
  const tS = Math.max(tFly, 0.8)
  run(print, [
    { transform: 'scale(1) rotate(-12deg)', opacity: 1 },
    { transform: `translate(${(s0.left + s0.width / 2 - hit.x) * 0.5}px, ${(s0.top + s0.height / 2 - hit.y) * 0.5 - 40}px) scale(1.3) rotate(-30deg)`, offset: 0.5 },
    { transform: `translate(${s0.left + s0.width / 2 - hit.x}px, ${s0.top + s0.height / 2 - hit.y}px) scale(.7) rotate(-12deg)`, opacity: 1 },
  ], tS - 0.12, tS + 0.08, { easing: 'cubic-bezier(.5,0,.4,1)' })
  run(print, [{ opacity: 1 }, { opacity: 0 }], tS + 0.08, tS + 0.081)
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
  const kx = w * (0.22 + rand() * 0.15)
  const ky = h * (0.3 + rand() * 0.15)
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

function playLog(c: Ctx) {
  const { run } = c
  const short = c.nth > 10
  const cat = rect(c.cat)
  const card = rect(c.card)
  const h = Math.max(56, Math.min(72, card.height + 4))
  const w = card.width
  const L = { x: card.left, y: card.top + (card.height - h) / 2 }
  const scs = getComputedStyle(c.source)

  // 1 · дело становится поленом: карточка «деревенеет», слова остаются на нём светлой резьбой
  const log = document.createElement('div')
  Object.assign(log.style, { position: 'absolute', left: `${L.x}px`, top: `${L.y}px`, width: `${w}px`, height: `${h}px`, transformOrigin: '50% 100%' })
  log.innerHTML = logSvg(w, h, 7)
  const carve = document.createElement('p')
  carve.textContent = c.source.textContent
  Object.assign(carve.style, {
    position: 'absolute', left: `${h * 0.3 + 10}px`, right: `${h * 0.6 + 6}px`, top: '50%', transform: 'translateY(-50%)', margin: '0',
    font: scs.font, color: '#ffe9cc', textShadow: '0 1px 0 rgba(0,0,0,.55), 0 -1px 0 rgba(255,210,150,.15)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  })
  log.appendChild(carve)
  c.layer.appendChild(log)
  const t0 = short ? 0 : 0.0
  const tLog = short ? 0.04 : 0.14
  const tImp = short ? 0.12 : 0.32
  run(log, [
    { opacity: 0, transform: 'scale(.92, .6)' },
    { opacity: 1, transform: 'scale(1.03, 1.08)', offset: 0.6 },
    { opacity: 1, transform: 'scale(1)' },
  ], t0, tLog, { easing: SPRING })
  run(c.card, [{ opacity: 1 }, { opacity: 0 }], tLog * 0.6, tLog * 0.6 + 0.001)
  run(c.source, [{ opacity: 1 }, { opacity: 0 }], tLog * 0.6, tLog * 0.6 + 0.001)

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

  const targets: HTMLElement[] = [c.card, ...c.texts.slice(1).map((t) => t.parentElement as HTMLElement)]
  if (c.more) targets.push(c.more)
  const N = targets.length
  // трещины: зигзаг поперёк полена на границах кусков; общий для двух соседних кусков, чтобы куски сходились без щели
  const zig: number[][] = []
  for (let k = 1; k < N; k++) {
    const x = (w * k) / N
    const pts: number[] = []
    for (let s = 0; s <= 5; s++) pts.push(x + (s % 2 ? 5 : -5) + ((k * 13 + s * 7) % 5) - 2)
    zig.push(pts)
  }
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
    piece.innerHTML = log.innerHTML
    c.layer.appendChild(piece)
    const xl = left ? left[2] : 0
    const xr = right ? right[2] : w
    const cx = (xl + xr) / 2
    piece.style.transformOrigin = `${cx}px ${h / 2}px`
    const mid = (N - 1) / 2
    const sep = `translate(${(k - mid) * 7}px, ${-10 - Math.abs(k - mid) * 3}px) rotate(${(k - mid) * 4}deg)`
    run(piece, [{ opacity: 0 }, { opacity: 1 }], tSplit, tSplit + 0.001)
    run(piece, [{ transform: 'none' }, { transform: sep }], tSplit, tFly, { easing: SPRING })
    const to = rect(targets[k])
    const tx = to.left + to.width / 2 - (L.x + cx)
    const ty = to.top + to.height / 2 - (L.y + h / 2)
    const sx = Math.min(1.6, Math.max(0.45, to.width / Math.max(30, xr - xl)))
    const sy = Math.min(1.2, Math.max(0.35, to.height / h))
    const tk = tFly + k * 0.035
    const tArr = tk + 0.2
    run(piece, [
      { transform: sep, opacity: 1 },
      { transform: `translate(${tx * 0.55}px, ${ty * 0.55 - 26}px) rotate(${(k - mid) * -8}deg) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, opacity: 1, offset: 0.55 },
      // к месту кусок долетает уже растворяясь — выжигаемые буквы шага не прячутся под деревом
      { transform: `translate(${tx * 0.88}px, ${ty * 0.88}px) rotate(0deg) scale(${sx * 0.95}, ${sy})`, opacity: 0.85, offset: 0.8 },
      { transform: `translate(${tx}px, ${ty}px) rotate(0deg) scale(${sx}, ${sy})`, opacity: 0 },
    ], tk, tArr, { easing: 'cubic-bezier(.3,0,.25,1)' })
    // 5 · на месте кусок «выжигает» шаг: буквы загораются угольком слева направо и остывают в обычный текст
    if (k === 0) run(c.card, [{ opacity: 0 }, { opacity: 1 }], tArr - 0.02, tArr + 0.04, { easing: OUT })
    if (targets[k] === c.more) {
      run(c.more!, [{ opacity: 0 }, { opacity: 1 }], tArr - 0.02, tArr + 0.06, { easing: OUT })
      continue
    }
    if (k > 0) run(c.bullets[k - 1], [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], tArr - 0.02, tArr + 0.06, { easing: SPRING })
    burnIn(c, c.texts[k], tArr - 0.02, Math.min(0.12, 0.004 * (c.texts[k].textContent?.length ?? 10)), 0.14)
  }

  // отпечаток лапы остался на месте удара — он и есть подаренный первый штамп
  const print = document.createElement('div')
  const ps = 30
  Object.assign(print.style, {
    position: 'absolute', left: `${hit.x - ps / 2}px`, top: `${L.y + h / 2 - ps / 2}px`, width: `${ps}px`, height: `${(ps * 91) / 100}px`,
    background: '#a0ec2a', WebkitMaskImage: `url(${PRINT})`, maskImage: `url(${PRINT})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
  })
  c.layer.appendChild(print)
  run(print, [{ transform: 'scale(1.8) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(-12deg)', opacity: 0.95 }], tImp, tImp + 0.05, { easing: 'cubic-bezier(.6,0,.4,1)' })
  const s0 = rect(c.stamp0)
  const tS = 0.8
  const dx = s0.left + s0.width / 2 - hit.x
  const dy = s0.top + s0.height / 2 - (L.y + h / 2)
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

/* ───────────────────────────── сцена ───────────────────────────── */

type Phase = 'pre' | 'playing' | 'done'

export function BreakReveal({
  task,
  title,
  steps,
  variant,
  nth,
  onStart,
}: {
  task: string
  title: string
  steps: RevealStep[]
  variant: RevealVariant
  /** которая это разбивка у человека (1 — первая): от неё длина сцены */
  nth: number
  onStart?: (s: RevealStep) => void
}) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('pre')
  const [cheer, setCheer] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const catRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLParagraphElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)
  const stamp0Ref = useRef<HTMLSpanElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const anims = useRef<Animation[]>([])
  const ended = useRef(false)

  const shown = steps.slice(0, 3)
  const hidden = steps.length - shown.length
  const first = steps[0]
  const stamps = Math.min(steps.length + 1, 9)

  const finish = useCallback(() => {
    if (ended.current) return
    ended.current = true
    setPhase('done')
    // праздник: кот подпрыгивает, конфетти на весь экран, двойная мягкая вибрация
    hapticReward()
    setCheer(true)
    const cr = catRef.current?.getBoundingClientRect()
    if (cr && !reduced) celebrate({ x: cr.left + cr.width / 2, y: cr.top + cr.height * 0.35 })
    const cat = catRef.current
    if (cat && !reduced) {
      const sh = cat.querySelector('.cat-shadow') as HTMLElement | null
      const jump: Keyframe[] = [
        { transform: 'translateY(0) scale(1,1)' },
        { transform: 'translateY(4px) scale(1.08,.88)', offset: 0.14 },
        { transform: 'translateY(-58px) scale(.94,1.08)', offset: 0.42 },
        { transform: 'translateY(-64px) scale(1,1)', offset: 0.52 },
        { transform: 'translateY(0) scale(1.1,.86)', offset: 0.8 },
        { transform: 'translateY(0) scale(.97,1.03)', offset: 0.9 },
        { transform: 'translateY(0) scale(1,1)' },
      ]
      cat.animate(jump, { duration: 900, easing: 'cubic-bezier(.33,0,.4,1)' })
      // тень остаётся на земле и сжимается, пока кот в воздухе
      sh?.animate(
        [
          { translate: '0 0', scale: '1' },
          { translate: '0 -4px', scale: '1.06 1', offset: 0.14 },
          { translate: '0 58px', scale: '.62', opacity: 0.6, offset: 0.42 },
          { translate: '0 64px', scale: '.58', opacity: 0.55, offset: 0.52 },
          { translate: '0 0', scale: '1.05 1', opacity: 1, offset: 0.8 },
          { translate: '0 0', scale: '1' },
        ],
        { duration: 900, easing: 'cubic-bezier(.33,0,.4,1)' },
      )
    }
    window.setTimeout(() => setCheer(false), 1500)
    // картинка «на месте»: копии убираем, ниточку (клубок) оставляем
    for (const a of anims.current) a.cancel()
    anims.current = []
    const layer = layerRef.current
    if (layer) layer.replaceChildren()
    svgRef.current?.querySelectorAll(':scope > :not([data-thread]):not(mask)').forEach((n) => n.remove())
    // нить сделала своё — плавно растворяется, чтобы не перечёркивать пузырь и шаги
    svgRef.current?.querySelectorAll<SVGGElement>('[data-thread]').forEach((n) => {
      n.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 250, fill: 'forwards', easing: 'ease-out' })
    })
  }, [reduced])

  // пропуск: тап в любом месте — сразу итог (кнопка «Начать» при этом работает как обычно)
  const skip = useCallback(() => {
    if (phase !== 'playing') return
    for (const a of anims.current) a.finish()
  }, [phase])

  useEffect(() => preloadConfetti(PRINT), [])

  useLayoutEffect(() => {
    if (reduced === null) return
    if (reduced) {
      ended.current = true
      setPhase('done')
      return
    }
    let alive = true
    void document.fonts.ready.then(() => {
      if (!alive || !layerRef.current || !svgRef.current || !catRef.current || !cardRef.current || !sourceRef.current) return
      const T = revealMs(nth)
      const list: Animation[] = []
      const at = (f: number) => f * T
      // у одного узла бывает несколько анимаций одного свойства (клубок растёт, потом катится). Позже созданная
      // анимация в стопке выше: с fill 'both' она ещё до своего старта перебила бы первую (клубок стоял бы целым
      // с первого кадра). Поэтому начало держит только первая анимация свойства, следующие — 'forwards'.
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
      const root0 = root.current!
      const texts = [...root0.querySelectorAll<HTMLElement>('[data-rv-step]')]
      const bullets = [...root0.querySelectorAll<HTMLElement>('[data-rv-bullet]')]
      const ctx: Ctx = {
        T, nth, layer: layerRef.current, svg: svgRef.current, cat: catRef.current, card: cardRef.current, source: sourceRef.current,
        texts, bullets, more: moreRef.current, stamp0: stamp0Ref.current!, anims: list, at, run,
        onImpact: () => window.setTimeout(hapticReaction, at(variant === 'yarn' ? 0.3 : variant === 'log' ? (nth > 10 ? 0.12 : 0.32) : nth > 10 ? 0.14 : 0.3)),
      }
      // всё, что появляется только в конце: подпись, карта штампов, кнопка — снизу, мягко, с пружиной
      const lateEls = [...root0.querySelectorAll<HTMLElement>('[data-rv-late]')]
      lateEls.forEach((el, i) => run(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 0.84 + i * 0.03, 0.98 + i * 0.03, { easing: OUT }))
      // штампы: первый — отпечаток лапы с прижатием, второй (первый шаг) заполняется наполовину
      if (stamp0Ref.current) run(stamp0Ref.current, [{ transform: 'scale(2) rotate(-35deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-8deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(-12deg)', opacity: 1 }], 0.9, 1, { easing: 'cubic-bezier(.6,0,.4,1)' })
      if (ringRef.current) run(ringRef.current, [{ strokeDashoffset: '62.8' }, { strokeDashoffset: '31.4' }], 0.94, 1.06, { easing: OUT })
      if (variant === 'yarn') playYarn(ctx)
      else if (variant === 'log') playLog(ctx)
      else playPaw(ctx)
      anims.current = list
      setPhase('playing')
      void Promise.all(list.map((a) => a.finished)).then(() => alive && finish(), () => {})
    })
    return () => {
      alive = false
    }
    // сцена играет один раз на монтирование (новое дело — новый ключ компонента)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  const receipt = `Разломал на ${steps.length} ${plural(steps.length, 'шаг', 'шага', 'шагов')}. ${first?.minutes ? `Первый — на ${first.minutes} ${plural(first.minutes, 'минуту', 'минуты', 'минут')}.` : 'Первый — совсем маленький.'}`
  const line = phase === 'done' ? receipt : variant === 'yarn' ? 'Распутываю твоё дело…' : variant === 'log' ? 'Сейчас расколю!' : 'Сейчас как разломаю!'
  const expression: MascotExpression = phase === 'done' ? (cheer ? 'excited' : 'happy') : variant === 'yarn' ? 'focused' : 'excited'
  const action: MascotAction = cheer ? 'celebrate' : phase === 'done' ? 'idle' : 'think'

  return (
    <div
      ref={root}
      data-rv={phase}
      onPointerDown={skip}
      className="break-reveal relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5"
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div ref={catRef} className="relative origin-bottom will-change-transform">
          <MascotDoll expression={expression} action={action} size={128} label="Напарник" interactive={false} />
        </div>
        <p className="glass max-w-80 text-balance rounded-2xl px-4 py-2 text-center text-[0.95rem] leading-relaxed" aria-live="polite">
          {line}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p data-rv-late className="truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary/90">
          первый шаг · {title}
        </p>
        <div ref={cardRef} className="glass relative rounded-2xl border border-primary/40 px-4 pb-3 pt-3.5">
          {/* дело, каким его написал человек: с него всё начинается, на экране до самого превращения */}
          <p ref={sourceRef} aria-hidden="true" className="rv-source pointer-events-none absolute inset-x-4 top-3.5 text-pretty text-[1.15rem] font-bold leading-snug">
            {task}
          </p>
          <div className="flex items-start gap-3">
            <p data-rv-step className="rv-final min-w-0 flex-1 text-pretty text-[1.15rem] font-bold leading-snug">
              {first?.text}
            </p>
            {/* первый шаг уже наполовину: кольцо закрашено на половину */}
            <svg data-rv-late viewBox="0 0 24 24" className="mt-0.5 size-7 shrink-0 -rotate-90" aria-label="первый шаг начат наполовину">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="3" />
              <circle ref={ringRef} cx="12" cy="12" r="10" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray="62.8" strokeDashoffset={phase === 'done' ? 31.4 : 62.8} />
            </svg>
          </div>
          <p data-rv-late className="mt-1 font-mono text-[10.5px] uppercase tracking-widest text-primary/80">
            {first?.wait && <span className="text-reward">пока ждёшь · </span>}
            {first?.minutes ? `≈ ${first.minutes} мин · ` : ''}полшага уже позади
          </p>
        </div>
        {shown.slice(1).map((st) => (
          <div key={st.text} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13.5px] text-muted-foreground">
            <span data-rv-bullet aria-hidden="true" className="rv-final size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span data-rv-step className="rv-final line-clamp-1">
              {st.text}
            </span>
          </div>
        ))}
        {hidden > 0 && (
          <button ref={moreRef} type="button" className="rv-final min-h-9 self-start px-3 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            ещё {hidden} — ждут в Делах
          </button>
        )}

        {/* карта штампов: подаренный прогресс (Nunes & Drèze) — первый штамп уже стоит, потому что дело разломано */}
        <div data-rv-late className="mt-1 flex flex-col gap-1.5 rounded-2xl border border-white/10 px-3 py-2.5">
          <p className="text-[12.5px] leading-tight text-muted-foreground">
            <span className="font-semibold text-foreground">1 из {steps.length + 1} уже есть</span> · дело разломано, первый шаг начат
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: stamps }, (_, i) => (
              <span key={i} className={`relative grid size-7 place-items-center rounded-full ${i === 0 ? 'bg-primary/20' : 'border border-dashed border-white/25'}`}>
                {i === 0 && <span ref={stamp0Ref} className="rv-print block size-[18px]" />}
                {i === 1 && <span className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(var(--primary) 0 50%, transparent 50%)', opacity: 0.55 }} />}
              </span>
            ))}
          </div>
        </div>

        <div data-rv-late className="mt-1">
          <Button type="button" onClick={() => first && onStart?.(first)} className="h-14 w-full text-[17px]">
            Начать первый шаг
          </Button>
        </div>
      </div>

      <div ref={layerRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden" />
      <svg ref={svgRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 size-full overflow-visible" />
    </div>
  )
}
