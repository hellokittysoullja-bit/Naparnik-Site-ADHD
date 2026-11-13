/**
 * Живой костёр у кота на Доме (макет research/22-chat-and-home/mockups, согласован владельцем 13.11).
 * Три языка пламени и искры двигаются только transform и opacity (композитор, без перерисовки), свет на холме —
 * радиальный градиент без blur: на iPhone размытие на анимации давало отдельные слои и артефакты (CLAUDE.md §5.5).
 * При reduced-motion всё стоит (app/globals.css, «Костёр»).
 */
export function Campfire({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`campfire pointer-events-none ${className}`}>
      <span className="campfire-glow" />
      <svg viewBox="0 0 78 86" className="relative block size-full overflow-visible">
        <defs>
          <linearGradient id="cf-outer" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff6a1a" />
            <stop offset=".6" stopColor="#ff9a2e" />
            <stop offset="1" stopColor="#ffd166" stopOpacity=".2" />
          </linearGradient>
          <linearGradient id="cf-mid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ffb43a" />
            <stop offset="1" stopColor="#ffe9a3" stopOpacity=".5" />
          </linearGradient>
          <linearGradient id="cf-core" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#fff6d6" />
            <stop offset="1" stopColor="#ffe08a" stopOpacity=".3" />
          </linearGradient>
        </defs>
        <g className="campfire-flame">
          <path d="M39 76C20 76 15 60 22 47c4-8 3-16 1-22 9 5 12 13 12 19 3-9 9-17 8-30 12 10 18 26 15 40 4-3 5-9 5-13 6 10 6 35-24 35z" fill="url(#cf-outer)" />
        </g>
        <g className="campfire-flame campfire-flame-b">
          <path d="M39 76c-12 0-15-10-11-18 3-6 3-11 2-15 6 4 8 9 8 13 2-6 6-11 6-19 7 7 11 17 9 26 2-2 3-5 3-8 4 7 3 21-17 21z" fill="url(#cf-mid)" />
        </g>
        <g className="campfire-flame campfire-flame-c">
          <path d="M39 76c-6 0-8-6-6-10 2-4 2-7 2-9 3 3 4 6 4 8 1-3 3-6 3-10 4 4 6 9 5 14 1-1 1-2 1-4 2 5 1 11-9 11z" fill="url(#cf-core)" />
        </g>
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
