"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { MascotSvg, type MascotExpression } from "@/components/mascot-svg";
import { GroundPool, HeroScene, Moon } from "@/components/hero-scene";
import { Button } from "@/components/ui/button";
import { SPRING_PARALLAX, SPRING_SNAPPY } from "@/lib/motion";
import { playPurr } from "@/lib/reward-sound";

/**
 * Первый экран.
 *
 * Мобильный кадр несёт ОДИН момент и ровно одно действие:
 * существо -> обещание (H1) -> одна строка сути -> кнопка.
 * Диалог с чипами уехал на order-5 за сгиб (mt-[16dvh]), оставив намеренный
 * сливер пузыря как подсказку скролла.
 *
 * Почему так, по замерам живой прод-сборки:
 * - кнопка занимала 807-855px на экране 844px: нижняя кромка срезана, а с
 *   видимой адресной строкой Safari (~750px) кнопки не было вовсе. Первый
 *   экран не предлагал ни одного способа начать. Сейчас 503-555 на всех трёх
 *   ходовых высотах (844 / 750 / 667) с запасом 260 / 166 / 83px;
 * - вес по площади x светлоте: пузырь реплики (30 430px²) почти равнялся
 *   заголовку (30 665px²) - два одинаково тяжёлых блока в кадре, фокуса нет;
 * - тач-цели первого экрана и шапки: было 6 штук меньше 44px, стало 0;
 * - подзаголовок 15px/60% давал 6.58:1 (AA, но не AAA). Сейчас 16px/72% =
 *   9.15:1 по вендоренному scripts/contrast.py. Аудитория читает этот экран
 *   уставшей, на hero-копии берём AAA;
 * - тире на первом экране: было 4, стало 0 (taste-skill §9.G).
 *
 * На lg+ раскладка прежняя: оффер слева, существо и живой чат справа.
 * Все mt-/order- правки этого прохода помечены lg:-сбросами.
 */

const OPENING_LINE =
  "Привет. Я Напарник. Если сил совсем нет, давай просто побудем рядом минуту.";

const REPLIES = {
  procrastinate: {
    visitor: "Вечно откладываю дела",
    companion:
      "Знакомо. Это не лень — мозгу просто нужен кто-то рядом в момент старта. Пойдём, покажу, как это работает.",
  },
  curious: {
    visitor: "Просто посмотреть",
    companion:
      "Заходи. У меня тут остров, который растёт от каждого твоего старта. Попробуй одно крошечное дело — увидишь.",
  },
} as const;

type ReplyKey = keyof typeof REPLIES;

const INTRO_CHOICE_KEY = "naparnik:intro";

type SceneStep = {
  kind: "companion" | "visitor";
  text: string;
  /** Для FLIP-морфа: реплика-ответ наследует layoutId своего чипа */
  replyKey?: ReplyKey;
};

function WordReveal({
  text,
  startDelay = 0.55,
  step = 0.085,
  className,
}: {
  text: string;
  startDelay?: number;
  step?: number;
  className?: string;
}) {
  const words = text.split(" ");
  return (
    <p className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            <span
              className="hero-word"
              style={{
                animationDelay: `${(startDelay + i * step).toFixed(2)}s`,
              }}
            >
              {word}
            </span>{" "}
          </span>
        ))}
      </span>
    </p>
  );
}

/**
 * Реплика кота в чате. Раньше дописывалась посимвольно (`text.slice(0,
 * shown)`) — пузырь физически рос вместе с текстом 1.7с, и рукописная
 * пометка под ним ехала вниз следом (layout reflow на каждый символ).
 * Тот же приём, что уже верно сделан в WordReveal выше: весь текст сразу
 * в разметке (пузырь с первого кадра нужной высоты), проявляются только
 * слова через opacity — реflow ноль, ощущение «печатает» остаётся за
 * счёт последовательного появления слов, а не за счёт роста контейнера.
 */
function TypedLine({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");
  const startDelay = 0.05;
  const step = 0.045;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const firedRef = useRef(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    firedRef.current = false;
    const fireDone = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      onDoneRef.current?.();
    };
    if (reduceMotion) {
      fireDone();
      return;
    }
    // Вся фраза проявлена + небольшой запас на длительность самого fade-in
    // (hero-word: 0.32s) — момент, когда последнее слово реально видно.
    const totalMs = (startDelay + words.length * step) * 1000 + 320;
    const id = window.setTimeout(fireDone, totalMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduceMotion]);

  function skip() {
    setSkipped(true);
    if (!firedRef.current) {
      firedRef.current = true;
      onDoneRef.current?.();
    }
  }

  return (
    <p
      className="font-hand text-xl leading-snug text-secondary-foreground md:text-2xl"
      onClick={skip}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            <span
              className="hero-word"
              style={
                skipped
                  ? { animationDuration: "0.01s", animationDelay: "0s" }
                  : { animationDelay: `${(startDelay + i * step).toFixed(2)}s` }
              }
            >
              {word}
            </span>{" "}
          </span>
        ))}
      </span>
    </p>
  );
}

export function Hero() {
  const [steps, setSteps] = useState<SceneStep[]>([]);
  const [answered, setAnswered] = useState(false);
  const [expression, setExpression] = useState<MascotExpression>("calm");
  // CTA виден с первой секунды (не заперт за диалогом), но ответ существа
  // всё равно должен закрывать дофаминовую петлю действием, а не повисать
  // в пустоте — импульс на уже видимую кнопку вместо второй, конкурирующей
  const [ctaBoost, setCtaBoost] = useState(false);
  // Клиентский переход на /app не мгновенен (первая загрузка бандла) —
  // 200-300мс без визуального отклика читаются мозгом как «не сработало»,
  // тянет за собой повторный клик. Гвардим от двойного клика в самом
  // обработчике: disabled на Link-рендере base-ui ничего не даёт
  // (:disabled — псевдокласс нативных форм, у <a> его не бывает).
  const [navigating, setNavigating] = useState(false);

  const reduceMotion = useReducedMotion();

  // А6 · Глубина за курсором (десктоп): слои сцены едва смещаются за
  // мышью с ленивой пружиной — кадр получает объём (приём tvOS/дорогих
  // лендингов). Луна дальше — двигается сильнее (обратный параллакс дали).
  const sceneX = useSpring(0, SPRING_PARALLAX);
  const sceneY = useSpring(0, SPRING_PARALLAX);
  const moonX = useSpring(0, SPRING_PARALLAX);
  const moonY = useSpring(0, SPRING_PARALLAX);
  useEffect(() => {
    if (reduceMotion) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      sceneX.set(nx * -8);
      sceneY.set(ny * -5);
      moonX.set(nx * -15);
      moonY.set(ny * -9);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, sceneX, sceneY, moonX, moonY]);

  // Э2 · Погладить кота: ни одно касание экрана не должно быть мёртвым.
  // Тап → искренний восторг (искры, широкие зрачки, виляние хвостом) +
  // мурлыканье. Таймер сбрасывается при повторных тапах.
  // Без хаптики: это декоративная шутка лендинга, не продуктовое
  // достижение — вибрация здесь спорила бы по весу с hapticDone на
  // завершении настоящей рабочей сессии.
  const petTimerRef = useRef<number | null>(null);
  function petCat() {
    playPurr();
    setExpression("excited");
    if (petTimerRef.current) window.clearTimeout(petTimerRef.current);
    petTimerRef.current = window.setTimeout(
      () => setExpression("calm"),
      1600,
    );
  }

  // D3 · Раньше 550мс между отправленной репликой и ответом кота были
  // тишиной без единого сигнала — не ноль (мгновенный честный ответ) и не
  // настоящее предвкушение (сигнал «печатает»), а худшее из двух: пауза,
  // которую мозг читает как «сайт завис», а не как «он думает». Тот же
  // паттерн точек, что уже есть в companion-chat.tsx — переиспользован,
  // не изобретён заново.
  const [typing, setTyping] = useState(false);

  function choose(key: ReplyKey) {
    setAnswered(true);
    setExpression("happy");
    try {
      window.localStorage.setItem(INTRO_CHOICE_KEY, key);
    } catch {
      // приватный режим — не критично
    }
    setSteps([{ kind: "visitor", text: REPLIES[key].visitor, replyKey: key }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setSteps((prev) => [
        ...prev,
        { kind: "companion", text: REPLIES[key].companion },
      ]);
    }, 550);
  }

  return (
    <section
      id="hero"
      // calc(100svh - 3.5rem): sticky-шапка h-14 съедает верх вьюпорта —
      // с чистым 100svh низ секции (и скролл-хинт) выталкивались за экран
      className="grain grain-hero relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center overflow-hidden px-4 pb-8 pt-6"
    >
      {/* Атмосфера: ночная сцена с луной и звёздами — иммерсивный фон.
          ВАЖНО: высота сцены зафиксирована 100svh, а не inset-0. На мобильном
          hero выше вьюпорта (контент переполняет min-h), и slice-кроп растягивал
          сцену вертикально: луна опускалась на линию земли, холмы и трава
          уезжали в зону CTA, звёзды мобильной полосы — за кадр. С фиксированной
          высотой композиция сцены совпадает с задуманной при любом контенте. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100svh-3.5rem)]"
      >
        {/* Э6 · Параллакс: при скролле небо отстаёт от контента (сцена
            +10svh, луна +16svh к концу первого экрана) — мир глубже экрана.
            Только браузеры со scroll-driven animations, только motion-safe */}
        <div className="parallax-scene h-full w-full">
          {/* А6: мышиная глубина живёт на вложенном слое (scale 1.03 прячет
              кромки при сдвиге), scroll-параллакс — на внешнем: трансформы
              не воюют */}
          <motion.div
            style={{ x: sceneX, y: sceneY, scale: 1.03 }}
            className="h-full w-full"
          >
            <HeroScene />
          </motion.div>
        </div>
        {/* Луна привязана к углу вьюпорта, а не к slice-сцене: видна целиком
            на любом экране, никогда не сталкивается с котом и текстом */}
        <div className="parallax-moon absolute right-1 top-6 w-24 md:right-[5%] md:top-[7%] md:w-28">
          <motion.div style={{ x: moonX, y: moonY }} className="relative">
          {/* А5 · Пылинки в лунном свете: живут в viewport-слое (урок
              светлячков — не в slice-сцене), дрейф на пороге различимости */}
          <span className="mote absolute left-[16%] top-[64%] size-[3px] rounded-full bg-[oklch(0.9_0.03_95)] opacity-[0.17]" />
          <span className="mote mote-2 absolute left-[42%] top-[46%] size-[2px] rounded-full bg-[oklch(0.9_0.03_95)] opacity-[0.12]" />
          {/* Э7 · Облако: едва заметный силуэт дрейфует у луны, 60s цикл.
              Классическая форма кучевого облачка: ровный тонкий низ + два
              мягких бугра сверху — первый вариант из трёх эллипсов в ряд
              читался «сигарой», особенно на десктопе */}
          <svg
            viewBox="0 0 140 44"
            className="cloud-drift absolute -left-20 top-12 w-28 opacity-[0.05]"
          >
            <g fill="oklch(0.9 0.01 210)">
              <ellipse cx="70" cy="34" rx="52" ry="7" />
              <ellipse cx="52" cy="24" rx="24" ry="12" />
              <ellipse cx="88" cy="27" rx="18" ry="9" />
            </g>
          </svg>
          <Moon className="w-full" />
          </motion.div>
        </div>
      </div>

      {/* Продолжение земли под сценой: на мобильном hero длиннее 100svh,
          и без этого слоя зона ответов и CTA висела на плоском чёрном фоне —
          мир заканчивался на первом экране. Градиент продолжает тон холма
          вниз, травяная кромка прижимает низ hero к земле. На вьюпортах,
          где hero = 100svh, слой схлопывается в ноль и не рендерит ничего. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 top-[calc(100svh-3.5rem)] overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.2 0.01 130) 0%, oklch(0.185 0.012 138) 55%, oklch(0.19 0.016 148) 100%)",
          }}
        />
        <svg
          className="absolute inset-x-0 bottom-0 h-10 w-full"
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
        >
          <g stroke="oklch(0.155 0.014 135)" strokeLinecap="round" fill="none">
            <path d="M36 40 Q39 18 46 10" strokeWidth="5" />
            <path d="M46 40 Q48 24 44 16" strokeWidth="4" />
            <path d="M57 40 Q60 26 66 20" strokeWidth="4" />
            <path d="M338 40 Q342 16 350 8" strokeWidth="5" />
            <path d="M350 40 Q352 26 347 18" strokeWidth="4" />
            <path d="M361 40 Q364 22 371 14" strokeWidth="4" />
          </g>
        </svg>
      </div>

      <div className="hero-stack relative flex w-full max-w-md flex-col items-center gap-4 text-center lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-center lg:gap-x-16 lg:text-left">
        {/* Десктоп по референсу: оффер слева, существо и живой чат справа.
            На мобильном обе колонки схлопываются в display:contents,
            порядок кадра задают order-классы (сцена → промис → чат → CTA) */}
        <div className="contents lg:flex lg:flex-col lg:items-start lg:gap-5">
          {/* Промис голосом персонажа: первая фраза — боль, вторая —
            обещание от первого лица. Каракуля — под словом обещания */}
          <h1
            className="hero-title hero-rise order-2 mt-2 text-balance font-bold md:text-5xl lg:order-none lg:mt-0"
            style={{ "--rise-delay": "0.32s" } as CSSProperties}
          >
            {/* Тёплый «прогрев» слов остывает до резкого текста ровно к
              моменту, когда начинает рисоваться каракуля (0.95s) — взгляд
              сперва ловит проявление света, потом штрих */}
            <span className="chroma-appear">
              {/* Я прихожу: однобуквенное слово не оставляем в конце
                  строки — перенос уходит на границу предложений, и кадр
                  читается как «проблема / обещание», по строке на мысль */}
              Начать трудно. Я прихожу{" "}
              <span
                className="scribble-underline scribble-draw scribble-ink"
                style={{ "--scribble-delay": "0.95s" } as CSSProperties}
              >
                первым
                <svg
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 Q 22 2 42 6 T 78 5 Q 90 5 98 7"
                    pathLength={1}
                  />
                  {/* Второй проход штриха: настоящая каракуля рисуется в два
                    движения с разным нажимом — идеальная дуга выдаёт машину.
                    Только с md: на мобильном кегле два штриха сливались в
                    одну жирную полосу-маркер */}
                  <path
                    d="M4 10 Q 30 6 55 8 T 97 9"
                    pathLength={1}
                    className="hidden md:block"
                    style={{
                      strokeWidth: 2.5,
                      opacity: 0.55,
                      animationDelay: "1.35s",
                    }}
                  />
                </svg>
              </span>
              {/* Точка приклеена к слову: отдельным текстовым узлом она
                  уезжала на следующую строку одна. Под росчерком её нет —
                  подчёркивание не заходит под знак препинания. */}
              <span className="-ml-[0.06em]">.</span>
            </span>
          </h1>

          {/* Подзаголовок: конкретика + дифференциатор. Визуально ТИШЕ
              заголовка на два шага (кегль, тон, ширина колонки): на экране
              один главный текст — обещание H1; sub объясняет, не спорит */}
          <p
            className="hero-rise order-3 max-w-[32ch] text-pretty text-[16px] leading-[1.5] text-foreground/72 md:text-base lg:order-none lg:max-w-[44ch]"
            style={{ "--rise-delay": "0.46s" } as CSSProperties}
          >
            {/* Первое лицо, как и H1: два голоса в одном кадре — шов.
                Имя продукта остаётся в шапке прямо над заголовком.
                Кегль 16, а не 15: отношение к H1 остаётся 2.6x (порог «display
                >= 2.5x body»), но абсолютная читаемость выше, а /72 вместо /60
                выводит пару из AA (6.58:1) в AAA (замер contrast.py). Аудитория
                продукта читает этот экран уставшей — на hero-копии берём AAA.
                «Без стриков. Без стыда.» отсюда снято: строка дословно живёт
                в секции «Я обещаю» и в футере, а на первом экране она была
                четвёртым текстовым блоком и тянула вес у действия. */}
            Я сижу рядом, пока ты работаешь, и&nbsp;выращиваю остров из твоих
            стартов.
          </p>

          {/* Главный CTA: на мобильном — последний в кадре (order-5), на
            десктопе — в текстовой колонке сразу под оффером */}
          <div
            // id для шапки: HeaderCta наблюдает за этим блоком и показывает
            // свой «Начать» ровно тогда, когда hero-CTA не виден — инвариант
            // «в кадре всегда есть ровно одно primary-действие»
            id="hero-cta"
            className="hero-rise order-5 mt-3 flex w-full flex-col items-center gap-2.5 lg:order-none lg:mt-1 lg:items-start"
            style={{ "--rise-delay": "0.78s" } as CSSProperties}
          >
            <motion.div
              animate={ctaBoost ? { scale: [1, 1.045, 1] } : {}}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="w-full sm:w-auto"
            >
              <Button
                render={<Link href="/app" />}
                nativeButton={false}
                size="lg"
                onClick={(e: React.MouseEvent) => {
                  if (navigating) {
                    e.preventDefault();
                    return;
                  }
                  setNavigating(true);
                }}
                // Закон света: UI не светится неоном — но и не плоский.
                // Объём леденца: блик по верхней кромке + тёплая тень нижней
                // грани внутри заливки + чёрная тень вовне. Заметность — у
                // самой светлоты primary, ярчайшей поверхности кадра.
                // rounded-2xl: радиус единый с чипами и пузырём. А4: после
                // ответа в диалоге кнопка «нагревается» — тёплая нижняя грань
                // усиливается (событийное изменение, дофаминовый мостик
                // диалог → действие), переход мягкий 700мс.
                // .press-warm, не .press: transition — shorthand-свойство,
                // .press (transform 120ms) и отдельный transition-shadow на
                // одном элементе не складываются — тень никогда не
                // «нагревалась» бы плавно.
                className={`press-warm min-h-[52px] w-full max-w-xs rounded-2xl font-semibold sm:w-auto sm:px-10 ${
                  ctaBoost
                    ? "shadow-[inset_0_1px_0_oklch(1_0_0/0.5),inset_0_-9px_18px_-9px_oklch(0.68_0.17_75/0.75),0_14px_30px_-14px_oklch(0_0_0/0.6)]"
                    : "shadow-[inset_0_1px_0_oklch(1_0_0/0.45),inset_0_-8px_16px_-10px_oklch(0.55_0.18_130/0.6),0_14px_28px_-14px_oklch(0_0_0/0.6)]"
                }`}
              >
                {navigating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Иду…
                  </>
                ) : (
                  // Без стрелки в тексте: frontend-design (anthropics)
                  // относит «'→' appended to link and button text» к
                  // шаблонной обвязке, которая появляется у ИИ независимо
                  // от предмета. Кнопка и так говорит, что произойдёт.
                  "Начать первое дело"
                )}
              </Button>
            </motion.div>
            {/* Осознанное отступление от taste-skill §4.7 (он запрещает любую
                мелкую подпись под CTA в hero). Оставлено намеренно: строка
                снимает главное возражение ровно в точке решения, а не через
                экран, и после перестановки порядка под кнопкой осталось
                160+px свободной высоты — структурно она больше ничего не
                выталкивает. Регистрации и карты в продукте действительно нет,
                так что это факт, а не маркетинговый шум. */}
            {/* Одна человеческая фраза вместо мета-строки через среднюю
                точку: «meta strings joined with middle dots (A · B · C)» —
                из того же списка шаблонной обвязки. Работу свою строка
                делает ту же: снимает возражение про деньги и регистрацию
                ровно в точке решения. */}
            <span className="text-[13px] font-medium text-muted-foreground">
              Бесплатно, без карты и регистрации
            </span>
          </div>
        </div>

        <div className="contents lg:flex lg:flex-col lg:items-center lg:gap-2">
          {/* Существо в пятне света очага. На коротких экранах сцена
            ужимается, чтобы CTA оставался над сгибом */}
          {/* Порог 860px (был 740px): реальный iPhone отдаёт странице ~810px —
              компрессия не срабатывала, и чипы ответа уезжали за сгиб */}
          <div className="hero-scene relative order-1 flex origin-bottom flex-col items-center lg:order-none">
            {/* Э5 · Очаг дышит: внешний div держит позиционирование
                (translate), внутренний — только scale-пульс в такт дыханию
                кота. Очаг ТЁПЛЫЙ (hue 55): лайм зарезервирован за глазами,
                «первым» и CTA */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/4"
            >
              <div className="hearth-breathe h-full w-full rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.72_0.17_55/0.22)_0%,transparent_70%)] blur-2xl" />
            </div>
            {/* Э2 · Кот гладится: кнопка без визуального хрома, отклик —
                сам персонаж (восторг + хаптика) */}
            <button
              type="button"
              onClick={petCat}
              aria-label="Погладить напарника"
              className="press relative z-10 cursor-pointer rounded-full outline-offset-8"
            >
              <MascotSvg
                expression={expression}
                size={196}
                label=""
                className="lg:origin-bottom lg:scale-[1.15]"
              />
            </button>
            <GroundPool className="-mt-12 -mb-12" />
          </div>

          {/* Живой чат-вход: он здоровается, ты отвечаешь — премиальная реплика.
              Порядок кадра вернулся к авторскому (диалог перед действием):
              прятать реплики было неверно, они и есть отличительная часть
              экрана. Кнопка помещается не за счёт их выселения, а за счёт
              того, что вся композиция стала компактнее — сцена ужимается по
              высоте экрана, заголовок влезает в две строки, ушли скролл-хинт
              и четвёртый текстовый блок. */}
          <div
            className="hero-rise order-4 mt-1 flex w-full flex-col gap-2.5 lg:order-none"
            style={{ "--rise-delay": "0.62s" } as CSSProperties}
            aria-live="polite"
          >
            {/* LayoutGroup — общий контекст FLIP-морфа: layoutId чипа и
                реплики должны жить в одной группе */}
            <LayoutGroup>
            {/* Атрибуция реплики: на десктопе пузырь висит прямо под существом —
                работает хвостик. На мобильном атрибуцию несут сама фраза
                («Привет. Я Напарник») и живой кот в шапке — аватар у пузыря
                был третьим котом в кадре и снят по правилу «убери один
                аксессуар» (выбор владельца, вариант Б). */}
            <div className="flex self-start">
              {/* А7: ближний к сцене пузырь ловит тепло очага нижней кромкой
                  стекла — свет мира касается материала */}
              <div className="glass-hearthside relative max-w-[92%] rounded-2xl rounded-tl-sm px-5 py-3.5 text-left">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 14 10"
                  className="absolute -top-[9px] left-7 hidden h-[10px] w-[14px] text-white/25 lg:block"
                >
                  <path
                    d="M2 10 Q 5 4 12 1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <WordReveal
                  text={OPENING_LINE}
                  startDelay={0.85}
                  className="font-hand text-xl leading-snug text-secondary-foreground md:text-2xl"
                />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {steps.map((step, i) =>
                step.kind === "companion" ? (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING_SNAPPY}
                    className="max-w-[92%] self-start rounded-2xl rounded-tl-sm border border-white/5 bg-secondary/85 px-5 py-3.5 text-left shadow-xl backdrop-blur-md"
                  >
                    <TypedLine
                      text={step.text}
                      onDone={() => setCtaBoost(true)}
                    />
                  </motion.div>
                ) : (
                  // Э3 · Морф-приёмник: реплика наследует layoutId чипа —
                  // выбранный чип физически перелетает и становится
                  // сообщением (непрерывность объекта, не телепорт)
                  <motion.div
                    key={i}
                    layoutId={
                      step.replyKey ? `reply-${step.replyKey}` : undefined
                    }
                    initial={
                      step.replyKey ? false : { opacity: 0, y: 12, scale: 0.97 }
                    }
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING_SNAPPY}
                    className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-primary px-5 py-2.5 shadow-[0_8px_20px_-10px_oklch(0_0_0/0.6)]"
                  >
                    <p className="text-sm font-semibold leading-relaxed text-primary-foreground">
                      {step.text}
                    </p>
                  </motion.div>
                ),
              )}
              {typing && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING_SNAPPY}
                  className="flex items-center gap-1 self-start rounded-2xl rounded-tl-sm border border-white/5 bg-secondary/85 px-4 py-3 shadow-xl backdrop-blur-md"
                  aria-label="Напарник печатает"
                >
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
                    style={{ animationDelay: "-0.3s" }}
                  />
                  <span
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
                    style={{ animationDelay: "-0.15s" }}
                  />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* К-А · Диалог замыкается действием: после ответа существа в
                чате появляется кнопка-продолжение — раньше разговор был
                тупиком («Пойдём, покажу» — и ничего). Тихий glass-highlight:
                командный лайм остаётся за главным CTA ниже */}
            {ctaBoost && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING_SNAPPY}
                className="self-start"
              >
                <Link
                  href="/app"
                  className="glass-highlight press inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm font-semibold text-primary"
                >
                  Пойдём попробуем
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </motion.div>
            )}

            {/* Ряд «поля письма»: слева рукописная приписка к реплике
                напарника (стрелка вверх — на его пузырь: он придёт первым,
                даже если ты пропал), справа — чипы твоих ответов. Заметка
                больше не рвёт поток по центру и не тычет стрелкой в лес. */}
            <div className="flex flex-col items-start gap-3 pt-0.5 min-[360px]:flex-row min-[360px]:items-start">
              <div
                className="flex min-w-0 flex-1 items-start gap-1.5 pl-1"
                style={{ color: "oklch(0.85 0.15 88 / 0.85)" }}
              >
                <svg
                  viewBox="0 0 20 24"
                  className="mt-0.5 h-5 w-4 shrink-0 opacity-80"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M16 22 Q 6 18 7 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 10 L7 4 L11 9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="-rotate-2 text-left font-hand text-base leading-tight">
                  даже если ты
                  <br />
                  пропал на&nbsp;неделю
                </p>
              </div>
              <AnimatePresence>
                {!answered && (
                  <motion.div
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex shrink-0 flex-col items-end gap-2 self-end min-[360px]:self-auto"
                  >
                    {(Object.keys(REPLIES) as ReplyKey[]).map((key) => (
                      // Э3+Э4 · Чип: настоящая кнопка (не Link с preventDefault),
                      // при выборе FLIP-морфится в отправленную реплику через
                      // layoutId; при появлении по стеклу проходит лунный блик
                      <motion.button
                        key={key}
                        type="button"
                        layoutId={`reply-${key}`}
                        onClick={() => choose(key)}
                        // Микро-магнетизм: существо радуется, когда ты тянешься
                        // ответить — сцена откликается на намерение раньше действия
                        onMouseEnter={() => setExpression("happy")}
                        onMouseLeave={() => setExpression("calm")}
                        // Реплики легче команды: чипы — «что сказать», CTA —
                        // «что сделать». Один командный вес на экран
                        className="group glass glass-interactive glass-shine press inline-flex min-h-11 items-center whitespace-nowrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {REPLIES[key].visitor}
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </LayoutGroup>
          </div>
        </div>
      </div>

      {/* Подсказка скролла «листай — покажу» снята: taste-skill §9.F
          относит scroll cue к прямым запретам, и по делу — человек, который
          ещё не скроллил, смотрит на первый экран и уже знает, что такое
          скролл. Ниже сгиба теперь начинается диалог, его верхняя кромка
          сама показывает, что страница продолжается. */}
    </section>
  );
}
