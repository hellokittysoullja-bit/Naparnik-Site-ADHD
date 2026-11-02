"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { preload } from "react-dom";
import { asset } from "@/lib/asset-versions";

/**
 * Ночной мир первого экрана — готовое зацикленное видео и заставка (принцип cofounder.co, 02.11).
 * Небо, Млечный Путь, мерцание, падающая звезда, дымка и четыре гряды отрисованы заранее
 * (design/scene/build.mjs → public/scene); браузер только проигрывает видео видеочипом.
 * Раньше это были сотни SVG-фигур, маски и размытия поверх стекла — на iPhone при нагрузке
 * Safari терял слои (холм прямоугольником, куски текста под чужими прямоугольниками).
 *
 * - Заставка (= первый кадр видео) приходит с HTML и видна сразу; видео подключается после
 *   загрузки страницы и бесшовно её сменяет. Без JS, при reduced-motion и Save-Data — заставка.
 * - Две версии под раскладку: portrait — до lg (телефоны, планшеты стоя), landscape — lg+.
 * - Глубина за мышью (только мышь, не тач): сцена и луна чуть сдвигаются — CSS-переменные
 *   --px/--py на корне, сдвиг делает `.nw-depth` (app/globals.css), без пружин в JS.
 */

const WIDE = "(min-width: 1024px)";
type Variant = "portrait" | "landscape";
const variantNow = (): Variant => (window.matchMedia(WIDE).matches ? "landscape" : "portrait");
// H.264 High: level 4.0 у portrait, 4.2 у landscape (design/scene/build.mjs)
const AVC: Record<Variant, string> = { portrait: "avc1.640028", landscape: "avc1.64002A" };
const src = (variant: "portrait" | "landscape", ext: string) => asset(`/scene/night-${variant}.${ext}`);

export function NightScene({ children }: { children?: ReactNode }) {
  preload(src("portrait", "webp"), { as: "image", media: `not all and ${WIDE}`, fetchPriority: "high" });
  preload(src("landscape", "webp"), { as: "image", media: WIDE, fetchPriority: "high" });

  const rootRef = useRef<HTMLDivElement>(null);
  // какой ролик играть, решает код, а не `<source media>`: Safari на iPhone у <video> атрибут media
  // не учитывает и брал первый подходящий — компьютерный широкий кадр, растянутый на телефон (02.11)
  const [video, setVideo] = useState<Variant | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduce || saveData) return;
    // видео не спорит за сеть с первым экраном: подключаем после load и простоя
    let idle = 0;
    const start = () => {
      idle = window.requestIdleCallback
        ? window.requestIdleCallback(() => setVideo(variantNow()), { timeout: 1500 })
        : window.setTimeout(() => setVideo(variantNow()), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    // поворот или ресайз через границу lg — свой ролик под новую раскладку
    const wide = window.matchMedia(WIDE);
    const onChange = () => {
      setPlaying(false);
      setVideo((v) => (v ? variantNow() : v));
    };
    wide.addEventListener("change", onChange);
    return () => {
      wide.removeEventListener("change", onChange);
      window.removeEventListener("load", start);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
        root.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      // запасной цвет до прихода заставки — те же края неба и земли, что в кадре
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(to_bottom,oklch(0.15_0.04_265),oklch(0.25_0.055_228)_52%,oklch(0.15_0.02_170))]"
    >
      <div className="nw-depth nw-overscan absolute inset-0" style={{ "--k": "-8px", "--ky": "-5px" } as CSSProperties}>
        <picture>
          <source media={WIDE} srcSet={src("landscape", "webp")} />
          <img
            src={src("portrait", "webp")}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
        {video && (
          <video
            key={video}
            ref={(el) => {
              if (!el) return;
              // iOS играет без звука только с выставленным muted ДО play (React ставит лишь свойство)
              el.muted = true;
              el.defaultMuted = true;
              el.setAttribute("muted", "");
              el.play().catch(() => {});
            }}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            onPlaying={() => setPlaying(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
          >
            {/* только ролик своей раскладки; H.264 первым — его аппаратно декодирует любой телефон и компьютер
                (VP9 на части iPhone идёт программно и тратит батарею), VP9 — запасной */}
            <source src={src(video, "mp4")} type={`video/mp4; codecs="${AVC[video]}"`} />
            <source src={src(video, "webm")} type='video/webm; codecs="vp9"' />
          </video>
        )}
      </div>
      {children}
    </div>
  );
}
