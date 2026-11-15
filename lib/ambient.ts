/**
 * Эмбиент костра: синтез через WebAudio, ноль аудиофайлов.
 * Паттерн Calm: тихий фоновый звук снижает perceived effort сессии
 * и маскирует отвлекающие шумы. Строго опт-ин, громкость минимальная.
 *
 * Устройство: фильтрованный коричневый шум (гул пламени) +
 * случайные короткие щелчки (потрескивание веток).
 */

let ctx: AudioContext | null = null
let running: { stop: () => void } | null = null

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function isAmbientPlaying(): boolean {
  return running !== null
}

export function startCampfire() {
  if (running) return
  const ac = audioCtx()
  if (!ac) return

  const master = ac.createGain()
  master.gain.value = 0
  master.connect(ac.destination)
  // Плавный вход за 1.5 с — звук «разгорается», а не включается
  master.gain.linearRampToValueAtTime(0.028, ac.currentTime + 1.5)

  // Гул пламени: коричневый шум через низкий фильтр
  const bufferLen = ac.sampleRate * 2
  const buffer = ac.createBuffer(1, bufferLen, ac.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < bufferLen; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const lowpass = ac.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = 320
  noise.connect(lowpass)
  lowpass.connect(master)
  noise.start()

  // Дыхание пламени: медленная модуляция громкости гула
  const lfo = ac.createOscillator()
  lfo.frequency.value = 0.13
  const lfoGain = ac.createGain()
  lfoGain.gain.value = 0.008
  lfo.connect(lfoGain)
  lfoGain.connect(master.gain)
  lfo.start()

  // Потрескивание: случайные короткие высокочастотные щелчки
  let crackleTimer: number | null = null
  function scheduleCrackle() {
    crackleTimer = window.setTimeout(
      () => {
        if (!running) return
        const t = ac!.currentTime
        const pop = ac!.createOscillator()
        const g = ac!.createGain()
        pop.type = 'triangle'
        pop.frequency.value = 900 + Math.random() * 2200
        g.gain.setValueAtTime(0.012 + Math.random() * 0.014, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.05)
        pop.connect(g)
        g.connect(master)
        pop.start(t)
        pop.stop(t + 0.12)
        scheduleCrackle()
      },
      180 + Math.random() * 900,
    )
  }
  scheduleCrackle()

  running = {
    stop() {
      if (crackleTimer) window.clearTimeout(crackleTimer)
      // Плавное затухание — костёр гаснет, а не обрывается
      const t = ac.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.8)
      window.setTimeout(() => {
        noise.stop()
        lfo.stop()
        master.disconnect()
      }, 900)
    },
  }
}

export function stopCampfire() {
  if (!running) return
  const r = running
  running = null
  r.stop()
}


// ---------- Фон на выбор: костёр, дождь, ровный шум ----------
// Приём: звуковой фон на экране фокуса с выбором (Tiimo — плашка «Lo-fi beats» в углу таймера, Focus Friend — музыка
// от музыкантов, Numo — белый шум; research/25-deep-teardowns). Музыку с правами нам брать неоткуда, поэтому всё
// синтезируется в браузере, без файлов: дождь и ровный («коричневый») шум. Заявлений «улучшает концентрацию» не делаем.
export type AmbientKind = 'fire' | 'rain' | 'noise'
export const AMBIENT_KINDS: { key: AmbientKind; label: string }[] = [
  { key: 'fire', label: 'Костёр' },
  { key: 'rain', label: 'Дождь' },
  { key: 'noise', label: 'Ровный шум' },
]

function noiseBuffer(ac: AudioContext, brown: boolean) {
  const len = ac.sampleRate * 3
  const buffer = ac.createBuffer(1, len, ac.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else data[i] = white
  }
  return buffer
}

function startLayered(kind: 'rain' | 'noise') {
  const ac = audioCtx()
  if (!ac) return
  const master = ac.createGain()
  master.gain.value = 0
  master.connect(ac.destination)
  master.gain.linearRampToValueAtTime(kind === 'rain' ? 0.05 : 0.035, ac.currentTime + 1.5)
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac, kind === 'noise')
  src.loop = true
  const nodes: AudioNode[] = [src]
  let dropTimer: number | null = null
  if (kind === 'rain') {
    // шелест: белый шум в полосе 600–6000 Гц; редкие капли — короткие всплески той же полосы
    const hp = ac.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 600
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000
    src.connect(hp)
    hp.connect(lp)
    lp.connect(master)
    nodes.push(hp, lp)
    const drop = () => {
      dropTimer = window.setTimeout(() => {
        if (!running) return
        const t = ac.currentTime
        const o = ac.createOscillator()
        const g = ac.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(1400 + Math.random() * 1600, t)
        o.frequency.exponentialRampToValueAtTime(500, t + 0.06)
        g.gain.setValueAtTime(0.006 + Math.random() * 0.008, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
        o.connect(g)
        g.connect(master)
        o.start(t)
        o.stop(t + 0.1)
        drop()
      }, 120 + Math.random() * 500)
    }
    drop()
  } else {
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    src.connect(lp)
    lp.connect(master)
    nodes.push(lp)
  }
  src.start()
  running = {
    stop() {
      if (dropTimer) window.clearTimeout(dropTimer)
      const t = ac.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.8)
      window.setTimeout(() => {
        src.stop()
        master.disconnect()
      }, 900)
    },
  }
}

export function startAmbient(kind: AmbientKind) {
  if (running) return
  if (kind === 'fire') startCampfire()
  else startLayered(kind)
}
export const stopAmbient = stopCampfire
