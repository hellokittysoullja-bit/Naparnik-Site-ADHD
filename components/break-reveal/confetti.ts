/**
 * Конфетти на весь экран после разбивки (владелец 16.11: «как в Duolingo: сова прыгает, конфетти сверху — прям во
 * всём экране»). Один холст поверх страницы, физика своя: гравитация, сопротивление воздуха, переворот листика
 * (scaleY = cos фазы — «блестит» то лицом, то ребром), плавное угасание в конце. Через ~2,6 с холст убирается сам.
 *
 * Фигуры — из мира Напарника, не только бумажки: листики, кружки, кудрявые ленточки, искры как у кота (четыре луча)
 * и отпечатки лап (подушечки вырезаны из эталона кота, public/mascot/reveal/print.webp). Цвета — лайм кнопки,
 * золото награды, оранжевый подушечек, розовый язычка, голубой и белый.
 *
 * Анимирует только canvas (один слой, без DOM-узлов на каждую бумажку) — на слабом телефоне это одна текстура.
 */

const COLORS = ['#a0ec2a', '#f7c747', '#ff8a3d', '#ff9ec7', '#7cc8ff', '#f2f2ec', '#c9f27a']

type Kind = 'leaf' | 'dot' | 'ribbon' | 'spark' | 'paw'
type Piece = {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  flip: number
  vflip: number
  size: number
  color: string
  wob: number
  wobAmp: number
  drag: number
  grav: number
  vmax: number
  born: number
  life: number
}

export type Burst = {
  /** откуда: точка экрана в CSS px */
  x: number
  y: number
  count: number
  /** направление выстрела, радианы (0 — вправо, −π/2 — вверх) */
  angle: number
  spread: number
  speed: [number, number]
  delay?: number
  /** выпуск растянут на столько мс — поток, а не один хлопок (иначе бумажки летят «строем» и ложатся полосой) */
  stagger?: number
  /** разброс точки выпуска по x и y, px */
  jitter?: [number, number]
}

let printImg: HTMLImageElement | null = null
const tinted = new Map<string, HTMLCanvasElement>()

function pawSprite(color: string): HTMLCanvasElement | null {
  if (!printImg || !printImg.complete || !printImg.naturalWidth) return null
  const hit = tinted.get(color)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = printImg.naturalWidth
  c.height = printImg.naturalHeight
  const g = c.getContext('2d')!
  g.drawImage(printImg, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  tinted.set(color, c)
  return c
}

/** подгрузить отпечаток заранее (до первого праздника), чтобы лапки были уже в первом залпе */
export function preloadConfetti(src: string) {
  if (typeof window === 'undefined' || printImg) return
  printImg = new Image()
  printImg.decoding = 'async'
  printImg.src = src
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function pickKind(): Kind {
  const r = Math.random()
  return r < 0.46 ? 'leaf' : r < 0.62 ? 'dot' : r < 0.78 ? 'ribbon' : r < 0.9 ? 'spark' : 'paw'
}

export function confetti(bursts: Burst[], opts: { duration?: number; avoid?: DOMRect[] } = {}): () => void {
  if (typeof window === 'undefined') return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = window.innerWidth
  const H = window.innerHeight
  const cv = document.createElement('canvas')
  cv.setAttribute('aria-hidden', 'true')
  cv.width = Math.round(W * dpr)
  cv.height = Math.round(H * dpr)
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none', zIndex: '80' })
  document.body.appendChild(cv)
  const g = cv.getContext('2d')!
  g.scale(dpr, dpr)

  const total = opts.duration ?? 2600
  const pieces: Piece[] = []
  for (const b of bursts) {
    for (let i = 0; i < b.count; i++) {
      const a = b.angle + rnd(-b.spread, b.spread) / 2
      const v = rnd(b.speed[0], b.speed[1])
      const kind = pickKind()
      const [jx, jy] = b.jitter ?? [6, 6]
      pieces.push({
        kind,
        x: b.x + rnd(-jx, jx),
        y: b.y + rnd(-jy, jy),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: rnd(0, Math.PI * 2),
        vr: rnd(-9, 9),
        flip: rnd(0, Math.PI * 2),
        vflip: rnd(6, 16),
        size: kind === 'paw' ? rnd(13, 18) : kind === 'spark' ? rnd(7, 11) : rnd(6, 10),
        color: COLORS[(Math.random() * COLORS.length) | 0],
        wob: rnd(0, Math.PI * 2),
        wobAmp: rnd(18, 60),
        // у каждой бумажки свой вес: одни падают камнем, другие долго планируют — так не бывает «строя»
        drag: kind === 'dot' ? rnd(0.4, 0.9) : rnd(1.1, 2.8),
        grav: kind === 'dot' ? rnd(800, 1000) : rnd(420, 720),
        vmax: kind === 'dot' ? 900 : rnd(200, 400),
        born: (b.delay ?? 0) + rnd(0, b.stagger ?? 0),
        life: rnd(total * 0.7, total),
      })
    }
  }

  let raf = 0
  let t0 = 0
  let last = 0
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    cv.remove()
  }

  const frame = (now: number) => {
    if (!t0) t0 = last = now
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    const el = now - t0
    g.clearRect(0, 0, W, H)
    let alive = 0
    for (const p of pieces) {
      if (el < p.born) {
        alive++
        continue
      }
      const age = el - p.born
      if (age > p.life) continue
      alive++
      // воздух: бумажка тормозит быстро и дальше «планирует», качаясь из стороны в сторону
      p.vx -= p.vx * p.drag * dt
      p.vy -= p.vy * p.drag * dt
      p.vy += p.grav * dt
      if (p.vy > p.vmax) p.vy = p.vmax
      p.wob += dt * 5
      p.x += (p.vx + (p.kind === 'leaf' || p.kind === 'ribbon' || p.kind === 'paw' ? Math.sin(p.wob) * p.wobAmp : 0)) * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      p.flip += p.vflip * dt
      if (p.y > H + 40) continue
      const fade = Math.min(1, (p.life - age) / 420)
      g.globalAlpha = fade
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      const sy = Math.cos(p.flip)
      g.fillStyle = p.color
      switch (p.kind) {
        case 'leaf': {
          g.scale(1, sy)
          // тень ребра: когда листок повёрнут, он чуть темнее — читается объём
          if (Math.abs(sy) < 0.35) g.globalAlpha = fade * 0.75
          g.beginPath()
          g.roundRect(-p.size * 0.5, -p.size * 0.8, p.size, p.size * 1.6, 1.6)
          g.fill()
          break
        }
        case 'dot':
          g.beginPath()
          g.arc(0, 0, p.size * 0.42, 0, Math.PI * 2)
          g.fill()
          break
        case 'ribbon': {
          g.scale(1, 0.6 + 0.4 * Math.abs(sy))
          g.strokeStyle = p.color
          g.lineWidth = 3
          g.lineCap = 'round'
          g.beginPath()
          for (let k = 0; k <= 10; k++) {
            const u = k / 10
            const xx = (u - 0.5) * p.size * 2.6
            const yy = Math.sin(u * Math.PI * 2 + p.wob * 2) * p.size * 0.45
            if (k) g.lineTo(xx, yy)
            else g.moveTo(xx, yy)
          }
          g.stroke()
          break
        }
        case 'spark': {
          // четырёхлучевая искра — как звёздочки у кота в радости
          const s = p.size * (0.85 + 0.15 * Math.sin(p.flip))
          g.beginPath()
          g.moveTo(0, -s)
          g.quadraticCurveTo(0, 0, s, 0)
          g.quadraticCurveTo(0, 0, 0, s)
          g.quadraticCurveTo(0, 0, -s, 0)
          g.quadraticCurveTo(0, 0, 0, -s)
          g.fill()
          break
        }
        case 'paw': {
          const sp = pawSprite(p.color)
          g.scale(1, 0.55 + 0.45 * Math.abs(sy))
          if (sp) g.drawImage(sp, -p.size / 2, -p.size / 2, p.size, (p.size * sp.height) / sp.width)
          else {
            g.beginPath()
            g.arc(0, 0, p.size * 0.4, 0, Math.PI * 2)
            g.fill()
          }
          break
        }
      }
      g.restore()
    }
    g.globalAlpha = 1
    // «окна» поверх холста: бумажки проходят позади них (квитанция кота читается)
    if (opts.avoid?.length) {
      g.save()
      g.globalCompositeOperation = 'destination-out'
      for (const a of opts.avoid) {
        g.beginPath()
        g.roundRect(a.left - 3, a.top - 3, a.width + 6, a.height + 6, 20)
        g.fill()
      }
      g.restore()
    }
    if (!alive || el > total + 600) return stop()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  return stop
}

/** Праздник как у Duolingo: две пушки сверху по углам бьют вниз-внутрь на весь экран + хлопок от самого кота вверх */
export function celebrate(cat: { x: number; y: number }, avoid: DOMRect[] = []) {
  const W = window.innerWidth
  return confetti(
    [
      // две пушки из верхних углов — поток вниз-внутрь на весь экран
      { x: -10, y: -30, count: 48, angle: Math.PI * 0.3, spread: 1.1, speed: [380, 1050], stagger: 380, jitter: [10, 40] },
      { x: W + 10, y: -30, count: 48, angle: Math.PI * 0.7, spread: 1.1, speed: [380, 1050], stagger: 380, jitter: [10, 40] },
      // мягкий дождь сверху по всей ширине
      { x: W * 0.5, y: -24, count: 30, angle: Math.PI * 0.5, spread: 0.5, speed: [40, 220], delay: 150, stagger: 600, jitter: [W * 0.5, 20] },
      // хлопок от самого кота вверх
      { x: cat.x, y: cat.y, count: 36, angle: -Math.PI / 2, spread: 2.1, speed: [380, 900], delay: 60, stagger: 90, jitter: [14, 8] },
    ],
    { duration: 3000, avoid },
  )
}
