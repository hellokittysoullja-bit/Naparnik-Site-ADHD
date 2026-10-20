"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MascotFx, MascotSvg, type MascotAction, type MascotExpression } from "@/components/mascot-svg";
import { MascotAnimator, type RigAction } from "@/lib/rig/animator";
import { RigRenderer } from "@/lib/rig/renderer";
import type { RigData } from "@/lib/rig/types";
import { VIEWBOX } from "@/components/mascot-geometry";

/**
 * Кот на настоящем скелете: части нарисованы GPT-Image-2 (скрытые зоны дорисованы), посажены на кости с весами,
 * рисуются в WebGL линейным скиннингом (lib/rig). Хвост гнётся непрерывно, голова поворачивается на шее,
 * уши и огонёк идут на пружинах. Где WebGL нет (или действие «пишет», которому нужен блокнот) — прежний
 * SVG-кот (MascotSvg) с теми же свойствами.
 */
type Props = {
  expression?: MascotExpression;
  action?: MascotAction;
  size?: number;
  label?: string;
  className?: string;
  interactive?: boolean;
};

const BASE = "/mascot/rig/";
type Loaded = { rig: RigData; renderer: RigRenderer } | null;
let loading: Promise<Loaded> | null = null;
function loadRig(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      try {
        const rig = (await (await fetch(BASE + "rig.json")).json()) as RigData;
        const renderer = await RigRenderer.create(rig, BASE);
        return renderer ? { rig, renderer } : null;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

export function MascotRig(props: Props) {
  // «Пишет» рисует блокнот и карандаш на траектории лапы — это остаётся за SVG-котом
  if (props.action === "write") return <MascotSvg {...props} />;
  return <RigCanvas {...props} />;
}

function RigCanvas({ expression = "calm", action = "idle", size = 160, label, className, interactive = true }: Props) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const anim = useRef<MascotAnimator | null>(null);
  const rend = useRef<RigRenderer | null>(null);
  const [state, setState] = useState<"loading" | "rig" | "svg">("loading");
  const [inView, setInView] = useState(true);
  const act = (action === "write" ? "idle" : action) as RigAction;
  const sleepy = expression === "sleepy" || expression === "listening";
  const excited = expression === "excited" || action === "celebrate";

  // загрузка и создание аниматора
  useEffect(() => {
    let live = true;
    loadRig().then((l) => {
      if (!live) return;
      if (!l) return setState("svg");
      anim.current = new MascotAnimator(l.rig);
      rend.current = l.renderer;
      setState("rig");
    });
    return () => {
      live = false;
    };
  }, []);

  // свойства -> аниматор
  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    a.expression = expression;
    a.reduced = !!reduce;
    a.setAction(act);
  }, [state, expression, act, reduce]);

  // видимость: у невидимых котов цикл стоит
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // цикл рисования
  useEffect(() => {
    if (state !== "rig") return;
    const cv = canvas.current;
    const a = anim.current;
    if (!cv || !a) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let on = true;
    const draw = (ms: number) => {
      const r = rend.current;
      if (!on || !r) return;
      a.update(ms / 1000);
      r.draw(ctx, cv.width, cv.height, a.pose.skin, a.parts);
    };
    if (!inView || document.visibilityState === "hidden") {
      draw(performance.now());
      return;
    }
    if (reduce) {
      draw(performance.now());
      return () => {
        on = false;
      };
    }
    const loop = (ms: number) => {
      draw(ms);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVis = () => document.visibilityState === "hidden" && cancelAnimationFrame(raf);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      on = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state, inView, reduce]);

  // указатель: кот провожает взглядом (на таче — по прокрутке)
  useEffect(() => {
    const a = anim.current;
    if (state !== "rig" || !a || reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.44;
      a.gaze = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 1.2))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 1.2))),
      };
      a.pointerMoved();
    };
    let lastY = window.scrollY;
    let settle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (Math.abs(dy) < 2) return;
      a.pointerMoved();
      a.gaze = { x: 0, y: Math.max(-1, Math.min(1, dy / 48)) * 0.9 };
      clearTimeout(settle);
      settle = setTimeout(() => (a.gaze = null), 500);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(settle);
    };
  }, [state, reduce]);

  // тап и долгое нажатие («гладят»)
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const down = () => {
    if (!interactive || reduce) return;
    anim.current?.poke();
    if (hold.current) clearTimeout(hold.current);
    hold.current = setTimeout(() => anim.current?.petting(true), 550);
  };
  const up = () => {
    if (hold.current) clearTimeout(hold.current);
    anim.current?.petting(false);
  };

  if (state === "svg") return <MascotSvg expression={expression} action={action} size={size} label={label} className={className} interactive={interactive} />;

  const dpr = typeof window === "undefined" ? 2 : Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(size * dpr);
  return (
    <div
      ref={wrap}
      className={className}
      style={{ position: "relative", width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      onPointerDown={interactive ? down : undefined}
      onPointerUp={interactive ? up : undefined}
      onPointerLeave={interactive ? up : undefined}
      onPointerCancel={interactive ? up : undefined}
    >
      {state === "loading" && (
        <div style={{ position: "absolute", inset: 0 }}>
          <MascotSvg expression={expression} action={action} size={size} interactive={false} />
        </div>
      )}
      {state === "rig" && (
        <>
          <svg viewBox={VIEWBOX} width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
            <ellipse cx={690} cy={776} rx={330} ry={20} fill="oklch(0.08 0.01 270)" opacity={0.35} />
          </svg>
          <canvas ref={canvas} width={px} height={px} style={{ position: "absolute", inset: 0, width: size, height: size }} />
          <svg viewBox={VIEWBOX} width={size} height={size} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden>
            <MascotFx action={action} sleepy={sleepy} excited={excited} reduceMotion={!!reduce} />
          </svg>
        </>
      )}
    </div>
  );
}
