'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { hapticStart, hapticThreshold } from '@/lib/haptics'

const HOLD_MS = 900

/**
 * «Удерживай, чтобы начать»: ритуал обязательства вместо случайного тапа.
 * Лицо кнопки заливается слева направо, пока палец держит; отпустил раньше —
 * заливка мягко стекает назад, и появляется подсказка (без упрёка).
 * Клавиатура и ассистивные технологии (click с detail === 0) стартуют сразу:
 * удержание — ритуал для пальца, а не барьер доступности.
 */
export function HoldToStart({ onComplete, busy }: { onComplete: () => void; busy?: boolean }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [hint, setHint] = useState(false)
  const [done, setDone] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)
  const progressRef = useRef(0)

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  function finish() {
    if (done) return
    setDone(true)
    setProgress(1)
    hapticStart()
    onComplete()
  }

  function tick() {
    const p = Math.min(1, (performance.now() - startRef.current) / HOLD_MS)
    progressRef.current = p
    setProgress(p)
    if (p >= 1) {
      rafRef.current = null
      setHolding(false)
      finish()
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function press() {
    if (done || busy) return
    setHint(false)
    setHolding(true)
    hapticThreshold()
    // Продолжаем с текущей заливки, если палец вернулся, пока она стекала
    startRef.current = performance.now() - progressRef.current * HOLD_MS
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  function release() {
    if (!holding || done) return
    setHolding(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (progressRef.current < 1) {
      setHint(true)
      // Стекание назад — та же скорость, что заливка, только быстрее
      const from = progressRef.current
      const t0 = performance.now()
      const drain = () => {
        const p = Math.max(0, from - (performance.now() - t0) / 350)
        progressRef.current = p
        setProgress(p)
        if (p > 0) rafRef.current = requestAnimationFrame(drain)
        else rafRef.current = null
      }
      rafRef.current = requestAnimationFrame(drain)
    }
  }

  const label = done || busy
    ? 'Поехали'
    : holding
      ? 'Ещё чуть-чуть…'
      : 'Удерживай, чтобы начать'

  return (
    <div className="flex flex-col items-center gap-2">
      <p
        aria-live="polite"
        className={`h-5 text-sm text-muted-foreground transition-opacity duration-200 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        Держи палец, пока полоса не заполнится
      </p>
      <button
        type="button"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          press()
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault()
            finish()
          }
        }}
        onClick={(e) => {
          // detail === 0 — клик без указателя (VoiceOver, Switch Control)
          if (e.detail === 0) finish()
        }}
        data-holding={holding ? '' : undefined}
        aria-label="Начать первую сессию"
        className="btn-chunky btn-hold block w-full touch-none select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="btn-face relative flex h-[52px] items-center justify-center gap-2 overflow-hidden rounded-[16px] bg-primary px-6 text-[15px] font-bold uppercase tracking-[0.06em] text-primary-foreground">
          {/* Заливка удержания: светлый слой поверх лица, scaleX — без reflow */}
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-white/35"
            style={{ transform: `scaleX(${progress})` }}
          />
          <span className="relative flex items-center gap-2">
            {(done || busy) && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {label}
          </span>
        </span>
      </button>
    </div>
  )
}
