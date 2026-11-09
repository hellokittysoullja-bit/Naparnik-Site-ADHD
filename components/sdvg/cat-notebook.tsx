'use client'

import type { CSSProperties } from 'react'
import copy from '@/content/sdvg-copy.ru.json'

/**
 * Блокнот Напарника в тесте /sdvg-test (ТЗ research/15-product-science/traffic-attachment.md, п. 1).
 *
 * - `asrs`: на ЛЮБОЙ ответ ВОЗ — одна и та же неразборчивая черта (≤300 мс, не блокирует). Длина, форма, цвет и мимика
 *   кота не зависят от ответа: иначе кот подсказывал бы, какой ответ «хороший», и сдвигал бы ответы (Schuetzler 2,6 vs 4,2).
 * - `tear`: страница ВОЗ «вырывается» и уходит — её кот отдаёт, а не хранит (ответы ВОЗ живут только во фрагменте адреса).
 * - `notes`: новая страница, слова человека из 4 вопросов Напарника разборчиво (самоотнесение, Symons & Johnson d=0,50).
 * Анимации — только ответ на событие (CLAUDE.md §3 «контингентность»), при prefers-reduced-motion их нет (globals.css).
 */

const SQUIGGLE = 'M2 9 C 7 2, 11 15, 16 8 S 25 3, 29 9 S 37 14, 42 7'

function Squiggle({ fresh }: { fresh: boolean }) {
  return (
    <svg
      viewBox="0 0 44 16"
      className={`h-4 w-11 text-muted-foreground ${fresh ? 'scribble-draw' : ''}`}
      style={fresh ? ({ '--scribble-delay': '0s' } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <path
        d={SQUIGGLE}
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        style={fresh ? { animationDuration: '280ms' } : undefined}
      />
    </svg>
  )
}

export function CatNotebook({
  mode,
  scribbles = 0,
  notes = [],
}: {
  mode: 'asrs' | 'tear' | 'notes'
  scribbles?: number
  notes?: string[]
}) {
  if (mode === 'notes') {
    return (
      <div className="mt-4 rounded-xl border border-border bg-card px-3 py-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{copy.cat.notesPage}</p>
        {notes.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-x-3 font-hand text-[18px] leading-snug" aria-label={copy.notebook.title}>
            {notes.map((n, i) => (
              <li key={`${i}-${n}`}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  return (
    <div
      className={`mt-4 rounded-xl border border-border bg-card px-3 py-2 ${mode === 'tear' ? 'notebook-tear' : ''}`}
      role="img"
      aria-label={copy.cat.asrsPage}
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{copy.cat.asrsPage}</p>
      <div className="mt-1 flex h-5 items-center gap-1.5">
        {Array.from({ length: scribbles }, (_, i) => (
          <Squiggle key={i} fresh={mode === 'asrs' && i === scribbles - 1} />
        ))}
      </div>
    </div>
  )
}
