"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PawPrint, Sprout } from "lucide-react";
import { NightScene } from "@/components/landing/night-scene";
import { Knoll, Moon } from "@/components/hero-scene";
import { MascotDoll } from "@/components/mascot-doll";
import { Campfire } from "@/components/campfire";
import { useClientMount } from "@/hooks/use-client-mount";
import { registerServiceWorker } from "@/lib/checkin";
import { peekFinds, peekPlan, peekProfile, peekStarts, peekStepQueue } from "@/lib/memory";
import {
  breakHref,
  findsLabel,
  homeChips,
  homeExample,
  homeFallbackTask,
  homeHint,
  homeSphere,
  homeStep,
  type HomeProfile,
  type HomeStep,
} from "@/lib/home-step";
import type { Sphere } from "@/lib/onboarding";

/**
 * Дом «Привал» (13.11, research/22-chat-and-home/E-home-design.md, макеты согласованы владельцем):
 * ночная сцена лендинга, кот на холме, слева живой костёр; ниже — шаг, о котором человек договорился сам,
 * строка по двум ответам знакомства и одна главная кнопка «Разломать на шаг». Чат — за запиской «Поговорить с котом»
 * (/app/chat), не на главном экране: пустое поле и задержки ИИ не стоят на пути к старту (research/22, отчёт B).
 */
type Data = { step: HomeStep; profile: HomeProfile; finds: number };

function readData(): Data {
  try {
    return {
      step: homeStep({ now: new Date(), plan: peekPlan(), queue: peekStepQueue(), starts: peekStarts() }),
      profile: peekProfile(),
      finds: peekFinds().length,
    };
  } catch (e) {
    // память читается с гардами; если что-то всё же бросит — Дом первого визита, а не пустой экран
    console.error("[home] memory read failed", e);
    return { step: homeStep({ now: new Date(), plan: null, queue: null, starts: [] }), profile: null, finds: 0 };
  }
}

export function HomeCamp() {
  const router = useRouter();
  const clientMount = useClientMount();
  // переход по табу — память читаем сразу; гидратация статического HTML — после монтирования (hooks/use-client-mount)
  const [data, setData] = useState<Data | null>(() => (clientMount ? readData() : null));
  const [text, setText] = useState("");
  const [sphere, setSphere] = useState<Sphere | null>(() => (clientMount ? homeSphere(peekProfile()) : null));

  // своя сцена закрывает экран — общий фон /app под ней не рисуется (app/globals.css, «Дом «Привал»»)
  useLayoutEffect(() => {
    document.body.dataset.homeCamp = "";
    return () => {
      delete document.body.dataset.homeCamp;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setData(readData());
    if (!data) {
      refresh();
      setSphere(homeSphere(peekProfile()));
    }
    // план, положенный в чате или в другой вкладке, сразу виден на Доме
    window.addEventListener("naparnik:memory", refresh);
    document.addEventListener("visibilitychange", refresh);
    void registerServiceWorker();
    return () => {
      window.removeEventListener("naparnik:memory", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // только при открытии
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = data?.step ?? null;
  const empty = step?.kind === "empty";
  const hint = data ? homeHint(data.profile) : null;
  const target = empty ? text.trim() || homeFallbackTask(sphere, data?.profile ?? null) : (step?.title ?? "");
  // «сегодня старт уже был»: шаг сделан, дробить его снова незачем — Фокус открывается чистым, под новое дело
  const href = step?.kind === "done-today" || !target ? "/app/session" : breakHref(target, step?.fromPlan ?? false);

  return (
    <main className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">Дом</h1>
      <div className="absolute inset-0 z-0">
        <NightScene />
      </div>

      <div className="relative z-10 flex h-full flex-col pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        {/* находки острова — тихая плашка, ведёт в Мир; у новичка её нет */}
        <div className="flex min-h-14 items-start justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))] [@media(max-height:620px)]:min-h-10 [@media(max-height:620px)]:pt-2">
          {data && data.finds > 0 && (
            <Link
              href="/app/world"
              // зона касания 44 px при плашке ~32 px: невидимое продолжение вокруг
              className="press relative flex items-center gap-1.5 rounded-full border border-white/10 bg-[oklch(0.2_0.02_130/0.55)] px-3 py-1.5 text-[13px] font-semibold after:absolute after:-inset-1.5 after:content-['']"
            >
              <Sprout className="size-4 text-primary" aria-hidden="true" />
              {findsLabel(data.finds)}
            </Link>
          )}
        </div>

        {/* сцена: кот по центру на холме, костёр слева от него */}
        <div className="relative flex min-h-0 flex-1 items-end justify-center">
          {/* луна, как на лендинге: справа вверху, отдельно от видео */}
          <Moon className="pointer-events-none absolute right-[3%] top-0 w-[clamp(84px,26vw,112px)]" />
          <div className={`relative ${data ? "" : "invisible"}`}>
            {/* До чтения памяти (холодная загрузка) кот скрыт: блок шага под ним вырастает по содержимому, и кот
                встал бы на новое место на глазах (прыжок). visibility, а не opacity: скрытый элемент не даёт сдвига
                раскладки (CLS 0). При переходе по меню память читается сразу — кот виден с первого кадра. */}
            {/* холм поднят над лапами (макушка svg, y≈6 из 500, на 0,15 W выше лап): кот сидит в холме, не на кромке */}
            <Knoll className="pointer-events-none absolute left-1/2 top-[82%] w-[440%] max-w-[900px] -translate-x-1/2" />
            {/* Костёр — как в первом макете, согласованном владельцем (скриншот 13.11): близко к коту, на макушке холма.
                Всё в долях ширины кота W (холм — 4,4 W): центр костра на 0,52 W левее центра кота, низ поленьев
                (95 % рисунка) на 0,03 W ниже лап и на ~0,025 W в земле. Холм поднят (top 82 %, 13.11 владелец: «холм симметрично выше»): макушка на 0,15 W выше лап, кот и костёр сидят в холме, а не на кромке. Тест: e2e/home-camp.spec.ts */}
            <Campfire className="absolute bottom-[-2.5%] left-[-22%] z-[1] h-[46%] w-[40%]" />
            <MascotDoll
              expression="calm"
              size={190}
              label="Напарник"
              className="size-[clamp(96px,calc(100dvh-480px-env(safe-area-inset-bottom)),196px)] [@media(max-height:620px)]:size-[clamp(90px,calc(100dvh-440px-env(safe-area-inset-bottom)),196px)]"
            />
          </div>
        </div>

        {/* Шаг и действия. Блок по содержимому, кнопки прижаты к низу, кот сидит прямо над ним (13.11, владелец: «пустота —
            это баг»): короткий шаг не оставляет дыр, лишняя высота экрана уходит в небо над котом. Размер кота — от
            свободной высоты (под самое высокое состояние), поэтому он одинаков при любом шаге. Пока память не прочитана
            после гидратации, кот скрыт (visibility), чтобы блок шага не сдвигал его на глазах (CLS 0). */}
        <section aria-label="Шаг на сейчас" className="relative px-4 pt-5 text-center [@media(max-height:620px)]:pt-3">
          {/* Подпись, шаг и строка над кнопкой — одна группа прямо над кнопками. Затемнение земли начинается над
              подписью и доходит до полной темноты за ~100 px, isolate — слой затемнения над холмом, но под текстом
              и кнопками. Колонка не шире 448 px, как у Фокуса; затемнение — на всю ширину экрана. До чтения памяти затемнение
              скрыто (visibility): оно растёт вместе с блоком, и это был бы сдвиг раскладки (CLS 0,05 на холодной загрузке) */}
          <div className={`relative isolate mx-auto flex w-full max-w-md flex-col before:pointer-events-none before:absolute before:-inset-x-[50vw] before:-top-5 before:bottom-0 before:-z-10 before:bg-[linear-gradient(to_bottom,rgb(3_11_9/0),rgb(3_11_9/0.8)_52px,rgb(3_11_9)_100px)] before:content-[''] ${data ? "" : "before:invisible"}`}>
          <div>
          <p className="min-h-4 font-mono text-[10.5px] font-semibold leading-4 tracking-[0.26em] text-primary/90">{step?.label}</p>
          <div className="mt-3 flex flex-col">
            {step && empty ? (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    router.push(href);
                  }}
                >
                  <label className="sr-only" htmlFor="home-task">
                    Что сейчас висит
                  </label>
                  <input
                    id="home-task"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 120))}
                    placeholder={homeExample(sphere)}
                    enterKeyHint="go"
                    autoComplete="off"
                    className="h-12 w-full rounded-[14px] border border-white/15 bg-[oklch(0.22_0.012_130/0.9)] px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </form>
                <div className="mt-3 flex justify-center gap-2" role="group" aria-label="Сфера дела">
                  {homeChips(data?.profile ?? null).map((c) => (
                    <button
                      key={c.sphere}
                      type="button"
                      aria-pressed={sphere === c.sphere}
                      onClick={() => setSphere(sphere === c.sphere ? null : c.sphere)}
                      className={`press min-h-11 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                        sphere === c.sphere
                          ? "border-transparent bg-[oklch(0.97_0.005_100)] text-[#141a10] shadow-[0_2px_0_oklch(0.75_0.01_100)]"
                          : "border-white/10 bg-[oklch(0.24_0.014_130/0.9)] text-foreground"
                      }`}
                    >
                      <span aria-hidden="true">{c.icon}</span> {c.label}
                    </button>
                  ))}
                </div>
              </>
            ) : step ? (
              <>
                <h2 className="mx-auto line-clamp-2 max-w-[22ch] text-balance text-[clamp(22px,6.6vw,27px)] font-bold leading-[1.12] tracking-[-0.01em]">
                  {step.title}
                </h2>
                {step.sub && <p className="mx-auto mt-1.5 line-clamp-1 max-w-[34ch] text-[13.5px] font-medium text-muted-foreground">{step.sub}</p>}
              </>
            ) : null}
            {/* строка над кнопкой — в том же блоке: шаг и строка центрируются вместе, и когда строки нет (нет ответов
                знакомства) или шаг короткий, пустое место делится сверху и снизу, а не дырой над кнопкой */}
            {step && hint && (
              <p className="mx-auto mt-2.5 line-clamp-2 max-w-[34ch] text-balance text-[16px] font-bold leading-[22px] text-[oklch(0.93_0.04_90)]">{hint}</p>
            )}
          </div>

          </div>
          <Link
            href={href}
            // iOS Safari включает :active только при наличии touch-слушателя
            onTouchStart={() => {}}
            className="btn-chunky mt-3 block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face btn-sheen flex h-[56px] items-center justify-center rounded-[16px] bg-primary px-6 text-[18px] font-bold tracking-[-0.01em] text-primary-foreground">
              Разломать на шаг
            </span>
          </Link>

          <Link
            href="/app/chat"
            onTouchStart={() => {}}
            className="btn-paper mt-5 [@media(max-height:620px)]:mt-3 block w-full select-none rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-paper-face flex h-[52px] items-center justify-center rounded-[14px] px-12 text-[18px] font-bold">
              <PawPrint className="absolute left-[18px] top-1/2 size-6 -translate-y-1/2 fill-[#6b4e2a] text-[#6b4e2a] opacity-70" aria-hidden="true" />
              Поговорить с котом
            </span>
          </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
