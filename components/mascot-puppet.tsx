"use client";

import { useEffect, useRef } from "react";
import type { Mascot, MascotOptions, Mood, OneShot } from "@/lib/mascot/puppet";

/**
 * React-обёртка над куклой (lib/mascot/puppet.ts). Движок живёт вне React:
 * создаётся один раз на монтирование, реагирует на смену mood/play через ref.
 */
export function MascotPuppet({
  size = 280,
  mood = "idle",
  play,
  onReady,
  className,
  label,
  options,
}: {
  size?: number;
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

  useEffect(() => {
    let dead = false;
    let instance: Mascot | null = null;
    (async () => {
      const { createMascot } = await import("@/lib/mascot/puppet");
      if (dead || !host.current) return;
      instance = await createMascot(host.current, { size, ...options });
      if (dead) { instance.destroy(); return; }
      cat.current = instance;
      ready.current?.(instance);
    })();
    return () => {
      dead = true;
      instance?.destroy();
      cat.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => { cat.current?.setMood(mood); }, [mood]);
  useEffect(() => { if (play) void cat.current?.play(play.name); }, [play]);

  return (
    <div
      ref={host}
      className={className}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
