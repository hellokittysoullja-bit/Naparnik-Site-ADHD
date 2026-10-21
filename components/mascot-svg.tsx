"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  useSpring,
  type TargetAndTransition,
} from "motion/react";
import {
  EAR_L_PIVOT,
  EAR_R_PIVOT,
  EYE,
  EYE_L,
  EYE_R,
  EYE_RX,
  EYE_RY,
  FUR,
  GROUND,
  INK,
  L,
  MOUTH,
  NECK,
  OUTLINE,
  PAPER,
  PAW_C,
  PENCIL,
  SHOULDER,
  VIEWBOX,
  type Layer,
} from "@/components/mascot-geometry";
import { SPRING_GAZE } from "@/lib/motion";

/**
 * Кот-напарник — ОРИГИНАЛЬНЫЙ рисунок владельца, разрезанный на слои и
 * посаженный на кости (cutout-риг, как в Spine/Rive). Кот совпадает с
 * референсом до пикселя, а двигается как персонаж.
 *
 * Как устроена «жизнь» (по разбору аниматоров из базы знаний:
 * Neistadt «Keep Alive», AnimSchool про idle-циклы, Kouhi про дыхание):
 *
 * — Idle-слои на CSS (globals.css, «Напарник: idle-риг»): дыхание 4.6 с,
 *   вдох короче выдоха, с удержанием на пике; голова едет за грудью с
 *   задержкой (follow-through); хвост качается на своём, некратном
 *   дыханию периоде, а завиток догоняет его с отставанием (overlapping
 *   action); огонёк дрожит на третьей частоте. Шов цикла не ловится.
 * — Редкие события на JS со случайным интервалом: моргание (иногда
 *   двойное, иногда медленное «кошачье доверие»), зрачки чуть расширяются
 *   после моргания и сужаются с перелётом, дёрнулось ухо, уравновешенный
 *   взгляд в сторону, наклон головы, зевок от скуки, редкий большой вздох.
 * — Действия (prop `action`) — Motion-хореографии с anticipation,
 *   перелётом и settle: машет лапой, пишет в блокноте, думает, радуется.
 * — Тап по коту — real-time отклик: squash & stretch, уши, прищур;
 *   каждый третий тап — машет в ответ.
 *
 * Reduced motion: CSS-слои гасятся медиазапросом, действия показываются
 * статичной позой — смысл (машет / пишет) сохраняется без движения.
 */

export type MascotExpression =
  "calm" | "happy" | "focused" | "sleepy" | "excited" | "listening";

/** Что кот делает руками/телом поверх выражения лица */
export type MascotAction = "idle" | "wave" | "write" | "think" | "celebrate";

type MouthShape = "w" | "smile" | "flat";

type MascotSvgProps = {
  expression?: MascotExpression;
  action?: MascotAction;
  size?: number;
  label?: string;
  className?: string;
  /** Тап по коту даёт живой отклик (по умолчанию да) */
  interactive?: boolean;
};

/** Старые единицы риг-хореографий (viewBox 200) → пиксели рисунка */
const K = 4.55;

/**
 * Опора для вращения в координатах рисунка. originX/originY, а не
 * transformOrigin: Motion собирает origin сам и молча перезаписывает
 * строковый transformOrigin на «50% 50%» (поймано рендером).
 */
const pivot = (p: { x: number; y: number }) =>
  ({
    transformBox: "view-box",
    originX: `${p.x}px`,
    originY: `${p.y}px`,
  }) as const;

/** Слой рисунка на своём месте */
export function Img({ l }: { l: Layer }) {
  return (
    <image
      href={l.href}
      x={l.x}
      y={l.y}
      width={l.w}
      height={l.h}
      preserveAspectRatio="none"
    />
  );
}

/* ── «Пишет»: одна траектория для лапы, карандаша и чернил ───────────
   Лапа вращается вокруг плеча и подрагивает вверх-вниз (почерк);
   кончик карандаша вычисляется той же формулой поворота, а линия
   проявляется по накопленной длине пути — чернила выходят ровно из-под
   грифеля, без рассинхрона. */
const WRITE_DUR = 3.6;
const WRITE_N = 44;
const WRITE_END = 0.64;
const PENCIL_TIP = { x: 448, y: 766 };

function tipAt(thetaDeg: number, wy: number) {
  const t = (thetaDeg * Math.PI) / 180;
  const dx = PENCIL_TIP.x - SHOULDER.x;
  const dy = PENCIL_TIP.y + wy - SHOULDER.y;
  return {
    x: SHOULDER.x + dx * Math.cos(t) - dy * Math.sin(t),
    y: SHOULDER.y + dx * Math.sin(t) + dy * Math.cos(t),
  };
}

const WRITE = (() => {
  const times: number[] = [];
  const arm: number[] = [];
  const paw: number[] = [];
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < WRITE_N; i++) {
    const u = i / (WRITE_N - 1);
    const eased = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const theta = 11 - 20 * eased;
    // почерк: петли разной высоты, а не ровная синусоида
    const wy = -1.7 * K * Math.sin(u * Math.PI * 2 * 5.5) * (0.7 + 0.3 * Math.sin(u * 9));
    times.push(u * WRITE_END);
    arm.push(theta);
    paw.push(wy);
    pts.push(tipAt(theta, wy));
  }
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = acc[acc.length - 1];
  const ink = acc.map((a) => a / total);
  // отрыв: карандаш поднимается и возвращается к началу строки
  times.push(0.72, 0.82, 0.88, 1);
  arm.push(4, 11, 11, 11);
  paw.push(-5 * K, -4 * K, 0, 0);
  const inkTimes = [...times.slice(0, WRITE_N), 0.9, 0.97, 1];
  const inkVals = [...ink, 1, 1, 0];
  const inkOpacity = [...ink.map(() => 1), 1, 0, 0];
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  return { times, arm, paw, inkTimes, inkVals, inkOpacity, d };
})();

/* ── «Машет»: подъём с anticipation и перелётом, кисть отстаёт ──────── */
const WAVE = {
  duration: 2.8,
  times: [0, 0.09, 0.27, 0.39, 0.51, 0.63, 0.75, 0.86, 1],
  arm: [0, -7, 124, 110, 128, 110, 126, 116, 0],
  // кисть разворачивает подушечки к зрителю и «доигрывает» взмах
  paw: [0, 6, -136, -104, -144, -104, -140, -122, 0],
  ease: [
    "easeOut",
    [0.34, 1.56, 0.64, 1],
    "easeInOut",
    "easeInOut",
    "easeInOut",
    "easeInOut",
    "easeInOut",
    [0.65, 0, 0.35, 1],
  ] as const,
};

/** Поза поднятой лапы для reduced motion — смысл «машет» без движения */
const WAVE_STILL = { arm: 116, paw: -122 };

/* ── Рты: латка меха рисунка закрывает родное «ω»; улыбка и «ровный»
   рот — это само родное «ω», растянутое; «о» и открытый рот — вектор
   (на рисунке их нет) ────────────────────────────────────────────── */
function Mouth({ shape }: { shape: MouthShape }) {
  if (shape === "w") return null; // родной рот рисунка
  return (
    <g>
      <Img l={L.mouthFur} />
      {shape === "smile" && (
        <g transform="translate(615 470) scale(1.32 1.55) translate(-615 -470)">
          <Img l={L.mouth} />
        </g>
      )}
      {shape === "flat" && (
        <g transform="translate(615 470) scale(0.8 0.55) translate(-615 -470)">
          <Img l={L.mouth} />
        </g>
      )}
    </g>
  );
}

/** Верхнее веко — мех самого рисунка, которым залатан глаз */
function Lid({ side }: { side: "l" | "r" }) {
  return <Img l={side === "l" ? L.eyeFurL : L.eyeFurR} />;
}

/** Закрытый глаз (сон, ожидание): мех рисунка + родная нижняя дуга обводки */
function ClosedEye({ side }: { side: "l" | "r" }) {
  return (
    <>
      <Img l={side === "l" ? L.eyeFurL : L.eyeFurR} />
      <Img l={side === "l" ? L.eyeArcL : L.eyeArcR} />
    </>
  );
}

export function MascotSvg({
  expression = "calm",
  action = "idle",
  size = 160,
  label,
  className,
  interactive = true,
}: MascotSvgProps) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Перф-гейт: на лендинге живёт 5+ инстансов существа — глаза, таймеры
  // и CSS-слои работают только у видимых котов.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sleepy = expression === "sleepy";
  const focused = expression === "focused";
  const happy = expression === "happy";
  const excited = expression === "excited" || action === "celebrate";
  // listening: человек надолго замолчал в поле ввода — существо прикрывает
  // глаза и ждёт, терпеливо, не засыпая: та же дуга глаз, что у sleepy,
  // но без zzz и с ушами торчком — «слушаю, не тороплю».
  const listening = expression === "listening";
  const eyesClosed = sleepy || listening;
  const alive = inView && !reduceMotion;

  /* «Скучает»: долго никто не двигает курсор и не листает — кот зевает
     (State Machine idle → idle_bored → idle). Не чаще раза в ~40 с. */
  const [yawn, setYawn] = useState(false);

  // Рты только из рисунка: родное «ω», растянутое в улыбку или
  // приплюснутое — на рисунке нет «о» и открытого рта, их не выдумываем.
  const mouth: MouthShape =
    excited || yawn || action === "wave" || happy
      ? "smile"
      : focused || action === "write"
        ? "flat"
        : "w";

  /* ── Взгляд ─────────────────────────────────────────────────────── */
  const px = useSpring(0, SPRING_GAZE);
  const py = useSpring(0, SPRING_GAZE);
  const tilt = useSpring(0, { stiffness: 90, damping: 14 });
  const lastPointer = useRef(0);
  // куда смотрит действие: в блокнот, вверх «в мысль» — или куда угодно
  const actionGaze =
    action === "write"
      ? { x: -3.2, y: 4.2, tilt: -5 }
      : action === "think"
        ? { x: 3.8, y: -4.4, tilt: 6 }
        : action === "wave"
          ? { x: -1, y: 0, tilt: -4 }
          : null;

  useEffect(() => {
    if (!alive || sleepy) {
      px.set(0);
      py.set(0);
      tilt.set(0);
      return;
    }
    if (actionGaze) {
      px.set(actionGaze.x * K);
      py.set(actionGaze.y * K);
      tilt.set(actionGaze.tilt);
      return;
    }
    tilt.set(0);
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      lastPointer.current = performance.now();
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.44;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 1.2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 1.2)));
      px.set(dx * 5 * K);
      py.set(dy * 4 * K);
    };
    // На таче pointermove мёртв: листаешь — кот провожает взглядом,
    // через полсекунды покоя глаза возвращаются к центру.
    let lastY = window.scrollY;
    let settle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (Math.abs(dy) < 2) return;
      lastPointer.current = performance.now();
      py.set(Math.max(-1, Math.min(1, dy / 48)) * 4.5 * K);
      clearTimeout(settle);
      settle = setTimeout(() => py.set(0), 500);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(settle);
    };
    // actionGaze выводится из action — зависимость по action достаточна
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive, sleepy, action, px, py, tilt]);

  /* ── Редкие события idle: моргание, ухо, взгляд, наклон головы ──── */
  const [blink, setBlink] = useState<"open" | "shut" | "slow">("open");
  const pupilsCtl = useAnimationControls();
  const earL = useAnimationControls();
  const earR = useAnimationControls();
  const rootCtl = useAnimationControls();

  useEffect(() => {
    if (!alive || eyesClosed) return;
    let live = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (live) fn();
      }, ms);
      timers.add(t);
    };
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    // моргание: закрытие быстрое, открытие мягче; после — зрачок
    // чуть шире (за веком темно) и сужается с перелётом
    const openEyes = () => {
      setBlink("open");
      void pupilsCtl.start({
        scale: [1.1, 0.96, 1],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    };
    const blinkLoop = () => {
      later(() => {
        const roll = Math.random();
        if (roll < 0.1) {
          // медленное моргание — кошачье «я тебе доверяю»
          setBlink("slow");
          later(openEyes, 560);
        } else {
          setBlink("shut");
          later(() => {
            openEyes();
            if (roll > 0.86) {
              later(() => {
                setBlink("shut");
                later(openEyes, 110);
              }, 170);
            }
          }, 120);
        }
        blinkLoop();
      // раз в несколько циклов дыхания, не на каждый вдох (AnimSchool):
      // слишком частое моргание читается «роботно»
      }, rnd(4000, 11000));
    };
    blinkLoop();

    // ухо дёргается то левое, то правое — асимметрия живее синхрона
    let earSide = Math.random() < 0.5;
    const earLoop = () => {
      later(() => {
        earSide = !earSide;
        void (earSide ? earL : earR).start({
          rotate: [0, earSide ? -13 : 13, earSide ? 3 : -3, 0],
          transition: { duration: 0.5, times: [0, 0.25, 0.6, 1], ease: "easeOut" },
        });
        earLoop();
      }, rnd(7000, 15000));
    };
    earLoop();

    // взгляд в сторону и наклон головы — только в покое и без курсора;
    // уравновешенно: посмотрел влево — потом посмотрит вправо
    let glanceSide = Math.random() < 0.5 ? -1 : 1;
    const glanceLoop = () => {
      later(() => {
        if (action === "idle" && performance.now() - lastPointer.current > 2500) {
          glanceSide = -glanceSide;
          px.set(glanceSide * 3.6 * K);
          py.set(rnd(-1.5, 1.2) * K);
          if (Math.random() < 0.45) tilt.set(glanceSide * 3.5);
          later(() => {
            px.set(0);
            py.set(0);
            tilt.set(0);
          }, rnd(1100, 2200));
        }
        glanceLoop();
      }, rnd(3800, 8200));
    };
    glanceLoop();

    const boredLoop = () => {
      later(() => {
        if (action === "idle" && performance.now() - lastPointer.current > 20000) {
          setYawn(true);
          tilt.set(-6);
          void earL.start({ rotate: -10, transition: { duration: 0.5 } });
          void earR.start({ rotate: 10, transition: { duration: 0.5 } });
          later(() => {
            setYawn(false);
            tilt.set(0);
            void earL.start({ rotate: 0, transition: { duration: 0.6 } });
            void earR.start({ rotate: 0, transition: { duration: 0.6 } });
          }, 1700);
        }
        boredLoop();
      }, rnd(26000, 40000));
    };
    boredLoop();

    // большой вздох раз в 4–5 циклов дыхания — редкое событие на фоне
    // «ровного контраста» обычных вдохов
    const sighLoop = () => {
      later(() => {
        if (action === "idle") {
          void rootCtl.start({
            scaleY: [1, 1.045, 1.045, 1],
            scaleX: [1, 1.015, 1.015, 1],
            transition: { duration: 2.2, times: [0, 0.35, 0.5, 1], ease: "easeInOut" },
          });
        }
        sighLoop();
      }, rnd(21000, 30000));
    };
    sighLoop();

    return () => {
      live = false;
      timers.forEach(clearTimeout);
    };
  }, [alive, eyesClosed, action, pupilsCtl, earL, earR, px, py, tilt, rootCtl]);

  /* ── Корневая группа: прыжки радости и отклик на тап ────────────── */
  const [squint, setSquint] = useState(false);
  // повторные тапы не должны давать одно и то же (привыкание): каждый
  // третий — кот машет в ответ
  const [tapWave, setTapWave] = useState(false);

  useEffect(() => {
    if (action !== "celebrate" || !alive) return;
    // anticipation (присел) → прыжок с вытяжкой → приземление со сжатием → settle
    void rootCtl.start({
      y: [0, 2.5 * K, -20 * K, 0, -7 * K, 0],
      scaleY: [1, 0.88, 1.08, 0.9, 1.03, 1],
      scaleX: [1, 1.08, 0.95, 1.08, 0.99, 1],
      transition: {
        duration: 1.15,
        times: [0, 0.16, 0.42, 0.62, 0.8, 1],
        ease: "easeOut",
        repeat: 1,
        repeatDelay: 0.25,
      },
    });
  }, [action, alive, rootCtl]);

  // «Мешок» реакций (как мешок фигур в Tetris): порядок случайный, но за
  // цикл выпадает каждая и без повторов подряд — тап не приедается и нет
  // долгой «засухи» без любимой реакции.
  const bag = useRef<string[]>([]);
  const lastReaction = useRef("");
  const nextReaction = () => {
    if (bag.current.length === 0) {
      const all = ["squash", "ears", "wave", "squash", "slowblink"];
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      if (all[all.length - 1] === lastReaction.current) all.reverse();
      bag.current = all;
    }
    const r = bag.current.pop() as string;
    lastReaction.current = r;
    return r;
  };

  const squash = () =>
    void rootCtl.start({
      y: [0, 1.5 * K, -5 * K, 0],
      scaleY: [1, 0.9, 1.05, 1],
      scaleX: [1, 1.07, 0.97, 1],
      transition: { duration: 0.46, times: [0, 0.22, 0.6, 1], ease: "easeOut" },
    });

  const poke = () => {
    if (!interactive || !alive) return;
    const r = nextReaction();
    if (r === "squash" || r === "wave") squash();
    void earL.start({ rotate: [0, -12, 2, 0], transition: { duration: 0.42 } });
    void earR.start({ rotate: [0, 12, -2, 0], transition: { duration: 0.42, delay: 0.04 } });
    if (r === "slowblink") {
      setBlink("slow");
      setTimeout(() => setBlink("open"), 560);
    } else {
      setSquint(true);
      setTimeout(() => setSquint(false), 380);
    }
    if (r === "wave" && action === "idle" && !tapWave) {
      setTapWave(true);
      setTimeout(() => setTapWave(false), WAVE.duration * 1000 + 100);
    }
  };

  // Пасхалка: долгое нажатие — «гладишь» кота: он жмурится и тянется
  // мордочкой, пока держишь палец (ответ на неожиданное действие).
  const [petting, setPetting] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDown = () => {
    poke();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      setPetting(true);
      tilt.set(7);
    }, 550);
  };
  const onUp = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (petting) {
      setPetting(false);
      tilt.set(0);
    }
  };

  /* ── Лапа-«рука» (левая для зрителя) ────────────────────────────── */
  const armWaving = action === "wave" || action === "celebrate" || tapWave;
  const writing = action === "write";
  const armAnim: TargetAndTransition = reduceMotion
    ? armWaving
      ? { rotate: WAVE_STILL.arm, transition: { duration: 0 } }
      : { rotate: 0, transition: { duration: 0 } }
    : armWaving
      ? {
          rotate: WAVE.arm,
          transition: {
            duration: WAVE.duration,
            times: WAVE.times,
            ease: [...WAVE.ease],
            repeat: action === "wave" ? 1 : 0,
            repeatDelay: 1.6,
          },
        }
      : writing
        ? {
            rotate: WRITE.arm,
            transition: {
              duration: WRITE_DUR,
              times: WRITE.times,
              ease: "linear",
              repeat: Infinity,
            },
          }
        : { rotate: 0, transition: { duration: 0.5, ease: "easeInOut" } };
  const pawAnim: TargetAndTransition = reduceMotion
    ? armWaving
      ? { rotate: WAVE_STILL.paw, y: 0, transition: { duration: 0 } }
      : { rotate: 0, y: 0, transition: { duration: 0 } }
    : armWaving
      ? {
          rotate: WAVE.paw,
          y: 0,
          transition: {
            duration: WAVE.duration,
            times: WAVE.times,
            ease: [...WAVE.ease],
            repeat: action === "wave" ? 1 : 0,
            repeatDelay: 1.6,
          },
        }
      : writing
        ? {
            rotate: 0,
            y: WRITE.paw,
            transition: {
              y: {
                duration: WRITE_DUR,
                times: WRITE.times,
                ease: "linear",
                repeat: Infinity,
              },
              rotate: { duration: 0.3 },
            },
          }
        : { rotate: 0, y: 0, transition: { duration: 0.5, ease: "easeInOut" } };

  /* ── Веки ───────────────────────────────────────────────────────── */
  const lidBase = yawn ? 0.75 : focused ? 0.34 : writing ? 0.22 : 0;
  const lid =
    blink !== "open" || squint ? 1 : petting ? 0.8 : lidBase;
  const lidTransition =
    blink === "slow"
      ? { duration: 0.28, ease: "easeInOut" as const }
      : lid === 1
        ? { duration: 0.06, ease: "easeIn" as const }
        : { duration: 0.11, ease: "easeOut" as const };

  const eye = (side: "l" | "r") => {
    const { x, y } = side === "l" ? EYE_L : EYE_R;
    const clipId = `${uid}-eye-${side}`;
    return (
      <g key={side}>
        <defs>
          <clipPath id={clipId}>
            <ellipse cx={x} cy={y} rx={EYE_RX} ry={EYE_RY} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {/* style — ВСЕГДА, без ветвления по reduceMotion: серверный рендер
              не знает системную настройку, ветвление давало React #418 на
              каждой загрузке у людей с «уменьшить движение». Пружины сами
              держат px/py на нуле, разметка одинакова. */}
          <motion.g
            style={{ x: px, y: py, ...pivot({ x, y }) }}
            initial={{ scale: 1 }}
            animate={pupilsCtl}
          >
            <motion.g
              style={pivot({ x, y })}
              initial={{ scale: 1 }}
              animate={{ scale: excited ? 1.18 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <Img l={side === "l" ? L.pupilL : L.pupilR} />
            </motion.g>
          </motion.g>
          <motion.g
            style={pivot({ x, y: y - EYE_RY - 6 })}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: lid }}
            transition={lidTransition}
          >
            <Lid side={side} />
          </motion.g>
        </g>
      </g>
    );
  };

  const mood = sleepy ? "sleep" : excited ? "excited" : "calm";

  return (
    <svg
      ref={ref}
      viewBox={VIEWBOX}
      width={size}
      height={size}
      className={["cat-rig", className].filter(Boolean).join(" ")}
      data-mood={mood}
      data-paused={inView ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      onPointerDown={interactive ? onDown : undefined}
      onPointerUp={interactive ? onUp : undefined}
      onPointerLeave={interactive ? onUp : undefined}
      onPointerCancel={interactive ? onUp : undefined}
      style={{ overflow: "visible" }}
    >
      {/* контактная тень: кот сидит на земле, а не висит в воздухе */}
      <ellipse cx={690} cy={776} rx={330} ry={20} fill="oklch(0.08 0.01 270)" opacity={0.35} />
      <motion.g style={pivot(GROUND)} initial={{ y: 0, scaleX: 1, scaleY: 1 }} animate={rootCtl}>
        {/* хвост за телом: качается от основания, завиток отстаёт, огонь пляшет */}
        <g className="cat-tail">
          <Img l={L.tailBase} />
          <g className="cat-curl">
            <Img l={L.tailCurl} />
            <g className="cat-flame">
              <Img l={L.flame} />
            </g>
            <circle className="cat-ember" cx={972} cy={268} r={6} fill="oklch(0.85 0.15 75)" />
            <circle className="cat-ember cat-ember--late" cx={948} cy={285} r={4.5} fill="oklch(0.88 0.12 90)" />
          </g>
        </g>

        {/* тело (с правой для зрителя лапой) — дышит от земли */}
        <g className="cat-breathe">
          <Img l={L.body} />
        </g>

        {/* голова едет за грудью с задержкой; наклон — на вложенной группе */}
        <g className="cat-ride">
          <motion.g style={{ rotate: tilt, ...pivot(NECK) }}>
            <motion.g style={pivot(EAR_L_PIVOT)} initial={{ rotate: 0 }} animate={earL}>
              <motion.g
                style={pivot(EAR_L_PIVOT)}
                initial={{ rotate: 0 }}
                animate={{ rotate: listening ? 4 : sleepy ? -8 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Img l={L.earL} />
              </motion.g>
            </motion.g>
            <motion.g style={pivot(EAR_R_PIVOT)} initial={{ rotate: 0 }} animate={earR}>
              <motion.g
                style={pivot(EAR_R_PIVOT)}
                initial={{ rotate: 0 }}
                animate={{ rotate: listening ? -4 : sleepy ? 8 : 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Img l={L.earR} />
              </motion.g>
            </motion.g>
            <Img l={L.head} />
            {eyesClosed ? (
              <>
                <ClosedEye side="l" />
                <ClosedEye side="r" />
              </>
            ) : (
              <>
                {eye("l")}
                {eye("r")}
              </>
            )}
            {/* быстрая подмена формы рта читается как живая мимика (~100 мс) */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.g
                key={sleepy ? "sleep" : mouth}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <Mouth shape={sleepy ? "flat" : mouth} />
              </motion.g>
            </AnimatePresence>
          </motion.g>
        </g>

        {/* блокнот лежит перед лапами, пока кот пишет */}
        <AnimatePresence>
          {writing && (
            <motion.g
              key="notebook"
              style={pivot({ x: 430, y: 780 })}
              initial={{ opacity: 0, y: 26, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, transition: { duration: 0.2, ease: "easeIn" } }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <path d="M300 748 L560 740 L578 806 L282 814Z" fill={PAPER} stroke={OUTLINE} strokeWidth={7} strokeLinejoin="round" />
              <path d="M432 744 L432 810" stroke="oklch(0.75 0.03 90)" strokeWidth={5} />
              <path d="M306 770 L562 763" stroke="oklch(0.8 0.04 240)" strokeWidth={3} opacity={0.8} />
              <path d="M300 792 L570 784" stroke="oklch(0.8 0.04 240)" strokeWidth={3} opacity={0.8} />
              <motion.path
                d={WRITE.d}
                fill="none"
                stroke={INK}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 1 }}
                animate={
                  reduceMotion
                    ? { pathLength: 1, opacity: 1, transition: { duration: 0 } }
                    : {
                        pathLength: WRITE.inkVals,
                        opacity: WRITE.inkOpacity,
                        transition: {
                          duration: WRITE_DUR,
                          times: WRITE.inkTimes,
                          ease: "linear",
                          repeat: Infinity,
                        },
                      }
                }
              />
            </motion.g>
          )}
        </AnimatePresence>

        {/* левая (для зрителя) лапа — машет и пишет; поверх головы, чтобы
            поднятая лапа не пряталась за щёку */}
        <g className="cat-breathe">
          <motion.g style={pivot(SHOULDER)} initial={{ rotate: 0 }} animate={armAnim}>
            <Img l={L.leg} />
            <motion.g style={pivot(PAW_C)} initial={{ rotate: 0, y: 0 }} animate={pawAnim}>
              <AnimatePresence>
                {writing && (
                  <motion.g
                    key="pencil"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path d="M457 754 L540 660" stroke={OUTLINE} strokeWidth={26} strokeLinecap="round" />
                    <path d="M457 754 L540 660" stroke={PENCIL} strokeWidth={17} />
                    <path d="M532 669 L544 655" stroke="oklch(0.72 0.1 10)" strokeWidth={17} strokeLinecap="round" />
                    <path d="M448 766 L452 742 L466 754Z" fill="oklch(0.85 0.06 70)" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
                    <path d="M448 766 L450 757 L455 761Z" fill={INK} />
                  </motion.g>
                )}
              </AnimatePresence>
              <Img l={L.paw} />
            </motion.g>
          </motion.g>
        </g>
      </motion.g>

      {/* мысль: три точки всплывают по очереди — диегетичное «думаю» вместо спиннера */}
      <AnimatePresence>
        {action === "think" && (
          <motion.g
            key="think"
            fill={EYE}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
          >
            {[
              { x: 850, y: 90, r: 16 },
              { x: 905, y: 30, r: 22 },
              { x: 975, y: -40, r: 30 },
            ].map((d, i) => (
              <motion.circle
                key={d.x}
                cx={d.x}
                cy={d.y}
                r={d.r}
                style={pivot(d)}
                initial={{ scale: 0.4, opacity: 0.25 }}
                animate={
                  reduceMotion
                    ? { scale: 1, opacity: 0.85 }
                    : { scale: [0.4, 1.12, 1, 0.4], opacity: [0.25, 1, 0.85, 0.25] }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 1.8,
                        times: [0, 0.25, 0.6, 1],
                        delay: i * 0.22,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
              />
            ))}
          </motion.g>
        )}
      </AnimatePresence>

      {/* zzz во сне */}
      {sleepy && (
        <g className="font-hand" fill={EYE}>
          {[
            { x: 830, y: 120, s: 60, d: 0 },
            { x: 890, y: 50, s: 78, d: 0.5 },
            { x: 960, y: -20, s: 100, d: 1 },
          ].map((z) => (
            /* initial — без ветвления по reduceMotion (React #418): различается
               только animate — при reduced-motion «z» просто стоит видимой. */
            <motion.text
              key={z.x}
              x={z.x}
              y={z.y}
              fontSize={z.s}
              initial={{ opacity: 0, y: 18 }}
              animate={
                reduceMotion
                  ? { opacity: 0.6, y: 0 }
                  : { opacity: [0, 0.9, 0], y: [18, -18, -45] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 2.4, repeat: Infinity, delay: z.d, ease: "easeInOut" }
              }
            >
              z
            </motion.text>
          ))}
        </g>
      )}

      {/* искры в восторге */}
      {excited && (
        <g fill={EYE}>
          {[
            { x: 300, y: 120, d: 0 },
            { x: 900, y: 150, d: 0.35 },
            { x: 830, y: 20, d: 0.7 },
          ].map((sp) => (
            <motion.path
              key={sp.x}
              d="M0 -32 L8 -8 L32 0 L8 8 L0 32 L-8 8 L-32 0 L-8 -8 Z"
              style={{ x: sp.x, y: sp.y }}
              initial={{ scale: 0.5, opacity: 0.4 }}
              animate={
                reduceMotion
                  ? { scale: 1, opacity: 0.9 }
                  : { scale: [0.5, 1.15, 0.5], opacity: [0.4, 1, 0.4] }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 1.4, repeat: Infinity, delay: sp.d, ease: "easeInOut" }
              }
            />
          ))}
        </g>
      )}
    </svg>
  );
}
