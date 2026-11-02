"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react";
import { SPRING_PARALLAX } from "@/lib/motion";

/**
 * Ночной мир первого экрана (02.11, research/02 — образцы: Jonnie Hallman — ночные горы
 * с месяцем и слоистым параллаксом; Amie/Endel — небо как фон-состояние; §4.1 — сцена
 * занимает 60–100 % кадра). Было: почти чёрное небо и пара холмов — ¾ экрана пустоты.
 *
 * - Небо: индиго сверху → бирюзовое свечение у горизонта, Млечный Путь по диагонали
 *   (мимо кота и луны), падающая звезда раз в 13 с.
 * - Четыре гряды с воздушной перспективой: дальняя светлее и синее, ближние темнее и
 *   зеленее. Текст стоит на тёмных грядах (контраст замерен — CLAUDE.md, «Ночной мир»).
 * - Глубина за мышью: у каждой гряды свой сдвиг (только pointer: fine, не при
 *   reduced-motion). Дымка между грядами дрейфует 44–60 с (медленный цикл, §4.2).
 *
 * Всё считается детерминированно при сборке (свой ГПСЧ): сервер и клиент рисуют
 * одинаково, сцена есть в HTML до JS. Гряды привязаны к dvh, а ширина — к пикселям
 * (max(108vw, 1150px)): горы одного масштаба на телефоне и компьютере, на телефоне
 * виден их центр.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Pt = [number, number];

/** Силуэт гряды: сумма синусов, сглаженная квадратичными кривыми через середины точек */
function ridge(seed: number, base: number, amp: number, peaks: number) {
  const W = 1600;
  const H = 900;
  const r = rng(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const pts: Pt[] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const y =
      base -
      amp *
        (0.55 * Math.abs(Math.sin(t * peaks * 0.5 + ph[0])) +
          0.3 * Math.sin(t * peaks * 1.3 + ph[1]) +
          0.15 * Math.sin(t * peaks * 3.1 + ph[2]));
    pts.push([(i / N) * W, y]);
  }
  // целые координаты: на ширине 1150–1600 px разница меньше пикселя, а HTML короче
  const n = (v: number) => Math.round(v);
  let d = `M0 ${H}V${n(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    d += `Q${n(x0)} ${n(y0)} ${n((x0 + x1) / 2)} ${n((y0 + y1) / 2)}`;
  }
  d += `L${W} ${n(pts[pts.length - 1][1])}V${H}Z`;
  return { d, pts };
}

function yAt(pts: Pt[], x: number) {
  const step = pts[1][0] - pts[0][0];
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(x / step)));
  const k = (x - pts[i][0]) / step;
  return pts[i][1] * (1 - k) + pts[i + 1][1] * k;
}

/** Ель силуэтом: три яруса и ствол */
function pine(cx: number, base: number, h: number, w: number) {
  const r = Math.round;
  const a = r(w * 0.55), b = r(h * 0.5), c = r(w * 0.25), d = r(w * 0.5), e = r(h * 0.38);
  const f = r(w * 0.65), g = r(h * 0.12), k = r(w * 0.3);
  return `M${r(cx)} ${r(base - h)}l${a} ${b}h${-c}l${d} ${e}h${-f}v${g}h${-k}v${-g}h${-f}l${d} ${-e}h${-c}z`;
}

const FAR = ridge(7, 230, 150, 3);
const MID = ridge(19, 250, 95, 5);
const NEAR = ridge(31, 230, 60, 4);
const FRONT = ridge(43, 200, 34, 3);

const MID_PINES = (() => {
  const r = rng(91);
  const out: string[] = [];
  for (let x = 10; x < 1600; x += 9 + r() * 18) {
    if (r() > 0.55) continue;
    const h = 14 + r() * 22;
    out.push(pine(x, yAt(MID.pts, x) + 4, h, h * 0.34));
  }
  return out.join(" ");
})();

// ближний лес гуще и выше к краям: центр кадра остаётся коту и тексту
const NEAR_PINES = (() => {
  const r = rng(77);
  const out: string[] = [];
  for (let x = 20; x < 1600; x += 14 + r() * 26) {
    const edge = Math.abs(x - 800) / 800;
    if (r() > 0.25 + edge * 0.7) continue;
    const h = 26 + r() * 46 * (0.6 + edge);
    out.push(pine(x, yAt(NEAR.pts, x) + 6, h, h * 0.36));
  }
  return out.join(" ");
})();

// крупные ели переднего плана обрамляют кадр по краям (на телефоне за кадром)
const FRONT_PINES = (() => {
  const r = rng(123);
  const out: string[] = [];
  for (const [from, to] of [
    [0, 330],
    [1270, 1600],
  ] as const) {
    for (let x = from; x < to; x += 22 + r() * 30) {
      const edge = x < 800 ? 1 - x / 330 : (x - 1270) / 330;
      const h = 90 + r() * 70 + edge * 140;
      out.push(pine(x, yAt(FRONT.pts, x) + 10, h, h * 0.34));
    }
  }
  return out.join(" ");
})();

type Star = { x: number; y: number; r: number; a: number; tw?: number };

/** Неподвижные звёзды в корзинах размер × яркость: один path на корзину вместо сотни circle */
function starBuckets(stars: Star[]) {
  const map = new Map<string, { w: number; a: number; d: string }>();
  for (const s of stars) {
    if (s.tw) continue;
    const w = Math.round(s.r * 2 * 2) / 2;
    const a = Math.round(s.a * 5) / 5;
    const key = `${w}|${a}`;
    const b = map.get(key) ?? { w, a, d: "" };
    b.d += `M${Math.round(s.x)} ${Math.round(s.y)}h0`;
    map.set(key, b);
  }
  return [...map.values()];
}

// общий рассев + плотная полоса Млечного Пути
const STARS: Star[] = (() => {
  const r = rng(5);
  const s: Star[] = [];
  for (let i = 0; i < 70; i++)
    s.push({
      x: r() * 1000,
      y: r() * 620,
      r: 0.6 + r() * 1.3,
      a: 0.25 + r() * 0.55,
      tw: r() < 0.18 ? 3 + r() * 4 : undefined,
    });
  for (let i = 0; i < 220; i++) {
    const t = r();
    const off = (r() + r() + r() - 1.5) * 70;
    s.push({
      x: t * 1000 + off * 0.45,
      y: 190 + (t - 0.42) * -404 + off,
      r: 0.35 + r() * 0.8,
      a: 0.15 + r() * 0.45,
    });
  }
  return s;
})();
const STILL = starBuckets(STARS);
const TWINKLE = STARS.filter((s): s is Star & { tw: number } => s.tw !== undefined);

function Ridge({
  className,
  x,
  children,
}: {
  className: string;
  x: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMin meet"
      className={`absolute left-1/2 w-[max(108vw,1150px)] -translate-x-1/2 ${className}`}
      style={{ x }}
    >
      {children}
    </motion.svg>
  );
}

export function NightWorld() {
  const reduce = useReducedMotion();
  const sky = useSpring(0, SPRING_PARALLAX);
  const far = useSpring(0, SPRING_PARALLAX);
  const mid = useSpring(0, SPRING_PARALLAX);
  const near = useSpring(0, SPRING_PARALLAX);
  const front = useSpring(0, SPRING_PARALLAX);
  useEffect(() => {
    if (reduce) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      sky.set(nx * -4);
      far.set(nx * -8);
      mid.set(nx * -16);
      near.set(nx * -28);
      front.set(nx * -42);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduce, sky, far, mid, near, front]);

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, oklch(0.15 0.04 265) 0%, oklch(0.19 0.05 250) 30%, oklch(0.25 0.055 228) 52%, oklch(0.3 0.05 205) 64%, oklch(0.22 0.03 190) 80%, oklch(0.15 0.02 170) 100%)",
        }}
      />
      <motion.svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 h-full w-full"
        style={{ x: sky }}
      >
        <defs>
          <radialGradient id="nw-milky" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="oklch(0.8 0.06 280)" stopOpacity="0.16" />
            <stop offset="45%" stopColor="oklch(0.75 0.06 230)" stopOpacity="0.07" />
            <stop offset="100%" stopColor="oklch(0.7 0.05 230)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g transform="rotate(-22 420 190)">
          <ellipse cx="420" cy="190" rx="700" ry="110" fill="url(#nw-milky)" />
          <ellipse cx="470" cy="170" rx="420" ry="46" fill="url(#nw-milky)" />
        </g>
        <g stroke="oklch(0.95 0.015 240)" strokeLinecap="round">
          {STILL.map((b) => (
            <path key={`${b.w}|${b.a}`} d={b.d} strokeWidth={b.w} opacity={b.a} />
          ))}
        </g>
      </motion.svg>
      {/* Мерцание и падающая звезда — HTML-элементы с CSS-анимацией opacity/transform: их считает
          композитор, небо не перерисовывается каждый кадр (SMIL внутри SVG перерисовывал весь
          слой неба: −6 % занятости главного потока в покое на слабом телефоне). */}
      <motion.div className="absolute inset-0" style={{ x: sky }}>
        {TWINKLE.map((s, i) => (
          <span
            key={i}
            className="nw-twinkle"
            style={
              {
                left: `calc(50% + ${(s.x - 500).toFixed(1)} * max(0.1vw, 0.1dvh))`,
                top: `calc(${s.y.toFixed(1)} * max(0.1vw, 0.1dvh))`,
                width: `calc(${(s.r * 2).toFixed(2)} * max(0.1vw, 0.1dvh))`,
                height: `calc(${(s.r * 2).toFixed(2)} * max(0.1vw, 0.1dvh))`,
                "--lo": (s.a * 0.4).toFixed(2),
                "--hi": s.a.toFixed(2),
                animationDuration: `${s.tw.toFixed(1)}s`,
              } as CSSProperties
            }
          />
        ))}
        <span className="nw-meteor" />
      </motion.div>

      <Ridge className="top-[calc(48dvh-230px)] lg:top-[calc(55dvh-230px)]" x={far}>
        <defs>
          <linearGradient id="nw-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.29 0.045 232)" />
            <stop offset="35%" stopColor="oklch(0.24 0.04 225)" />
          </linearGradient>
        </defs>
        <path d={FAR.d} fill="url(#nw-far)" />
      </Ridge>
      <div className="mist-drift absolute inset-x-[-20%] top-[calc(56dvh-60px)] h-[120px] bg-[radial-gradient(ellipse_at_center,oklch(0.7_0.04_210/0.13),transparent_70%)] blur-xl lg:top-[calc(64dvh-60px)]" />
      <Ridge className="top-[calc(55dvh-240px)] lg:top-[calc(64dvh-240px)]" x={mid}>
        <path d={MID.d} fill="oklch(0.205 0.036 215)" />
        <path d={MID_PINES} fill="oklch(0.205 0.036 215)" />
      </Ridge>
      <div className="mist-drift mist-drift-2 absolute inset-x-[-20%] top-[calc(64dvh-50px)] h-[100px] bg-[radial-gradient(ellipse_at_center,oklch(0.7_0.04_200/0.1),transparent_70%)] blur-xl lg:top-[calc(74dvh-50px)]" />
      <Ridge className="top-[calc(63dvh-230px)] lg:top-[calc(74dvh-230px)]" x={near}>
        <path d={NEAR.d} fill="oklch(0.17 0.03 195)" />
        <path d={NEAR_PINES} fill="oklch(0.17 0.03 195)" />
      </Ridge>
      <Ridge className="top-[calc(74dvh-200px)] lg:top-[calc(88dvh-200px)]" x={front}>
        <path d={FRONT.d} fill="oklch(0.135 0.022 170)" />
        <path d={FRONT_PINES} fill="oklch(0.12 0.02 170)" />
      </Ridge>
    </div>
  );
}
