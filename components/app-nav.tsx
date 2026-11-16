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
// Меню как в main: Дом · Фокус · Мир. «Дела» — не четвёртая вкладка, а отдельная круглая кнопка справа от меню, как у
// Tiimo (research/25-deep-teardowns/img/tiimo-appstore-3.jpg: четыре значка в общей плашке и отдельный круг справа).
// Выбор владельца 15.11: «дела будет как в б, а фокус останется»
const tabs = [
  { href: "/app", label: "Дом", icon: CatSilhouette, exact: true },
  { href: "/app/session", label: "Фокус", icon: Timer, exact: false },
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
  // null / undefined — память ещё не прочитана (первый кадр при обновлении): точку и минуты тогда показывает CSS по
  // атрибутам скрипта первого кадра (lib/app-prepaint.ts), а не прячет до ответа памяти
  const [worldUnseen, setWorldUnseen] = useState<boolean | null>(null);

  // К-Д · Активная сессия видна с любого экрана: бейдж оставшихся минут
  // на табе «Фокус» (паттерн активного звонка iOS). Ощущение контроля:
  // ушёл на Мир — сессия не «исчезла».
  const [minutesLeft, setMinutesLeft] = useState<number | null | undefined>(undefined);
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
      <div className="mx-auto flex max-w-md items-center py-2 pr-3">
        <div className="flex flex-1 items-center justify-around">
        {tabs.map((tab) => {
          // чат переехал с Дома на /app/chat и открывается с Дома — Дом остаётся подсвеченным
          const active = tab.exact
            ? pathname === tab.href || (tab.href === "/app" && (pathname === "/app/chat" || pathname.startsWith("/app/stuck")))
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const showBadge = tab.href === "/app/world" && worldUnseen === true && !active;
          const preBadge = tab.href === "/app/world" && worldUnseen === null && !active;
          // идёт сессия, а человек на другом экране — минуты на вкладке «Фокус» (как в main)
          const showTimer = tab.href === "/app/session" && typeof minutesLeft === "number" && !active;
          const preTimer = tab.href === "/app/session" && minutesLeft === undefined && !active;
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
                {(showBadge || preBadge) && (
                  <span
                    data-pre-badge={preBadge ? "" : undefined}
                    className="absolute -right-1 -top-1 size-2 animate-pulse rounded-full bg-reward shadow-[0_0_6px_oklch(0.8_0.16_85/0.8)] motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {(showTimer || preTimer) && (
                  <span
                    data-pre-timer={preTimer ? "" : undefined}
                    className="absolute -right-3.5 -top-1.5 rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground"
                    aria-hidden="true"
                  >
                    {showTimer ? `${minutesLeft}м` : null}
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
        {/* «Дела» — круглая кнопка-записка справа (бумажный цвет записок Дома: дела — это список на бумажке). Не цвет
            главной кнопки: на Доме лаймовая «Разломать на шаг» должна оставаться самой заметной. Без подписи, как у
            источника; название — для экранного диктора и в подсказке */}
        <Link
          href="/app/deals"
          aria-label="Дела"
          title="Дела"
          aria-current={pathname.startsWith("/app/deals") ? "page" : undefined}
          onTouchStart={() => {}}
          className="deals-orb press grid size-[52px] shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          data-active={pathname.startsWith("/app/deals") ? "" : undefined}
        >
          <ListChecks className="size-6" strokeWidth={2.3} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
