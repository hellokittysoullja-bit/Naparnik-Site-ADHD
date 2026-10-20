"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "hero", label: "Старт" },
  { id: "how", label: "Как" },
  { id: "world", label: "Мир" },
  { id: "presence", label: "Зачем" },
  { id: "pricing", label: "Договор" },
];

/**
 * Точки-якоря справа: только десктоп (md+), где справа и так пусто —
 * на мобильном добавили бы ещё один слой поверх контента без места для него.
 * Ориентир «где я на странице», а не CTA — вторым primary-действием не
 * считается, поэтому не конфликтует с одним CTA на вьюпорт.
 */
export function SectionNav() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const onScroll = () => {
      const offset = window.innerHeight * 0.5;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.getBoundingClientRect().top <= offset) {
          setActive(SECTIONS[i].id);
          break;
        }
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Навигация по странице"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2.5 md:flex"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          aria-label={s.label}
          aria-current={active === s.id ? "true" : undefined}
          className="group relative flex items-center justify-end gap-2"
        >
          <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md border border-white/10 bg-card/90 px-2.5 py-1 font-mono text-[10px] tracking-wider text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
            {s.label}
          </span>
          {/* Размер через scale (не w/h — layout-анимация), свойства
              перечислены, без UI-glow (закон света Р1). Видимая точка
              остаётся 12px, но before:-inset-4 расширяет тач-цель до 44px
              (WCAG 2.5.8 / Fitts) — тот же приём, что у реакций в
              chat-bubble.tsx (before:-inset-2.5 на size-7 кнопке). */}
          <span
            className={`relative block size-3 rounded-full transition-[transform,background-color] duration-300 before:absolute before:-inset-4 before:content-[''] ${
              active === s.id
                ? "scale-100 bg-primary"
                : "scale-[0.67] bg-muted-foreground/35 group-hover:bg-muted-foreground/70"
            }`}
          />
        </a>
      ))}
    </nav>
  );
}
