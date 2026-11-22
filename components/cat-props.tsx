import { asset } from "@/lib/asset-versions";
import type { DollActivity } from "@/lib/rig/doll";

/**
 * Предметы перед котом (владелец 22.11, «работаем вместе»): ноутбук и книга. Рисуются в координатах рисунка кота
 * (то же окно, что у куклы и постера), поэтому стоят на своём месте при любом размере кота, и с куклой, и с постером.
 *
 * Ноутбук: кот сидит ЗА крышкой и печатает — над кромкой видна тыльная сторона лап, они поднимаются на каждый удар;
 * свет экрана мягко падает на грудь и подбородок. На крышке — отпечаток лапы с серыми подушечками (владелец 22.11). Книга: твёрдая обложка в цветах
 * продукта, кот держит её нашими лапами из эталона (вырезаны для «Полена»), закладка покачивается, страница
 * «перелистывается» раз в 8 с — в такт тому, как глаза кота дочитывают пятую строку (lib/rig/doll.ts).
 */
const VIEW = "-48 -428 1442 1442";
const INK = "#1d140d";

export function CatProps({ activity }: { activity: DollActivity }) {
  if (activity === "none") return null;
  return (
    <svg viewBox={VIEW} aria-hidden="true" className="cat-props pointer-events-none absolute inset-0 size-full overflow-visible">
      <defs>
        <radialGradient id="cp-face" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#dcecff" stopOpacity="0.3" />
          <stop offset="0.6" stopColor="#b9d6f5" stopOpacity="0.1" />
          <stop offset="1" stopColor="#a9cdf5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cp-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3ede3" />
          <stop offset="1" stopColor="#d8cdbd" />
        </linearGradient>
        <linearGradient id="cp-fl" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff6a1a" />
          <stop offset="0.6" stopColor="#ff9a2e" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="cp-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a7880" />
          <stop offset="1" stopColor="#3d3c42" />
        </linearGradient>
        <linearGradient id="cp-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2683a" />
          <stop offset="1" stopColor="#bf4a22" />
        </linearGradient>
      </defs>

      {activity === "laptop" ? (
        // ноутбук стоит на земле и не дышит вместе с котом; без смешивания слоёв (mix-blend на iPhone давал прямоугольные
        // артефакты) и без резких полос света — только мягкий свет экрана на груди и подбородке
        <g>
          <ellipse cx="545" cy="700" rx="300" ry="150" fill="url(#cp-face)" style={{ opacity: "calc(0.55 + var(--key-hit, 0) * 0.25)" }} />
          {/* лапы на клавиатуре — тыльной стороной к зрителю, выглядывают из-за крышки и поднимаются на каждый удар:
              подъём считает кукла (--paw-l, --paw-r) */}
          <PawBack x={430} side="l" />
          <PawBack x={660} side="r" />
          {/* тень ноутбука на земле */}
          <ellipse cx="545" cy="992" rx="330" ry="16" fill="#000" opacity="0.35" />
          {/* крышка (вид сзади): ровный скруглённый прямоугольник, обводка как у кота, внутренний кант */}
          <rect x="292" y="700" width="506" height="258" rx="28" fill="url(#cp-lid)" stroke={INK} strokeWidth="10" />
          <rect x="310" y="718" width="470" height="222" rx="18" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" />
          {/* логотип — отпечаток лапы, подушечки серые */}
          <g transform="translate(545 832)" fill="#8c8a92" stroke={INK} strokeWidth="6" strokeLinejoin="round">
            <path d="M0 6c-22 0-38 14-38 30 0 13 12 19 24 16 6-2 9-4 14-4s8 2 14 4c12 3 24-3 24-16 0-16-16-30-38-30z" />
            <ellipse cx="-33" cy="-14" rx="10" ry="13" transform="rotate(-18 -33 -14)" />
            <ellipse cx="-12" cy="-30" rx="10" ry="13" transform="rotate(-6 -12 -30)" />
            <ellipse cx="12" cy="-30" rx="10" ry="13" transform="rotate(6 12 -30)" />
            <ellipse cx="33" cy="-14" rx="10" ry="13" transform="rotate(18 33 -14)" />
          </g>
          {/* основание: дека шире крышки, светлая кромка сверху и выемка спереди */}
          <path d="M268 952 L822 952 Q834 952 838 962 L846 980 Q850 990 838 990 L252 990 Q240 990 244 980 L252 962 Q256 952 268 952 Z" fill="#6c6872" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
          <path d="M276 962 L814 962" stroke="#a19ea8" strokeWidth="4" strokeLinecap="round" />
          <rect x="505" y="978" width="80" height="8" rx="4" fill="#4b4851" />
        </g>
      ) : (
        <g className="cat-props-breathe">
          <g className="cat-props-page" style={{ transformOrigin: "545px 960px" }}>
            {/* корешок и страницы видны снизу и справа — книга объёмная */}
            <rect x="350" y="700" width="420" height="262" rx="18" fill="#f6ecd6" stroke={INK} strokeWidth="9" transform="translate(14 12)" />
            <path d="M372 950h396M372 938h396" stroke="#d8c7a4" strokeWidth="4" transform="translate(14 12)" />
            <rect x="330" y="690" width="430" height="262" rx="18" fill="url(#cp-cover)" stroke={INK} strokeWidth="10" />
            <rect x="330" y="690" width="46" height="262" rx="14" fill="#9a3716" stroke={INK} strokeWidth="10" />
            {/* обложка: рамка-тиснение, огонёк и «Один шаг» */}
            <rect x="402" y="716" width="332" height="210" rx="12" fill="none" stroke="#ffd7a8" strokeOpacity="0.55" strokeWidth="5" />
            <path d="M568 818c-20 0-26-15-19-28 4-8 4-16 1-22 9 5 12 13 12 19 3-9 8-17 8-30 12 10 18 26 15 40 4-3 5-9 5-13 6 10 6 34-22 34z" fill="url(#cp-fl)" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
            <text x="568" y="880" textAnchor="middle" fontFamily="var(--font-sans), Manrope, sans-serif" fontWeight="800" fontSize="42" fill="#fff3df" letterSpacing="2">
              ОДИН ШАГ
            </text>
            {/* закладка покачивается */}
            <g className="cat-props-ribbon" style={{ transformOrigin: "700px 950px" }}>
              <path d="M690 948 L690 1010 L702 998 L714 1010 L714 948 Z" fill="#a6e22e" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
            </g>
          </g>
          {/* лапы держат книгу снизу — лапа из эталона (public/mascot/reveal/paw.webp), не перерисована */}
          <image href={asset("/mascot/reveal/paw.webp")} x="300" y="860" width="128" height="121" transform="rotate(-14 364 920)" />
          <image href={asset("/mascot/reveal/paw.webp")} x="662" y="860" width="128" height="121" transform="rotate(14 726 920) scale(-1 1) translate(-1452 0)" />
        </g>
      )}
    </svg>
  );
}

/** Лапа сверху (тыльная сторона): мягкая «варежка» с двумя бороздками между пальцами, шерсть цвета кота */
function PawBack({ x, side }: { x: number; side: "l" | "r" }) {
  return (
    <g style={{ transform: `translateY(calc(var(--paw-${side}, 0) * -34px))` }}>
      <g transform={`translate(${x} 712) rotate(${side === "l" ? -8 : 8}) scale(1.3)`}>
        <path d="M-62 46 C-66 -6 -36 -44 0 -44 C36 -44 66 -6 62 46 Z" fill="url(#cp-fur)" stroke={INK} strokeWidth="9" strokeLinejoin="round" />
        <path d="M-22 -40 Q-19 -26 -21 -10 M22 -40 Q19 -26 21 -10" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <path d="M-40 -18 Q-34 -32 -20 -37" fill="none" stroke="#8d8a93" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      </g>
    </g>
  );
}
