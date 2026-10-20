/**
 * Кот-напарник собран из ОРИГИНАЛЬНОГО рисунка владельца (cutout-риг, как
 * в Spine/Rive): рисунок разрезан на слои — хвост (основание и завиток),
 * огонёк, тело, лапа и подушечка, уши, голова, зрачки — и каждый слой
 * висит на своей «кости» (точке опоры). Перерисовка «по мотивам» 1 в 1 не
 * получалась; так кот совпадает с референсом до пикселя.
 *
 * Слои — public/mascot/*.webp, нарезаны из исходника 1264×848: фон снят
 * заливкой от краёв (блики в глазах не тронуты), места под подвижными
 * частями залатаны мехом/радужкой — когда лапа поднята или зрачок смещён,
 * под ними не дыра, а продолжение рисунка.
 *
 * Все координаты — в пикселях исходника. Без 'use client': серверный
 * первый кадр (MascotStatic) рисует того же кота.
 */

export type Layer = { href: string; x: number; y: number; w: number; h: number };

const layer = (name: string, x0: number, y0: number, x1: number, y1: number): Layer => ({
  href: `/mascot/${name}.webp`,
  x: x0,
  y: y0,
  w: x1 - x0,
  h: y1 - y0,
});

export const L = {
  tailBase: layer("tail-base", 780, 430, 1160, 790),
  tailCurl: layer("tail-curl", 880, 250, 1160, 600),
  flame: layer("flame", 905, 255, 1040, 430),
  body: layer("body", 380, 500, 860, 790),
  leg: layer("leg", 410, 600, 575, 700),
  paw: layer("paw", 430, 655, 565, 775),
  earL: layer("ear-l", 360, 110, 570, 280),
  earR: layer("ear-r", 630, 95, 840, 280),
  head: layer("head", 250, 180, 920, 610),
  pupilL: layer("pupil-l", 465, 345, 545, 465),
  pupilR: layer("pupil-r", 678, 345, 758, 465),
} as const;

/** Квадратный кадр вокруг кота: потребители рассчитаны на квадрат */
export const VIEWBOX = "250 -85 910 910";

/* Кости: точки опоры в координатах исходника */
export const GROUND = { x: 600, y: 768 };
export const NECK = { x: 610, y: 590 };
export const EAR_L_PIVOT = { x: 470, y: 255 };
export const EAR_R_PIVOT = { x: 735, y: 245 };
export const SHOULDER = { x: 495, y: 625 };
export const PAW_C = { x: 497, y: 712 };

/* Глаза: эллипс радужки внутри тушевого кольца */
export const EYE_L = { x: 505, y: 405 };
export const EYE_R = { x: 718, y: 405 };
export const EYE_RX = 57;
export const EYE_RY = 60;

/* Цвета, снятые с рисунка: веки и латки рта — ровно этим мехом */
export const FUR = "rgb(74 77 82)";
export const INK = "rgb(22 22 24)";
export const EYE = "var(--color-primary)";
export const PAPER = "oklch(0.95 0.015 95)";
export const PENCIL = "oklch(0.82 0.15 85)";
export const OUTLINE = "rgb(28 28 30)";

/** Рот «ω» исходника: сюда кладётся латка меха при смене рта */
export const MOUTH = { x: 615, y: 486 };
export const WARM = "oklch(0.75 0.15 65)";
