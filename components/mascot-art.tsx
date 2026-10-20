/**
 * Рисунок напарника по частям — чистые SVG-узлы без хуков и без
 * 'use client'. Из этих частей собраны и интерактивный маскот
 * (mascot-svg.tsx, риг на motion), и серверный первый кадр
 * (MascotStatic в hero-scene.tsx, живёт на CSS без JS) — поэтому кот
 * везде один и тот же, до пикселя.
 *
 * Части не знают, где стоят: позиционирование — в путях geometry,
 * анимации — на группах-обёртках у потребителя.
 */

import type { ReactNode } from "react";
import {
  ACCENT,
  BODY_PATH,
  BODY_STRANDS,
  CHEEK_MARKS,
  CHEST_TUFT,
  CROWN_TUFT,
  EAR_INNER,
  EAR_L,
  EAR_L_INNER,
  EAR_L_TIP,
  EAR_R,
  EAR_R_INNER,
  EAR_STRANDS,
  EYE,
  EYE_DARK,
  EYE_RX,
  EYE_RY,
  FLAME,
  FLAME_CORE,
  FLAME_INNER,
  FLAME_OUTER,
  FUR,
  FUR_DARK,
  FUR_LIGHT,
  HEAD_PATH,
  INK,
  LEG_L,
  LEG_R,
  NOSE,
  NOSE_PATH,
  OUTLINE,
  SHEEN,
  TAIL_BASE,
  TAIL_CURL,
  TAIL_MID,
  WARM,
  WHISKERS,
  WHITE,
} from "@/components/mascot-geometry";

const STROKE = 2.8;

/** Градиенты объёма: верхний свет, тень снизу, тёплый отсвет очага, лунный rim */
export function CatDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <radialGradient id={`${uid}-sheen`} cx="0.36" cy="0.18" r="0.7">
        <stop offset="0%" stopColor={SHEEN} stopOpacity="0.75" />
        <stop offset="60%" stopColor={SHEEN} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="55%" stopColor={FUR_DARK} stopOpacity="0" />
        <stop offset="100%" stopColor={FUR_DARK} stopOpacity="0.85" />
      </linearGradient>
      {/* Двухточечный свет: тёплый очаг снизу-слева + холодная луна справа-сверху */}
      <radialGradient id={`${uid}-warm`} cx="0.2" cy="1.1" r="0.8">
        <stop offset="0%" stopColor={WARM} stopOpacity="0.2" />
        <stop offset="60%" stopColor={WARM} stopOpacity="0.05" />
        <stop offset="100%" stopColor={WARM} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${uid}-moon`} cx="0.92" cy="0.05" r="0.8">
        <stop offset="0%" stopColor="oklch(0.86 0.05 230)" stopOpacity="0.2" />
        <stop offset="50%" stopColor="oklch(0.86 0.05 230)" stopOpacity="0.04" />
        <stop offset="100%" stopColor="oklch(0.86 0.05 230)" stopOpacity="0" />
      </radialGradient>
      {/* Радужка: светлая середина, тёмная кромка под веком */}
      <radialGradient id={`${uid}-iris`} cx="0.5" cy="0.62" r="0.62">
        <stop offset="0%" stopColor={EYE} />
        <stop offset="72%" stopColor={EYE} />
        <stop offset="100%" stopColor={EYE_DARK} />
      </radialGradient>
      <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.6" r="0.5">
        <stop offset="0%" stopColor={FLAME} stopOpacity="0.55" />
        <stop offset="100%" stopColor={FLAME} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * Заливка с объёмом в духе Duolingo: плоский мех + крупные мягкие пятна
 * света и тени (cel-shading), без штриховки. Контур — тёмный тон меха,
 * а не чёрная тушь: форма читается мягко, но не теряется на тёмном фоне.
 */
function Volume({ d, uid, clip }: { d: string; uid: string; clip: string }) {
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={d} />
        </clipPath>
      </defs>
      <path
        d={d}
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      <path d={d} fill={`url(#${uid}-sheen)`} />
      <path d={d} fill={`url(#${uid}-shade)`} />
      <path d={d} fill={`url(#${uid}-warm)`} />
      <path d={d} fill={`url(#${uid}-moon)`} />
    </>
  );
}

function Strands({ paths, opacity = 0.5 }: { paths: string[]; opacity?: number }) {
  return (
    <g
      stroke={FUR_LIGHT}
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
      opacity={opacity}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/* ── Хвост ─────────────────────────────────────────────────────────── */

/**
 * Хвост сужается к кончику: три сегмента разной толщины. Сначала все
 * обводки, потом все заливки — так на стыках нет тёмных колец. Завиток
 * рисуется дважды (обводка и заливка) — потребитель оборачивает оба
 * раза в одинаково анимированную группу, `curl`.
 */
export function CatTail({
  curl = (n) => n,
  flame,
}: {
  curl?: (node: ReactNode, layer: "outline" | "fill") => ReactNode;
  flame?: ReactNode;
}) {
  const seg = (d: string, w: number, color: string) => (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
    />
  );
  return (
    <>
      {seg(TAIL_BASE, 23, OUTLINE)}
      {seg(TAIL_MID, 19, OUTLINE)}
      {curl(seg(TAIL_CURL, 15, OUTLINE), "outline")}
      {seg(TAIL_BASE, 17.5, FUR)}
      {seg(TAIL_MID, 13.5, FUR)}
      {curl(
        <>
          {seg(TAIL_CURL, 9.6, FUR)}
          {/* светлая прядь вдоль завитка — объём */}
          <path
            d="M173 117 C164 114 159 120 161 127"
            fill="none"
            stroke={FUR_LIGHT}
            strokeWidth={1.4}
            strokeLinecap="round"
            opacity={0.55}
          />
          {flame}
        </>,
        "fill",
      )}
      {/* светлая прядь вдоль хвоста */}
      <path
        d="M138 181 C158 186 174 180 179 162"
        fill="none"
        stroke={FUR_LIGHT}
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.5}
      />
    </>
  );
}

/** Огонёк: внешний язык + горячее ядро; ядро потребитель может трясти отдельно */
export function CatFlame({
  uid,
  core = (n) => n,
}: {
  uid: string;
  core?: (node: ReactNode) => ReactNode;
}) {
  return (
    <>
      <ellipse cx={169} cy={98} rx={17} ry={20} fill={`url(#${uid}-glow)`} />
      <path
        d={FLAME_OUTER}
        fill={FLAME}
        stroke="oklch(0.55 0.16 40)"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      {core(<path d={FLAME_INNER} fill={FLAME_CORE} />)}
    </>
  );
}

/* ── Тело ──────────────────────────────────────────────────────────── */

export function CatBody({ uid }: { uid: string }) {
  return (
    <>
      <Volume d={BODY_PATH} uid={uid} clip={`${uid}-bodyclip`} />
      {/* тень от большой головы на груди — голова «висит» над телом */}
      <g clipPath={`url(#${uid}-bodyclip)`}>
        <ellipse cx={100} cy={122} rx={46} ry={10} fill={FUR_DARK} opacity={0.5} />
      </g>
      <Strands paths={BODY_STRANDS} opacity={0.35} />
      {/* светлое жабо под подбородком */}
      <path d={CHEST_TUFT} fill={FUR_LIGHT} opacity={0.42} />
      <path d="M92 133 q2 4 0 7 M108 133 q-2 4 0 7" stroke={FUR_LIGHT} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.6} />
    </>
  );
}

/**
 * Лапа-столбик: мех лапы сливается с грудью, контур — тонкие боковые
 * штрихи, как карандашные линии скетча (без верхней и нижней кромки:
 * сверху плечо уходит в мех, снизу лапу закрывает подушечка).
 */
export function CatLeg({ side, uid }: { side: "l" | "r"; uid: string }) {
  const d = side === "l" ? LEG_L : LEG_R;
  const [x0, x1] = side === "l" ? [72, 92] : [108, 128];
  const sides = `M${x0 + 1} 158 C${x0} 163 ${x0 - 1} 167 ${x0 - 1} 175 M${x1 - 1} 158 C${x1} 163 ${x1 + 1} 167 ${x1 + 1} 175`;
  return (
    <>
      <path d={d} fill={FUR} />
      {/* лапы ближе к зрителю — верхний свет как на голове, тень книзу */}
      <path d={d} fill={`url(#${uid}-sheen)`} opacity={0.35} />
      <path d={d} fill={`url(#${uid}-shade)`} opacity={0.6} />
      <path
        d={sides}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.85}
      />
      <path
        d={side === "l" ? "M81 156 q-1 7 0 13" : "M119 156 q1 7 0 13"}
        stroke={FUR_LIGHT}
        strokeWidth={1.3}
        strokeLinecap="round"
        fill="none"
        opacity={0.4}
      />
    </>
  );
}

/** Подушечки к зрителю: крупная «фасолина» + три пальчика */
export function CatPaw({ x, y }: { x: number; y: number }) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y}
        rx={14}
        ry={10.5}
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={STROKE}
      />
      <g fill={ACCENT}>
        <path
          d={`M${x - 5.8} ${y + 3.4} Q${x - 5.8} ${y - 1.4} ${x} ${y - 1} Q${x + 5.8} ${y - 1.4} ${x + 5.8} ${y + 3.4} Q${x + 3} ${y + 6.6} ${x} ${y + 5} Q${x - 3} ${y + 6.6} ${x - 5.8} ${y + 3.4}Z`}
        />
        <ellipse cx={x - 7.4} cy={y - 3.8} rx={2.5} ry={2.9} />
        <ellipse cx={x} cy={y - 6.2} rx={2.6} ry={3} />
        <ellipse cx={x + 7.4} cy={y - 3.8} rx={2.5} ry={2.9} />
      </g>
    </>
  );
}

/* ── Голова ────────────────────────────────────────────────────────── */

export function CatEar({
  side,
  tip = (n) => n,
}: {
  side: "l" | "r";
  tip?: (node: ReactNode) => ReactNode;
}) {
  const outer = side === "l" ? EAR_L : EAR_R;
  const inner = side === "l" ? EAR_L_INNER : EAR_R_INNER;
  const strands = side === "l" ? EAR_STRANDS.slice(0, 2) : EAR_STRANDS.slice(2);
  return (
    <>
      <path
        d={outer}
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      <path d={inner} fill={EAR_INNER} />
      <g
        stroke="oklch(0.62 0.05 50)"
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      >
        {strands.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {side === "l" &&
        tip(
          <path
            d={EAR_L_TIP}
            fill={FUR}
            stroke={OUTLINE}
            strokeWidth={2.2}
            strokeLinejoin="round"
            paintOrder="stroke"
          />,
        )}
    </>
  );
}

export function CatHead({ uid }: { uid: string }) {
  return (
    <>
      <path
        d={CROWN_TUFT}
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      <Volume d={HEAD_PATH} uid={uid} clip={`${uid}-headclip`} />
      {/* хохолок поверх кромки головы — без шва */}
      <path d={CROWN_TUFT} fill={FUR} />
      <path d={CROWN_TUFT} fill={`url(#${uid}-sheen)`} opacity={0.9} />
      {/* мягкий блик на лбу — главный признак «объёмного» маскота */}
      <g clipPath={`url(#${uid}-headclip)`}>
        <ellipse cx={84} cy={52} rx={30} ry={14} fill={SHEEN} opacity={0.35} />
        <ellipse cx={100} cy={134} rx={58} ry={12} fill={FUR_DARK} opacity={0.3} />
      </g>
    </>
  );
}

/** Усы + щёчные штрихи + нос — неподвижная часть мордочки */
export function CatMuzzle({ blush = 0.9 }: { blush?: number }) {
  return (
    <>
      <g
        stroke={FUR_LIGHT}
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      >
        {WHISKERS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g
        stroke={ACCENT}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
        opacity={blush}
      >
        {CHEEK_MARKS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path
        d={NOSE_PATH}
        fill={NOSE}
        stroke={OUTLINE}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </>
  );
}

export type MouthShape = "w" | "smile" | "open" | "flat" | "o";

export function CatMouth({ shape }: { shape: MouthShape }) {
  const line = {
    fill: "none",
    stroke: INK,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (shape) {
    case "w":
      return (
        <path
          d="M100 108.6L100 110.6M92.5 110Q96.2 115 100 110.6Q103.8 115 107.5 110"
          {...line}
        />
      );
    case "smile":
      return (
        <path
          d="M100 108.6L100 111M90.5 109.4Q95.5 117.5 100 111Q104.5 117.5 109.5 109.4"
          {...line}
        />
      );
    case "flat":
      return <path d="M100 108.6L100 111M95 112.2L105 112.2" {...line} />;
    case "o":
      return (
        <ellipse
          cx={100}
          cy={114}
          rx={2.6}
          ry={2.9}
          fill={INK}
          stroke={INK}
          strokeWidth={1}
        />
      );
    case "open":
      return (
        <g>
          <path d="M100 108.6L100 110.4" {...line} />
          <path
            d="M92 110.4Q100 110.6 108 110.4Q106.5 122 100 122.4Q93.5 122 92 110.4Z"
            fill={INK}
            stroke={INK}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
          <path
            d="M95.4 118.6Q100 115.6 104.6 118.6Q103 121.4 100 121.6Q97 121.4 95.4 118.6Z"
            fill="oklch(0.66 0.12 15)"
          />
        </g>
      );
  }
}

/** Открытый глаз без зрачка: тушевая кромка + радужка */
export function CatEyeBase({ x, y, uid }: { x: number; y: number; uid: string }) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y}
        rx={EYE_RX}
        ry={EYE_RY}
        fill={`url(#${uid}-iris)`}
        stroke={OUTLINE}
        strokeWidth={3.2}
      />
    </>
  );
}

/** Вертикальный зрачок + блики (блики едут со зрачком — «влажный» глаз) */
export function CatPupil({
  x,
  y,
  dilated = false,
}: {
  x: number;
  y: number;
  dilated?: boolean;
}) {
  return (
    <>
      <ellipse
        cx={x}
        cy={y + 0.5}
        rx={dilated ? 8.6 : 6.4}
        ry={dilated ? 14.5 : 13}
        fill={INK}
      />
      <circle cx={x + 5.4} cy={y - 7.4} r={3.9} fill={WHITE} />
      <circle cx={x - 3.6} cy={y + 7.6} r={1.5} fill={WHITE} opacity={0.75} />
    </>
  );
}

/** Закрытый глаз-дуга (сон, ожидание) */
export function CatClosedEye({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 13} ${y + 1} Q${x} ${y + 11} ${x + 13} ${y + 1}`}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

/** Верхнее веко: меховая шторка с тушевой кромкой (моргание — деформация, не fade) */
export function CatLid({ x, y }: { x: number; y: number }) {
  const l = x - EYE_RX - 2;
  const r = x + EYE_RX + 2;
  const top = y - EYE_RY - 2;
  const bot = y + EYE_RY + 1;
  return (
    <>
      <path
        d={`M${l} ${top} L${r} ${top} L${r} ${bot - 4} Q${x} ${bot + 3} ${l} ${bot - 4}Z`}
        fill={FUR}
      />
      <path
        d={`M${l + 2} ${bot - 4} Q${x} ${bot + 3} ${r - 2} ${bot - 4}`}
        fill="none"
        stroke={OUTLINE}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </>
  );
}

/** Нижнее веко-улыбка: щёки приподнимают низ глаза — глаза «улыбаются» */
export function CatSmileLid({ x, y }: { x: number; y: number }) {
  const l = x - EYE_RX - 2;
  const r = x + EYE_RX + 2;
  const bot = y + EYE_RY + 2;
  return (
    <path
      d={`M${l} ${bot} L${l} ${y + 17} Q${x} ${y + 9} ${r} ${y + 17} L${r} ${bot}Z`}
      fill={FUR}
    />
  );
}
