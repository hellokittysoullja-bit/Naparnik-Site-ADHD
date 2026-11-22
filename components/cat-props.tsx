import { asset } from "@/lib/asset-versions";
import type { DollActivity } from "@/lib/rig/doll";

/**
 * Предметы перед котом (владелец 22.11, «работаем вместе»): ноутбук и книга. Рисуются в координатах рисунка кота
 * (то же окно, что у куклы и постера), поэтому стоят на своём месте при любом размере кота, и с куклой, и с постером.
 *
 * Ноутбук: кот сидит ЗА крышкой — лапы спрятаны (в архиве лапы из позы сидя торчали подушечками к зрителю), свет
 * экрана падает на морду и мерцает в ритме печати, над кромкой крышки — свечение. Книга: твёрдая обложка в цветах
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
          <stop offset="0" stopColor="#cfe6ff" stopOpacity="0.42" />
          <stop offset="0.6" stopColor="#a9cdf5" stopOpacity="0.14" />
          <stop offset="1" stopColor="#a9cdf5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cp-rim" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#d9ecff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#d9ecff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cp-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6eedd" />
          <stop offset="1" stopColor="#e2d3b6" />
        </linearGradient>
        <linearGradient id="cp-fl" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff6a1a" />
          <stop offset="0.6" stopColor="#ff9a2e" />
          <stop offset="1" stopColor="#ffd166" />
        </linearGradient>
        <linearGradient id="cp-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2683a" />
          <stop offset="1" stopColor="#bf4a22" />
        </linearGradient>
      </defs>

      {activity === "laptop" ? (
        <g className="cat-props-breathe">
          {/* свет экрана на морде и над кромкой крышки — мерцает, как экран при печати */}
          <g className="cat-props-screen" style={{ mixBlendMode: "screen" }}>
            <ellipse cx="545" cy="575" rx="360" ry="250" fill="url(#cp-face)" />
            <path d="M300 712 L790 712 L770 640 Q545 600 320 640 Z" fill="url(#cp-rim)" />
          </g>
          {/* крышка (вид сзади): чуть сужается кверху, толстая тёмная обводка как у кота */}
          <path d="M318 706 Q306 706 304 720 L284 948 Q282 966 300 966 L790 966 Q808 966 806 948 L786 720 Q784 706 772 706 Z" fill="url(#cp-lid)" stroke={INK} strokeWidth="10" strokeLinejoin="round" />
          <path d="M330 730 L760 730" stroke="#fff" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
          {/* логотип — огонёк, как на хвосте */}
          <path d="M545 880c-26 0-34-20-25-37 6-11 5-21 2-29 12 7 16 17 16 26 4-12 11-23 10-40 16 13 24 34 20 52 5-4 7-11 7-17 8 13 8 45-30 45z" fill="url(#cp-fl)" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
          {/* основание с клавиатурой — тонкая полоса под крышкой */}
          <rect x="246" y="958" width="598" height="30" rx="15" fill="#5d5964" stroke={INK} strokeWidth="9" />
          <rect x="262" y="964" width="566" height="6" rx="3" fill="#8b8794" />
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
