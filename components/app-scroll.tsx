'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { asset } from '@/lib/asset-versions'
import { hapticThreshold } from '@/lib/haptics'

/**
 * Слой прокрутки экранов /app и «потяни вниз — обнови» с котом.
 *
 * Почему свой слой. На iPhone Safari «оттягивает» всю страницу, как резинку: потянул вверх — снизу голый фон и пустота
 * (скриншот владельца 15.11, Дом), потянул вниз — системный серый значок обновления. CSS-запрет (overscroll-behavior)
 * Safari выполняет ненадёжно: в WebKit открыт баг 275947 «overscroll-behavior: none doesn't disable pull to refresh».
 * Надёжно — когда сам документ не прокручивается вовсе (html и body высотой в экран, без прокрутки), а прокручивается
 * этот слой: оттягивать и обновлять Safari нечего. Жест «обновить» ловим сами и показываем кота вместо значка.
 *
 * Кот — постер эталона (не вторая модель кота, CLAUDE.md §10), в тёмном кружке, чтобы читался на любой сцене. Тянешь —
 * выезжает сверху и выпрямляется; дотянул до порога — подпрыгивает и даёт лёгкую вибрацию; отпустил — прыгает, пока
 * страница перезагружается. Не тянется: из середины ленты (только с самого верха), из поля ввода, в переписке (там
 * свой жест, components/pull-to-stretch.tsx) и при вертикально прокрученном вложенном блоке.
 */
const THRESHOLD = 72
const MAX = 120
const RESIST = 0.5

function scrolledAncestor(el: Element | null, stop: Element): boolean {
  for (let n = el; n && n !== stop; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true
  }
  return false
}

export function AppScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const offRef = useRef(false)
  const refreshingRef = useRef(false)

  // переход на другой экран — новый экран с самого верха (слой прокрутки общий на все экраны /app);
  // в переписке свой жест (pull-to-stretch), наш там выключен
  useEffect(() => {
    offRef.current = pathname.startsWith('/app/chat')
    ref.current?.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startY: number | null = null
    let startX = 0
    let decided = false
    let crossed = false
    let current = 0

    const reset = () => {
      startY = null
      decided = false
      crossed = false
      current = 0
    }
    const onStart = (e: TouchEvent) => {
      reset()
      if (offRef.current || refreshingRef.current || e.touches.length !== 1 || el.scrollTop > 0) return
      const t = e.target as Element
      if (t.closest('input, textarea, select, [contenteditable], [role="dialog"], [data-no-pull]')) return
      if (scrolledAncestor(t, el)) return
      if (document.body.dataset.focusImmersive) return
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      const dx = e.touches[0].clientX - startX
      if (!decided) {
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return
        decided = true
        // вбок или вверх — это не наш жест
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          startY = null
          return
        }
      }
      if (el.scrollTop > 0) return
      // резину и системное обновление не даём включить, пока тянем кота
      if (e.cancelable) e.preventDefault()
      current = Math.min(MAX, Math.max(0, dy * RESIST))
      if (!crossed && current >= THRESHOLD) {
        crossed = true
        hapticThreshold()
      } else if (crossed && current < THRESHOLD) crossed = false
      setPull(current)
    }
    const onEnd = () => {
      if (startY === null) return
      const go = current >= THRESHOLD
      reset()
      if (go) {
        refreshingRef.current = true
        setRefreshing(true)
        setPull(THRESHOLD)
        // кот успевает прыгнуть: перезагрузка сразу была бы мельканием
        window.setTimeout(() => window.location.reload(), 520)
      } else setPull(0)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // клавиатура iPhone сдвигает видимую часть документа; после неё возвращаем на место — документ не прокручивается
  useEffect(() => {
    const back = () =>
      window.setTimeout(() => {
        const a = document.activeElement
        if (!(a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0)
      }, 60)
    document.addEventListener('focusout', back)
    return () => document.removeEventListener('focusout', back)
  }, [])

  const p = Math.min(1, pull / THRESHOLD)
  const ready = pull >= THRESHOLD
  return (
    <div ref={ref} className="app-scroll" data-app-scroll="">
      {(pull > 0 || refreshing) && (
        <div
          className="ptr-cat"
          data-ready={ready ? '' : undefined}
          data-refreshing={refreshing ? '' : undefined}
          role={refreshing ? 'status' : undefined}
          aria-label={refreshing ? 'Обновляю' : undefined}
          style={{
            transform: `translate(-50%, ${pull - 64}px) rotate(${(1 - p) * -28}deg) scale(${0.62 + 0.38 * p})`,
            opacity: Math.min(1, p * 1.4),
            transition: startTransition(pull, refreshing),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset('/mascot/poster/neutral.webp')} alt="" width={52} height={52} className="ptr-cat-img" draggable={false} />
        </div>
      )}
      {children}
    </div>
  )
}

/** пока палец ведёт — без задержки; отпустил — кот плавно уходит или встаёт на место */
function startTransition(pull: number, refreshing: boolean) {
  return refreshing || pull === 0 ? 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease' : 'none'
}
