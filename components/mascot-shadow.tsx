/**
 * Тень кота: не одно пятно, а три слоя, как у настоящей контактной тени.
 *  — penumbra: широкая мягкая полутень (рассеянный свет неба);
 *  — core: плотное ядро строго под телом и тянется к лапам (там, где свет закрыт
 *    всем котом);
 *  — occlusion: узкие тёмные «пятна контакта» под каждой лапой (ambient occlusion),
 *    у земли тень всегда темнее и резче, дальше — светлее и мягче;
 *  — хвост отдельно бросает свою лёгкую тень.
 * Источник света — огонёк справа-сверху, поэтому всё чуть смещено влево.
 * Без хуков и 'use client': один и тот же компонент для интерактивного кота
 * (mascot-svg.tsx анимирует его при прыжке) и серверного кадра (hero-scene.tsx).
 */

/** Ось тени: центр под котом, на этой точке тень масштабируется при прыжке */
export const SHADOW_AXIS = { x: 640, y: 774 };

export function ShadowDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <filter id={`${uid}-sh-soft`} x="-40%" y="-300%" width="180%" height="700%">
        <feGaussianBlur stdDeviation="22" />
      </filter>
      <filter id={`${uid}-sh-mid`} x="-30%" y="-300%" width="160%" height="700%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
      <filter id={`${uid}-sh-tight`} x="-30%" y="-400%" width="160%" height="900%">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
    </defs>
  );
}

export function ShadowLayers({ uid }: { uid: string }) {
  const ink = "oklch(0.05 0.01 270)";
  return (
    <g aria-hidden="true">
      {/* penumbra: широкая и лёгкая, смещена от огня */}
      <ellipse cx={650} cy={780} rx={390} ry={40} fill={ink} opacity={0.3} filter={`url(#${uid}-sh-soft)`} />
      {/* тень хвоста */}
      <ellipse cx={900} cy={778} rx={210} ry={15} fill={ink} opacity={0.34} filter={`url(#${uid}-sh-mid)`} />
      {/* ядро под телом */}
      <ellipse cx={625} cy={774} rx={270} ry={17} fill={ink} opacity={0.5} filter={`url(#${uid}-sh-mid)`} />
      {/* пятна контакта под лапами */}
      <ellipse cx={500} cy={770} rx={78} ry={9} fill={ink} opacity={0.62} filter={`url(#${uid}-sh-tight)`} />
      <ellipse cx={712} cy={770} rx={78} ry={9} fill={ink} opacity={0.62} filter={`url(#${uid}-sh-tight)`} />
    </g>
  );
}
