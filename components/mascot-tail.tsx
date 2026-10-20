/**
 * Хвост-цепочка: один слой рисунка режется на сегменты вдоль центральной
 * линии, каждый сегмент вложен в предыдущий и качается вокруг своего сустава
 * (CSS .cat-tseg в globals.css) с отставанием по фазе. Углы складываются по
 * цепочке — кончик ходит шире, а по хвосту бежит волна (overlapping action),
 * вместо жёсткого поворота целым куском. Сегменты перекрываются, шва нет.
 * Без хуков и 'use client': работает и в серверном первом кадре.
 */
import type { ReactNode } from "react";
import { L } from "@/components/mascot-geometry";

/** Суставы вдоль центральной линии хвоста (координаты рисунка) */
const J: ReadonlyArray<readonly [number, number]> = [
  [825, 697],
  [900, 702],
  [975, 705],
  [1040, 690],
  [1085, 655],
  [1100, 600],
  [1095, 545],
  [1075, 490],
];

const HALF = 70;
const OVERLAP = 10;

function quad(i: number): string {
  const [ax, ay] = J[i];
  const [bx, by] = J[i + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  // первый сегмент уходит под тело, остальные перекрывают соседей
  const a0x = ax - ux * (i === 0 ? 60 : OVERLAP);
  const a0y = ay - uy * (i === 0 ? 60 : OVERLAP);
  const b0x = bx + ux * OVERLAP;
  const b0y = by + uy * OVERLAP;
  const hw = i < 4 ? HALF : 62;
  const f = (v: number) => v.toFixed(1);
  return [
    [a0x + px * hw, a0y + py * hw],
    [b0x + px * hw, b0y + py * hw],
    [b0x - px * hw, b0y - py * hw],
    [a0x - px * hw, a0y - py * hw],
  ]
    .map(([x, y]) => `${f(x)},${f(y)}`)
    .join(" ");
}

/** Завиток с узелком — всё, что дальше последнего сустава */
const LAST = "1150,463 1000,517 1038,650 880,650 880,395 1150,395";

export function TailChain({ uid, children }: { uid: string; children?: ReactNode }) {
  const n = J.length;
  const polys = [...Array.from({ length: n - 1 }, (_, i) => quad(i)), LAST];
  const build = (i: number): ReactNode => (
    <g
      key={i}
      className="cat-tseg"
      style={
        {
          "--ox": `${J[i][0]}px`,
          "--oy": `${J[i][1]}px`,
          "--d": `${-i * 0.42}s`,
        } as React.CSSProperties
      }
    >
      <g clipPath={`url(#${uid}-tail-${i})`}>
        <image href={L.tail.href} x={L.tail.x} y={L.tail.y} width={L.tail.w} height={L.tail.h} preserveAspectRatio="none" />
      </g>
      {i < n - 1 ? build(i + 1) : children}
    </g>
  );
  return (
    <>
      <defs>
        {polys.map((pts, i) => (
          <clipPath key={i} id={`${uid}-tail-${i}`}>
            <polygon points={pts} />
          </clipPath>
        ))}
      </defs>
      {build(0)}
    </>
  );
}
