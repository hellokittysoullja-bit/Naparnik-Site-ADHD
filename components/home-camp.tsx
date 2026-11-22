"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { NightScene } from "@/components/landing/night-scene";
import { Knoll, Moon } from "@/components/hero-scene";
import { MascotDoll } from "@/components/mascot-doll";
import { Campfire } from "@/components/campfire";
import { useClientMount } from "@/hooks/use-client-mount";
import { registerServiceWorker } from "@/lib/checkin";
import { peekStarts } from "@/lib/memory";
import { brightnessOf, litLine } from "@/lib/fire";

/**
 * Дом (владелец 22.11, функция 1 «Не могу начать» — ядро): кот в центре на тёплой подсветке от огня, внизу огромная
 * кнопка «Не могу начать 🔥», под ней мелко «Вывалить мысли» и «Горит дедлайн». Больше ничего. Сверху мелко —
 * «Подожжено: N · уровень» (функция 3). Ночная сцена, холм и костёр — прежние, согласованные 13.11.
 */
type Data = { lit: number; glow: number };

function readData(): Data {
  try {
    const starts = peekStarts();
    return { lit: starts.length, glow: brightnessOf(starts) };
  } catch (e) {
    console.error("[home] memory read failed", e);
    return { lit: 0, glow: 0.25 };
  }
}

export function HomeCamp() {
  const clientMount = useClientMount();
  const [data, setData] = useState<Data | null>(() => (clientMount ? readData() : null));

  // своя сцена закрывает экран — общий фон /app под ней не рисуется (app/globals.css, «Дом «Привал»»)
  useLayoutEffect(() => {
    document.body.dataset.homeCamp = "";
    return () => {
      delete document.body.dataset.homeCamp;
    };
  }, []);

  useEffect(() => {
    const refresh = () => setData(readData());
    refresh();
    window.addEventListener("naparnik:memory", refresh);
    document.addEventListener("visibilitychange", refresh);
    void registerServiceWorker();
    return () => {
      window.removeEventListener("naparnik:memory", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const line = data ? litLine(data.lit) : null;
  // тёплая подсветка от огня: ярче, когда дела начинались недавно; без дел — тёплый уголёк, но не тьма
  const glow = data?.glow ?? 0.6;

  return (
    <main className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">Дом</h1>
      <div className="absolute inset-0 z-0">
        <NightScene />
      </div>

      <div className="relative z-10 flex h-full flex-col pb-[calc(4.75rem+var(--sab))]">
        {/* сверху мелко: сколько дел подожжено и уровень (функция 3). Место занято всегда — кот не прыгает */}
        <div className="flex min-h-12 items-start px-5 pt-[max(1rem,var(--sat))]">
          {line && (
            <p className="rounded-full border border-white/10 bg-[oklch(0.2_0.02_60/0.55)] px-3 py-1.5 text-[13px] font-semibold text-[oklch(0.93_0.04_80)]">
              <span aria-hidden="true">🔥 </span>
              {line}
            </p>
          )}
        </div>

        <section aria-label="Начать" className="relative z-[1] order-last mt-auto px-4 pt-4 text-center">
          <div className="relative isolate mx-auto flex w-full max-w-md flex-col before:pointer-events-none before:absolute before:-inset-x-[50vw] before:-top-6 before:bottom-0 before:-z-10 before:bg-[linear-gradient(to_bottom,rgb(3_11_9/0),rgb(3_11_9/0.8)_40px,rgb(3_11_9)_80px)] before:content-['']">
            <Link
              href="/app/stuck"
              onTouchStart={() => {}}
              className="btn-chunky block w-full select-none rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="btn-face btn-sheen flex h-[68px] items-center justify-center gap-2 rounded-[20px] bg-primary px-6 text-[21px] font-extrabold tracking-[-0.01em] text-primary-foreground">
                Не могу начать <span aria-hidden="true">🔥</span>
              </span>
            </Link>
            <div className="mt-2 flex items-center justify-center gap-1 text-[14px] font-semibold text-[oklch(0.86_0.03_85)]">
              <Link href="/app/deals" className="press min-h-11 rounded-full px-3 leading-[44px] underline-offset-4 hover:underline">
                Вывалить мысли
              </Link>
              <span aria-hidden="true" className="text-white/25">·</span>
              <Link href="/app/sos" className="press min-h-11 rounded-full px-3 leading-[44px] underline-offset-4 hover:underline">
                Горит дедлайн
              </Link>
            </div>
          </div>
        </section>

        {/* сцена: кот в центре на тёплой подсветке, костёр слева */}
        <div className="relative flex min-h-0 flex-1 items-end justify-center pb-[6vh]">
          <Moon className="pointer-events-none absolute right-[3%] top-0 w-[clamp(84px,26vw,112px)]" />
          <div className="relative">
            <Knoll className="pointer-events-none absolute left-1/2 top-[82%] w-[440%] max-w-[900px] -translate-x-1/2" />
            {/* тёплый свет огня на коте и холме: радиальный градиент без blur (iPhone, CLAUDE.md §5.5) */}
            <div
              aria-hidden="true"
              className="home-fire-glow pointer-events-none absolute left-[-35%] top-[-20%] h-[150%] w-[170%]"
              style={{ opacity: 0.45 + glow * 0.55 }}
            />
            <Campfire className="absolute bottom-[-2.5%] left-[-22%] z-[2] h-[46%] w-[40%]" />
            <MascotDoll
              expression="calm"
              size={240}
              label="Напарник"
              className="vt-cat size-[clamp(120px,calc(var(--cat-vh)-330px-var(--sab)),248px)]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
