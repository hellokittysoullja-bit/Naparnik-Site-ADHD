"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MascotSvg, type MascotAction, type MascotExpression } from "@/components/mascot-svg";
import { DollAnimator, drawDollFx, drawDollShadow, setDollFxColor, type DollAction } from "@/lib/rig/doll";
import { loadRigImages, RigRenderer } from "@/lib/rig/renderer";
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
let loading: Promise<Rig | null> | null = null;
/** Риг и декодированные слои — один раз на страницу; WebGL-контекст у каждого экземпляра свой (lib/rig/renderer). */
export function loadDoll(): Promise<Rig | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const rig = (await (await fetch(BASE + "rig.json")).json()) as Rig;
        await loadRigImages(rig, BASE);
        return rig;
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
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);   // кот: WebGL прямо здесь
  const under = useRef<HTMLCanvasElement>(null);    // тень под лапами (2D), перерисовывается только когда меняется высота прыжка
  const over = useRef<HTMLCanvasElement>(null);     // звёздочки и Z (2D), рисуются только пока есть
  const anim = useRef<DollAnimator | null>(null);
  const rig = useRef<Rig | null>(null);
  const rend = useRef<RigRenderer | null>(null);
  const [state, setState] = useState<"loading" | "doll" | "svg">("loading");
  // контекст есть и готов рисовать: 0 — нет (грузится / потерян, пока показываем постер), растёт при каждом (пере)создании
  const [ready, setReady] = useState(0);
  const [inView, setInView] = useState(true);
  const [px, setPx] = useState(0);
  // у героя внешний постер 900 px запрашивается только после шрифтов первого экрана: на 3G он делил полосу
  // с ними поровну (HTTP/1.1, 6 соединений) и отодвигал текст на 1,3 с; инлайн 480 px до тех пор на месте
  const [posterReady, setPosterReady] = useState(!inlinePoster);
  useEffect(() => {
    if (!inlinePoster || posterReady) return;
    let alive = true;
    const go = () => { if (alive) setPosterReady(true); };
    const t = window.setTimeout(go, 3000);
    document.fonts?.ready.then(go);
    return () => { alive = false; window.clearTimeout(t); };
  }, [inlinePoster, posterReady]);

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
    loadDoll().then((rg) => {
      if (!alive) return;
      if (!rg) { setState("svg"); return; }
      rig.current = rg;
      anim.current = new DollAnimator(rg);
      setState("doll");
    });
    return () => { alive = false; };
  }, []);

  // свой WebGL-контекст на видимом холсте; при потере контекста (фон на Android, лимит контекстов) — снова постер,
  // после восстановления рендер пересоздаётся на том же холсте; нет WebGL — прежний кот MascotSvg
  useEffect(() => {
    if (state !== "doll") return;
    const cv = canvas.current, rg = rig.current;
    if (!cv || !rg) return;
    let alive = true;
    const make = () => {
      RigRenderer.create(rg, BASE, cv).then((r) => {
        if (!alive) { r?.dispose(); return; }
        if (!r) { setState("svg"); return; }
        rend.current = r;
        setReady((n) => n + 1);
      }).catch(() => { if (alive) setState("svg"); });
    };
    const onLost = (e: Event) => { e.preventDefault(); rend.current = null; setReady(0); };
    const onRestored = () => { if (alive) make(); };
    cv.addEventListener("webglcontextlost", onLost);
    cv.addEventListener("webglcontextrestored", onRestored);
    make();
    return () => {
      alive = false;
      cv.removeEventListener("webglcontextlost", onLost);
      cv.removeEventListener("webglcontextrestored", onRestored);
      rend.current?.dispose(); rend.current = null;
    };
  }, [state]);

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

  // кадр: WebGL — кот; 2D-слои трогаем только когда есть что менять (в покое кадр = один вызов draw)
  useEffect(() => {
    if (state !== "doll" || !ready || !px) return;
    const cv = canvas.current, uc = under.current, oc = over.current, a = anim.current, r = rend.current, rg = rig.current;
    if (!cv || !uc || !oc || !a || !r || !rg) return;
    cv.width = px; cv.height = px; uc.width = px; uc.height = px; oc.width = px; oc.height = px;
    const uctx = uc.getContext("2d"), octx = oc.getContext("2d");
    let raf = 0, last = performance.now(), lift = -1, fxShown = false;
    const frame = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      a.update(dt);
      r.draw(px, px, a.pose.skin, a.parts);
      const l = Math.max(0, -a.pose.ty[0]);
      if (uctx && rg.cat && Math.abs(l - lift) > 0.25) {
        lift = l;
        uctx.clearRect(0, 0, px, px);
        drawDollShadow(uctx, a, rg.cat, rg.view, px, px);
      }
      if (octx && (a.fx.length || fxShown)) {
        octx.clearRect(0, 0, px, px);
        drawDollFx(octx, a.fx, a.t, rg.view, px, px);
        fxShown = a.fx.length > 0;
      }
      if (!reduce && inView) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state, ready, px, reduce, inView]);

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
      style={{ ...(/(^|\s)(lg:|md:|sm:)?size-/.test(className ?? "") ? {} : { width: size, height: size }), position: "relative", display: "inline-block", verticalAlign: "bottom", touchAction: "manipulation" }}
      onPointerDown={interactive ? () => anim.current?.poke() : undefined}
    >
      {state === "loading" || !ready || !view || !cat ? (
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
          {posterReady ? (
            <img src="/mascot/poster/neutral.webp" alt="" draggable={false} loading={inlinePoster ? "eager" : "lazy"} decoding="async"
              style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
          ) : null}
        </>
      ) : null}
      {state === "doll" ? (
        <>
          <canvas ref={under} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none" }} />
          <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none" }} />
          <canvas ref={over} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none", pointerEvents: "none" }} />
        </>
      ) : null}
    </div>
  );
}
