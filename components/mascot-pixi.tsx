"use client";

/**
 * ПРОТОТИП: кот на PixiJS (WebGL) + GSAP — настоящий скиннинг сеткой.
 *
 * Хвост и уши — не жёсткие куски и не цепочка клипов, а сетка вершин поверх
 * того же слоя рисунка (public/mascot/*.webp). Каждая вершина получает вес
 * по положению вдоль «костей» (суставы хвоста), и рисунок ГНЁТСЯ плавно,
 * как в Spine/Live2D (linear blend skinning, считаем на CPU — сетка ~200
 * вершин). Углы костей крутит GSAP: каждая со сдвигом по фазе, поэтому по
 * хвосту бежит волна, а кончик с огоньком раскачивается сильнее всего.
 *
 * Остальное — те же слои на «костях» GSAP: дыхание, голова с задержкой,
 * зрачки за курсором, моргание кроссфейдом на сгенерированные закрытые глаза.
 *
 * Не заменяет MascotSvg: на лендинге котов несколько, а WebGL-контекст на
 * каждого дорог; серверный первый кадр остаётся SVG. Это проверка, даёт ли
 * сетка заметно более живой результат.
 */

import { useEffect, useRef } from "react";
import { L, type Layer } from "@/components/mascot-geometry";

const VIEW = { x: 250, y: -85, size: 910 };
const TAIL_JOINTS: ReadonlyArray<readonly [number, number]> = [
  [825, 697],
  [900, 702],
  [975, 705],
  [1040, 690],
  [1085, 655],
  [1100, 600],
  [1095, 545],
  [1075, 490],
];

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** Параметр вершины вдоль ломаной суставов: 0..n-1 (дробный) */
function paramAlong(px: number, py: number, joints: ReadonlyArray<readonly [number, number]>) {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < joints.length - 1; i++) {
    const [ax, ay] = joints[i];
    const [bx, by] = joints[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    if (d < best.d) best = { d, s: i + t };
  }
  return best.s;
}

export function MascotPixi({ size = 420, className }: { size?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const [{ Application, Assets, Container, MeshSimple, Sprite }, { gsap }] = await Promise.all([
        import("pixi.js"),
        import("gsap"),
      ]);
      if (disposed || !host.current) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const app = new Application();
      await app.init({
        width: VIEW.size,
        height: VIEW.size,
        backgroundAlpha: 0,
        antialias: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      host.current.appendChild(app.canvas);
      app.canvas.style.width = `${size}px`;
      app.canvas.style.height = `${size}px`;
      app.canvas.setAttribute("aria-hidden", "true");

      const tex = async (l: Layer) => Assets.load(l.href);
      const sprite = async (l: Layer) => {
        const s = new Sprite(await tex(l));
        s.position.set(l.x, l.y);
        s.width = l.w;
        s.height = l.h;
        return s;
      };

      const world = new Container();
      world.position.set(-VIEW.x, -VIEW.y);
      app.stage.addChild(world);

      /* ── Меш со скиннингом ───────────────────────────────────────── */
      type Skin = {
        mesh: InstanceType<typeof MeshSimple>;
        rest: Float32Array;
        deform: (out: Float32Array, rest: Float32Array) => void;
      };
      const buildMesh = async (l: Layer, cols: number, rows: number): Promise<Skin> => {
        const texture = await tex(l);
        const n = (cols + 1) * (rows + 1);
        const rest = new Float32Array(n * 2);
        const uvs = new Float32Array(n * 2);
        const indices: number[] = [];
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c <= cols; c++) {
            const i = r * (cols + 1) + c;
            rest[i * 2] = l.x + (l.w * c) / cols;
            rest[i * 2 + 1] = l.y + (l.h * r) / rows;
            uvs[i * 2] = c / cols;
            uvs[i * 2 + 1] = r / rows;
            if (r < rows && c < cols) {
              const a = i;
              const b = i + 1;
              const d = i + cols + 1;
              indices.push(a, b, d, b, d + 1, d);
            }
          }
        }
        const mesh = new MeshSimple({
          texture,
          vertices: new Float32Array(rest),
          uvs,
          indices: new Uint32Array(indices),
        });
        return { mesh, rest, deform: () => {} };
      };

      /* хвост: кости-суставы, углы крутит GSAP */
      const tail = await buildMesh(L.tail, 18, 20);
      const tailAngles = TAIL_JOINTS.map(() => ({ a: 0 }));
      const tailS = new Float32Array(tail.rest.length / 2);
      for (let i = 0; i < tailS.length; i++) {
        tailS[i] = paramAlong(tail.rest[i * 2], tail.rest[i * 2 + 1], TAIL_JOINTS);
      }
      // FK-цепочка: изнутри наружу, точка проходит повороты всех суставов,
      // которые она «обгоняет», с плавным весом. Возвращает и суммарный угол
      const skinPoint = (px: number, py: number, s: number) => {
        let x = px;
        let y = py;
        let total = 0;
        for (let i = TAIL_JOINTS.length - 1; i >= 0; i--) {
          const k = smooth(s - i + 0.5);
          if (k <= 0) continue;
          const ang = tailAngles[i].a * k;
          total += ang;
          const [jx, jy] = TAIL_JOINTS[i];
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const dx = x - jx;
          const dy = y - jy;
          x = jx + dx * cos - dy * sin;
          y = jy + dx * sin + dy * cos;
        }
        return { x, y, total };
      };
      tail.deform = (out, rest) => {
        for (let v = 0; v < tailS.length; v++) {
          const p = skinPoint(rest[v * 2], rest[v * 2 + 1], tailS[v]);
          out[v * 2] = p.x;
          out[v * 2 + 1] = p.y;
        }
      };
      // огонёк стоит на макушке завитка и едет по той же скиннинг-функции
      const FLAME_BASE = { x: 972, y: 432 };
      const flameS = paramAlong(FLAME_BASE.x, FLAME_BASE.y, TAIL_JOINTS);

      /* ухо: одна кость в основании, вес растёт к кончику */
      const makeEar = async (l: Layer, pivot: { x: number; y: number }) => {
        const m = await buildMesh(l, 8, 8);
        const ang = { a: 0 };
        const w = new Float32Array(m.rest.length / 2);
        const reach = Math.hypot(l.w, l.h) * 0.75;
        for (let i = 0; i < w.length; i++) {
          w[i] = smooth(Math.hypot(m.rest[i * 2] - pivot.x, m.rest[i * 2 + 1] - pivot.y) / reach);
        }
        m.deform = (out, rest) => {
          for (let v = 0; v < w.length; v++) {
            const a = ang.a * w[v];
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            const dx = rest[v * 2] - pivot.x;
            const dy = rest[v * 2 + 1] - pivot.y;
            out[v * 2] = pivot.x + dx * cos - dy * sin;
            out[v * 2 + 1] = pivot.y + dx * sin + dy * cos;
          }
        };
        return { m, ang };
      };
      const earL = await makeEar(L.earL, { x: 470, y: 255 });
      const earR = await makeEar(L.earR, { x: 735, y: 245 });

      /* ── Сцена ───────────────────────────────────────────────────── */
      const flame = await sprite(L.flame);
      // основание огонька — начало координат своей группы
      flame.position.set(L.flame.x - FLAME_BASE.x, L.flame.y - FLAME_BASE.y);
      const flameGroup = new Container();
      // дрожание — на внутренней группе: масштаб и наклон от основания огня
      const flameInner = new Container();
      flameInner.addChild(flame);
      flameGroup.addChild(flameInner);

      const body = await sprite(L.body);
      const leg = await sprite(L.leg);
      const paw = await sprite(L.paw);
      const head = await sprite(L.head);
      const pupilL = await sprite(L.pupilL);
      const pupilR = await sprite(L.pupilR);
      const closedL = await sprite(L.eyeClosedL);
      const closedR = await sprite(L.eyeClosedR);
      closedL.alpha = 0;
      closedR.alpha = 0;
      const eyeFurL = await sprite(L.eyeFurL);
      const eyeFurR = await sprite(L.eyeFurR);
      eyeFurL.alpha = 0;
      eyeFurR.alpha = 0;

      const breathe = new Container();
      breathe.addChild(body, leg, paw);
      const ride = new Container();
      ride.addChild(earL.m.mesh, earR.m.mesh, head, pupilL, pupilR, eyeFurL, eyeFurR, closedL, closedR);
      world.addChild(tail.mesh, flameGroup, breathe, ride);

      // опоры для масштабирования от земли
      breathe.pivot.set(600, 768);
      breathe.position.set(600, 768);
      ride.pivot.set(600, 768);
      ride.position.set(600, 768);

      app.ticker.add(() => {
        tail.deform(tail.mesh.vertices as Float32Array, tail.rest);
        earL.m.deform(earL.m.mesh.vertices as Float32Array, earL.m.rest);
        earR.m.deform(earR.m.mesh.vertices as Float32Array, earR.m.rest);
        const f = skinPoint(FLAME_BASE.x, FLAME_BASE.y, flameS);
        flameGroup.position.set(f.x, f.y);
        flameGroup.rotation = f.total;
      });

      if (reduce) return void (cleanup = () => app.destroy(true, { children: true }));

      /* ── GSAP: слои жизни ────────────────────────────────────────── */
      const ctx = gsap.context(() => {
        // хвост: волна, у каждой кости своя фаза; амплитуда нарастает к кончику
        tailAngles.forEach((b, i) => {
          gsap.to(b, {
            a: 0.012 + i * 0.003,
            duration: 3.7,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: -i * 0.42,
          });
          b.a = -(0.012 + i * 0.003);
        });
        // уши: каждое на своей частоте
        gsap.to(earL.ang, { a: 0.07, duration: 4.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(earR.ang, { a: -0.06, duration: 5.3, ease: "sine.inOut", yoyo: true, repeat: -1, delay: -1.2 });
        // дыхание: вдох короче выдоха, с удержанием
        const br = gsap.timeline({ repeat: -1 });
        br.to(breathe.scale, { y: 1.032, x: 1.008, duration: 1.8, ease: "sine.inOut" })
          .to(breathe.scale, { y: 1.032, x: 1.008, duration: 0.45 })
          .to(breathe.scale, { y: 1, x: 1, duration: 2.35, ease: "sine.inOut" });
        gsap.to(ride.position, { y: 768 - 8, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.14 });
        // огонёк
        gsap.to(flameInner.scale, { x: 1.06, y: 0.94, duration: 0.65, ease: "sine.inOut", yoyo: true, repeat: -1 });
        gsap.to(flameInner.skew, { x: 0.05, duration: 0.9, ease: "sine.inOut", yoyo: true, repeat: -1 });

        // моргание: случайный интервал, кроссфейд на закрытые глаза
        const blink = () => {
          gsap.delayedCall(4 + Math.random() * 6, () => {
            const t = gsap.timeline({ onComplete: blink });
            t.to([closedL, closedR, eyeFurL, eyeFurR], { alpha: 1, duration: 0.06 })
              .to([closedL, closedR, eyeFurL, eyeFurR], { alpha: 0, duration: 0.12 }, "+=0.06");
          });
        };
        blink();
      });

      // взгляд за курсором
      const onMove = (e: PointerEvent) => {
        const r = app.canvas.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.6)));
        const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.45)) / (r.height * 0.6)));
        gsap.to(pupilL, { x: L.pupilL.x + dx * 22, y: L.pupilL.y + dy * 18, duration: 0.25, ease: "power2.out", overwrite: "auto" });
        gsap.to(pupilR, { x: L.pupilR.x + dx * 22, y: L.pupilR.y + dy * 18, duration: 0.25, ease: "power2.out", overwrite: "auto" });
        gsap.to(ride.skew, { x: dx * 0.02, duration: 0.5, ease: "power2.out", overwrite: "auto" });
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      cleanup = () => {
        window.removeEventListener("pointermove", onMove);
        ctx.revert();
        app.destroy(true, { children: true });
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [size]);

  return <div ref={host} className={className} style={{ width: size, height: size }} role="img" aria-label="Напарник" />;
}
