/**
 * Живой костёр у кота на Доме (макет research/22-chat-and-home/mockups, согласован владельцем 13.11).
 *
 * Каждый язык пламени — отдельный маленький <svg> внутри HTML-слоя, и анимируется именно слой (transform, opacity).
 * Так движение целиком на композиторе: анимация частей SVG (<g>) в Chrome и Safari пересчитывает стили и
 * перерисовывает рисунок в главном потоке на каждом кадре. Свет на холме — радиальный градиент без blur (iPhone: без
 * отдельных размытых слоёв, CLAUDE.md §5.5). При reduced-motion всё стоит (app/globals.css, «Костёр»).
 */
const FLAMES = [
  {
    cls: 'campfire-flame',
    d: 'M39 76C20 76 15 60 22 47c4-8 3-16 1-22 9 5 12 13 12 19 3-9 9-17 8-30 12 10 18 26 15 40 4-3 5-9 5-13 6 10 6 35-24 35z',
    stops: [
      ['0', '#ff6a1a', 1],
      ['.6', '#ff9a2e', 1],
      ['1', '#ffd166', 0.2],
    ],
  },
  {
    cls: 'campfire-flame campfire-flame-b',
    d: 'M39 76c-12 0-15-10-11-18 3-6 3-11 2-15 6 4 8 9 8 13 2-6 6-11 6-19 7 7 11 17 9 26 2-2 3-5 3-8 4 7 3 21-17 21z',
    stops: [
      ['0', '#ffb43a', 1],
      ['1', '#ffe9a3', 0.5],
    ],
  },
  {
    cls: 'campfire-flame campfire-flame-c',
    d: 'M39 76c-6 0-8-6-6-10 2-4 2-7 2-9 3 3 4 6 4 8 1-3 3-6 3-10 4 4 6 9 5 14 1-1 1-2 1-4 2 5 1 11-9 11z',
    stops: [
      ['0', '#fff6d6', 1],
      ['1', '#ffe08a', 0.3],
    ],
  },
] as const

export function Campfire({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <span className="campfire-glow" />
      {FLAMES.map((f, i) => (
        <span key={i} className={f.cls}>
          <svg viewBox="0 0 78 86" className="block size-full overflow-visible">
            <defs>
              <linearGradient id={`cf-${i}`} x1="0" y1="1" x2="0" y2="0">
                {f.stops.map(([offset, color, opacity]) => (
                  <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
                ))}
              </linearGradient>
            </defs>
            <path d={f.d} fill={`url(#cf-${i})`} />
          </svg>
        </span>
      ))}
      {/* поленья не двигаются — обычный рисунок поверх пламени */}
      <svg viewBox="0 0 78 86" className="absolute inset-0 block size-full overflow-visible">
        <rect x="12" y="73" width="54" height="8" rx="4" fill="#5b3a22" transform="rotate(-10 39 77)" />
        <rect x="12" y="73" width="54" height="8" rx="4" fill="#6e4628" transform="rotate(12 39 77)" />
        <rect x="16" y="75" width="46" height="2" rx="1" fill="#ff8a3d" opacity=".55" transform="rotate(12 39 77)" />
      </svg>
      <span className="campfire-spark" style={{ left: '38%', top: '22%', ['--dx' as string]: '-8px', animationDelay: '0.2s' }} />
      <span className="campfire-spark" style={{ left: '56%', top: '15%', ['--dx' as string]: '10px', animationDelay: '1.1s' }} />
      <span className="campfire-spark" style={{ left: '47%', top: '30%', ['--dx' as string]: '2px', animationDelay: '1.8s' }} />
    </div>
  )
}
