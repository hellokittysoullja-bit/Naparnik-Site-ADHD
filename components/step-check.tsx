'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { hapticReward } from '@/lib/haptics'

/**
 * Строка шага с отметкой. Праздник — как в Numo 12.7.5 («Check off a task and it now lifts, crosses out and sends a
 * burst of emoji up over your list»; research/25-deep-teardowns/numo.md): строка приподнимается, зачёркивается,
 * вверх летит веер. Вместо эмодзи — искры-четырёхлучки цветов продукта; очков «+10» нет (кармы у нас нет и не будет).
 * Срабатывает только на «сделал», снятие отметки — тихо. Хаптика — на событие мира (CLAUDE.md §4).
 */
const SPARKS = [
  { dx: -34, dy: -46, s: 1, r: 80, d: 0, c: 'var(--reward)' },
  { dx: -12, dy: -62, s: 0.8, r: -60, d: 30, c: 'var(--primary)' },
  { dx: 14, dy: -70, s: 1.15, r: 120, d: 10, c: 'var(--reward)' },
  { dx: 40, dy: -54, s: 0.75, r: -90, d: 50, c: 'oklch(0.85 0.13 330)' },
  { dx: 62, dy: -34, s: 0.95, r: 60, d: 20, c: 'var(--primary)' },
  { dx: 30, dy: -24, s: 0.6, r: -40, d: 70, c: 'oklch(0.85 0.12 205)' },
  { dx: -22, dy: -22, s: 0.65, r: 100, d: 60, c: 'oklch(0.85 0.12 205)' },
]

export function StepCheck({
  text,
  done,
  minutes,
  wait,
  onToggle,
}: {
  text: string
  done: boolean
  minutes?: number
  wait?: boolean
  onToggle: () => boolean | void
}) {
  const [burst, setBurst] = useState(0)
  return (
    <div className="relative">
    {/* key: каждое «сделал» запускает праздник заново (анимация привязана к появлению узла) */}
    <div key={burst} className="step-row relative flex items-center gap-2.5" data-done={done ? '' : undefined} data-burst={burst ? '' : undefined}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Снять отметку: ${text}` : `Сделано: ${text}`}
        onClick={() => {
          const now = onToggle()
          if (now ?? !done) {
            hapticReward()
            setBurst((n) => n + 1)
          }
        }}
        className="press -m-1.5 grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={`step-check grid size-6 place-items-center rounded-full border-2 transition-colors duration-150 ${
            done ? 'border-reward bg-reward text-reward-foreground' : 'border-white/30'
          }`}
        >
          {done && <Check className="size-3.5" strokeWidth={3.2} aria-hidden="true" />}
        </span>
      </button>
      <span className={`min-w-0 flex-1 text-[14.5px] leading-snug transition-colors duration-200 ${done ? 'text-muted-foreground' : ''}`}>
        <span className="step-strike">{text}</span>
        {wait && !done && <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-reward/90">пока ждёшь</span>}
      </span>
      {minutes ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{minutes} мин</span> : null}
      {burst > 0 && (
        <span className="sparks" aria-hidden="true">
          {SPARKS.map((p, i) => (
            <i
              key={i}
              className="spark"
              style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--s' as string]: p.s, ['--r' as string]: `${p.r}deg`, ['--d' as string]: `${p.d}ms`, ['--c' as string]: p.c }}
            />
          ))}
        </span>
      )}
    </div>
    </div>
  )
}
