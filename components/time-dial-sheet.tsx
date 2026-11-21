'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { hapticThreshold } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/reduced-motion'

/**
 * Сколько дать первому шагу (владелец 21.11, образец — круг таймера Tiimo). Любое время от 1 до 60 минут: тянешь конец
 * дуги по кругу, число в середине. Под кругом — частые значения в одно касание. Круг живёт в листе, а не на экране
 * разбивки: на низком телефоне ему там нет места, а шаги прятать нельзя.
 *
 * Пока тянешь, от конца дуги плавно разлетаются наши мотивы — звёздочки записки, месяцы сцены, точки. Это ответ на
 * действие руки (контингентность, CLAUDE.md §3), а не украшение по таймеру. Двигает их видеокарта: каждая частица —
 * отдельный узел с анимацией transform/opacity (WAAPI), главный поток только создаёт её. При «уменьшить движение» их нет.
 */
const QUICK = [1, 5, 15, 25, 45]
const SIZE = 260
const C = SIZE / 2
const R = 104
const W = 22
const LIME = 'var(--primary)'

const pt = (deg: number): [number, number] => {
  const r = ((deg - 90) * Math.PI) / 180
  return [C + R * Math.cos(r), C + R * Math.sin(r)]
}
const toMin = (deg: number) => Math.max(1, Math.min(60, Math.round(deg / 6)))

export function minutesWord(n: number) {
  const a = n % 10
  const b = n % 100
  if (a === 1 && b !== 11) return 'минута'
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'минуты'
  return 'минут'
}

function arcPath(deg: number) {
  const a = Math.max(0.5, Math.min(359.9, deg))
  const [x0, y0] = pt(0)
  const [x, y] = pt(a)
  return { d: `M${x0} ${y0} A${R} ${R} 0 ${a > 180 ? 1 : 0} 1 ${x} ${y}`, x, y, a }
}

export function TimeDialSheet({ open, minutes, onClose, onPick }: { open: boolean; minutes: number; onClose: () => void; onPick: (m: number) => void }) {
  const reduce = useReducedMotion()
  const [value, setValue] = useState(minutes)
  const deg = useRef(minutes * 6)
  const arc = useRef<SVGPathElement>(null)
  const tip = useRef<SVGGElement>(null)
  const fx = useRef<SVGSVGElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastSpawn = useRef(0)
  const tween = useRef(0)

  useEffect(() => {
    if (!open) return
    deg.current = Math.min(360, Math.max(6, minutes * 6))
    setValue(minutes)
    // кадр после монтирования листа: узлы уже есть
    requestAnimationFrame(() => paint(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- состояние берётся при открытии
  }, [open])

  function paint(fromUser: boolean) {
    const { d, x, y, a } = arcPath(deg.current)
    arc.current?.setAttribute('d', d)
    tip.current?.setAttribute('transform', `translate(${x} ${y}) rotate(${a})`)
    const m = toMin(deg.current)
    setValue((v) => {
      if (v !== m && fromUser) hapticThreshold()
      return m
    })
  }

  function spawn(n: number, spread: number) {
    const host = fx.current
    if (!host || reduce) return
    const ns = 'http://www.w3.org/2000/svg'
    for (let i = 0; i < n; i++) {
      if (host.childElementCount > 40) host.firstElementChild?.remove()
      const a = deg.current + (Math.random() - 0.5) * spread
      const [sx, sy] = pt(a)
      const r = ((a - 90) * Math.PI) / 180
      const dist = 28 + Math.random() * (spread > 20 ? 70 : 50)
      const k = Math.random()
      const lime = Math.random() < 0.3
      const fill = lime ? LIME : 'rgba(245,233,214,0.85)'
      const g = document.createElementNS(ns, 'g')
      const el = document.createElementNS(ns, 'path')
      const s = k < 0.45 ? 2.5 + Math.random() * 2.5 : 6 + Math.random() * 4
      // точка, четырёхлучевая звёздочка (как на записке) или месяц (как луна сцены)
      el.setAttribute(
        'd',
        k < 0.45
          ? `M${-s} 0a${s} ${s} 0 1 0 ${2 * s} 0a${s} ${s} 0 1 0 ${-2 * s} 0`
          : k < 0.75
            ? `M0 ${-s}C${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s} 0C${s * 0.18} ${s * 0.18} ${s * 0.18} ${s * 0.18} 0 ${s}C${-s * 0.18} ${s * 0.18} ${-s * 0.18} ${s * 0.18} ${-s} 0C${-s * 0.18} ${-s * 0.18} ${-s * 0.18} ${-s * 0.18} 0 ${-s}Z`
            : `M${s * 0.2} ${-s}A${s} ${s} 0 1 0 ${s * 0.2} ${s}A${s * 0.75} ${s * 0.75} 0 1 1 ${s * 0.2} ${-s}Z`,
      )
      el.setAttribute('fill', fill)
      g.appendChild(el)
      g.style.transformBox = 'view-box'
      host.appendChild(g)
      const rot0 = Math.random() * 360
      const spin = (Math.random() - 0.5) * 220
      const dx = Math.cos(r) * dist
      const dy = Math.sin(r) * dist
      const life = 900 + Math.random() * 600
      const anim = g.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) rotate(${rot0}deg) scale(0.4)`, opacity: 0 },
          { transform: `translate(${sx + dx * 0.3}px, ${sy + dy * 0.3}px) rotate(${rot0 + spin * 0.3}deg) scale(1)`, opacity: 0.95, offset: 0.18 },
          { transform: `translate(${sx + dx}px, ${sy + dy}px) rotate(${rot0 + spin}deg) scale(0.8)`, opacity: 0 },
        ],
        { duration: life, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' },
      )
      anim.onfinish = () => g.remove()
    }
  }

  // угол от центра круга; через «12 часов» не перескакивает — упирается в 1 и в 60 минут
  function setFromPoint(x: number, y: number) {
    const b = wrap.current?.getBoundingClientRect()
    if (!b) return
    let a = (Math.atan2(y - (b.top + C), x - (b.left + C)) * 180) / Math.PI + 90
    if (a < 0) a += 360
    if (Math.abs(a - deg.current) > 180) a = deg.current > 180 ? 360 : 6
    deg.current = Math.max(6, Math.min(360, a))
    cancelAnimationFrame(tween.current)
    paint(true)
    const now = performance.now()
    if (now - lastSpawn.current > 45) {
      spawn(1, 16)
      lastSpawn.current = now
    }
  }

  // быстрые значения: дуга плавно доезжает, с маленьким всплеском
  function tweenTo(m: number) {
    cancelAnimationFrame(tween.current)
    const from = deg.current
    const to = m * 6
    const t0 = performance.now()
    const d = reduce ? 1 : 420
    spawn(12, 60)
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / d)
      deg.current = from + (to - from) * (1 - Math.pow(1 - k, 3))
      paint(false)
      if (k < 1) tween.current = requestAnimationFrame(step)
    }
    if (m !== value) hapticThreshold()
    tween.current = requestAnimationFrame(step)
  }

  const init = arcPath(Math.min(360, Math.max(6, minutes * 6)))
  return (
    <Sheet open={open} onClose={onClose} title="Сколько на первый шаг?">
      <div className="flex flex-col items-center gap-3 pt-1">
        <div
          ref={wrap}
          role="slider"
          tabIndex={0}
          aria-label="Время на первый шаг"
          aria-valuemin={1}
          aria-valuemax={60}
          aria-valuenow={value}
          aria-valuetext={`${value} ${minutesWord(value)}`}
          onKeyDown={(e) => {
            const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
            if (!delta) return
            e.preventDefault()
            deg.current = Math.max(6, Math.min(360, (toMin(deg.current) + delta) * 6))
            paint(true)
          }}
          onPointerDown={(e) => {
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
            setFromPoint(e.clientX, e.clientY)
          }}
          onPointerMove={(e) => dragging.current && setFromPoint(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          className="relative touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg ref={fx} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} />
          <svg aria-hidden="true" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={W} />
            <path ref={arc} d={init.d} fill="none" stroke={LIME} strokeWidth={W} strokeLinecap="round" />
            <g ref={tip} transform={`translate(${init.x} ${init.y}) rotate(${init.a})`}>
              <path d="M-4 -0.5 L3.5 -0.5 M0 -4 L3.5 -0.5 L0 3" fill="none" stroke="rgba(20,26,12,0.6)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center font-extrabold leading-none text-foreground">
            <span className="text-[62px] tabular-nums tracking-[-0.02em]">{value}</span>
            <span className="mt-2 text-[20px] text-foreground/70">{minutesWord(value)}</span>
          </div>
        </div>
        <div className="flex w-full gap-1.5">
          {QUICK.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => tweenTo(m)}
              aria-pressed={value === m}
              className={`press h-10 flex-1 rounded-full border text-[15px] font-extrabold transition-colors ${
                value === m ? 'border-transparent bg-primary text-primary-foreground' : 'border-white/12 bg-white/7 text-foreground'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <Button size="lg" onClick={() => onPick(value)} className="h-14 w-full text-[17px]">
          Готово
        </Button>
      </div>
    </Sheet>
  )
}
