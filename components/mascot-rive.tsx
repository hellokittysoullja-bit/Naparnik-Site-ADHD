"use client";

import { useEffect, useRef } from "react";
import {
  Alignment,
  Fit,
  Layout,
  RuntimeLoader,
  useRive,
  useStateMachineInput,
} from "@rive-app/react-canvas";
import type { MascotAction, MascotExpression } from "@/components/mascot-svg";

/**
 * Кот-напарник на Rive — как маскоты Duolingo: один .riv, слоистая state machine
 * (дыхание / хвост на костях и меше / огонёк / моргание / взгляд / наклон /
 * эмоция / рот / уши / действие / вздох / зевок / реакция на тап — параллельные
 * слои), код только двигает входы. Файл собирается из слоёв рисунка владельца
 * скриптом design/mascot/rive/cat.py (hand-written RML + Rive CLI).
 *
 * Здесь же — то, что Rive не умеет сам: слежение за курсором с пружиной,
 * взгляд в сторону/зевок «от скуки», редкий взгляд-наклон.
 */

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

const SM = "Cat";
const EXPRESSION: Record<MascotExpression, number> = {
  calm: 0, happy: 1, focused: 2, sleepy: 3, excited: 4, listening: 5,
};
const ACTION: Record<MascotAction, number> = { idle: 0, wave: 1, write: 2, think: 3, celebrate: 4 };
const MOUTH = { w: 0, smile: 1, flat: 2, open: 3, o: 4 } as const;

type Props = {
  expression?: MascotExpression;
  action?: MascotAction;
  size?: number;
  label?: string;
  className?: string;
  interactive?: boolean;
  /** Для лаборатории и тестов: отдать наружу входы state machine */
  onReady?: (api: MascotRiveApi) => void;
};

export type MascotRiveApi = {
  set: (name: string, value: number) => void;
  fire: (name: string) => void;
};

export function MascotRive({
  expression = "calm",
  action = "idle",
  size = 160,
  label,
  className,
  interactive = true,
  onReady,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const { rive, RiveComponent } = useRive({
    src: "/mascot/naparnik-cat.riv",
    stateMachines: SM,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  });

  const num = (n: string, v = 0) => useStateMachineInput(rive, SM, n, v); // eslint-disable-line react-hooks/rules-of-hooks
  const gazeX = num("gazeX");
  const gazeY = num("gazeY");
  const tilt = num("tilt");
  const expr = num("expression");
  const act = num("action");
  const mouth = num("mouth");
  const tapIn = useStateMachineInput(rive, SM, "tap");
  const yawnIn = useStateMachineInput(rive, SM, "yawn");
  const blinkIn = useStateMachineInput(rive, SM, "blink");

  const excited = expression === "excited" || action === "celebrate";
  const mouthShape =
    excited ? "open"
    : action === "wave" || expression === "happy" ? "smile"
    : action === "think" ? "o"
    : expression === "focused" || action === "write" ? "flat"
    : expression === "sleepy" ? "flat"
    : "w";

  useEffect(() => { if (expr) expr.value = EXPRESSION[expression]; }, [expr, expression]);
  useEffect(() => { if (act) act.value = ACTION[action]; }, [act, action]);
  useEffect(() => { if (mouth) mouth.value = MOUTH[mouthShape]; }, [mouth, mouthShape]);

  // Взгляд: цель → пружина (rAF) → вход state machine. Курсор / скролл / действие.
  const target = useRef({ x: 0, y: 0, tilt: 0 });
  const cur = useRef({ x: 0, y: 0, vx: 0, vy: 0, t: 0, vt: 0 });
  const lastPointer = useRef(0);
  const sleepy = expression === "sleepy" || expression === "listening";

  useEffect(() => {
    if (sleepy) {
      target.current = { x: 0, y: 0, tilt: 0 };
      return;
    }
    if (action === "write") { target.current = { x: -3.2 / 5 * 100, y: 4.2 / 4 * 100, tilt: -50 }; return; }
    if (action === "think") { target.current = { x: 3.8 / 5 * 100, y: -4.4 / 4 * 100, tilt: 60 }; return; }
    target.current.tilt = 0;
    const el = box.current;
    const onMove = (e: PointerEvent) => {
      if (!el) return;
      lastPointer.current = performance.now();
      const r = el.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.44)) / (r.height * 1.2)));
      target.current.x = dx * 100;
      target.current.y = dy * 100;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [action, sleepy]);

  useEffect(() => {
    if (!gazeX || !gazeY || !tilt) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = cur.current;
      const g = target.current;
      // критически-подкритическая пружина (как SPRING_GAZE сайта): быстро, с лёгким перелётом
      const k = 140, d = 16;
      c.vx += (k * (g.x - c.x) - d * c.vx) * dt; c.x += c.vx * dt;
      c.vy += (k * (g.y - c.y) - d * c.vy) * dt; c.y += c.vy * dt;
      c.vt += (90 * (g.tilt - c.t) - 14 * c.vt) * dt; c.t += c.vt * dt;
      gazeX.value = Math.max(-100, Math.min(100, c.x));
      gazeY.value = Math.max(-100, Math.min(100, c.y));
      tilt.value = Math.max(-100, Math.min(100, c.t));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [gazeX, gazeY, tilt]);

  // Взгляд в сторону (по очереди влево/вправо), зевок от скуки — как у SVG-кота.
  useEffect(() => {
    if (!blinkIn || !yawnIn || sleepy) return;
    let live = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => { timers.delete(t); if (live) fn(); }, ms);
      timers.add(t);
    };
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let side = Math.random() < 0.5 ? -1 : 1;
    const glance = () => later(() => {
      if (action === "idle" && performance.now() - lastPointer.current > 2500) {
        side = -side;
        if (Math.random() < 0.55) blinkIn.fire();
        target.current.x = side * 3.6 / 5 * 100;
        target.current.y = rnd(-1.5, 1.2) / 4 * 100;
        if (Math.random() < 0.45) target.current.tilt = side * 35;
        later(() => { target.current = { x: 0, y: 0, tilt: 0 }; }, rnd(1100, 2200));
      }
      glance();
    }, rnd(3800, 8200));
    glance();
    const bored = () => later(() => {
      if (action === "idle" && performance.now() - lastPointer.current > 20000) {
        yawnIn.fire();
        target.current.tilt = -60;
        later(() => { target.current.tilt = 0; }, 1700);
      }
      bored();
    }, rnd(26000, 40000));
    bored();
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [blinkIn, yawnIn, action, sleepy]);

  const ready = useRef(onReady);
  useEffect(() => { ready.current = onReady; });
  useEffect(() => {
    if (!rive || !ready.current) return;
    ready.current({
      set: (name, value) => {
        const i = rive.stateMachineInputs(SM)?.find((x) => x.name === name);
        if (i) i.value = value;
      },
      fire: (name) => rive.stateMachineInputs(SM)?.find((x) => x.name === name)?.fire(),
    });
  }, [rive]);

  return (
    <div
      ref={box}
      className={className}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      onPointerDown={interactive ? () => tapIn?.fire() : undefined}
    >
      <RiveComponent style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
