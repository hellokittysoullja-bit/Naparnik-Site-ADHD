"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { DollAnimator, drawDollFx, drawDollShadow, setDollFxColor, type DollAction, type DollExpression } from "@/lib/rig/doll";
import { loadRigImages, RigRenderer } from "@/lib/rig/renderer";
import { asset } from "@/lib/asset-versions";
import type { RigData } from "@/lib/rig/types";

/**
 * Кот-кукла из эталонного PNG (design/mascot/png/neutral.png -> design/mascot/doll_build.py): тот же рисунок,
 * разобранный на слои, живёт кодом — моргает, смотрит за курсором, дышит, двигает ушами и хвостом; радость —
 * язычок и звёздочки, сон — дуги и Z. Рисуется WebGL-скиннингом (lib/rig). Где WebGL нет или риг не загрузился —
 * сам эталон неподвижно (постер). Другой модели кота на сайте нет: старый cutout-кот (MascotSvg, MascotStatic,
 * слои public/mascot/*.webp) удалён 22.10 — у него была белая кайма и он подменял куклу на «пишет» и без WebGL.
 */
export type MascotExpression = DollExpression;
export type MascotAction = DollAction;

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
        const rig = (await (await fetch(asset(BASE + "rig.json"))).json()) as Rig;
        await loadRigImages(rig, BASE);
        return rig;
      } catch {
        return null;
      }
    })();
  }
  return loading;
}

/**
 * Живых WebGL-контекстов одновременно — не больше MAX_LIVE. У браузера общий лимит (Chrome 16, Safari меньше),
 * сверх него он молча отбирает САМЫЙ СТАРЫЙ контекст: в длинной переписке у каждой группы реплик свой аватар,
 * и 30 сообщений давали 18 котов — кот в шапке Дома терял контекст (замер 22.10, «Too many active WebGL contexts»).
 * Контекст держит только кот в кадре (IntersectionObserver), ушедший из кадра отдаёт его через RELEASE_MS;
 * кто не получил слот, стоит эталонным постером и ждёт очереди.
 */
const MAX_LIVE = 12;
const RELEASE_MS = 1500;
let liveCount = 0;
const waiters = new Set<() => void>();
function acquireSlot() {
  if (liveCount >= MAX_LIVE) return false;
  liveCount++;
  return true;
}
function releaseSlot() {
  liveCount = Math.max(0, liveCount - 1);
  const next = waiters.values().next().value;
  if (next) { waiters.delete(next); next(); }
}

export function MascotDoll(props: Props) {
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
  // static — WebGL нет или риг не загрузился: остаётся эталонный постер
  const [state, setState] = useState<"loading" | "doll" | "static">("loading");
  // контекст есть и готов рисовать: 0 — нет (грузится / потерян, пока показываем постер), растёт при каждом (пере)создании
  const [ready, setReady] = useState(0);
  // кукла уже нарисовала кадр в холст: только тогда убираем постер. Иначе там, где кадры не идут (вкладка открыта
  // в фоне, iOS придержал requestAnimationFrame), холст пустой, а постера уже нет — кот исчезал
  const [drawn, setDrawn] = useState(false);
  // в кадре ли кот (с запасом 60 px — успеть ожить до появления): без IntersectionObserver считаем, что да; с ним — ждём первого ответа, а не создаём контексты
  // всем котам разом при монтировании длинной переписки
  const [inView, setInView] = useState(() => typeof IntersectionObserver === "undefined");
  // держать ли WebGL-контекст: в кадре — сразу, ушёл из кадра — через RELEASE_MS (быстрый скролл туда-обратно не дёргает)
  const [wantLive, setWantLive] = useState(false);
  // поколение холста: отпущенный (loseContext) или потерянный контекст на том же <canvas> не вернуть, поэтому каждый
  // новый контекст — на новом холсте (ключ = поколение + ступень детальности texPx)
  const [gen, setGen] = useState(0);
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
    loadDoll().then((rg) => {
      if (!alive) return;
      if (!rg) { setState("static"); return; }
      rig.current = rg;
      anim.current = new DollAnimator(rg);
      setState("doll");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "60px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const liveRef = useRef(false);
  useEffect(() => {
    if (inView) {
      if (!liveRef.current) { liveRef.current = true; setGen((g) => g + 1); setWantLive(true); }
      return;
    }
    const t = window.setTimeout(() => { liveRef.current = false; setWantLive(false); }, RELEASE_MS);
    return () => window.clearTimeout(t);
  }, [inView]);

  // WebGL-контекст на свежем холсте, пока кот в кадре и есть слот; потеря контекста (фон на Android, чужой лимит) —
  // снова постер и новый холст через 300 мс; WebGL нет — эталонный постер навсегда (state static)
  // детальность слоёв — ступенями степени двойки от размера холста: пересоздаём контекст только при смене ступени
  const texPx = px ? 2 ** Math.ceil(Math.log2(px)) : 0;
  useEffect(() => {
    if (state !== "doll" || !wantLive || !texPx) return;
    const cv = canvas.current, rg = rig.current;
    if (!cv || !rg) return;
    let alive = true, held = false, lostTimer = 0;
    const onLost = (e: Event) => {
      e.preventDefault();
      rend.current = null; setReady(0); setDrawn(false);
      lostTimer = window.setTimeout(() => { if (alive) setGen((g) => g + 1); }, 300);
    };
    const start = () => {
      if (!alive) return;
      if (!acquireSlot()) { waiters.add(start); return; }
      held = true;
      RigRenderer.create(rg, BASE, cv, texPx).then((r) => {
        if (!alive) { r?.dispose(); return; }
        if (!r) { setState("static"); return; }
        rend.current = r;
        setReady((n) => n + 1);
      }).catch(() => { if (alive) setState("static"); });
    };
    cv.addEventListener("webglcontextlost", onLost);
    start();
    return () => {
      alive = false;
      waiters.delete(start);
      window.clearTimeout(lostTimer);
      cv.removeEventListener("webglcontextlost", onLost);
      rend.current?.dispose(); rend.current = null;
      setReady(0); setDrawn(false);
      if (held) releaseSlot();
    };
  }, [state, wantLive, gen, texPx]);

  useEffect(() => {
    const a = anim.current;
    if (!a) return;
    a.expression = expression;
    a.setAction(action);
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
    // первый кадр — сразу, а не по requestAnimationFrame: холст прозрачен, постер под ним виден, пока кадр не готов
    frame(performance.now());
    setDrawn(true);
    return () => cancelAnimationFrame(raf);
  }, [state, ready, px, reduce, inView]);

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
      {state !== "doll" || !ready || !drawn || !view || !cat ? (
        // первый кадр до загрузки рига — тот же эталонный рисунок неподвижно, на своём месте: лёгкая копия
        // эталона (900 px, webp ≈ 86 КБ, предзагружена из layout) — PNG 1,3 МБ на 3G качался 13 с и
        // проявлялся полосами сверху вниз (уши → голова → тело)
        <>
          {/* герой: чёткий кот прямо в HTML (480 px, ~37 КБ) — виден с первой отрисовки; поверх, когда
              долетит, — постер 900 px для экранов с DPR 3; остальные коты страницы — только внешний постер */}
          {inlinePoster ? (
            <img src={MASCOT_POSTER_INLINE} alt="" draggable={false} aria-hidden
              style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
          ) : null}
          {/* у героя внешний постер идёт обычным приоритетом картинки в кадре: первый кадр уже дал инлайн, а шрифты
              первого экрана вшиты в CSS (app/hero-fonts.css), уступать полосу ему больше некому */}
          <img src={asset("/mascot/poster/neutral.webp")} alt="" draggable={false} loading={inlinePoster ? "eager" : "lazy"} decoding="async"
            style={{ position: "absolute", left: `${(48 / 1442) * 100}%`, width: `${(1347 / 1442) * 100}%`, top: `${(428 / 1442) * 100}%`, height: "auto", pointerEvents: "none" }} />
        </>
      ) : null}
      {state === "doll" ? (
        <>
          <canvas ref={under} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none" }} />
          <canvas key={`${gen}-${texPx}`} ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none" }} />
          <canvas ref={over} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: ready ? "block" : "none", pointerEvents: "none" }} />
        </>
      ) : null}
    </div>
  );
}
