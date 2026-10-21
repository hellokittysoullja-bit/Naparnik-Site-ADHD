"use client";

import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { useReducedMotion } from "motion/react";
import { MascotSvg, type MascotAction, type MascotExpression } from "@/components/mascot-svg";
import { DollAnimator, drawDollFx, drawDollShadow, setDollFxColor, type DollAction } from "@/lib/rig/doll";
import { RigRenderer } from "@/lib/rig/renderer";
import type { RigData } from "@/lib/rig/types";

/**
 * Кот-кукла из эталонного PNG (design/mascot/png/neutral.png -> design/mascot/doll_build.py): тот же рисунок,
 * разобранный на слои, живёт кодом — моргает, смотрит за курсором, дышит, двигает ушами и хвостом; радость —
 * язычок и звёздочки, сон — дуги и Z. Рисуется WebGL-скиннингом (lib/rig). Где WebGL нет, и для «пишет»
 * (блокнот и карандаш в лапе) — прежний кот MascotSvg с теми же свойствами.
 */
type Props = {
  expression?: MascotExpression;
  action?: MascotAction;
  size?: number;
  label?: string;
  className?: string;
  interactive?: boolean;
  /** герой первого экрана: чёткий постер прямо в HTML + preload — кот виден с первой отрисовки */
  inlinePoster?: boolean;
};

const BASE = "/mascot/doll/";
import { MASCOT_POSTER_INLINE } from "@/components/mascot-poster-inline";
type Rig = RigData & { eyes?: number[][]; cat?: number[] };
type Loaded = { rig: Rig; renderer: RigRenderer } | null;
let loading: Promise<Loaded> | null = null;
export function loadDoll(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      try {
        const rig = (await (await fetch(BASE + "rig.json")).json()) as Rig;
        const renderer = await RigRenderer.create(rig, BASE);
        return renderer ? { rig, renderer } : null;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

export function MascotDoll(props: Props) {
  if (props.action === "write") return <MascotSvg {...props} />;
  return <DollCanvas {...props} />;
}

function DollCanvas({ expression = "calm", action = "idle", size = 160, label, className, interactive = true, inlinePoster = false }: Props) {
  // постер первого кадра — в <head> как preload с высоким приоритетом (и при SSR): кот виден с первой отрисовки
  if (inlinePoster) preload("/mascot/poster/neutral.webp", { as: "image", fetchPriority: "high" });
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const anim = useRef<DollAnimator | null>(null);
  const rig = useRef<Rig | null>(null);
  const rend = useRef<RigRenderer | null>(null);
  const [state, setState] = useState<"loading" | "doll" | "svg">("loading");
  const [inView, setInView] = useState(true);
  const [px, setPx] = useState(0);

  // размер холста — по фактическому размеру на странице (класс size-[clamp(...)] на первом экране меняет его)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const measure = () => setPx(Math.max(16, Math.round(el.getBoundingClientRect().width * dpr)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  useEffect(() => {
    if (wrap.current) setDollFxColor(getComputedStyle(wrap.current).getPropertyValue("--color-primary").trim());
  }, [state]);

  useEffect(() => {
    let alive = true;
    loadDoll().then((l) => {
      if (!alive) return;
      if (!l) { setState("svg"); return; }
      rig.current = l.rig; rend.current = l.renderer;
      anim.current = new DollAnimator(l.rig);
      setState("doll");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    a.expression = expression;
    a.setAction((action === "write" ? "idle" : action) as DollAction);
    a.reduced = !!reduce;
  }, [expression, action, reduce, state]);

  // взгляд за указателем
  useEffect(() => {
    if (state !== "doll" || reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = wrap.current, a = anim.current;
      if (!el || !a) return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / Math.max(200, r.width * 2);
      const dy = (e.clientY - (r.top + r.height * 0.45)) / Math.max(200, r.height * 2);
      a.gaze = { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) };
    };
    const onLeave = () => { if (anim.current) anim.current.gaze = null; };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => { window.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave); };
  }, [state, reduce]);

  // кадр
  useEffect(() => {
    if (state !== "doll") return;
    const cv = canvas.current, a = anim.current, r = rend.current, rg = rig.current;
    if (!cv || !a || !r || !rg) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (!px) return;
    cv.width = px; cv.height = px;
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      a.update(dt);
      r.draw(ctx, Math.min(px, 1024), Math.min(px, 1024), a.pose.skin, a.parts);
      if (rg.cat) drawDollShadow(ctx, a, rg.cat, rg.view, px, px);
      drawDollFx(ctx, a.fx, a.t, rg.view, px, px);
      if (!reduce && inView) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state, px, reduce, inView]);

  if (state === "svg") return <MascotSvg expression={expression} action={action} size={size} label={label} className={className} interactive={interactive} />;
  const view = rig.current?.view;
  const cat = rig.current?.cat;
  return (
    <div
      ref={wrap}
      className={["cat-doll", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      style={{ ...(/(^|\s)(lg:|md:|sm:)?size-/.test(className ?? "") ? {} : { width: size, height: size }), position: "relative", display: "inline-block", touchAction: "manipulation" }}
      onPointerDown={interactive ? () => anim.current?.poke() : undefined}
    >
      {state === "loading" || !view || !cat ? (
        // первый кадр до загрузки рига — тот же эталонный рисунок неподвижно, на своём месте: лёгкая копия
        // эталона (900 px, webp ≈ 86 КБ, предзагружена из layout) — PNG 1,3 МБ на 3G качался 13 с и
        // проявлялся полосами сверху вниз (уши → голова → тело)
        // eslint-disable-next-line @next/next/no-img-element
        <>
          {/* герой: чёткий кот прямо в HTML (480 px, ~37 КБ) — виден с первой отрисовки; поверх, когда
              долетит, — постер 900 px для экранов с DPR 3; остальные коты страницы — только внешний постер */}
          {inlinePoster ? (
            <img src={MASCOT_POSTER_INLINE} alt="" draggable={false} aria-hidden
              style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
          ) : null}
          <img src="/mascot/poster/neutral.webp" alt="" draggable={false} fetchPriority={inlinePoster ? "high" : "auto"} loading={inlinePoster ? "eager" : "lazy"} decoding="async"
            style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
        </>
      ) : null}
      <canvas ref={canvas} style={{ width: "100%", height: "100%", display: state === "doll" ? "block" : "none" }} />
    </div>
  );
}
