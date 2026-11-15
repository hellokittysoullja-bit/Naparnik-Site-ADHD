'use client'

import { useEffect, useRef, useState } from 'react'
import { Music2 } from 'lucide-react'
import { AMBIENT_KINDS, type AmbientKind } from '@/lib/ambient'

/**
 * Плашка звука в углу экрана фокуса — как «♪ Lo-fi beats ▮▮▮» у Tiimo (research/25-deep-teardowns/img/tiimo-appstore-6.jpg):
 * слева вверху, название того, что играет, и столбики-эквалайзер. Тап открывает выбор: костёр, дождь, ровный шум,
 * тишина. Столбики движутся только когда звук идёт (диегетичность, CLAUDE.md §3).
 */
export type SoundChoice = AmbientKind | 'off'

export function SoundChip({ value, onChange }: { value: SoundChoice; onChange: (v: SoundChoice) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const label = value === 'off' ? 'Тишина' : AMBIENT_KINDS.find((k) => k.key === value)!.label
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Звук: ${label}`}
        onClick={() => setOpen((v) => !v)}
        className={`press flex h-11 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          value === 'off' ? 'border-white/10 text-muted-foreground' : 'border-primary/35 bg-primary/10 text-primary'
        }`}
      >
        <Music2 className="size-4" aria-hidden="true" />
        {label}
        <span className="eq" data-on={value === 'off' ? undefined : ''} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      {open && (
        <div role="menu" className="sheet-panel absolute left-0 top-12 z-20 flex w-44 flex-col rounded-2xl border border-white/10 p-1.5">
          {[...AMBIENT_KINDS, { key: 'off' as const, label: 'Тишина' }].map((k) => (
            <button
              key={k.key}
              type="button"
              role="menuitemradio"
              aria-checked={value === k.key}
              onClick={() => {
                onChange(k.key)
                setOpen(false)
              }}
              className={`press flex h-11 items-center justify-between rounded-xl px-3 text-left text-[14.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                value === k.key ? 'bg-primary/12 text-primary' : 'text-foreground/90'
              }`}
            >
              {k.label}
              {value === k.key && <span aria-hidden="true" className="size-2 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
