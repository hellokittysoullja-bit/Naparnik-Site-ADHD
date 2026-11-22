"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PawPrint, Sprout, Zap } from "lucide-react";
import { splitDump, upsertDeal } from "@/lib/deals";
import { BREAK_TOO_SHORT, breakable } from "@/lib/break-task";
import { NightScene } from "@/components/landing/night-scene";
import { Knoll, Moon } from "@/components/hero-scene";
import { MascotDoll } from "@/components/mascot-doll";
import { Campfire } from "@/components/campfire";
import { useClientMount } from "@/hooks/use-client-mount";
import { registerServiceWorker } from "@/lib/checkin";
import { peekFinds, peekProfile } from "@/lib/memory";
import {
  breakHref,
  findsLabel,
  homeChips,
  homeExample,
  homeFallbackTask,
  homeHint,
  homeSphere,
  type HomeProfile,
} from "@/lib/home-step";
import type { Sphere } from "@/lib/onboarding";

/**
 * Дом «Привал» (13.11, research/22-chat-and-home/E-home-design.md, макеты согласованы владельцем):
 * ночная сцена лендинга, кот на холме, слева живой костёр; ниже — «Что сейчас висит?», поле, три сферы, строка по двум
 * ответам знакомства и главная кнопка «Разломать на шаг». Чат — за запиской «Поговорить с котом» (/app/chat).
 *
 * Решение владельца 13.11: Дом у всех и всегда один и тот же экран, как на согласованном примере — никаких состояний
 * «по плану», «следующий шаг» и т. п. на Доме. От знакомства зависят только подсвеченная сфера, пример в поле и строка
 * над кнопкой (а позже — текст самой кнопки). Поэтому высота блока постоянна, и кот не сдвигается ни при каких данных.
 */
type Data = { profile: HomeProfile; finds: number };

function readData(): Data {
  try {
    return { profile: peekProfile(), finds: peekFinds().length };
  } catch (e) {
    // память читается с гардами; если что-то всё же бросит — Дом без ответов знакомства, а не пустой экран
    console.error("[home] memory read failed", e);
    return { profile: null, finds: 0 };
  }
}

export function HomeCamp() {
  const router = useRouter();
  const clientMount = useClientMount();
  // переход по табу — память читаем сразу; гидратация статического HTML — после монтирования (hooks/use-client-mount)
  const [data, setData] = useState<Data | null>(() => (clientMount ? readData() : null));
  const [text, setText] = useState("");
  // «Разломать» с делом, которое нечем разламывать («Hh»): кот просит слова в строке над кнопкой, экран не меняется
  const [tooShort, setTooShort] = useState(false);
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
    // ответы знакомства, изменённые в другой вкладке или забытые в чате, сразу видны на Доме
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

  const profile = data?.profile ?? null;
  // до чтения памяти строки нет, но её место занято (h-11 ниже): появится на своём месте, ничего не сдвинув
  const hint = data ? homeHint(profile) : null;
  // пустое поле — дробится дело из ответов знакомства (сфера + помеха), чтобы кнопка никогда не вела в никуда
  // Этап 2 (research/24 A №5): можно вывалить несколько дел через запятую — кот берёт первое сейчас, остальные кладёт в «Дела»
  const dump = splitDump(text);
  const many = dump.length > 1;
  const target = (many ? dump[0] : text.trim()) || homeFallbackTask(sphere, profile);
  const href = target ? breakHref(target) : "/app/session";
  const keepRest = () => {
    if (many) for (const d of dump.slice(1)) upsertDeal(d);
  };
  // пустое поле разламывает дело из ответов знакомства; написанное — только если его можно разламывать (lib/break-task.ts)
  const canBreak = !text.trim() || breakable(target);
  // «Разломать на шаг»: клавиатура закрывается сразу, и следующий кадр — уже Фокус с поленом, без промежуточных кадров
  // и наплывов (17.11, владелец: «сразу без доп кадров должен быть кадр с бревном»)
  const go = () => {
    if (!canBreak) return setTooShort(true);
    keepRest();
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
    router.push(href);
  };

  return (
    <main className="relative h-dvh overflow-hidden">
      <h1 className="sr-only">Дом</h1>
      <div className="absolute inset-0 z-0">
        <NightScene />
      </div>

      <div className="relative z-10 flex h-full flex-col pb-[calc(4.75rem+var(--sab))]">
        {/* находки острова — тихая плашка, ведёт в Мир; у новичка её нет */}
        <div className="flex min-h-14 items-start justify-end px-5 pt-[max(1rem,var(--sat))] [@media(max-height:620px)]:min-h-10 [@media(max-height:620px)]:pt-2">
          {/* до чтения памяти (обновление страницы) плашку и число показывает CSS по памяти из скрипта первого кадра (lib/app-prepaint.ts) */}
          {(data ? data.finds > 0 : true) && (
            <Link
              href="/app/world"
              // зона касания 44 px при плашке ~32 px: невидимое продолжение вокруг
              className={`press relative flex items-center gap-1.5 rounded-full border border-white/10 bg-[oklch(0.2_0.02_130/0.55)] px-3 py-1.5 text-[13px] font-semibold after:absolute after:-inset-1.5 after:content-['']${data ? "" : " home-finds-pre"}`}
            >
              <Sprout className="size-4 text-primary" aria-hidden="true" />
              {data ? findsLabel(data.finds) : <span className="home-pre-finds" />}
            </Link>
          )}
        </div>

        {/* Блок дела стоит в HTML РАНЬШЕ сцены, а на экране — под ней (order-last; mt-auto держит его внизу, даже пока
            сцены ещё нет). HTML приходит порциями, и на слабом телефоне браузер рисовал кадр, когда кот уже разобран, а
            блок под ним ещё нет: кот на миг вставал внизу экрана и прыгал вверх на 350 px (e2e «холодная загрузка», 14.11).
            Теперь недостающей частью может быть только сцена, а блок с самого первого кадра на своём месте. z-[1] — блок
            поверх кота и холма явно (Safari рисует флекс-элементы в порядке кода, а не order, CLAUDE.md §5.5); костёр — z-[2],
            поверх затемнения блока, как и было. При равных z Chrome учитывает order, а Safari — порядок кода, и ореол
            костра лёг бы в них по-разному; разные z снимают вопрос (замер zchk.mjs: кадр совпадает со старым) */}
        {/* «Что сейчас висит?» и действия. Блок одной высоты у всех: подпись, поле, три сферы, место под строку над
            кнопкой (две строки, есть всегда), кнопки. Кот сидит прямо над блоком, лишнюю высоту экрана забирает небо;
            размер кота — от свободной высоты (96–196 px). */}
        <section aria-label="Дело на сейчас" className="relative z-[1] order-last mt-auto px-4 pt-5 text-center [@media(max-height:620px)]:pt-3">
          {/* Затемнение земли начинается над подписью и доходит до полной темноты за ~100 px; isolate — слой затемнения
              над холмом, но под текстом и кнопками. Колонка не шире 448 px, как у Фокуса; затемнение — на всю ширину */}
          <div className="relative isolate mx-auto flex w-full max-w-md flex-col before:pointer-events-none before:absolute before:-inset-x-[50vw] before:-top-5 before:bottom-0 before:-z-10 before:bg-[linear-gradient(to_bottom,rgb(3_11_9/0),rgb(3_11_9/0.8)_52px,rgb(3_11_9)_100px)] before:content-['']">
          <p className="h-[22px] text-[16px] font-extrabold leading-[22px] text-[oklch(0.93_0.04_90)]">Какое дело сейчас висит?</p>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label className="sr-only" htmlFor="home-task">
              Что сейчас висит
            </label>
            <input
              id="home-task"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 120));
                setTooShort(false);
              }}
              placeholder={homeExample(sphere)}
              enterKeyHint="go"
              autoComplete="off"
              className="field"
              autoCapitalize="sentences"
            />
          </form>
          {/* до чтения памяти подсвеченную и третью сферу ставит CSS по атрибутам, которые выставил скрипт первого кадра */}
          <div className="mt-3 flex justify-center gap-2" role="group" aria-label="Сфера дела" data-pre={data ? undefined : ""}>
            {homeChips(profile).map((c, i) => (
              <button
                key={c.sphere}
                type="button"
                aria-pressed={sphere === c.sphere}
                data-chip={data || i < 2 ? c.sphere : "third"}
                onClick={() => setSphere(sphere === c.sphere ? null : c.sphere)}
                className={`press min-h-11 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                  sphere === c.sphere
                    ? "border-transparent bg-[oklch(0.97_0.005_100)] text-[#141a10] shadow-[0_2px_0_oklch(0.75_0.01_100)]"
                    : "border-white/10 bg-[oklch(0.24_0.014_130/0.9)] text-foreground"
                }`}
              >
                {data || i < 2 ? (
                  <>
                    <span aria-hidden="true">{c.icon}</span> {c.label}
                  </>
                ) : (
                  <>
                    <span data-third="home">
                      <span aria-hidden="true">🏠</span> Дом
                    </span>
                    <span data-third="message">
                      <span aria-hidden="true">✉️</span> Написать
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
          {/* строка над кнопкой по двум ответам знакомства (25 вариантов, без ответов — общая); место под две строки
              занято всегда, поэтому строка любой длины не сдвигает ни кота, ни кнопки */}
          <div id="home-hint" className="mt-2.5 flex h-11 items-center justify-center">
            {tooShort ? (
              <p role="status" className="mx-auto line-clamp-2 max-w-[34ch] text-balance text-[16px] font-bold leading-[22px] text-[oklch(0.93_0.04_90)]">
                {BREAK_TOO_SHORT}
              </p>
            ) : many ? (
              <p className="mx-auto line-clamp-2 max-w-[34ch] text-balance text-[15px] font-bold leading-[21px] text-[oklch(0.93_0.04_90)]">
                Возьму «{dump[0].slice(0, 24)}» сейчас, остальное ({dump.length - 1}) положу в Дела
              </p>
            ) : (
              hint && <p className="mx-auto line-clamp-2 max-w-[34ch] text-balance text-[16px] font-bold leading-[22px] text-[oklch(0.93_0.04_90)]">{hint}</p>
            )}
          </div>

          <Link
            href={href}
            onClick={(e) => {
              // ссылка остаётся ради предзагрузки Фокуса, а переход ведём сами: клавиатура уезжает до перехода
              e.preventDefault();
              go();
            }}
            // iOS Safari включает :active только при наличии touch-слушателя
            onTouchStart={() => {}}
            className="btn-chunky mt-3 block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face btn-sheen flex h-[56px] items-center justify-center rounded-[16px] bg-primary px-6 text-[18px] font-bold tracking-[-0.01em] text-primary-foreground">
              Разломать на шаг
            </span>
          </Link>

          {/* Этап 2 (research/24 A №9): рядом с «Поговорить с котом» — «Не могу начать»: кот спросит, что происходит, и
              подберёт первый шаг под это (Procrastination Wizard у Amazing Marvin). Две записки в один ряд — блок той же высоты */}
          <div className="mt-5 grid grid-cols-2 gap-2 [@media(max-height:620px)]:mt-3">
            <Link
              href="/app/chat"
              aria-label="Поговорить с котом"
              onTouchStart={() => {}}
              className="btn-paper block w-full select-none rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="btn-paper-face flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] px-2 text-[15px] font-bold">
                <PawPrint className="size-5 shrink-0 fill-[#6b4e2a] text-[#6b4e2a] opacity-70" aria-hidden="true" />
                Поговорить
              </span>
            </Link>
            <Link
              href={`/app/stuck${text.trim() ? `?task=${encodeURIComponent(target)}` : ""}`}
              onTouchStart={() => {}}
              className="btn-paper block w-full select-none rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="btn-paper-face flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] px-2 text-[15px] font-bold">
                <Zap className="size-5 shrink-0 fill-[#6b4e2a] text-[#6b4e2a] opacity-70" aria-hidden="true" />
                Не могу начать
              </span>
            </Link>
          </div>
          </div>
        </section>

        {/* сцена: кот по центру на холме, костёр слева от него */}
        <div className="relative flex min-h-0 flex-1 items-end justify-center">
          {/* луна, как на лендинге: справа вверху, отдельно от видео */}
          <Moon className="pointer-events-none absolute right-[3%] top-0 w-[clamp(84px,26vw,112px)]" />
          <div className="relative">
            {/* холм поднят над лапами (макушка svg, y≈6 из 500, на 0,15 W выше лап): кот сидит в холме, не на кромке */}
            <Knoll className="pointer-events-none absolute left-1/2 top-[82%] w-[440%] max-w-[900px] -translate-x-1/2" />
            {/* Костёр — как в первом макете, согласованном владельцем (скриншот 13.11): близко к коту, на макушке холма.
                Всё в долях ширины кота W (холм — 4,4 W): центр костра на 0,52 W левее центра кота, низ поленьев
                (95 % рисунка) на 0,03 W ниже лап и на ~0,025 W в земле. Холм поднят (top 82 %, 13.11 владелец: «холм симметрично выше»): макушка на 0,15 W выше лап, кот и костёр сидят в холме, а не на кромке. Тест: e2e/home-camp.spec.ts */}
            <Campfire className="absolute bottom-[-2.5%] left-[-22%] z-[2] h-[46%] w-[40%]" />
            <MascotDoll
              expression="calm"
              size={190}
              label="Напарник"
              className="vt-cat size-[clamp(96px,calc(100dvh-480px-var(--sab)),196px)] [@media(max-height:620px)]:size-[clamp(90px,calc(100dvh-440px-var(--sab)),196px)]"
            />
          </div>
        </div>

      </div>
    </main>
  );
}
