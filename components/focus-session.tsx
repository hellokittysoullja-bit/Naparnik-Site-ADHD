'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { MascotSvg } from '@/components/mascot-svg'
import { EmphasisText } from '@/components/emphasis-text'
import { RevealIsland, type RevealNewItem } from '@/components/reveal-island'
import { ChevronRight, Sparkles } from 'lucide-react'
import {
  addFind,
  clearActiveSession,
  clearPlan,
  consumeQueueStep,
  getActiveSession,
  getCompanionName,
  getFinds,
  getPatterns,
  getPlan,
  getStarts,
  getStepQueue,
  recordStart,
  saveActiveSession,
  savePlan,
  saveStepQueue,
  todayKey,
  updateStartMinutes,
  type IslandFindEntry,
} from '@/lib/memory'
import {
  drawFind,
  elementNameForStartNumber,
  ISLAND_POOL,
  LANDMARK_COUNT,
  RARITY_LABEL,
  type Rarity,
} from '@/lib/island-elements'
import { playStartSigh } from '@/lib/reward-sound'
import { startCampfire, stopCampfire } from '@/lib/ambient'
import { hapticDone, hapticStart, hapticThreshold } from '@/lib/haptics'
import { trimLabel } from '@/lib/utils'
import { FIRST_MINUTES } from '@/lib/onboarding'

const durations = [15, 25, 45]

// Русская плюрализация «N ненайденных находок»: без неё тизер на малых
// остатках («ещё 2 ненайденных находок») читается машинным — ровно в момент,
// когда коллекция почти собрана и каждый знак внимания на счету
function pluralFinds(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'ненайденная находка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return 'ненайденные находки'
  return 'ненайденных находок'
}

// Готовые шаги: пустое поле для СДВГ — стена. Нажал чип — поехали.
const stepChips = ['Открыть документ', 'Убрать одну вещь', 'Ответить на одно сообщение']

const HIDE_DIGITS_KEY = 'naparnik:hideDigits'

/**
 * Реплика сетапа. На первой сессии объясняет правило («первый шаг — не
 * вся задача») — это ещё не прожито. На последующих — то же объяснение
 * читается как будто существо забыло, что уже говорило это вчера.
 */
function buildSetupLine(
  prefilledStep: string,
  priorSessions: number,
  companionName: string | null,
): string {
  if (prefilledStep) return 'Шаг уже выбран. Просто *жми* — я рядом.'
  if (priorSessions === 0) {
    return 'Что делаем? Назови *первый шаг* — не всю задачу.'
  }
  return companionName
    ? `Погнали. Что *в фокусе*? ${companionName} рядом.`
    : 'Погнали. Что *в фокусе*? Я рядом.'
}
const AMBIENT_KEY = 'naparnik:ambient'

type Moment = 'start' | 'middle' | 'late' | 'done' | 'early-exit'

const fallbackVoice: Record<Moment, string> = {
  start: 'Я рядом. *Одно действие* за раз.',
  middle: '*Половина* есть. Ты реально в игре.',
  late: 'Осталось чуть-чуть. *Финишная прямая*.',
  done: 'Начато и отработано. Мой остров стал чуть больше. Без пафоса: ты *красавчик*.',
  'early-exit': 'Ты начал — это *главное*. Остров всё равно вырос. Ноль стыда.',
}

async function fetchVoice(moment: Moment, task: string, minutes: number): Promise<string> {
  try {
    const res = await fetch('/api/session-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment, task, minutes }),
    })
    if (!res.ok) return fallbackVoice[moment]
    const data = (await res.json()) as { text: string | null }
    return data.text || fallbackVoice[moment]
  } catch {
    return fallbackVoice[moment]
  }
}

type Phase = 'setup' | 'starting' | 'running' | 'done'

export function FocusSession() {
  const reducedMotion = useReducedMotion()
  const searchParams = useSearchParams()
  const prefilledStep = searchParams.get('step') ?? ''
  const fromPlan = searchParams.get('plan') === '1'
  const prefilledDuration = Number(searchParams.get('d'))
  // auto=1 приходит из знакомства (/app/start): человек уже выбрал шаг и
  // удержал кнопку — повторный сетап был бы вторым «точно?» подряд.
  // Только там разрешена короткая первая сессия (FIRST_MINUTES).
  const autoStart = searchParams.get('auto') === '1' && Boolean(prefilledStep)
  const initialMinutes =
    durations.includes(prefilledDuration) ||
    (autoStart && prefilledDuration === FIRST_MINUTES)
      ? prefilledDuration
      : 25

  const [phase, setPhase] = useState<Phase>('setup')
  const [task, setTask] = useState(prefilledStep)

  // Имя и число прошлых сессий — тот же экран не должен объяснять
  // механику вечно: на 20-й сессии человек уже знает, что «первый шаг —
  // не вся задача». Раз узнаём на маунте — реплика сетапа тратится
  // мгновенно, к моменту, когда человек читает текст, состояние уже есть.
  const [companionName, setCompanionName] = useState<string | null>(null)
  const [priorSessions, setPriorSessions] = useState(0)
  useEffect(() => {
    void getCompanionName().then(setCompanionName)
    void getPatterns().then((p) => setPriorSessions(p.totalStarts))
  }, [])

  // «Раздроби мне задачу»: человек пишет большое пугающее дело —
  // AI возвращает 3 крошечных шага. Task initiation — главный
  // bottleneck СДВГ; выбор готового микрошага снимает стену.
  const [brokenSteps, setBrokenSteps] = useState<string[] | null>(null)
  const [breaking, setBreaking] = useState(false)
  // Раньше сетевая ошибка просто отпускала кнопку без следа — человек не
  // понимал, сработало дробление или нет, и был вынужден жать вслепую ещё
  // раз. Теперь ошибка видима и даёт явный повтор (WCAG Status Messages).
  const [breakError, setBreakError] = useState(false)
  async function breakDown() {
    if (!task.trim() || breaking) return
    setBreaking(true)
    setBreakError(false)
    try {
      const res = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: task.trim() }),
      })
      if (res.ok) {
        const data = (await res.json()) as { steps: string[] | null }
        if (data.steps) setBrokenSteps(data.steps)
        else setBreakError(true)
      } else {
        setBreakError(true)
      }
    } catch {
      setBreakError(true)
    } finally {
      setBreaking(false)
    }
  }
  const [minutes, setMinutes] = useState(initialMinutes)
  // #7 · Default Effect: пока человек сам не тронул длительность, чип 25
  // мин помечен как рекомендованный, а не просто «уже выбранный системой».
  // Как только выбор стал осознанным — метка больше не нужна.
  const [durationTouched, setDurationTouched] = useState(Boolean(prefilledDuration))
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [voice, setVoice] = useState(fallbackVoice.start)
  const [doneVoice, setDoneVoice] = useState<string | null>(null)
  const [endedEarly, setEndedEarly] = useState(false)
  // Самый первый старт в жизни продукта — пик называем по имени шага,
  // а не общей фразой: это момент, который человек запомнит (Peak-End)
  const [firstEver, setFirstEver] = useState(false)

  // Награда: что выросло на острове после этого старта.
  // Ориентир (старты 1-10) или находка из пула с редкостью (старты 11+).
  // landmarksUnlocked/finds/newItem — снимок острова ДО этой находки, нужен
  // RevealIsland, чтобы прорастить новый элемент на настоящем острове, а не
  // на отдельной карточке (см. components/reveal-island.tsx).
  const [grownElement, setGrownElement] = useState<{
    name: string
    rarity: Rarity | 'landmark'
    landmarksUnlocked: number
    finds: IslandFindEntry[]
    newItem: RevealNewItem
  } | null>(null)

  // Ритуал завершения: план на завтра на пике дофамина.
  // Форма свёрнута: пик отдан находке, план — по желанию (не обязанность).
  const [tomorrowTask, setTomorrowTask] = useState('')
  const [tomorrowStep, setTomorrowStep] = useState('')
  const [planSaved, setPlanSaved] = useState(false)
  const [planFormOpen, setPlanFormOpen] = useState(false)

  // «Ещё разок» на пике (one-more-time hook): следующая цель острова и
  // следующий микрошаг из очереди дробления видны прямо на финальном экране —
  // сессия заканчивается не точкой, а приглашением.
  const [nextUp, setNextUp] = useState<{
    /** Следующий микрошаг из очереди дробления, если остался */
    step: string | null
    /** Задача, из которой раздроблен шаг (для однотапового плана) */
    queueTask: string | null
    /** Честный тизер следующего роста острова */
    tease: string | null
  }>({ step: null, queueTask: null, tease: null })

  // Раскрытие формы добавляет ~140px под сгиб (2 поля + кнопка + CTA
  // «Ещё одна сессия» ниже) — без автоскролла кнопка сохранения формы
  // и следующая за ней CTA утыкаются в fixed-нав без подсказки, что
  // нужно проскроллить. Скроллим к концу документа, а не scrollIntoView
  // на саму форму: элемент оказывается «уже в зоне видимости» по расчёту
  // браузера ещё до появления кнопок под ним, и scrollIntoView тогда
  // молча не скроллит вовсе — эмпирически проверено, не только в теории.
  useEffect(() => {
    if (planFormOpen) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }, [planFormOpen])

  // Защита состояния потока: пока идёт сессия, нижний таб-бар (Дом/Мир)
  // — это всегда видимая рампа выхода ровно в тот момент, когда мы держим
  // человека в фокусе. Flow требует убрать конкурирующие affordance'ы
  // действия (так же гаснет HUD в играх на катсцене, прячется хром в
  // видеоплеере). Не ловушка: «Закончить раньше» на экране остаётся, и
  // это его собственный таймер. На фазе 'done' (награда + план) навигация
  // возвращается — уйти на выросший остров как раз желанно.
  // Нав живёт в layout, фаза — здесь, поэтому связь через data-атрибут body.
  useEffect(() => {
    const immersive = phase === 'starting' || phase === 'running'
    if (immersive) document.body.dataset.focusImmersive = 'true'
    else delete document.body.dataset.focusImmersive
    return () => {
      delete document.body.dataset.focusImmersive
    }
  }, [phase])

  // Последовательное раскрытие: сначала находка одна на экране
  // (пик без конкурентов), потом появляются план и кнопки
  const [restRevealed, setRestRevealed] = useState(false)

  // Обратный отсчёт для СДВГ — давление дедлайна. Цифры можно спрятать:
  // остаются существо и полоска. Выбор запоминается.
  const [hideDigits, setHideDigits] = useState(false)
  useEffect(() => {
    try {
      setHideDigits(localStorage.getItem(HIDE_DIGITS_KEY) === '1')
    } catch {
      /* приватный режим */
    }
  }, [])
  // Эмбиент костра: опт-ин, паттерн Calm — тихий фон снижает
  // perceived effort. Играет только пока идёт сессия.
  const [ambientOn, setAmbientOn] = useState(false)
  useEffect(() => {
    try {
      setAmbientOn(localStorage.getItem(AMBIENT_KEY) === '1')
    } catch {
      /* приватный режим */
    }
  }, [])
  useEffect(() => {
    if (phase === 'running' && ambientOn) startCampfire()
    else stopCampfire()
    return () => stopCampfire()
  }, [phase, ambientOn])
  function toggleAmbient() {
    setAmbientOn((v) => {
      try {
        localStorage.setItem(AMBIENT_KEY, v ? '0' : '1')
      } catch {
        /* приватный режим */
      }
      return !v
    })
  }

  function toggleDigits() {
    setHideDigits((v) => {
      try {
        localStorage.setItem(HIDE_DIGITS_KEY, v ? '0' : '1')
      } catch {
        /* приватный режим */
      }
      return !v
    })
  }

  // Раскрытие «остального» (план/кнопки) теперь ведёт RevealIsland через
  // onRevealed — хореография предвкушение→прорастание сама решает, когда
  // пик отыграл своё. Этот эффект — только защита на случай null-находки.
  useEffect(() => {
    if (phase !== 'done') return
    if (!grownElement) setRestRevealed(true)
  }, [phase, grownElement])

  const totalRef = useRef(0)
  const startIdRef = useRef<string | null>(null)
  const startedAtRef = useRef<number>(0)
  const firedMomentsRef = useRef<Set<Moment>>(new Set())

  const speak = useCallback((moment: Moment, taskLabel: string, mins: number) => {
    if (firedMomentsRef.current.has(moment)) return
    firedMomentsRef.current.add(moment)
    fetchVoice(moment, taskLabel, mins).then(setVoice)
  }, [])

  // Мягкий возврат из отвлечения: СДВГ-мозг уходит в другую вкладку —
  // это норма, а не провал. Вернулся — встречаем без упрёка.
  const hiddenAtRef = useRef<number | null>(null)
  const [backFromDrift, setBackFromDrift] = useState(false)

  // Честный таймер: остаток вычисляется от абсолютного времени старта,
  // а не тиками — фоновая вкладка и троттлинг браузера не искажают часы.
  useEffect(() => {
    if (phase !== 'running') return
    const update = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000
      setSecondsLeft(Math.max(0, Math.ceil(totalRef.current - elapsed)))
    }
    update()
    const id = setInterval(update, 1000)
    // Возврат во вкладку — мгновенная синхронизация, без ожидания тика
    const onVisible = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
        return
      }
      update()
      // Отходил дольше 2 минут — встречаем тепло, а не молчанием
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current > 120_000) {
        setBackFromDrift(true)
        window.setTimeout(() => setBackFromDrift(false), 6000)
      }
      hiddenAtRef.current = null
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [phase])

  // Сессия переживает закрытие вкладки: если при открытии страницы есть
  // незавершённая сессия — продолжаем с правильного места (или сразу финиш)
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    getActiveSession().then((s) => {
      if (!s) {
        if (autoStart) {
          // Параметры убираем сразу: перезагрузка после финиша не должна
          // запустить вторую сессию (активная восстановится и без них)
          window.history.replaceState(null, '', '/app/session')
          void start()
        }
        return
      }
      totalRef.current = s.minutes * 60
      startedAtRef.current = s.startedAt
      startIdRef.current = s.startId
      firedMomentsRef.current = new Set()
      setTask(s.task)
      setMinutes(s.minutes)
      const elapsed = (Date.now() - s.startedAt) / 1000
      setSecondsLeft(Math.max(0, Math.ceil(s.minutes * 60 - elapsed)))
      setVoice(fallbackVoice.start)
      setPhase('running')
    })
  }, [])

  // Завершение по нулю — отдельным эффектом, а не изнутри setState-апдейтера
  useEffect(() => {
    if (phase === 'running' && secondsLeft === 0 && totalRef.current > 0) {
      finish(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, phase])

  // Хореография старта: 2.2 секунды — существо садится рядом, потом сессия
  useEffect(() => {
    if (phase !== 'starting') return
    const t = window.setTimeout(() => setPhase('running'), 2200)
    return () => window.clearTimeout(t)
  }, [phase])

  // Живое присутствие: на каждой четверти пути котик коротко радуется
  const lastQuarterRef = useRef(0)
  const [cheering, setCheering] = useState(false)
  useEffect(() => {
    if (phase !== 'running' || totalRef.current === 0) return
    const q = Math.floor((1 - secondsLeft / totalRef.current) * 4)
    if (q > lastQuarterRef.current && q < 4) {
      lastQuarterRef.current = q
      setCheering(true)
      const t = window.setTimeout(() => setCheering(false), 2600)
      return () => window.clearTimeout(t)
    }
  }, [secondsLeft, phase])

  // Реплики по ходу сессии
  useEffect(() => {
    if (phase !== 'running' || totalRef.current === 0) return
    const progress = 1 - secondsLeft / totalRef.current
    if (progress >= 0.85) speak('late', task, minutes)
    else if (progress >= 0.5) speak('middle', task, minutes)
  }, [secondsLeft, phase, speak, task, minutes])

  async function start() {
    if (!task.trim()) return
    hapticStart()
    playStartSigh()
    totalRef.current = minutes * 60
    setSecondsLeft(minutes * 60)
    firedMomentsRef.current = new Set()
    lastQuarterRef.current = 0
    setVoice(fallbackVoice.start)
    // Хореография: интерфейс растворяется, существо садится рядом,
    // таймер проявляется. При reduced-motion — сразу к делу.
    setPhase(reducedMotion ? 'running' : 'starting')
    startedAtRef.current = Date.now()

    // Старт записывается в момент старта: инициация — и есть валюта
    const entry = await recordStart({ label: task, fromPlan })
    startIdRef.current = entry.id

    // Если шаг взят из очереди дробления — он исполнен, очередь короче
    await consumeQueueStep(task)

    // Сессия переживает закрытие вкладки
    await saveActiveSession({
      startedAt: startedAtRef.current,
      minutes,
      task,
      startId: entry.id,
    })

    // План исполнен — убираем: и когда старт пришёл из плана, и когда
    // человек сам начал шаг, лежащий в плане (иначе утром продукт
    // предложит уже сделанное — стейл-план подрывает доверие к памяти)
    const plan = await getPlan()
    if (plan && ((fromPlan && plan.forDate === todayKey()) || plan.firstStep === task)) {
      await clearPlan()
    }

    speak('start', task, minutes)
  }

  async function finish(early: boolean) {
    await clearActiveSession()
    // Не больше длительности сессии: вкладка могла быть закрыта надолго
    const workedMin = Math.min(
      (Date.now() - startedAtRef.current) / 60000,
      totalRef.current / 60,
    )
    if (startIdRef.current) {
      await updateStartMinutes(startIdRef.current, workedMin)
    }
    // Награда должна быть видна в момент, когда она заработана
    const starts = await getStarts()
    const n = starts.length
    if (n <= LANDMARK_COUNT) {
      // Первые 10 стартов — предсказуемые ориентиры: новичку нужна ясная история.
      // Находок пула тут структурно быть не может: пул стартует только при n > LANDMARK_COUNT.
      const name = elementNameForStartNumber(n)
      setGrownElement(
        name
          ? {
              name,
              rarity: 'landmark',
              landmarksUnlocked: n - 1,
              finds: [],
              newItem: { kind: 'landmark', index: n - 1 },
            }
          : null,
      )
    } else {
      // Дальше — вероятностный пул. Полная сессия повышает шанс редкого.
      const finds = await getFinds()
      let pity = 0
      for (let i = finds.length - 1; i >= 0 && finds[i].rarity === 'common'; i--) pity++
      const find = drawFind(!early, pity)
      const findEntry = { ...find, date: todayKey(), startId: startIdRef.current ?? '' }
      if (startIdRef.current) {
        await addFind(findEntry)
      }
      setGrownElement({
        name: find.name,
        rarity: find.rarity,
        landmarksUnlocked: LANDMARK_COUNT,
        finds,
        newItem: { kind: 'find', find: findEntry, findIndex: finds.length },
      })
    }
    hapticDone()
    setEndedEarly(early)
    setFirstEver(n === 1)
    setDoneVoice(null)
    setPlanSaved(false)
    setPlanFormOpen(false)
    setRestRevealed(false)
    setTomorrowTask('')
    setTomorrowStep('')

    // «Ещё разок»: следующая цель видна в момент пика, не после него.
    // Тизер честный: ориентиры детерминированы — называем; пул случаен —
    // называем только реальное число ненайденного.
    const queue = await getStepQueue()
    let tease: string | null = null
    if (n < LANDMARK_COUNT) {
      const nextName = elementNameForStartNumber(n + 1)
      if (nextName) tease = `следующий старт вырастит «${nextName}»`
    } else {
      const allFinds = await getFinds()
      const foundKeys = new Set(allFinds.map((f) => f.key))
      const unfound = ISLAND_POOL.filter((e) => !foundKeys.has(e.key)).length
      // Pity дозрел (5+ обычных подряд) — drawFind ГАРАНТИРУЕТ необычную+,
      // и это честно сказать вслух: далёкая цель «ещё N находок» превращается
      // в близкую «следующая будет особенной» (variable ratio + goal gradient)
      let pityNow = 0
      for (let i = allFinds.length - 1; i >= 0 && allFinds[i].rarity === 'common'; i--)
        pityNow++
      tease =
        pityNow >= 5
          ? 'следующая находка будет необычной — или лучше'
          : unfound === 1
            ? 'на острове осталась последняя ненайденная находка'
            : unfound > 0
              ? `на острове ещё ${unfound} ${pluralFinds(unfound)}`
              : 'остров собран полностью — теперь он густеет'
    }
    setNextUp({
      step: queue?.steps[0] ?? null,
      queueTask: queue?.task ?? null,
      tease,
    })

    setPhase('done')
    fetchVoice(early ? 'early-exit' : 'done', task, minutes).then(setDoneVoice)
  }

  async function saveTomorrowPlan() {
    if (!tomorrowTask.trim() || !tomorrowStep.trim()) return
    await savePlan({ task: tomorrowTask.trim(), firstStep: tomorrowStep.trim() })
    setPlanSaved(true)
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const progress = totalRef.current > 0 ? 1 - secondsLeft / totalRef.current : 0

  if (phase === 'setup') {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        {/* Сцена: существо в центре внимания, а не в углу формы */}
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <MascotSvg expression="calm" label={companionName ?? 'Напарник'} size={150} />
          <p className="glass max-w-72 text-balance rounded-2xl px-4 py-2 text-center font-sans text-[0.95rem] leading-relaxed">
            <EmphasisText text={buildSetupLine(prefilledStep, priorSessions, companionName)} />
          </p>
        </div>
        {/* Управление внизу — в зоне большого пальца */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Первый шаг
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Готовые шаги">
              {stepChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    if (task !== chip) hapticThreshold()
                    setTask(chip)
                  }}
                  aria-pressed={task === chip}
                  // min-h-11: пилюля визуально компактна (py-1.5), но тач-цель
                  // должна быть не меньше 44px (WCAG 2.5.8) — замерено рендером,
                  // раньше цель была ~32px.
                  className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    task === chip
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'glass text-muted-foreground transition-[filter] duration-150 hover:text-foreground hover:brightness-125'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <input
              value={task}
              onChange={(e) => {
                setTask(e.target.value)
                setBrokenSteps(null)
              }}
              // Enter замыкает петлю «ввёл шаг → начал» без поиска кнопки.
              // isComposing/229 — защита от CJK IME (Enter подтверждает
              // набор, а не отправляет)
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229 &&
                  task.trim()
                ) {
                  start()
                }
              }}
              // autoFocus только когда реально нужно печатать. Если шаг уже
              // пришёл из Дома (prefilledStep) — buildSetupLine сама говорит
              // «просто жми», а не «напиши»: фокусировать пустое действие
              // некуда, а клавиатура на весь экран закрыла бы кнопку «Начали»,
              // ради которой человек сюда и пришёл. Это тот самый экран,
              // куда заходят ЗА одним конкретным действием (в отличие от
              // формы имени на Доме — туда заходят по десятку разных причин,
              // и красть фокус там означало бы поднимать клавиатуру раньше,
              // чем человек вообще решил, чем будет заниматься).
              // Известное ограничение: iOS Safari часто не поднимает
              // экранную клавиатуру по autoFocus без жеста пользователя —
              // курсор и фокус всё равно достаются полю, лавиатура — не
              // всегда; на десктопе и Android работает полностью.
              autoFocus={!prefilledStep}
              enterKeyHint="go"
              placeholder="Открыть файл презентации"
              // text-base, не text-sm: 14px триггерит авто-zoom всей страницы
              // в iOS Safari при фокусе на поле — тот же фикс, что уже стоит
              // в companion-chat.tsx.
              className="glass h-12 rounded-xl px-4 text-base"
            />
          </label>

          {/* Дробление своей задачи: написал большое — получил 3 крошечных */}
          {/* Дробилка — ядро продукта для СДВГ, а была ссылкой 11px с
              тап-зоной ~20px (нарушение Фиттса ровно на ключевой фиче).
              Теперь — полноценная кнопка 44px с иконкой: видима на
              периферии, попадаема большим пальцем. */}
          {task.trim().length >= 8 && !stepChips.includes(task) && !brokenSteps && (
            <button
              type="button"
              onClick={breakDown}
              disabled={breaking}
              className="glass glass-interactive press inline-flex min-h-11 items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
            >
              <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {breaking ? 'Дроблю…' : 'Звучит крупно? Раздробить'}
            </button>
          )}
          {breakError && !brokenSteps && !breaking && (
            <div
              role="status"
              className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-background/70 px-4 py-2 text-xs leading-relaxed text-muted-foreground"
            >
              Не вышло раздробить — сеть подвела.
              <button
                type="button"
                onClick={breakDown}
                className="press inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ещё раз
              </button>
            </div>
          )}
          {brokenSteps && (
            <div className="glass flex flex-col gap-2 rounded-2xl p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                выбери первый — остальное потом
              </p>
              <div className="flex flex-col gap-1.5" role="group" aria-label="Микрошаги">
                {brokenSteps.map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      // Остальные шаги не выбрасываются: очередь помнит их
                      // и сама предложит следующий после этой сессии
                      // (на финале и на Доме). Продукт помнит сказанное.
                      void saveStepQueue(
                        task,
                        brokenSteps.filter((s) => s !== step),
                      )
                      setTask(step)
                      setBrokenSteps(null)
                    }}
                    className="glass glass-interactive press rounded-xl px-3 py-2 text-left text-sm font-medium"
                  >
                    {step}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Длительность
            </span>
            <div className="flex gap-2">
              {durations.map((d) => (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (minutes !== d) hapticThreshold()
                      setMinutes(d)
                      setDurationTouched(true)
                    }}
                    aria-pressed={minutes === d}
                    className={`w-full rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                      minutes === d
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'glass text-muted-foreground transition-[filter] duration-150 hover:text-foreground hover:brightness-125'
                    }`}
                  >
                    {d} мин
                  </button>
                  {/* #7 · Default Effect: 25 мин помечен как рекомендованный,
                      пока выбор ещё не стал осознанным действием человека */}
                  {!durationTouched && d === 25 && (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">
                      рекомендуем
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* #8 · Confirmation bias: короткая честная строка под уже
                сделанным выбором — снимает микро-сомнение «а не мало/много
                ли я взял», не задавая нового решения */}
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {minutes === 15
                ? '15 — короткий разгон, если просто нужно сдвинуться с места'
                : minutes === 25
                  ? '25 — классический фокус-блок, не выматывает'
                  : '45 — для дела, в которое стоит погрузиться'}
            </p>
          </div>
          <motion.div whileTap={reducedMotion ? undefined : { scale: 0.96 }}>
            <Button
              size="lg"
              onClick={start}
              disabled={!task.trim()}
              className="w-full font-semibold"
            >
              Начали. Я рядом
            </Button>
          </motion.div>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            старт засчитывается сразу — даже если выйдешь раньше
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'starting') {
    // Хореография: мир затихает, существо садится рядом, сессия проявляется
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
        <motion.div
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        >
          <MascotSvg expression="happy" label="Напарник садится рядом" size={170} />
        </motion.div>
        <motion.p
          className="font-sans text-lg text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
        >
          <EmphasisText text="*Сажусь рядом*. Начали." />
        </motion.p>
        <motion.p
          className="font-mono text-xs uppercase tracking-widest text-primary"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3, duration: 0.6 }}
        >
          старт засчитан
        </motion.p>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <>
        {/* Подложка-скрим под подвал экрана: горизонт в фоне (AppBackdrop)
            общий на все три экрана и сам по себе ничего не гасит под собой —
            карточки Дома отделяются от него своим glass-фоном, а здесь
            сноска висела голым текстом прямо на силуэтах ростка/ёлки/фонаря.
            Скрим только у Фокуса, потому что только тут текст ничем не
            подложен. */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 h-[34vh] bg-gradient-to-t from-background/85 to-transparent"
        />
        <motion.div
          className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 pt-8 pb-[32vh]"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {/* Существо — центр сцены: дышит, радуется четвертям, встречает из отвлечения */}
          {/* #10 · Кольцо вместо линейного бара под существом: время сессии
              читается на самом объекте, за которым и так следит взгляд, а не
              в отдельной полоске ниже — тот же вес внимания, один якорь
              вместо двух. -inset-4: кольцо на 16px шире мяскота (130px), не
              задевая его контур. rotate(-90deg): прогресс стартует с 12
              часов — там же, где начинается любой аналоговый таймер.
              Трек и дуга: на живой ночной сцене var(--secondary) почти не
              отличим от фона (замерено на реальном скрине) — трек поднят до
              полупрозрачного foreground, а дуга получила мягкое лаймовое
              свечение (тот же язык, что у очага/сияния), иначе на малом
              прогрессе она читается не как кольцо, а как случайный блик. */}
          <div className="relative flex items-center justify-center">
            <svg
              className="pointer-events-none absolute -inset-4"
              viewBox="0 0 156 156"
              aria-hidden="true"
            >
              <circle
                cx="78"
                cy="78"
                r="72"
                fill="none"
                stroke="color-mix(in oklab, var(--foreground) 16%, transparent)"
                strokeWidth="5"
              />
              <circle
                cx="78"
                cy="78"
                r="72"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 72}
                style={{
                  strokeDashoffset: 2 * Math.PI * 72 * (1 - progress),
                  transform: 'rotate(-90deg)',
                  transformOrigin: '78px 78px',
                  transition: reducedMotion ? 'none' : 'stroke-dashoffset 1s linear',
                  filter: 'drop-shadow(0 0 5px color-mix(in oklab, var(--primary) 70%, transparent))',
                }}
              />
            </svg>
            <motion.div
              animate={
                reducedMotion
                  ? undefined
                  : { y: [0, -4, 0], rotate: [0, 0, -1.5, 0, 1.5, 0, 0] }
              }
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            >
              <MascotSvg
                expression={cheering || backFromDrift ? 'happy' : 'focused'}
                label="Напарник работает рядом"
                size={130}
              />
            </motion.div>
          </div>
          <p className="glass max-w-72 text-balance rounded-2xl px-4 py-2 text-center font-sans text-[0.95rem] leading-relaxed">
            <EmphasisText
              text={
                backFromDrift
                  ? 'Ты отходил — это нормально. Мы всё ещё *в деле*.'
                  : cheering
                    ? '*Четверть пути* позади. Идём.'
                    : voice
              }
            />
          </p>
          <div className="flex flex-col items-center gap-2">
            {/* Название дела — контекст «чем я занят», не утилитарная кнопка:
                чуть плотнее и светлее ряда переключателей ниже, плюс кавычки
                — та же пунктуация, что и в карточке Дома («Следующий шаг:
                «X»»), а не голый капс без каких-либо знаков препинания. */}
            <p className="text-center font-mono text-xs font-semibold uppercase tracking-widest text-foreground/80">
              «{task}»
            </p>
            {hideDigits ? (
              <p className="font-sans text-lg text-muted-foreground">
                <EmphasisText text="время идёт — я *слежу*" />
              </p>
            ) : (
              // U1: без aria-live — role="timer" имеет implicit "off";
              // polite означал объявление КАЖДОЙ секунды скринридером
              <div
                role="timer"
                className="text-7xl font-bold tabular-nums tracking-tight"
              >
                {mm}:{ss}
              </div>
            )}
            <div className="flex items-center gap-3">
              {/* U2: min-h-11 + padding — честная тап-зона 44px (Fitts) */}
              <button
                type="button"
                onClick={toggleDigits}
                className="min-h-11 px-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground underline-offset-2 hover:underline"
              >
                {hideDigits ? 'показать цифры' : 'спрятать цифры'}
              </button>
              {/* Разделитель: два независимых переключателя рядом иначе
                  читаются как один составной контрол (закон близости) */}
              <span aria-hidden="true" className="h-3 w-px bg-border" />
              <button
                type="button"
                onClick={toggleAmbient}
                aria-pressed={ambientOn}
                className={`min-h-11 px-2 font-mono text-[11px] uppercase tracking-widest underline-offset-2 hover:underline ${
                  ambientOn ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {ambientOn ? 'костёр горит' : 'зажечь костёр'}
              </button>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 pt-1">
            {/* Выход из сессии — секондари-действие, но не строка того же
                веса, что переключатели выше: glass-пилюля даёт ему
                собственную форму, не сливаясь с текстовым списком над ним. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => finish(true)}
              className="h-11 rounded-full px-5 text-sm text-muted-foreground"
            >
              Закончить раньше
            </Button>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              старт уже засчитан · полная сессия повышает шанс редкой находки
            </p>
          </div>
        </motion.div>
      </>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      <MascotSvg expression="excited" label="Напарник радуется" size={110} />
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold">
          {firstEver ? 'Первое дело сдвинуто.' : endedEarly ? 'Ты начал.' : 'Сделано.'}
        </h2>
        <p className="font-sans text-[0.95rem] leading-relaxed text-muted-foreground">
          <EmphasisText
            text={
              firstEver
                ? `«${trimLabel(task, 40)}» — начато. А начать и есть самое трудное. Смотри, что выросло.`
                : (doneVoice ?? fallbackVoice[endedEarly ? 'early-exit' : 'done'])
            }
          />
        </p>
      </div>

      {/* Пик дофамина — находка прорастает НА настоящем острове, не на карточке поверх него.
          RevealIsland сам ведёт хореографию предвкушение → прорастание → (для rare) золотое
          цветение и зовёт onRevealed, когда пора показывать план/кнопки ниже. */}
      {grownElement && (
        <motion.div
          className="w-full"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reducedMotion ? { duration: 0.3 } : { duration: 0.5, ease: 'easeOut' }
          }
        >
          <Link
            href="/app/world"
            className="group glass glass-interactive press flex w-full flex-col items-center gap-2 overflow-hidden rounded-2xl px-4 pb-4 pt-3 text-center"
          >
            <RevealIsland
              landmarksUnlocked={grownElement.landmarksUnlocked}
              finds={grownElement.finds}
              newItem={grownElement.newItem}
              rarity={grownElement.rarity}
              onRevealed={() => setRestRevealed(true)}
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-widest ${
                grownElement.rarity === 'rare' ? 'text-reward' : 'text-primary'
              }`}
            >
              {grownElement.rarity === 'landmark'
                ? 'на острове появилось'
                : RARITY_LABEL[grownElement.rarity]}
            </span>
            <span className="text-balance text-xl font-bold">{grownElement.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              смотреть остров целиком
            </span>
          </Link>
        </motion.div>
      )}

      {/* План и кнопки появляются после того, как находка отыграла свой момент */}
      <motion.div
        className="flex w-full flex-col items-center gap-6"
        initial={false}
        animate={{ opacity: restRevealed ? 1 : 0, y: restRevealed ? 0 : 12 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ pointerEvents: restRevealed ? 'auto' : 'none' }}
        aria-hidden={!restRevealed}
      >
      {firstEver ? (
        // Первая победа: один ясный следующий шаг вместо меню из четырёх.
        // План на завтра и остальное — уже с Дома, после пика, не вместо него
        <div className="flex w-full flex-col gap-2">
          <Link
            href="/app"
            onTouchStart={() => {}}
            className="btn-chunky block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[15px] font-bold uppercase tracking-[0.06em] text-primary-foreground">
              Дальше — в мой дом
            </span>
          </Link>
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setTask(nextUp.step ?? task)
              setFirstEver(false)
              setGrownElement(null)
              setPhase('setup')
            }}
          >
            Хочу ещё — посидим подольше
          </Button>
        </div>
      ) : (
      <>
      {!planSaved ? (
        !planFormOpen ? (
          <div className="flex w-full flex-col gap-2">
            {/* Однотаповый договор: на пике дофамина печатать — стена.
                Если из дробления остался следующий шаг — план продолжает
                ту же задачу; иначе — «это же дело» повторяется завтра. */}
            <button
              type="button"
              onClick={() => {
                void savePlan({
                  task: nextUp.queueTask ?? task,
                  firstStep: nextUp.step ?? task,
                })
                setPlanSaved(true)
              }}
              className="glass glass-interactive press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">
                  {nextUp.step ? 'Завтра — следующий шаг' : 'Это же дело — завтра'}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  «{nextUp.step ?? task}»
                </span>
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-primary">
                один тап
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPlanFormOpen(true)}
              className="glass glass-interactive press flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold">Своё дело на завтра</span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="glass flex w-full flex-col gap-3 rounded-2xl p-4">
            <p className="text-sm font-semibold">Договоримся с завтрашним собой?</p>
            <input
              value={tomorrowTask}
              onChange={(e) => setTomorrowTask(e.target.value)}
              placeholder="Что завтра важно"
              aria-label="Дело на завтра"
              className="glass h-11 rounded-xl px-4 text-sm"
            />
            <input
              value={tomorrowStep}
              onChange={(e) => setTomorrowStep(e.target.value)}
              placeholder="Первый крошечный шаг"
              aria-label="Первый шаг завтрашнего дела"
              className="glass h-11 rounded-xl px-4 text-sm"
            />
            <Button
              size="lg"
              onClick={saveTomorrowPlan}
              disabled={!tomorrowTask.trim() || !tomorrowStep.trim()}
              className="h-11 font-semibold"
            >
              Положить план
            </Button>
            <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              можно пропустить — это не обязанность
            </p>
          </div>
        )
      ) : (
        <div className="glass flex w-full flex-col gap-1 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold">План лежит. Утром напишу первым.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Просто открой эту страницу утром — первое слово будет за мной.
          </p>
        </div>
      )}

      <div className="flex w-full flex-col gap-2">
        {/* One-more-time hook: следующая цель острова названа прямо над
            кнопкой — сессия заканчивается на «ещё разок», не на точке */}
        {nextUp.tease && (
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {nextUp.tease}
          </p>
        )}
        {/* whitespace-normal — не косметика. Button по умолчанию несёт
            whitespace-nowrap + shrink-0 (проверено в components/ui/button.tsx),
            поэтому кнопка с подставленным шагом не сжимается и не переносится,
            а РАСПИРАЕТ контейнер за край экрана — на 320px это гарантированно.
            Разрешаем перенос и рост в высоту, как у «Начинаю» на Доме: лимит
            щедрый (60) и режет по границе слова, чтобы обрубок первого шага не
            добавлял страха вместо того, чтобы его снимать. */}
        <Button
          size="lg"
          className="h-auto py-3 font-semibold whitespace-normal"
          onClick={() => {
            // Очередь дробления сама подставляет следующий микрошаг —
            // продолжение той же работы в один тап
            setTask(nextUp.step ?? '')
            setDoneVoice(null)
            setEndedEarly(false)
            setGrownElement(null)
            setPhase('setup')
          }}
        >
          <span className="text-pretty">
            {nextUp.step ? `Ещё одна: «${trimLabel(nextUp.step, 60)}»` : 'Ещё одна сессия'}
          </span>
        </Button>
        <Button
          render={<Link href="/app/world" />}
          nativeButton={false}
          variant="ghost"
          className="text-muted-foreground"
        >
          Посмотреть, как вырос мир
        </Button>
      </div>
      </>
      )}
      </motion.div>
    </div>
  )
}
