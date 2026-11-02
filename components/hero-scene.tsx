// Цвета сцены (раньше брались из геометрии старого cutout-кота, удалённого 22.10)
const INK = "rgb(22 22 24)";
const WARM = "oklch(0.75 0.15 65)";

/**
 * Пятно тёплого света на земле под существом: гарантированная «земля»
 * на любом вьюпорте + мягкая тень под лапами (дышит в противофазе).
 */
/**
 * Холм под котом на первом экране (02.11): тёмная земля, макушку подсвечивает тепло
 * огонька; края растворяются маской в грядах NightWorld (components/landing/night-world.tsx).
 */
export function Knoll({ className }: { className?: string }) {
  const hill = "M0 500 L0 150 Q150 70 300 30 Q400 6 500 30 Q650 70 800 150 L800 500 Z";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 500"
      className={className}
      style={{
        maskImage: "radial-gradient(ellipse 70% 100% at 50% 0%, black 55%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 100% at 50% 0%, black 55%, transparent 100%)",
      }}
    >
      <defs>
        <linearGradient id="knoll-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.2 0.03 160)" />
          <stop offset="18%" stopColor="oklch(0.15 0.024 165)" />
          <stop offset="100%" stopColor="oklch(0.13 0.02 170)" />
        </linearGradient>
        <radialGradient id="knoll-warm" cx="0.5" cy="0.02" r="0.32">
          <stop offset="0%" stopColor={WARM} stopOpacity="0.28" />
          <stop offset="100%" stopColor={WARM} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={hill} fill="url(#knoll-ground)" />
      <path d={hill} fill="url(#knoll-warm)" />
    </svg>
  );
}

export function GroundPool({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 120"
      width={360}
      height={120}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="gp-pool" cx="0.5" cy="0.4" r="0.62">
          <stop offset="0%" stopColor="oklch(0.285 0.032 95)" />
          <stop
            offset="55%"
            stopColor="oklch(0.23 0.016 130)"
            stopOpacity="0.65"
          />
          <stop
            offset="100%"
            stopColor="oklch(0.2 0.012 130)"
            stopOpacity="0"
          />
        </radialGradient>
        <filter id="gp-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <ellipse cx={180} cy={52} rx={176} ry={46} fill="url(#gp-pool)" />
      <ellipse
        cx={180}
        cy={22}
        rx={48}
        ry={6.5}
        fill="oklch(0.09 0.01 130)"
        opacity={0.3}
        filter="url(#gp-soft)"
      >
        <animate
          attributeName="rx"
          values="48;44.5;48"
          dur="4.6s"
          repeatCount="indefinite"
        />
      </ellipse>
      <g
        stroke="oklch(0.38 0.045 132)"
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      >
        <path d="M96 40 q2 -10 7 -13" />
        <path d="M108 43 q1 -8 5 -11" />
        <path d="M250 38 q2 -10 7 -13" />
        <path d="M263 41 q1 -8 5 -11" />
        <path d="M160 62 q2 -9 6 -12" />
        <path d="M214 66 q-2 -9 -6 -12" />
      </g>
    </svg>
  );
}

/**
 * Луна — небесный якорь, привязанный к углу ВЬЮПОРТА, а не к пейзажной
 * сцене: slice-кроп сцены делает позицию зависимой от пропорций экрана
 * (на мобильном резалась краем, на десктопе уходила за кадр). Отдельный
 * компактный SVG: гало дышит на SMIL, диск с кратерами тёплой кости.
 */
export function Moon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="moon-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="oklch(0.85 0.03 95)" stopOpacity="0.22" />
          <stop offset="55%" stopColor="oklch(0.85 0.03 95)" stopOpacity="0.07" />
          <stop offset="100%" stopColor="oklch(0.85 0.03 95)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#moon-halo)">
        <animate
          attributeName="opacity"
          values="0.85;1;0.85"
          dur="7s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="60" cy="60" r="21" fill="oklch(0.84 0.035 95)" opacity="0.9" />
      <g fill={INK} opacity="0.12">
        <circle cx="53" cy="53" r="5" />
        <circle cx="68" cy="66" r="3.4" />
        <circle cx="57" cy="71" r="2.2" />
      </g>
    </svg>
  );
}
