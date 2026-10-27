"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { getFinds, getStarts, markHome } from "@/lib/memory";
import { LANDMARK_COUNT } from "@/lib/island-elements";
import { landmarkAnchors, landmarkNodes } from "@/lib/island-sprites";

/**
 * Тихий ночной фон приложения — континуитет со сценой лендинга без её драмы.
 *
 * /app открывают десятки раз в день, поэтому сцена подчинена трём правилам,
 * которые разрешают противоречие «живое vs. не отвлекающее»:
 *
 *  1) ДИЕГЕТИЧНОСТЬ — двигается только то, что двигалось бы в реальном мире
 *     (небо, дыхание существа). Ни одна UI-поверхность не пульсирует.
 *  2) МЕДЛЕННОСТЬ — 7–23с. Habituation выжигает быстрый цикл, а не движение
 *     как таковое; на этих периодах глаз не ловит «анимацию».
 *  3) КОНТИНГЕНТНОСТЬ — самое заметное движение (сияние) появляется только
 *     как ответ на заработанное событие, а не по таймеру. Награда не
 *     приедается, потому что она заслужена.
 *
 * Рендерится один раз в app/app/layout.tsx (fixed, вне потока документа) и
 * живёт через все переходы Дом/Фокус/Мир без перемонтирования.
 *
 * БЕЗ отрицательного z-index (сознательно): и <html>, и <body> здесь несут
 * собственный явный bg-background. В этой связке z-index < 0 на fixed-элементе
 * прячет его под фон корневого элемента — эмпирически подтверждено. Порядок в
 * DOM (этот блок рендерится ПЕРВЫМ) при z-index: auto даёт тот же результат.
 */

const STARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [6, 14, 1.5, 0.32],
  [9, 78, 1.5, 0.26],
  [15, 42, 1.5, 0.22],
  [23, 88, 2, 0.3],
  [31, 20, 1.5, 0.2],
  [38, 64, 1.5, 0.26],
  [46, 8, 1.5, 0.18],
  [54, 92, 2, 0.24],
  [62, 34, 1.5, 0.18],
  [70, 72, 1.5, 0.24],
  [79, 16, 1.5, 0.16],
  [87, 56, 1.5, 0.2],
];

/**
 * #20 · Фаза луны по реальному лунному календарю.
 * Синодический месяц 29.53059 суток от известного новолуния (2000-01-06).
 * Возвращает 0..1, где 0 и 1 — новолуние, 0.5 — полная луна.
 * Луна появляется только после 10-го ориентира («Луна над островом») —
 * небо буквально меняется за прохождение карты, а дальше живёт своим
 * циклом: мир существует по своим законам, а не по нашим сессиям.
 */
function moonPhase(now: Date): number {
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC = 29.530588853 * 86400000;
  const diff = now.getTime() - KNOWN_NEW_MOON;
  const phase = ((diff % SYNODIC) + SYNODIC) % SYNODIC;
  return phase / SYNODIC;
}

/** Фазы неба. Граница ночи совпадает с продуктовой (NIGHT_UNTIL_HOUR = 5). */
type SkyPhase = "night" | "dawn" | "day" | "dusk";

function phaseForHour(hour: number): SkyPhase {
  if (hour < 5) return "night";
  if (hour < 9) return "dawn";
  if (hour < 17) return "day";
  if (hour < 21) return "dusk";
  return "night";
}

/**
 * НЕБО ПО ЧАСУ СУТОК.
 *
 * Сцена уже читала прогресс (луна за 10-й старт, сияние за редкую находку),
 * но не читала время: в 4 утра и в 2 дня фон был буквально одним и тем же
 * градиентом. Для продукта, у которого ночь — отдельная продуктовая ветка со
 * своим текстом и инвертированным целевым действием, это было расхождение
 * каналов: реплика говорила «сейчас 4:14, ночь не время начинать», а сцена
 * за ней показывала ровно то же самое, что в полдень.
 *
 * КРИТИЧНО: светлота всех нижних стопов держится в коридоре 0.152–0.172 —
 * там же, где живёт --background (0.17). Продукт dark-first, и все замеренные
 * контрасты (muted-foreground = 6.63:1 и т.д.) посчитаны против этого
 * коридора. Поэтому «день» отличается от «ночи» НЕ яркостью, а оттенком и
 * насыщенностью: холодная бирюза днём против глубокого индиго ночью, тёплая
 * кромка на рассвете и в сумерках. Сцена честно меняется в течение суток, но
 * ни один текст не теряет контраст ни в один час — вариация уходит в
 * hue/chroma, а не в lightness.
 */
const SKY: Record<
  SkyPhase,
  { top: string; mid: string; bottom: string; stars: number; hearth: number }
> = {
  night: {
    top: "oklch(0.2 0.035 268)",
    mid: "oklch(0.168 0.018 205)",
    bottom: "oklch(0.152 0.009 145)",
    stars: 1,
    hearth: 1,
  },
  dawn: {
    top: "oklch(0.215 0.032 278)",
    mid: "oklch(0.203 0.042 42)",
    bottom: "oklch(0.168 0.018 62)",
    stars: 0.22,
    hearth: 0.72,
  },
  day: {
    top: "oklch(0.232 0.028 218)",
    mid: "oklch(0.206 0.02 176)",
    bottom: "oklch(0.172 0.011 142)",
    stars: 0,
    hearth: 0.48,
  },
  dusk: {
    top: "oklch(0.198 0.036 288)",
    mid: "oklch(0.2 0.046 32)",
    bottom: "oklch(0.163 0.019 88)",
    stars: 0.5,
    hearth: 1,
  },
};

const PHASES: SkyPhase[] = ["night", "dawn", "day", "dusk"];

/**
 * Куда встаёт каждый заработанный ориентир на дальней гряде.
 *
 * Координаты — в системе слоя ориентиров (viewBox 0 0 400 80). Значения y
 * выведены из геометрии дальнего холма (его гребень идёт через y=16/9/13/12/
 * 10/14 при x=0/18/36/70/86/100 в системе холмов), пересчитанной в этот
 * viewBox — поэтому ориентир стоит НА линии гребня, а не висит над ней и не
 * тонет в заливке. Разлёт к краям намеренный: центр внизу занят очагом и
 * силуэтом существа, и постройка там спорила бы с ними.
 *
 * Порядок совпадает с ISLAND_ELEMENT_NAMES. Луна (индекс 9) сюда не входит —
 * её рисует отдельный слой в небе, у неё уже есть своя механика фаз.
 */
const RIDGE: ReadonlyArray<{ x: number; y: number; s: number }> = [
  { x: 60, y: 13, s: 0.8 },   // росток
  { x: 104, y: 19, s: 0.62 }, // дерево
  { x: 150, y: 42, s: 0.62 }, // костёр
  { x: 268, y: 33, s: 0.6 },  // домик
  { x: 306, y: 24, s: 0.58 }, // грядки
  { x: 342, y: 12, s: 0.6 },  // фонарь
  { x: 376, y: 34, s: 0.6 },  // второе дерево
  { x: 24, y: 50, s: 0.62 },  // флаг
  { x: 210, y: 37, s: 0.58 }, // причал
];

export function AppBackdrop() {
  const [hasAurora, setHasAurora] = useState(false);
  const [hasMoon, setHasMoon] = useState(false);
  // Фазу считаем в состоянии, а не при рендере: Date.now() на сервере и на
  // клиенте различаются → hydration mismatch. Тот же паттерн React #418,
  // что уже поймали в маскоте на prefers-reduced-motion.
  const [phase, setPhase] = useState<number | null>(null);
  // Час и число ориентиров — тоже только после монтирования, по той же
  // причине, что и фаза луны выше: страницы /app статически пререндерены, час
  // сборки почти никогда не совпадает с часом визита. До гидратации показываем
  // «ночь» (совпадает с серверным HTML), после — настоящую фазу; переход не
  // мигает, потому что слои неба меняются кроссфейдом по opacity.
  const [hour, setHour] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [landmarks, setLandmarks] = useState(0);
  // #2 · Ориентир, выросший за только что законченную сессию, ждёт своего
  // первого показа на Доме, а не проигрывает прорастание где придётся
  // (сцена одна на все три экрана и не перемонтируется между ними).
  const [pendingGrowth, setPendingGrowth] = useState<number | null>(null);
  const [grownIndex, setGrownIndex] = useState<number | null>(null);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  // #ЖИВОЙ МИР · Падающая звезда и светлячок — редкие, диегетичные события
  // ночного неба. Не декорация на таймере, а РЕДКИЕ случайные явления
  // (минуты между появлениями, каждое живёт секунды) — та же логика
  // контингентности, что у сияния/очага: заметное движение должно быть
  // редким, чтобы не приесться, но здесь источник редкости — вероятность,
  // не заработанное событие (мир живёт сам по себе, не только в ответ на
  // пользователя). Одно явление за раз, никогда оба разом.
  const [shootingStar, setShootingStar] = useState<{ id: number; top: number; left: number } | null>(null);
  const [firefly, setFirefly] = useState<{ id: number; top: number; left: number } | null>(null);

  useEffect(() => {
    let alive = true;
    setMounted(true);
    setHour(new Date().getHours());

    const readMemory = () => {
      void Promise.all([getFinds(), getStarts()]).then(([finds, starts]) => {
        if (!alive) return;
        // каждый визит в /app продлевает метку «уже свой» (и ставит её тем, кто пришёл до её появления)
        markHome(starts.length > 0);
        setHasAurora(finds.some((f) => f.key === "aurora"));
        setHasMoon(starts.length >= LANDMARK_COUNT);
        const count = Math.min(starts.length, RIDGE.length);
        setLandmarks(count);
        // Сколько ориентиров человек уже видел на горизонте — сравнение с
        // count ловит рост между визитами. Не пишем сюда сами: запись
        // "видел" происходит только когда прорастание реально показано
        // (см. эффект на pathname ниже), иначе гонка с несколькими вкладками
        // могла бы съесть анимацию до того, как человек попал на Дом.
        let seen = 0;
        try {
          seen = Number(window.localStorage.getItem("naparnik:ridgeSeen")) || 0;
        } catch {
          /* приватный режим */
        }
        if (count > seen) setPendingGrowth(count - 1);
        setPhase(moonPhase(new Date()));
      });
    };
    readMemory();

    // Час пересчитываем раз в 5 минут: сессия фокуса легко переживает смену
    // фазы, и небо обязано догнать реальность без перезагрузки страницы.
    const tick = window.setInterval(() => setHour(new Date().getHours()), 300_000);
    // Сцена живёт в layout и НЕ перемонтируется при переходах Дом/Фокус/Мир —
    // без явного сигнала гряда показывала бы вчерашний остров до перезагрузки.
    // lib/memory шлёт это событие на каждую запись.
    window.addEventListener("naparnik:memory", readMemory);
    document.addEventListener("visibilitychange", readMemory);
    return () => {
      alive = false;
      window.clearInterval(tick);
      window.removeEventListener("naparnik:memory", readMemory);
      document.removeEventListener("visibilitychange", readMemory);
    };
  }, []);

  // #2 · Прорастание играет один раз — в момент, когда человек реально на
  // Доме (единственное место, где горизонт виден за перепиской, а не за
  // формой Фокуса или картой Мира). Как только показали — фиксируем «видел»,
  // чтобы возврат на /app позже не проигрывал тот же рост снова.
  useEffect(() => {
    if (pathname !== "/app" || pendingGrowth === null) return;
    setGrownIndex(pendingGrowth);
    try {
      window.localStorage.setItem("naparnik:ridgeSeen", String(pendingGrowth + 1));
    } catch {
      /* приватный режим */
    }
    setPendingGrowth(null);
  }, [pathname, pendingGrowth]);

  const skyPhase: SkyPhase = mounted ? phaseForHour(hour) : "night";
  const sky = SKY[skyPhase];
  const isDark = skyPhase === "night" || skyPhase === "dusk";

  useEffect(() => {
    if (reduceMotion || !isDark) {
      setShootingStar(null);
      setFirefly(null);
      return;
    }
    let starTimer: number;
    let starClear: number;
    let fireflyTimer: number;
    let fireflyClear: number;

    // Интервалы намеренно случайные и длинные (минуты, не секунды): редкость
    // — это и есть эффект. Частое явление читалось бы как декоративный тик,
    // не как «мир живёт сам по себе».
    const scheduleStar = () => {
      const delay = 70_000 + Math.random() * 160_000; // ~1.2–3.8 мин
      starTimer = window.setTimeout(() => {
        setShootingStar({
          id: Date.now(),
          top: 5 + Math.random() * 16,
          left: 8 + Math.random() * 48,
        });
        starClear = window.setTimeout(() => setShootingStar(null), 1300);
        scheduleStar();
      }, delay);
    };
    const scheduleFirefly = () => {
      const delay = 45_000 + Math.random() * 110_000; // ~45с–2.5 мин
      fireflyTimer = window.setTimeout(() => {
        setFirefly({
          id: Date.now(),
          top: 60 + Math.random() * 9,
          left: 12 + Math.random() * 62,
        });
        fireflyClear = window.setTimeout(() => setFirefly(null), 5400);
        scheduleFirefly();
      }, delay);
    };
    scheduleStar();
    scheduleFirefly();
    return () => {
      window.clearTimeout(starTimer);
      window.clearTimeout(starClear);
      window.clearTimeout(fireflyTimer);
      window.clearTimeout(fireflyClear);
    };
  }, [reduceMotion, isDark]);

  /*
   * Освещённая доля диска и сторона освещения. Растущая луна (phase < 0.5)
   * освещена справа, убывающая — слева. Рисуем маской: тёмный круг
   * съезжает по диску — та же механика, что видит глаз в небе.
   */
  const lit = phase === null ? 0 : 1 - Math.abs(phase * 2 - 1); // 0..1
  const waxing = phase !== null && phase < 0.5;
  const maskShift = phase === null ? 0 : (waxing ? -1 : 1) * (1 - lit) * 1.9;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
    >
      {/* НЕБО. Четыре слоя стоят всегда, видимость решает opacity: градиенты
          браузер между кадрами не интерполирует, а кроссфейд по opacity
          интерполирует идеально и считает на композиторе, без перерисовки
          страницы. Час меняется — сцена перетекает, а не переключается. */}
      {PHASES.map((p) => (
        <div
          key={p}
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-out motion-reduce:transition-none"
          style={{
            opacity: p === skyPhase ? 1 : 0,
            background: `linear-gradient(to bottom, ${SKY[p].top} 0%, ${SKY[p].mid} 42%, ${SKY[p].bottom} 100%)`,
          }}
        />
      ))}
      {/* Кинематографичная виньетка: на телефоне края почти не тронуты, на
          широком десктопе зона за колонкой контента уходит в тень — пустота
          по бокам читается как намеренное «letterbox». */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 82% 82% at 50% 42%, transparent 52%, oklch(0.12 0.006 130 / 0.55) 100%)",
        }}
      />
      {/* Дальнее эхо очага — едва тёплое пятно вверху, не движется. */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 rounded-full opacity-80 blur-3xl"
        style={{
          width: "clamp(18rem, 34vw, 40rem)",
          height: "clamp(18rem, 34vw, 40rem)",
          background:
            "radial-gradient(ellipse at center, oklch(0.72 0.17 55 / 0.08) 0%, transparent 65%)",
        }}
      />

      {/* #18 · СЕВЕРНОЕ СИЯНИЕ — только если найдено (rare). Два полотна с
          разными периодами: один слой читается как «анимация», два в
          противофазе — как погода. Держится в верхней трети, далеко от
          текста; blend 'screen' складывает свет, не перекрашивает сцену. */}
      {hasAurora && (
        <div
          className="absolute inset-x-0 top-0 h-[46vh] overflow-hidden"
          style={{ mixBlendMode: "screen" }}
        >
          <div
            className="aurora-veil absolute inset-x-[-10%] top-0 h-full blur-2xl"
            style={{
              background:
                "linear-gradient(175deg, oklch(0.82 0.16 155 / 0.3) 0%, oklch(0.78 0.13 190 / 0.14) 42%, transparent 78%)",
            }}
          />
          <div
            className="aurora-veil aurora-veil-2 absolute inset-x-[-14%] top-0 h-[78%] blur-3xl"
            style={{
              background:
                "linear-gradient(168deg, oklch(0.86 0.18 145 / 0.2) 0%, oklch(0.8 0.12 205 / 0.1) 55%, transparent 82%)",
            }}
          />
        </div>
      )}

      {/* Зерно: последний штрих плоского фона — разница между «плоско» и
          «дорого» физически в нём. Турбулентность вместо PNG. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />
      {/* ЗВЁЗДЫ гаснут к рассвету и зажигаются к сумеркам — час суток
          читается с одного взгляда, до всякого текста. */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] motion-reduce:transition-none"
        style={{ opacity: sky.stars }}
      >
        {STARS.map(([top, left, size, alpha], i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `clamp(${size * 1}px, ${size * 0.14}vw, ${size * 1.9}px)`,
              height: `clamp(${size * 1}px, ${size * 0.14}vw, ${size * 1.9}px)`,
              backgroundColor: `oklch(0.92 0.01 210 / ${alpha})`,
            }}
          />
        ))}
      </div>

      {/* ЖИВОЙ МИР · падающая звезда — редкое явление ночного неба, не тик
          таймера (см. планирование выше). Одна на раз, короткая (1.3с),
          и полностью пропадает без следа — реальная падающая звезда не
          оставляет ничего после себя. */}
      {shootingStar && (
        <span
          key={shootingStar.id}
          aria-hidden="true"
          className="shooting-star absolute"
          style={{ top: `${shootingStar.top}%`, left: `${shootingStar.left}%` }}
        />
      )}

      {/* ЖИВОЙ МИР · светлячок у гряды — тёплая (тот же оттенок 55, что очаг)
          редкая искра над травой, не над репликами. Живёт секунды, дрейфует,
          гаснет — не зовёт внимание, только даёт сцене дышать. */}
      {firefly && (
        <span
          key={firefly.id}
          aria-hidden="true"
          className="firefly absolute rounded-full"
          style={{ top: `${firefly.top}%`, left: `${firefly.left}%` }}
        />
      )}

      {/* #20 · ЛУНА — 10-я награда, дальше живёт по реальному календарю.
          В новолуние (lit < 0.06) не рисуем вовсе: пустое небо в новолуние —
          это и есть достоверность, а не потерянный элемент.

          opacity: sky.stars — раньше луна показывалась с полным гало в ЛЮБОЙ
          час, потому что писалась ещё для целиком статичного неба: тогда
          «всегда видна» было единственно верным выбором, час суток попросту
          не существовал. Час суток теперь существует (см. фазы неба выше),
          и не увязать луну с ним значило бы держать на полуденном небе
          светящийся диск — новый шов между двумя механиками, которого не
          было ни в одной из них по отдельности. sky.stars уже кодирует ровно
          нужную величину («насколько сейчас темно для неба») — не считать
          её заново, а разделить с тем же сигналом, что гасит звёзды. */}
      {hasMoon && phase !== null && lit > 0.06 && (
        // moon-drift: луна не висит гвоздём — за 4 минуты едва заметно
        // смещается на несколько пикселей, как небесное тело в реальном
        // движении. Цикл настолько медленный, что глаз не ловит «анимацию»,
        // только ощущение, что небо живое, если засечь его дольше минуты.
        <svg
          className="moon-drift absolute right-[14%] top-[11%] h-auto w-[clamp(2.6rem,7vw,4rem)] transition-opacity duration-[1200ms] motion-reduce:transition-none"
          viewBox="0 0 20 20"
          style={{ opacity: sky.stars }}
        >
          <defs>
            <mask id="moon-mask">
              <rect x="0" y="0" width="20" height="20" fill="black" />
              <circle cx="10" cy="10" r="6" fill="white" />
              {/* Тёмный круг съезжает по диску: положение задаёт и фазу,
                  и сторону освещения — одна цифра вместо восьми картинок. */}
              <circle
                cx={10 + maskShift * 6}
                cy="10"
                r="6"
                fill="black"
              />
            </mask>
          </defs>
          {/* Гало — свет вокруг диска, а не свечение UI-элемента */}
          <circle
            cx="10"
            cy="10"
            r="9"
            fill="oklch(0.92 0.03 210 / 0.05)"
            style={{ filter: "blur(1.2px)" }}
          />
          <g mask="url(#moon-mask)">
            <circle cx="10" cy="10" r="6" fill="oklch(0.93 0.02 205 / 0.5)" />
          </g>
        </svg>
      )}

      {/* ЗЕМЛЯ. Без неё чат висел в чёрной пустоте. Два холма-силуэта дают
          сцене пол, а разговору — место действия: ночной остров, не void.
          h-[38vh]: док ввода + таб-бар перекрывают нижние ~130px — при 22vh
          от холмов оставалась полоска в 18px. */}
      {/* ЗЕМЛЯ — ТРИ СЛОЯ ГЛУБИНЫ, не два. Дальний холм, НА нём заработанные
          ориентиры, и только потом ближний холм поверх их оснований. Порядок в
          DOM здесь и есть перспектива: ближний холм честно перекрывает
          подножия дальних построек, поэтому остров читается уходящим вдаль, а
          не наклейками поверх фона. Раньше оба холма стояли одной SVG, и
          вставить что-либо МЕЖДУ ними было физически некуда. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
      >
        <path
          d="M0 16 Q 18 9 36 13 T 70 12 Q 86 10 100 14 L 100 30 L 0 30 Z"
          fill="oklch(0.21 0.025 140)"
        />
      </svg>

      {/* ТВОЙ ОСТРОВ НА ГОРИЗОНТЕ. Награда за старты жила только на вкладке
          «Мир»: чтобы увидеть выросшее, надо было специально пойти смотреть.
          Теперь каждый заработанный ориентир стоит силуэтом на гряде ЗА
          разговором — доказательство прогресса попадает в поле зрения на
          самом частом экране продукта, без единого лишнего тапа и без цифры
          «3 из 10», которая говорит уму, но не глазу. Пустой горизонт у
          новичка — тоже честное состояние: то самое «до», на фоне которого
          первый росток будет виден.

          preserveAspectRatio НЕ "none" (в отличие от холмов рядом): холмам
          растяжение по вертикали безразлично, это плавные кривые, а домик и
          дерево при том же растяжении вытянулись бы вдвое. Здесь нужен
          РАВНОМЕРНЫЙ масштаб — отсюда meet и собственная узкая полоса ровно
          на линии гребня вместо слоя во всю сцену.
          w-[104vw] с центрированием: 4% запаса гарантируют, что крайние
          ориентиры (флаг слева, второе дерево справа) не окажутся срезаны
          кромкой вьюпорта.

          brightness(0.4): те же рисунки, что на карте «Мира», но притушены до
          силуэтов — массы на фоне неба, а не яркие иконки, спорящие за
          внимание с текстом переписки. SMIL внутри самих спрайтов (качание
          кроны, пламя костра) остаётся живым: ровно та медленная
          диегетическая жизнь, на которой стоит вся сцена. */}
      {landmarks > 0 && (
        <svg
          className="absolute bottom-[16vh] left-1/2 h-[13vh] w-[104vw] -translate-x-1/2"
          viewBox="0 0 400 80"
          preserveAspectRatio="xMidYMax meet"
          style={{ filter: "brightness(0.4) saturate(0.6)" }}
        >
          {Array.from({ length: landmarks }, (_, i) => {
            const p = RIDGE[i];
            const a = landmarkAnchors[i];
            return (
              <g
                key={i}
                transform={`translate(${p.x} ${p.y}) scale(${p.s}) translate(${-a.x} ${-a.y})`}
              >
                {/* island-grow анимирует CSS transform: на одном узле с
                    SVG-атрибутом transform (позиционирование выше) браузер
                    отдаёт приоритет анимации и молча теряет translate —
                    ориентир прорастал бы за пределами гряды. Вложенный g без
                    своего атрибута transform ловит анимацию без конфликта:
                    та же развязка, что уже в island.tsx (landmark.render
                    живёт в родителе, а не на анимируемом узле). */}
                <g className={i === grownIndex ? "island-grow island-new-element" : undefined}>
                  {landmarkNodes[i]}
                </g>
              </g>
            );
          })}
          {/* ЖИВОЙ МИР · дым из трубы — только если домик (RIDGE[3]) уже
              заработан: дым без дома был бы недиегетичен. Три завитка с
              разной задержкой на одном 6с цикле — органичное, не
              метрономное поднятие, как настоящий дым. Внутри той же SVG,
              что и сам домик, — общий viewBox и brightness-фильтр держат
              дым в том же «силуэтном» языке, что вся гряда. */}
          {landmarks > 3 && !reduceMotion && (
            <g transform="translate(266 25)" opacity="0.55">
              <circle className="chimney-smoke" style={{ animationDelay: "0s" }} r="2.1" fill="oklch(0.78 0.008 90)" />
              <circle className="chimney-smoke" style={{ animationDelay: "2s" }} r="1.7" fill="oklch(0.78 0.008 90)" />
              <circle className="chimney-smoke" style={{ animationDelay: "4s" }} r="1.3" fill="oklch(0.78 0.008 90)" />
            </g>
          )}
        </svg>
      )}

      {/* Ближний холм — поверх ориентиров: их подножия уходят за него. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
      >
        <path
          d="M0 22 Q 25 16 50 19 T 100 18 L 100 30 L 0 30 Z"
          fill="oklch(0.185 0.02 138)"
        />
      </svg>

      {/* ОЧАГ. Центр поднят на 150px от низа — над перекрывающими панелями:
          тёплый свет реально виден за нижними пузырями ленты. «Сидим рядом у
          огня»: это же свечение объясняет тёплую подсветку .chat-bubble-cat.
          Днём приглушается (hearth 0.48): костёр в полдень — не то, что
          двигает сцену, в этот час работает небо.
          .app-hearth разгорается, когда напарник печатает или только что
          ответил (body[data-companion-speaking]) — принцип контингентности,
          на котором стоит вся сцена, доведённый до её главного источника
          света: самое заметное движение фона привязано к событию, а не к
          таймеру, и потому не приедается. */}
      <div
        className="app-hearth absolute bottom-[150px] left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full blur-3xl transition-opacity duration-[1200ms] motion-reduce:transition-none"
        style={{
          width: "clamp(20rem, 60vw, 36rem)",
          height: "clamp(12rem, 32vw, 19rem)",
          opacity: sky.hearth,
          background:
            "radial-gradient(ellipse at center, oklch(0.72 0.17 55 / 0.2) 0%, oklch(0.72 0.17 55 / 0.07) 45%, transparent 70%)",
        }}
      />

      {/* #19 · СУЩЕСТВО У КОСТРА. Раньше напарник существовал только как
          аватар в шапке — «интерфейсный элемент». Теперь он физически сидит
          в сцене, спиной, чуть левее очага: тот, с кем ты рядом смотришь на
          огонь. Силуэт, без черт лица — домысленное присутствие сильнее
          прорисованного, и это не второй «персонаж» в конкуренции с маскотом.
          Дышит только грудная клетка (7s).
          Позиция и плотность выверены в браузере: на 168px композер срезал
          силуэт до одних ушей, на 124px — накрывал целиком. На 214px фигура
          читается, но лента скроллит текст мимо неё — столкновения с
          репликами неизбежны на узком экране. Поэтому opacity-50: существо
          обязано проигрывать тексту. Оно атмосфера, а не объект поверх
          контента — на полной плотности почти чёрный силуэт читался
          «дыркой» рядом со временем реплики. */}
      <svg
        className="absolute bottom-[214px] left-[5%] h-auto w-[clamp(2.2rem,6vw,2.9rem)] opacity-50"
        viewBox="0 0 40 44"
      >
        {/* Ореол от очага: край силуэта, обращённый к огню, ловит тепло */}
        <ellipse
          cx="26"
          cy="30"
          rx="13"
          ry="16"
          fill="oklch(0.72 0.17 55 / 0.07)"
          style={{ filter: "blur(3px)" }}
        />
        <g className="creature-breathe">
          {/* Корпус сидящей фигуры — каплевидный, чуть наклонён к огню */}
          <path
            d="M20 43 C 9 43 7 33 9.5 25 C 11.5 18.5 15 16 20 16 C 25 16 28.5 18.5 30.5 25 C 33 33 31 43 20 43 Z"
            fill="oklch(0.145 0.015 145)"
          />
          {/* Голова */}
          <circle cx="20" cy="11" r="7.2" fill="oklch(0.145 0.015 145)" />
          {/* Ушки — узнаваемая силуэтная примета кота */}
          <path d="M14.4 6.2 L 13.2 0.6 L 18.2 4.2 Z" fill="oklch(0.145 0.015 145)" />
          <path d="M25.6 6.2 L 26.8 0.6 L 21.8 4.2 Z" fill="oklch(0.145 0.015 145)" />
          {/* Контровой свет по кромке со стороны огня — читается объём */}
          <path
            d="M30.5 25 C 33 33 31 43 20 43 C 27 41.5 29.5 33.5 27.6 26 Z"
            fill="oklch(0.72 0.17 55 / 0.3)"
          />
          <path
            d="M20 3.8 A 7.2 7.2 0 0 1 27.2 11 A 7.2 7.2 0 0 1 25.4 15.6 C 26.6 13.2 26.4 8 23.4 5.4 Z"
            fill="oklch(0.72 0.17 55 / 0.26)"
          />
        </g>
        {/* Хвост обёрнут вокруг — не дышит вместе с корпусом, он лежит */}
        <path
          d="M11 41.5 C 4.5 41 2.5 36.5 5.5 33.5"
          stroke="oklch(0.145 0.015 145)"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
