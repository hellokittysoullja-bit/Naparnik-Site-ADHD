"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mascot, MascotOptions, Mood, OneShot } from "@/lib/mascot/puppet";

/**
 * React-обёртка над куклой (lib/mascot/puppet.ts). Движок живёт вне React:
 * создаётся один раз на монтирование, реагирует на смену mood/play через ref.
 */
export function MascotPuppet({
  size = 280,
  fill = false,
  fallback,
  mood = "idle",
  play,
  onReady,
  className,
  label,
  options,
}: {
  size?: number;
  /** размер из CSS-класса контейнера (клампы, адаптив), канвас заполняет его */
  fill?: boolean;
  /** что показывать до готовности WebGL (серверный SVG-кадр), чтобы не было пустоты */
  fallback?: ReactNode;
  mood?: Mood;
  /** одноразовое действие: меняешь значение (например, с ключом времени) — играет */
  play?: { name: OneShot; key: number } | null;
  onReady?: (m: Mascot) => void;
  className?: string;
  label?: string;
  options?: Omit<MascotOptions, "size">;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cat = useRef<Mascot | null>(null);
  const ready = useRef(onReady);
  useEffect(() => { ready.current = onReady; });
  const [live, setLive] = useState(false);
  // действие/настроение, пришедшие до готовности WebGL, не теряются — отыгрываются при готовности
  const pending = useRef<{ play: { name: OneShot; key: number } | null; mood: Mood }>({ play: play ?? null, mood });

  useEffect(() => {
    let dead = false;
    let instance: Mascot | null = null;
    (async () => {
      const { createMascot } = await import("@/lib/mascot/puppet");
      if (dead || !host.current) return;
      instance = await createMascot(host.current, { size, fill, ...options });
      if (dead) { instance.destroy(); return; }
      cat.current = instance;
      setLive(true);
      instance.setMood(pending.current.mood);
      if (pending.current.play) void instance.play(pending.current.play.name);
      ready.current?.(instance);
    })();
    return () => {
      dead = true;
      instance?.destroy();
      cat.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, fill]);

  useEffect(() => { pending.current.mood = mood; cat.current?.setMood(mood); }, [mood]);
  useEffect(() => { pending.current.play = play ?? null; if (play) void cat.current?.play(play.name); }, [play]);

  return (
    <div
      className={className}
      style={fill ? { position: "relative" } : { width: size, height: size, position: "relative" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {fallback && (
        <div style={{ position: "absolute", inset: 0, opacity: live ? 0 : 1, transition: "opacity 0.25s" }} aria-hidden="true">
          {fallback}
        </div>
      )}
      <div ref={host} style={{ position: "absolute", inset: 0, opacity: live ? 1 : 0, transition: "opacity 0.25s" }} />
    </div>
  );
}
