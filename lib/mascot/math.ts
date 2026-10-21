/**
 * Математика куклы: пружины (secondary motion), простой шум, сглаживание.
 * Без зависимостей — используется и движком, и лабораторией.
 */

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/**
 * Пружина с затуханием (semi-implicit Euler). target — куда тянет, inertia —
 * сколько «внешнего» ускорения прилетает в скорость: так ухо отстаёт от головы
 * и доболтывается, хотя его никто не анимирует.
 */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(
    public stiffness = 120,
    public damping = 10,
  ) {}
  step(dt: number, target = 0) {
    const h = Math.min(dt, 1 / 30);
    this.velocity += (this.stiffness * (target - this.value) - this.damping * this.velocity) * h;
    this.value += this.velocity * h;
    return this.value;
  }
  kick(impulse: number) {
    this.velocity += impulse;
  }
  reset(v = 0) {
    this.value = v;
    this.velocity = 0;
  }
}

/** 1D value noise со сглаживанием: достаточно для «плавания» костей, шов цикла не ловится */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 131.7) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  const a = h(i);
  const b = h(i + 1);
  return (lerp(a, b, smoothstep(f)) - 0.5) * 2;
}

/** Несколько октав шума — мелкая дрожь поверх медленного дрейфа */
export function fbm(x: number, seed = 0): number {
  return noise1(x, seed) * 0.65 + noise1(x * 2.7, seed + 1) * 0.25 + noise1(x * 7.1, seed + 2) * 0.1;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
