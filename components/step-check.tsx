'use client'

import { useMemo, useState } from 'react'
import { hapticReward } from '@/lib/haptics'

/**
 * Строка шага с отметкой. Праздник — как в Numo 12.7.5 («Check off a task and it now lifts, crosses out and sends a
 * burst of emoji up over your list»; research/25-deep-teardowns/numo.md): строка приподнимается, зачёркивается,
 * вверх летит веер. Вместо эмодзи — искры цветов продукта (четырёхлучки, точки, колечки; веер каждый раз новый), от кружка
 * расходится кольцо, галочка рисуется штрихом, черта — от руки одним из четырёх почерков (владелец 18.11); очков «+10» нет (кармы у нас нет и не будет).
 * Срабатывает только на «сделал», снятие отметки — тихо. Хаптика — на событие мира (CLAUDE.md §4).
 */
const COLORS = ['var(--reward)', 'var(--primary)', 'oklch(0.85 0.13 330)', 'oklch(0.85 0.12 205)', 'oklch(0.88 0.12 60)']
const KINDS = ['star', 'star', 'dot', 'ring'] as const

/** Почерк черты — по тексту шага: у каждого шага свой, и после перезагрузки тот же (globals.css, data-strike 0–3) */
export function strikeVariant(text: string) {
  // FNV-1a; берём старшие биты — младшие у русских текстов почти одинаковые, и выпадал один почерк
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193)
  return (h >>> 24) % 4
}

/** Веер на каждое «сделал» — новый: 9 частиц трёх видов, направление и размер случайные (раньше — одни и те же семь) */
function makeSparks() {
  return Array.from({ length: 9 }, (_, i) => {
    const a = (-160 + (140 / 8) * i + (Math.random() - 0.5) * 14) * (Math.PI / 180)
    const r = 34 + Math.random() * 38
    return {
      dx: Math.round(Math.cos(a) * r + 18),
      dy: Math.round(Math.sin(a) * r),
      s: 0.6 + Math.random() * 0.6,
      r: Math.round((Math.random() - 0.5) * 260),
      d: Math.round(Math.random() * 90),
      c: COLORS[(i + Math.floor(Math.random() * 5)) % 5],
      k: KINDS[Math.floor(Math.random() * KINDS.length)],
    }
  })
}

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
  const variant = strikeVariant(text)
  const sparks = useMemo(() => (burst ? makeSparks() : []), [burst])
  return (
    <div className="relative">
    {/* key: каждое «сделал» запускает праздник заново (анимация привязана к появлению узла) */}
    <div key={burst} className="step-row relative flex items-center gap-2.5" data-done={done ? '' : undefined} data-burst={burst ? '' : undefined} data-strike={variant}>
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
          {done && (
            <svg viewBox="0 0 24 24" className="step-tick size-3.5" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
      <span className={`relative min-w-0 flex-1 text-[14.5px] leading-snug transition-colors duration-200 ${done ? 'text-muted-foreground' : ''}`}>
        {text}
        {wait && !done && <span className="ml-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-reward/90">пока ждёшь</span>}
        {/* черта — на прозрачной копии текста поверх него (globals.css, .step-ink) */}
        {done && (
          <span className="step-ink" aria-hidden="true">
            <span>{text}</span>
          </span>
        )}
      </span>
      {minutes ? <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">{minutes} мин</span> : null}
      {burst > 0 && <span className="step-ring" aria-hidden="true" />}
      {burst > 0 && (
        <span className="sparks" aria-hidden="true">
          {sparks.map((p, i) => (
            <i
              key={i}
              className="spark"
              data-k={p.k}
              style={{ ['--dx' as string]: `${p.dx}px`, ['--dy' as string]: `${p.dy}px`, ['--s' as string]: p.s, ['--r' as string]: `${p.r}deg`, ['--d' as string]: `${p.d}ms`, ['--c' as string]: p.c }}
            />
          ))}
        </span>
      )}
    </div>
    </div>
  )
}
