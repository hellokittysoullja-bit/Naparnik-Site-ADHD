"use client";

import { useState } from "react";

/**
 * То же, что `useReducedMotion` из motion/react (значение «уменьшить движение» на момент первой отрисовки; на сервере
 * null), но без библиотеки анимаций: её импорт ради одного хука тянул ~42 КБ кода в каждый экран /app — Дом (кот и
 * общий фон) её больше ни для чего не использует (14.11, оптимизация скорости).
 */
export function useReducedMotion(): boolean | null {
  const [reduce] = useState<boolean | null>(() =>
    typeof window === "undefined" ? null : !!window.matchMedia?.("(prefers-reduced-motion)").matches,
  );
  return reduce;
}
