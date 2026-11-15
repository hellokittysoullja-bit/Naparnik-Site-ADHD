"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListChecks, Sprout, Timer } from "lucide-react";
import { CatSilhouette } from "@/components/icons/cat-silhouette";
import { getActiveSession, getUnseenWorldCount } from "@/lib/memory";
import { NAV_PILL_CLASS, NAV_PILL_STYLE } from "@/components/nav-pill-style";

/**
 * Нижний nav — только навигация ВНУТРИ приложения.
 * Путь назад на лендинг — в app-header (app/app/layout.tsx).
 * Принцип: bottom nav = core app actions, не site navigation.
 */
const tabs = [
  { href: "/app", label: "Дом", icon: CatSilhouette, exact: true },
  // Этап 2 (research/24 PLAN): Фокус — действие с Дома и из Дел, а не вкладка; на его месте — «Дела»
  { href: "/app/deals", label: "Дела", icon: ListChecks, exact: false },
  { href: "/app/world", label: "Мир", icon: Sprout, exact: false },
];

type PillComponent = () => React.JSX.Element;

export function AppNav() {
  const pathname = usePathname();
  // Пружинная пилюля (motion/react, ~42 КБ) грузится отдельно, после загрузки страницы (или по первому касанию): до этого на её месте
  // такая же неподвижная пилюля. Дом, кроме неё, библиотеку анимаций не использует — без этого она ехала в первом
  // пакете кода Дома и разбиралась до того, как экран оживал (14.11, оптимизация скорости).
  const [Pill, setPill] = useState<PillComponent | null>(null);
  useEffect(() => {
    let alive = true;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      void import("@/components/nav-pill").then((m) => {
        if (alive) setPill(() => m.NavPill);
      });
    };
    // после загрузки страницы и в простое — не спорит за сеть с котом первого экрана; касание меню — сразу
    const idle = () => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(load, { timeout: 2000 }) : setTimeout(load, 200));
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
    window.addEventListener("pointerdown", load, { once: true, capture: true });
    window.addEventListener("keydown", load, { once: true, capture: true });
    return () => {
      alive = false;
      window.removeEventListener("load", idle);
      window.removeEventListener("pointerdown", load, { capture: true });
      window.removeEventListener("keydown", load, { capture: true });
    };
  }, []);
  const [worldUnseen, setWorldUnseen] = useState(false);

  // К-Д · Активная сессия видна с любого экрана: бейдж оставшихся минут
  // на табе «Фокус» (паттерн активного звонка iOS). Ощущение контроля:
  // ушёл на Мир — сессия не «исчезла».
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = async () => {
      const s = await getActiveSession();
      if (!s) {
        setMinutesLeft(null);
        return;
      }
      const left = Math.ceil(
        (s.minutes * 60 - (Date.now() - s.startedAt) / 1000) / 60,
      );
      setMinutesLeft(left > 0 ? left : null);
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => window.clearInterval(id);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/app/world")) {
      setWorldUnseen(false);
      return;
    }
    getUnseenWorldCount().then((n) => setWorldUnseen(n > 0));
  }, [pathname]);

  // Флаг иммерсивного режима ставит только Фокус (и знакомство перед переходом в него); на любом другом экране он
  // устаревший — снимаем до отрисовки, чтобы меню не пропало навсегда после сорванного перехода
  useLayoutEffect(() => {
    if (!pathname.startsWith("/app/session")) delete document.body.dataset.focusImmersive;
  }, [pathname]);

  // Знакомство — один путь без боковых выходов: меню нет уже в HTML. Раньше его прятал эффект знакомства после
  // первой отрисовки, и «Дом/Фокус/Мир» мелькали внизу при каждом входе с лендинга (02.11).
  if (pathname.startsWith("/app/start")) return null;

  return (
    <nav
      aria-label="Основная навигация"
      className="glass-nav fixed inset-x-0 bottom-0 z-50 border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      {/* Ушёл со страницы, а сессия идёт — сверху пилюля «Фокус · ещё 12 мин» (как Live Activity у Focus Friend): вернуться в один тап */}
      {minutesLeft !== null && !pathname.startsWith("/app/session") && (
        <Link
          href="/app/session"
          className="nav-session-pill press fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground shadow-[0_6px_20px_-6px_oklch(0.86_0.22_130/0.6)]"
        >
          <Timer className="size-4" aria-hidden="true" />
          Фокус · ещё {minutesLeft} мин
        </Link>
      )}
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {tabs.map((tab) => {
          // чат переехал с Дома на /app/chat и открывается с Дома — Дом остаётся подсвеченным
          const active = tab.exact
            ? pathname === tab.href || (tab.href === "/app" && (pathname === "/app/chat" || pathname.startsWith("/app/session") || pathname.startsWith("/app/stuck")))
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const showBadge = tab.href === "/app/world" && worldUnseen && !active;
          const showTimer = false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`press relative flex flex-col items-center gap-1 rounded-2xl px-6 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Светящаяся пилюля активного таба перетекает между табами
                  пружиной (shared layoutId — паттерн iOS 17 / Arc): экран
                  ОТВЕЧАЕТ на навигацию телом, а не сменой цвета текста.
                  Активное место подсвечено светом очага — единый свет сцены. */}
              {active && (
                Pill ? (
                  <Pill />
                ) : (
                  <span className={NAV_PILL_CLASS} style={NAV_PILL_STYLE} aria-hidden="true" />
                )
              )}
              <span className="relative">
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden="true"
                />
                {showBadge && (
                  <span
                    className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-reward shadow-[0_0_6px_oklch(0.8_0.16_85/0.8)] motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {showTimer && (
                  <span
                    className="absolute -right-3.5 -top-1.5 rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground"
                    aria-hidden="true"
                  >
                    {minutesLeft}м
                  </span>
                )}
              </span>
              <span className="relative">{tab.label}</span>
              {showBadge && <span className="sr-only">— есть новое</span>}
              {showTimer && (
                <span className="sr-only">
                  — идёт сессия, осталось {minutesLeft} мин
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
