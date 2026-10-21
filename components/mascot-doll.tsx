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
};

const BASE = "/mascot/doll/";
// размытый силуэт первого кадра (эталон 48 px, webp, base64) — рисуется вместе с HTML
const LQIP = "data:image/webp;base64,UklGRo4FAABXRUJQVlA4WAoAAAAQAAAALwAAIgAAQUxQSOQCAAABoC3Jtmnbar2PhWOfc23btm3btm3btvVk2zaPbWNjjtF7e1hz7TU+ISImAE1DJQCAoGkA9toDguwKYNsnn1kbWhawyvuctZ5oLsHmBzyVyOJgVBoq2HkWC36QTWW/eSRTwakrQYNUcDYZzcdXIFkE3UexMzmZOHwJQHAEzUhvXxchk/zmxsaCDw3Yv7pOMiMZ+QgqmQa1scx91tDpXw2lkaTxT4Fkkd5nzXBvaOosG1Ep0xYQsGwbm7i5GUudk/uUCFpVWS8yp3PSIAgECx8LbQEbDqdlME5aBgqRHu17I3RFIKfPdc/gnLhVH0XAWXwYQbrSc9v/aczpadSmUkHvMf7lXdBmEgb968Y8Nmd3VPBs4eQK0CaKfeeY52HiB1VgVIrk0iGUSW3dd8yY23zECniAlm5UQKUB9fdozNdxqqLnnVPa3x360OKAQOqDFtppZPJsyW/t1Q93tDvJUXctBK0vtPgSC33KlMt81GUrLnPIfFpnEcm3KgoAi782zj2T29TFu1WHMpGkR54A0YGrLYnPmTJFHrfEquuMcp940dMdnvx7QOros8ovnjxL5Idr9wN+TPHnR6/5mpHj+wIYvGr3xT9n5tFndFtjFb2FJG97gtE7LgKkG4BVzpjXliF+sFAV6FntcemPw+6XHZgSbwcAgQKrjXFrxYoNoRA0VoEdmYynNAASlvyIxlbdJ20kCkAqQG3wk0ycs2pZBZcwsvXEU0Ndg0C1hnOZzH8ZUhZwk6Ucfj4aFcAGc5JH/tyrTPEhc7jPvGP3dXdZCKvddM0surNtPZRX8KDFDDSSbHvxi4KkRZu0JbTZhczhZGdhTtJSInkGKigX7fEWC9KMpDnpyRn51QskUyfNyPj65ghoLlJ/jUaSyciU2DhtEM7+cyjZRqZfdwEEXVX0f7OwD/csyFf/JT89fuyCnzdBQK3nvg8cv8H2y9cgAV0XYK31gN2vPxXLXHH1Sui3skIR0FxRClZQOCCEAgAAMAwAnQEqMAAjAD61Rp9JpyOioTHZmgDgFolqAMPgQcBRwG2tuwDeOKzNjSe7O8QMyVqNwGoL0jvQzSoDeNgPNc0IHQYxxRxweGkVeEAkresUrtJ4uKmIBe/5uQ8XhPD0++/rM18szrUogAD+/QQWTkdtuPkO9bOKSADi9vQf99d7XAWzTVwpSq+vPxdXM3XzWWGNuJce+NjEQeFgepm0yaqBN96zumg7a/JUE8X6/pxWt7M6ncRSS3NoktOOwzrVKqpZRHyADddnIbRKx/4PznRjbOYxD1Q08A1446Rz8Ph2/VTGfMJ6nsiWmm+nsqeT4lUIBO/XFBl57eupnYIfoZd+76gnUfLAorwrvJ1Re3eUIdzClZaaiccjXM5yL1+jNFQX2SHpnvN8dlRuxLuDRW0jEp+4f//MX75f8sF08YSs4/PAJAbhLzYZRCWtc7B3eoJeUgtzvpiGjIIjjpLEJGR5JJim+JcPWzcsPTF/hfSQtLoTh9+bow7ndJaNArS1MUa2PjSpqnEaI4nJ1oL3appFXIIViDaQc/U1HBCX9vrAo09+L4XYPzIcuQIKSoN2CA45oSSSlPUlj1d5HhDt5yp38R9933QC+q1rR31Ny5EjxQbpRav/Vf9SLwprf3Lknzb0UaWYXxX3RXC1XXTS0nDoy2swgLTAXEsm7duSywccIC08YYfiojKjVJJXvLhqNvq0prDNb2Mf7Zx6PfL5A/aLjOwY/kHhTA6xgCu4bdIngBjydUgiAkD5OdBCYZsrngzjiI7MpsVWByAZsf8EwSN4M9Cmhz2kTp/lL3pCiKHfksn5KUYRYnPdNutJfCb//X7hnFhYhuc8eQWCDBhsCihwoAA=";
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

function DollCanvas({ expression = "calm", action = "idle", size = 160, label, className, interactive = true }: Props) {
  // постер первого кадра — в <head> как preload с высоким приоритетом (и при SSR): кот виден с первой отрисовки
  preload("/mascot/poster/neutral.webp", { as: "image", fetchPriority: "high" });
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
          {/* силуэт кота есть уже в HTML (48 px, ~1,5 КБ, размыт), чтобы место не пустовало, пока летит постер */}
          <img src={LQIP} alt="" draggable={false} aria-hidden
            style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none", filter: "blur(6px)", opacity: 0.9 }} />
          <img src="/mascot/poster/neutral.webp" alt="" draggable={false} fetchPriority="high" loading="eager" decoding="async"
            style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
        </>
      ) : null}
      <canvas ref={canvas} style={{ width: "100%", height: "100%", display: state === "doll" ? "block" : "none" }} />
    </div>
  );
}
