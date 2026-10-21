"use client";

import { useEffect, useRef, useState } from "react";
import { MascotPuppet } from "@/components/mascot-puppet";
import type { Mascot, Mood, OneShot } from "@/lib/mascot/puppet";

/**
 * Лаборатория куклы — «редактор Rive в кармане»: все пружины, дыхание, моргание,
 * параллакс и тайминги крутятся слайдерами (Tweakpane) на живом коте; «Export»
 * копирует JSON пресета — его кладём в lib/mascot/presets/default.json.
 */
const MOODS: Mood[] = ["idle", "think", "sad", "sleep", "focused"];
const SHOTS: OneShot[] = ["wave", "happy", "react"];

declare global {
  interface Window {
    __puppet?: Mascot;
  }
}

export function MascotLab() {
  const [cat, setCat] = useState<Mascot | null>(null);
  const [mood, setMood] = useState<Mood>("idle");
  const [play, setPlay] = useState<{ name: OneShot; key: number } | null>(null);
  const paneHost = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState(360);
  // ?size=185 — рендер в масштабе героя лендинга (проверка «как на телефоне»)
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("size"));
    setSize(q > 0 ? q : Math.min(420, window.innerWidth - 24));
  }, []);

  useEffect(() => {
    if (!cat || !paneHost.current) return;
    let pane: { dispose: () => void } | null = null;
    // типы Tweakpane v4 не раскрывают addFolder/addButton на Pane в этой сборке — минимальный контракт
    type Binding = { on: (ev: string, cb: () => void) => void };
    type Folder = {
      addBinding: (obj: object, key: string, opts?: Record<string, unknown>) => Binding;
      addFolder: (opts: { title: string; expanded?: boolean }) => Folder;
      addButton: (opts: { title: string }) => Binding;
    };
    (async () => {
      const { Pane } = await import("tweakpane");
      const real = new Pane({ container: paneHost.current!, title: "Кукла", expanded: true });
      pane = real;
      const p = real as unknown as Folder;
      const pr = cat.preset;
      const f = (title: string) => p.addFolder({ title, expanded: false });
      let g = f("Дыхание");
      g.addBinding(pr.breath, "period", { min: 2, max: 9, step: 0.1 });
      g.addBinding(pr.breath, "chest", { min: 0, max: 0.08, step: 0.001 });
      g.addBinding(pr.breath, "bottom", { min: 0, max: 0.03, step: 0.001 });
      g.addBinding(pr.breath, "headRide", { min: 0, max: 20, step: 0.5 });
      g.addBinding(pr.breath, "hold", { min: 0, max: 0.3, step: 0.01 });
      g = f("Шум (никогда не замирает)");
      g.addBinding(pr.noise, "body", { min: 0, max: 0.03, step: 0.001 });
      g.addBinding(pr.noise, "head", { min: 0, max: 0.05, step: 0.001 });
      g.addBinding(pr.noise, "ears", { min: 0, max: 0.12, step: 0.002 });
      g.addBinding(pr.noise, "speed", { min: 0.02, max: 1, step: 0.01 });
      for (const k of ["earL", "earR", "flame", "head", "gaze"] as const) {
        g = f(`Пружина: ${k}`);
        g.addBinding(pr.springs[k], "stiffness", { min: 10, max: 400, step: 1 });
        g.addBinding(pr.springs[k], "damping", { min: 1, max: 40, step: 0.5 });
        if ("inertia" in pr.springs[k]) g.addBinding(pr.springs[k] as { inertia: number }, "inertia", { min: 0, max: 5, step: 0.1 });
      }
      g = f("Пружина: хвост");
      g.addBinding(pr.springs.tail, "stiffness", { min: 10, max: 300, step: 1 });
      g.addBinding(pr.springs.tail, "damping", { min: 1, max: 30, step: 0.5 });
      g.addBinding(pr.springs.tail, "inertia", { min: 0, max: 5, step: 0.1 });
      g.addBinding(pr.springs.tail, "falloff", { min: 0.5, max: 1, step: 0.01 });
      g.addBinding(pr.tail, "swayAmp", { min: 0, max: 0.08, step: 0.001 });
      g.addBinding(pr.tail, "swayPeriod", { min: 2, max: 14, step: 0.1 });
      g = f("Огонёк");
      g.addBinding(pr.flame, "flickerAmp", { min: 0, max: 0.25, step: 0.005 });
      g.addBinding(pr.flame, "flickerSpeed", { min: 0.2, max: 4, step: 0.05 });
      g = f("Моргание (обычное: закрытие / удержание / открытие, с)");
      g.addBinding(pr.blink.types.normal, "close", { min: 0.03, max: 0.2, step: 0.005 });
      g.addBinding(pr.blink.types.normal, "hold", { min: 0, max: 0.2, step: 0.005 });
      g.addBinding(pr.blink.types.normal, "open", { min: 0.05, max: 0.4, step: 0.005 });
      g.addBinding(pr.blink, "lagR", { min: 0, max: 0.05, step: 0.001, label: "лаг правого, с" });
      g.addBinding(pr.blink, "refractory", { min: 0, max: 2, step: 0.05 });
      g = f("Планировщик (логнормальный, по настроению)");
      for (const m of ["idle", "think", "focused", "sad"] as const) {
        g.addBinding(pr.blink.sched[m], "median", { min: 1, max: 10, step: 0.1, label: `${m} медиана, с` });
        g.addBinding(pr.blink.sched[m], "sigma", { min: 0.1, max: 1.2, step: 0.05, label: `${m} σ` });
        g.addBinding(pr.blink.sched[m], "pDouble", { min: 0, max: 0.5, step: 0.01, label: `${m} двойное` });
        g.addBinding(pr.blink.sched[m], "durMul", { min: 0.5, max: 3, step: 0.05, label: `${m} ×длит.` });
      }
      g = f("Реакция глаза на смыкание");
      g.addBinding(pr.react, "pupilDown", { min: 0, max: 0.15, step: 0.005 });
      g.addBinding(pr.react, "pupilNose", { min: 0, max: 0.05, step: 0.0025 });
      g.addBinding(pr.react, "squash", { min: 0, max: 0.15, step: 0.005 });
      g.addBinding(pr.react, "dilate", { min: 0, max: 0.5, step: 0.01 });
      g = f("Взгляд / псевдо-3D");
      g.addBinding(pr.look, "pupil", { min: 0, max: 30, step: 0.5 });
      g.addBinding(pr.look, "pupilY", { min: 0, max: 30, step: 0.5 });
      g.addBinding(pr.look, "face", { min: 0, max: 1.5, step: 0.05 });
      g.addBinding(pr.look, "head", { min: 0, max: 1, step: 0.05 });
      g.addBinding(pr.look, "earNear", { min: 0, max: 1, step: 0.05 });
      g.addBinding(pr.look, "earFar", { min: 0, max: 1, step: 0.05 });
      g.addBinding(pr.look, "headRot", { min: 0, max: 0.3, step: 0.005 });
      g.addBinding(pr.look, "range", { min: 0.2, max: 2, step: 0.05 });
      g = f("Веки по настроению");
      for (const m of ["think", "sad", "focused"] as const) {
        g.addBinding(pr.lids[m], "y", { min: 0, max: 1, step: 0.01, label: `${m} y` });
        g.addBinding(pr.lids[m], "rot", { min: -0.6, max: 0.6, step: 0.01, label: `${m} rot` });
      }
      g = f("Состояния");
      g.addBinding(pr.states, "crossfade", { min: 0.05, max: 1, step: 0.05 });
      g.addBinding(pr.states, "waveDur", { min: 1.5, max: 5, step: 0.1 });
      g.addBinding(pr.states, "happyDur", { min: 0.6, max: 2.5, step: 0.05 });
      g.addBinding(pr.states, "sleepAfter", { min: 0, max: 120, step: 5 });
      g = f("Отладка");
      g.addBinding(cat.debug, "bones");
      g.addBinding(cat.debug, "mesh");
      g.addBinding(cat.debug, "pivots");
      p.addButton({ title: "Export preset (JSON → буфер)" }).on("click", async () => {
        const json = JSON.stringify(cat.preset, null, 2);
        try { await navigator.clipboard.writeText(json); } catch { /* буфер недоступен — JSON ниже */ }
        setCopied(true);
        (document.getElementById("preset-out") as HTMLTextAreaElement | null)!.value = json;
      });
    })();
    return () => pane?.dispose();
  }, [cat]);

  const btn = "rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/90 active:bg-white/15";
  return (
    <main style={{ minHeight: "100dvh", background: "#121212", color: "#eee", display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <MascotPuppet
          size={size}
          mood={mood}
          play={play}
          onReady={(m) => { window.__puppet = m; setCat(m); }}
          options={{ sleepAfter: 0 }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {MOODS.map((m) => (
          <button key={m} className={btn} style={{ outline: m === mood ? "2px solid #ffd166" : "none" }} onClick={() => setMood(m)}>{m}</button>
        ))}
        {SHOTS.map((s) => (
          <button key={s} className={btn} onClick={() => setPlay({ name: s, key: Date.now() })}>{s}</button>
        ))}
        {(["normal", "fast", "double", "long", "half"] as const).map((b) => (
          <button key={b} className={btn} onClick={() => cat?.blink(b)}>blink {b}</button>
        ))}
        <button className={btn} onClick={() => cat?.slowBlink()}>slow blink</button>
        <button className={btn} onClick={() => cat?.cue("userSubmitted")}>cue: ввод</button>
        <button className={btn} onClick={() => cat?.cue("speechEnd")}>cue: конец реплики</button>
      </div>
      <div ref={paneHost} style={{ maxWidth: 480, width: "100%", margin: "0 auto" }} />
      <textarea id="preset-out" readOnly placeholder={copied ? "" : "Export preset → JSON появится здесь"} style={{ width: "100%", maxWidth: 480, margin: "0 auto", minHeight: 80, background: "#1b1b1b", color: "#ccc", border: "1px solid #333", borderRadius: 8, padding: 8, fontSize: 11 }} />
    </main>
  );
}
