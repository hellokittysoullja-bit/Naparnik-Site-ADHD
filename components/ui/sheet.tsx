'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'

/**
 * Нижний лист. Появление снизу за 0,32 с (кривая как у остальных въездов), уход быстрее (0,2 с): вход ведёт взгляд,
 * уход не задерживает (research/01 §3.3). Фон затемняется без размытия: размытие большой площади на слабых телефонах
 * пересчитывается каждый кадр (CLAUDE.md §5.5, «Плавность»). Закрытие — крестик, тап мимо, Esc. Фокус уходит в лист и
 * возвращается на кнопку, которая его открыла. Рисуется в <body> (портал): экраны /app лежат в своём слое (z-10), и
 * лист внутри них оказывался под нижним меню (z-50).
 */
export function Sheet({
  open,
  onClose,
  title,
  caption,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  caption?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      opener?.focus?.()
    }
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Закрыть"
            tabIndex={-1}
            onClick={onClose}
            className="absolute inset-0 bg-[oklch(0.1_0.01_130/0.72)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className="sheet-panel relative flex max-h-[86dvh] w-full max-w-md flex-col rounded-t-[26px] outline-none"
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.05, 0.7, 0.1, 1] }}
          >
            <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />
            <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-3">
              <div>
                <h2 className="text-[20px] font-bold leading-tight tracking-[-0.01em]">{title}</h2>
                {caption && <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{caption}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="press -mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,var(--sab))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
