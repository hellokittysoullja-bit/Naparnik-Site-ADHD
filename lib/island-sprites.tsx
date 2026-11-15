/**
 * Общая графика острова: спрайты ориентиров и находок + позиционирование.
 *
 * Раньше эти узлы жили внутри components/island.tsx. Вынесены сюда, чтобы
 * их мог переиспользовать экран финала сессии (components/reveal-island.tsx):
 * награда рождается прорастанием на том же острове, к которому привязан
 * человек, — а не как отдельная карточка. Один источник правды для рисунков,
 * ноль расхождений между страницей «Мир» и моментом награды.
 */

import type { CSSProperties, ReactNode } from 'react'
import { poolElementByKey } from '@/lib/island-elements'
import type { IslandFindEntry } from '@/lib/memory'

/** Палитра острова (те же токены, что на странице «Мир») */
export const ISLAND_COLORS = {
  ground: 'var(--color-secondary)',
  groundDark: 'var(--color-accent)',
  green: 'var(--color-primary)',
  soft: 'var(--color-muted-foreground)',
  warm: 'oklch(0.75 0.15 65)',
} as const

const c = ISLAND_COLORS

/**
 * Мерцание и покачивание — CSS-анимации (.sv-pulse, .sv-sway в globals.css), а не SMIL <animate>: SMIL браузер
 * считает в главном потоке и на каждом шаге перерисовывает весь SVG вместе со стилями (Мир в покое, CPU ×6: 2,5 с
 * работы из 5 с). Значения и ритм те же, что были у SMIL: «a;b;a» за dur, линейно (15.11).
 */
const pulse = (lo: number, hi: number, dur: string): CSSProperties => ({ '--lo': lo, '--hi': hi, '--d': dur }) as CSSProperties
const sway = (deg: number, x: number, y: number, dur: string): CSSProperties =>
  ({ '--a': `${deg}deg`, '--d': dur, transformOrigin: `${x}px ${y}px` }) as CSSProperties

// ---------- Ориентиры (старты 1–10) ----------

/** Ключи ориентиров по порядку — стабильные React-key */
export const landmarkKeys = [
  'sprout', 'tree', 'campfire', 'house', 'garden',
  'lantern', 'tree2', 'flag', 'dock', 'moon',
] as const

/**
 * Сырые узлы ориентиров (всегда «раскрытые»). Обёртку призрачности
 * (opacity/saturate для ещё не открытых) накладывает страница «Мир».
 */
export const landmarkNodes: ReactNode[] = [
  // 0 — Первый росток
  <>
    <path d="M196 150 q0 -14 0 -20" stroke={c.green} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M196 136 q-8 -4 -10 -12 q10 0 10 12" fill={c.green} />
    <path d="M196 140 q8 -4 10 -12 q-10 0 -10 12" fill={c.green} />
  </>,
  // 1 — Дерево (лёгкое покачивание кроны от корня — тот же принцип
  // «дыхания», что уже у костра и фонаря, просто через поворот, не opacity)
  <g className="sv-sway" style={sway(1.2, 121, 146, '5s')}>
    <rect x="118" y="118" width="6" height="28" rx="3" fill={c.groundDark} />
    <circle cx="121" cy="108" r="20" fill={c.green} opacity="0.9" />
    <circle cx="108" cy="118" r="12" fill={c.green} opacity="0.75" />
    <circle cx="134" cy="116" r="13" fill={c.green} opacity="0.8" />
  </g>,
  // 2 — Костёр
  <>
    <line x1="238" y1="148" x2="252" y2="140" stroke={c.groundDark} strokeWidth="4" strokeLinecap="round" />
    <line x1="252" y1="148" x2="238" y2="140" stroke={c.groundDark} strokeWidth="4" strokeLinecap="round" />
    {/* ореол: радиус 15 → 19 → 15 — тот же круг r=18 масштабом от центра (без анимации — прежние 18) */}
    <circle
      cx="245"
      cy="134"
      r="18"
      fill={c.warm}
      opacity="0.12"
      className="sv-glow"
      style={{ ...pulse(0.07, 0.18, '2.4s'), '--s0': 15 / 18, '--s1': 19 / 18, transformOrigin: '245px 134px' } as CSSProperties}
    />
    <path d="M245 138 q-6 -8 0 -16 q2 6 5 8 q3 -4 2 -8 q7 8 -1 16 q-3 2 -6 0z" fill={c.warm} className="sv-pulse" style={pulse(1, 0.75, '1.6s')} />
  </>,
  // 3 — Домик
  <>
    <rect x="152" y="96" width="34" height="26" rx="3" fill={c.groundDark} />
    <path d="M148 98 L169 80 L190 98 Z" fill={c.green} opacity="0.85" />
    <rect x="164" y="106" width="10" height="16" rx="2" fill={c.warm} opacity="0.9" />
  </>,
  // 4 — Грядки
  <>
    <ellipse cx="92" cy="152" rx="16" ry="5" fill={c.groundDark} />
    <path d="M84 150 v-7 M92 150 v-9 M100 150 v-7" stroke={c.green} strokeWidth="2.5" strokeLinecap="round" />
  </>,
  // 5 — Фонарь
  <>
    <line x1="212" y1="152" x2="212" y2="118" stroke={c.soft} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="212" cy="112" r="6" fill={c.warm} />
    <circle cx="212" cy="112" r="11" fill={c.warm} opacity="0.25" className="sv-pulse" style={pulse(0.15, 0.35, '3.6s')} />
  </>,
  // 6 — Второе дерево (свой ритм и амплитуда — не зеркало первого,
  // деревья на настоящем ветру не качаются синхронно)
  <g className="sv-sway" style={sway(-1, 274.5, 136, '4.2s')}>
    <rect x="272" y="112" width="5" height="24" rx="2.5" fill={c.groundDark} />
    <circle cx="274" cy="102" r="15" fill={c.green} opacity="0.8" />
    <circle cx="284" cy="110" r="9" fill={c.green} opacity="0.65" />
  </g>,
  // 7 — Флаг
  <>
    <line x1="68" y1="132" x2="68" y2="100" stroke={c.soft} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M68 100 L88 106 L68 112 Z" fill={c.green} />
  </>,
  // 8 — Причал
  <>
    <rect x="296" y="146" width="44" height="6" rx="3" fill={c.groundDark} />
    <line x1="304" y1="152" x2="304" y2="162" stroke={c.groundDark} strokeWidth="3" strokeLinecap="round" />
    <line x1="330" y1="152" x2="330" y2="162" stroke={c.groundDark} strokeWidth="3" strokeLinecap="round" />
  </>,
  // 9 — Луна над островом
  <>
    <circle cx="320" cy="44" r="14" fill={c.warm} opacity="0.85" />
    <circle cx="326" cy="40" r="12" fill="var(--color-card)" />
  </>,
]

/** Примерный «центр роста» каждого ориентира — для свечения предвкушения */
export const landmarkAnchors: Array<{ x: number; y: number }> = [
  { x: 196, y: 138 }, // росток
  { x: 121, y: 118 }, // дерево
  { x: 245, y: 136 }, // костёр
  { x: 169, y: 106 }, // домик
  { x: 92, y: 150 },  // грядки
  { x: 212, y: 120 }, // фонарь
  { x: 274, y: 112 }, // второе дерево
  { x: 68, y: 116 },  // флаг
  { x: 318, y: 150 }, // причал
  { x: 322, y: 44 },  // луна
]

// ---------- Находки (старты 11+) ----------

/** Маленькие рисунки в локальных координатах вокруг (0,0) — точка у земли */
export const findSprites: Record<string, ReactNode> = {
  pine: (
    <>
      <rect x="-2" y="-6" width="4" height="8" rx="2" fill={c.groundDark} />
      <path d="M0 -34 L11 -16 L-11 -16 Z" fill={c.green} opacity="0.85" />
      <path d="M0 -24 L13 -4 L-13 -4 Z" fill={c.green} opacity="0.9" />
    </>
  ),
  bush: (
    <>
      <circle cx="-5" cy="-6" r="8" fill={c.green} opacity="0.75" />
      <circle cx="5" cy="-5" r="7" fill={c.green} opacity="0.85" />
    </>
  ),
  stone: (
    <>
      <ellipse cx="0" cy="-4" rx="9" ry="6" fill={c.soft} opacity="0.55" />
      <ellipse cx="-3" cy="-6" rx="4" ry="2.5" fill={c.soft} opacity="0.35" />
    </>
  ),
  flowers: (
    <>
      <path d="M-6 0 v-8 M0 0 v-10 M6 0 v-7" stroke={c.green} strokeWidth="2" strokeLinecap="round" />
      <circle cx="-6" cy="-10" r="2.5" fill={c.warm} />
      <circle cx="0" cy="-12" r="2.5" fill={c.warm} opacity="0.85" />
      <circle cx="6" cy="-9" r="2.5" fill={c.warm} opacity="0.7" />
    </>
  ),
  mushrooms: (
    <>
      <rect x="-6" y="-6" width="3" height="6" rx="1.5" fill="var(--color-card)" />
      <path d="M-9.5 -6 a5 4 0 0 1 10 0 z" fill={c.warm} opacity="0.9" />
      <rect x="3" y="-4" width="2.5" height="4" rx="1.25" fill="var(--color-card)" />
      <path d="M0.5 -4 a4 3 0 0 1 8 0 z" fill={c.warm} opacity="0.7" />
    </>
  ),
  reeds: (
    <>
      <path d="M-4 0 q-1 -10 1 -14 M0 0 q1 -12 0 -17 M4 0 q2 -9 1 -13" stroke={c.green} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
      <ellipse cx="0" cy="-17" rx="1.6" ry="4" fill={c.groundDark} />
    </>
  ),
  bird: (
    <>
      <path d="M-8 0 q4 -6 8 0 q4 -6 8 0" stroke={c.soft} strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  cat: (
    <>
      <ellipse cx="0" cy="-5" rx="7" ry="5" fill={c.groundDark} />
      <circle cx="6" cy="-9" r="4" fill={c.groundDark} />
      <path d="M3.5 -12 l1.5 -3 l2 2.6 M8.5 -12 l1.5 -3 l-1 3" stroke={c.groundDark} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M-7 -4 q-6 2 -4 6" stroke={c.groundDark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="7.2" cy="-9" r="0.9" fill={c.green} />
    </>
  ),
  hammock: (
    <>
      <line x1="-14" y1="0" x2="-14" y2="-16" stroke={c.groundDark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="14" y1="0" x2="14" y2="-16" stroke={c.groundDark} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M-14 -13 q14 10 28 0" stroke={c.warm} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  boat: (
    <>
      <path d="M-12 -2 h24 l-5 6 h-14 z" fill={c.groundDark} />
      <line x1="0" y1="-2" x2="0" y2="-16" stroke={c.soft} strokeWidth="2" strokeLinecap="round" />
      <path d="M0 -16 L10 -8 L0 -8 Z" fill={c.warm} opacity="0.9" />
    </>
  ),
  firefly: (
    <>
      <circle cx="-6" cy="-10" r="1.8" fill={c.green} />
      <circle cx="-6" cy="-10" r="4" fill={c.green} opacity="0.25" />
      <circle cx="4" cy="-16" r="1.5" fill={c.green} opacity="0.9" />
      <circle cx="4" cy="-16" r="3.5" fill={c.green} opacity="0.2" />
      <circle cx="8" cy="-6" r="1.3" fill={c.green} opacity="0.8" />
    </>
  ),
  bench: (
    <>
      <rect x="-11" y="-8" width="22" height="3" rx="1.5" fill={c.groundDark} />
      <line x1="-8" y1="-5" x2="-8" y2="0" stroke={c.groundDark} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="8" y1="-5" x2="8" y2="0" stroke={c.groundDark} strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  whale: (
    <>
      <path d="M-14 0 q6 -12 24 -6 q4 2 2 6 z" fill={c.soft} opacity="0.7" />
      <path d="M12 -4 q6 -2 6 -8 q-4 2 -8 3" fill={c.soft} opacity="0.7" />
      <path d="M-8 -8 q0 -6 -2 -8 M-8 -8 q2 -6 5 -7" stroke={c.green} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.9" />
    </>
  ),
  aurora: (
    <>
      <path d="M-30 0 q15 -12 30 0 q15 12 30 0" stroke={c.green} strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M-26 8 q13 -10 26 0 q13 10 26 0" stroke={c.green} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.2" />
    </>
  ),
  'shooting-star': (
    <>
      <line x1="-18" y1="-10" x2="0" y2="0" stroke={c.warm} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M0 0 l2.2 4.6 l5 .7 l-3.6 3.6 l.9 5 l-4.5 -2.4 l-4.5 2.4 l.9 -5 l-3.6 -3.6 l5 -.7 z" fill={c.warm} transform="scale(0.7)" />
    </>
  ),
  lighthouse: (
    <>
      <path d="M-6 0 L-4 -26 h8 L6 0 z" fill="var(--color-card)" stroke={c.groundDark} strokeWidth="1.5" />
      <rect x="-5" y="-18" width="10" height="4" fill={c.warm} opacity="0.8" />
      <rect x="-4" y="-32" width="8" height="6" rx="1" fill={c.warm} />
      <path d="M4 -29 L22 -34 M4 -29 L22 -24" stroke={c.warm} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" />
    </>
  ),
}

/**
 * Позиция находки: детерминированная из сида и порядкового номера.
 * Золотое сечение по X расталкивает соседние находки без коллизий.
 */
export function findPosition(
  find: IslandFindEntry,
  index: number,
): { x: number; y: number; s: number } {
  const zone = poolElementByKey(find.key)?.zone ?? 'ground'
  const t = (index * 0.61803 + (find.seed % 1000) / 1000) % 1
  const jitter = ((find.seed >> 4) % 100) / 100

  if (zone === 'sky') {
    return { x: 46 + t * 240, y: 26 + jitter * 34, s: 1.05 + jitter * 0.4 }
  }
  if (zone === 'water') {
    // только по краям, чтобы не залезать на остров;
    // правый край ограничен, чтобы спрайт (до ~24 ед.) не резался viewBox=380
    const x = t < 0.5 ? 26 + t * 2 * 36 : 306 + (t - 0.5) * 2 * 28
    return { x, y: 166 + jitter * 8, s: 1.0 + jitter * 0.3 }
  }
  return { x: 58 + t * 264, y: 138 + jitter * 18, s: 1.0 + jitter * 0.5 }
}
