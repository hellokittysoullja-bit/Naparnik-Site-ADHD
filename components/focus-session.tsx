'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { MascotDoll as MascotSvg } from '@/components/mascot-doll'
import { EmphasisText } from '@/components/emphasis-text'
import { RevealIsland, type RevealNewItem } from '@/components/reveal-island'
import { Eye, EyeOff, LayoutList, NotebookPen, Pause, Play, SlidersHorizontal, Sparkles } from 'lucide-react'
import dynamic from 'next/dynamic'
import { SoundChip, type SoundChoice } from '@/components/sound-chip'
import type { Fineness } from '@/components/breakdown-prefs'
import type { Template } from '@/lib/templates'

// Листы, карточки итога и напоминание нужны не всем и не сразу: грузятся отдельно, когда до них дошло дело.
// Иначе первый пакет кода Фокуса вырастал на 16 КБ и выходил за предел (e2e/bundle-budget.spec.ts)
const TemplatesSheet = dynamic(() => import('@/components/templates-sheet').then((m) => m.TemplatesSheet), { ssr: false })
const BreakdownPrefs = dynamic(() => import('@/components/breakdown-prefs').then((m) => m.BreakdownPrefs), { ssr: false })
const WinCards = dynamic(() => import('@/components/win-cards').then((m) => m.WinCards), { ssr: false })
const TgRemind = dynamic(() => import('@/components/tg-remind').then((m) => m.TgRemind), { ssr: false })
const FINENESS_KEY = 'naparnik:fineness'
function readFineness(): Fineness {
  try {
    const v = window.localStorage.getItem(FINENESS_KEY)
    return v === 'coarse' || v === 'fine' ? v : 'normal'
  } catch {
    return 'normal'
  }
}
import {
  addFind,
  clearActiveSession,
  clearPlan,
  consumeQueueStep,
  getActiveSession,
  getFinds,
  getPlan,
  getStarts,
  getStepQueue,
  markSkillsShown,
  peekCompanionName,
  peekMemoryContext,
  peekPatterns,
  peekProfile,
  recordStart,
  saveActiveSession,
  savePlan,
  saveStepQueue,
  peekStepQueue,
  todayKey,
  updateStartMinutes,
  type IslandFindEntry,
} from '@/lib/memory'
import { BREAK_TOO_SHORT, BREAK_UNCLEAR, breakable } from '@/lib/break-task'
import {
  drawFind,
  elementNameForStartNumber,
  ISLAND_POOL,
  LANDMARK_COUNT,
  RARITY_LABEL,
  type Rarity,
} from '@/lib/island-elements'
import { playStartSigh } from '@/lib/reward-sound'
import { startAmbient, stopAmbient } from '@/lib/ambient'
import { hapticDone, hapticStart, hapticThreshold } from '@/lib/haptics'
import { trimLabel } from '@/lib/utils'
import { FIRST_MINUTES } from '@/lib/onboarding'
import { trackEvent } from '@/lib/events'
import { withAttribution } from '@/lib/visitor'
import { addCard, addThought, markStepDone, nextAfter, updateCard, upsertDeal } from '@/lib/deals'

// 5 минут — «просто начать» (этап 1, research/24 C: слепота ко времени, порог старта); оценка шага сама выбирает длительность
const durations = [5, 15, 25, 45]
const pickDuration = (m: number) => (m <= 5 ? 5 : m <= 15 ? 15 : m <= 25 ? 25 : 45)
type BStep = { text: string; minutes?: number; wait?: boolean }
// Вопроса «Сколько сил сейчас?» перед дроблением больше нет (16.11, владелец): кнопка обещает шаг, а давала вопрос и
// лишнее нажатие на каждом заходе. Силы знаем из знакомства («Нет сил даже начать»), размер шагов — из настройки,
// мельче — одной кнопкой после результата (lib/break-task.ts)
type Energy = 'low'
const SOUND_KEY = 'naparnik:sound'
const HOW_WAS_KEY = 'naparnik:howWas'
const endClock = (ms: number) => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

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
  // без рода и без тире (правила владельца 12.11); без «всё равно»: оно звучит как утешение за неудачу
  done: 'Начато и отработано. Мой остров стал чуть больше. Без пафоса: это *сильно*.',
  'early-exit': 'Старт есть, это *главное*. Остров вырос. Ноль стыда.',
}

/** Память для разовых задач Фокуса: тот же снимок, что уходит с чатом, без внутренних id устройства */
function memoryForTask() {
  return { ...peekMemoryContext(), factIds: undefined, skillIds: undefined }
}

async function fetchVoice(moment: Moment, task: string): Promise<string> {
  try {
    const res = await fetch('/api/session-voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment, task, memory: memoryForTask() }),
    })
    if (!res.ok) return fallbackVoice[moment]
    const data = (await res.json()) as { text: string | null }
    return data.text || fallbackVoice[moment]
  } catch {
    return fallbackVoice[moment]
  }
}

type Phase = 'setup' | 'starting' | 'running' | 'done' | 'break'

const AUTO_START_KEY = 'naparnik:autoStart'
/** Первый шаг — «крошечный и конкретный»: 120 знаков хватает с запасом, а экран сессии не уезжает вбок */
const STEP_MAX = 120

/**
 * Очередь после дробления. Дробили следующий шаг уже раздробленного дела (Дом «Разломать на шаг», состояние
 * «СЛЕДУЮЩИЙ ШАГ») — его подшаги встают на его место, а остальные шаги дела остаются (проверка 13.11: очередь
 * перезаписывалась целиком, и шаги дела пропадали). Иначе — новая очередь, как раньше.
 */
async function spliceQueue(task: string, rest: string[]) {
  const q = peekStepQueue()
  if (q && q.steps[0]?.trim() === task.trim()) {
    await saveStepQueue(q.task, [...rest, ...q.steps.slice(1)])
    return
  }
  await saveStepQueue(task, rest)
}

export function FocusSession() {
  const reducedMotion = useReducedMotion()
  const searchParams = useSearchParams()
  // шаг из адреса — с потолком: ссылка не должна приносить простыню на экран сессии и в память
  const prefilledStep = (searchParams.get('step') ?? '').trim().slice(0, STEP_MAX)
  const fromPlan = searchParams.get('plan') === '1'
  // пришли из теста /sdvg-test: после первой победы — экран «если — то» и сохранения (research/14), а не сразу домой
  // Запоминаем при открытии: после автостарта адрес чистится от шага, а финал должен знать, откуда пришли
  const [fromTest] = useState(() => searchParams.get('from') === 'sdvg')
  // пришли из знакомства (/app/start): финал первой сессии ведёт на «Как было?», а не сразу домой
  const [fromOnb] = useState(() => searchParams.get('from') === 'onb')
  const [onbNext] = useState(
    () => `/app/start/after?${new URLSearchParams(['m', 'b', 's'].flatMap((k) => (searchParams.get(k) ? [[k, searchParams.get(k) as string]] : []))).toString()}`,
  )
  const [testNext] = useState(
    () => `/sdvg-test/dalshe?${new URLSearchParams({ t: searchParams.get('t') ?? '', s: searchParams.get('s') ?? '' }).toString()}`,
  )
  const prefilledDuration = Number(searchParams.get('d'))
  // auto=1 приходит из знакомства (/app/start): человек уже выбрал шаг и
  // удержал кнопку — повторный сетап был бы вторым «точно?» подряд.
  // Только там разрешена короткая первая сессия (FIRST_MINUTES).
  // Пропуск ставит само знакомство (first-run.tsx) прямо перед переходом: чужая ссылка с auto=1 только
  // подставит шаг в поле, а «старт» человек нажмёт сам. Пропуск одноразовый.
  const [autoPass] = useState(() => {
    try {
      return window.sessionStorage.getItem(AUTO_START_KEY)
    } catch {
      return null
    }
  })
  // гасим в эффекте, не в инициализаторе: StrictMode в dev вызывает инициализатор дважды
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(AUTO_START_KEY)
    } catch {
      /* недоступно — пропуск и так не сработает повторно: параметры из адреса убираются при старте */
    }
  }, [])
  const autoStart =
    searchParams.get('auto') === '1' && Boolean(prefilledStep) && autoPass === prefilledStep
  // Дом («Разломать на шаг») открывает Фокус с делом и пометкой break=1: дробление запускается само. Старт — только
  // руками человека, поэтому чужая ссылка с break=1 ничего не начинает, а лишь показывает шаги
  // короче 8 знаков не дробим (тот же порог, что у кнопки дробления; сервер не принимает < 3): только подставляем
  const breakAsked = !autoStart && searchParams.get('break') === '1'
  const breakOnOpen = breakAsked && breakable(prefilledStep)
  const initialMinutes =
    durations.includes(prefilledDuration) ||
    (autoStart && prefilledDuration === FIRST_MINUTES)
      ? prefilledDuration
      : 25

  // Автостарт из знакомства сразу открывается хореографией старта: раньше до ответа памяти (getActiveSession) на
  // ~0,15 с мелькал экран выбора шага с «Шаг уже выбран» — второй «точно?», которого быть не должно (02.11)
  const [phase, setPhase] = useState<Phase>(autoStart ? 'starting' : 'setup')
  const [task, setTask] = useState(prefilledStep)

  // Имя и число прошлых сессий — тот же экран не должен объяснять
  // механику вечно: на 20-й сессии человек уже знает, что «первый шаг —
  // не вся задача». Раз узнаём на маунте — реплика сетапа тратится
  // мгновенно, к моменту, когда человек читает текст, состояние уже есть.
  // Читаем ДО первого кадра (peek*): раньше имя и число сессий приходили после показа, и кот сначала говорил реплику
  // новичка «Что делаем? Назови первый шаг…», а через миг менял её на «Погнали… Хуисос рядом» — пузырь из двух строк
  // становился одной и весь экран дёргался (запись экрана владельца 16.11). Фокус рисуется только на устройстве
  // (useSearchParams под Suspense), поэтому память здесь уже доступна; проверка window — на всякий случай
  const [companionName] = useState<string | null>(() => (typeof window === 'undefined' ? null : peekCompanionName()))
  const [priorSessions] = useState(() => (typeof window === 'undefined' ? 0 : peekPatterns().totalStarts))

  // «Раздроби мне задачу»: человек пишет большое пугающее дело —
  // AI возвращает 3 крошечных шага. Task initiation — главный
  // bottleneck СДВГ; выбор готового микрошага снимает стену.
  const [brokenSteps, setBrokenSteps] = useState<BStep[] | null>(null)
  // дело целиком («Курсовая по логистике»): шаги дробления лежат в «Делах» под этим названием
  const [dealTitle, setDealTitle] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [showAll, setShowAll] = useState(false)
  // «Не то» без потери: убранный шаг можно вернуть одной кнопкой (research/24 C)
  const [dropped, setDropped] = useState<{ step: BStep; index: number } | null>(null)
  const [finerError, setFinerError] = useState(false)
  // оценка выбранного шага в минутах (если модель её дала) — сама ставит длительность
  const [estimate, setEstimate] = useState<number | null>(null)
  const [breaking, setBreaking] = useState(false)
  // «Нет сил даже начать» из знакомства — шаги самые лёгкие и 5 минут, без вопроса перед каждым дроблением
  const [energy] = useState<Energy | null>(() => (typeof window !== 'undefined' && peekProfile()?.blocker === 'tired' ? 'low' : null))
  // кот не понял дело (набор букв) или разламывать нечего: просьба написать словами вместо общих шагов
  const [breakNote, setBreakNote] = useState<string | null>(() => (breakAsked && !breakable(prefilledStep) ? BREAK_TOO_SHORT : null))
  // размер шагов читаем до первого кадра: дробление с Дома стартует сразу при открытии и должно уже знать настройку
  // (раньше её читал эффект после открытия, и первое дробление шло без неё — ловил e2e «размер шагов уходят в дробление»)
  const [fineness, setFineness] = useState<Fineness>(() => (typeof window === 'undefined' ? 'normal' : readFineness()))
  const [templatesOpen, setTemplatesOpenRaw] = useState(false)
  const [prefsOpen, setPrefsOpenRaw] = useState(false)
  const [sheetsUsed, setSheetsUsed] = useState({ templates: false, prefs: false })
  const setTemplatesOpen = (v: boolean) => {
    if (v) setSheetsUsed((u) => ({ ...u, templates: true }))
    setTemplatesOpenRaw(v)
  }
  const setPrefsOpen = (v: boolean) => {
    if (v) setSheetsUsed((u) => ({ ...u, prefs: true }))
    setPrefsOpenRaw(v)
  }
  // Раньше сетевая ошибка просто отпускала кнопку без следа — человек не
  // понимал, сработало дробление или нет, и был вынужден жать вслепую ещё
  // раз. Теперь ошибка видима и даёт явный повтор (WCAG Status Messages).
  const [breakError, setBreakError] = useState(false)
  // кризисный текст в поле дела: обвязка вернула проверенный бережный ответ с телефонами помощи вместо шагов
  const [careReply, setCareReply] = useState<string | null>(null)
  function applyEstimate(m?: number) {
    setEstimate(m ?? null)
    if (m) {
      setMinutes(pickDuration(m))
      setDurationTouched(true)
    }
  }
  function selectStep(st: BStep) {
    if (st.text !== task) hapticThreshold()
    setTask(st.text)
    applyEstimate(st.minutes)
    setEditing(false)
  }
  /** Дробление: первый раз — всего дела; «Ещё мельче» — выбранного шага, его подшаги встают на его место */
  function applyTemplate(t: Template) {
    const list: BStep[] = t.steps.map((x) => ({ text: x.text, minutes: x.minutes, wait: x.wait }))
    setTemplatesOpen(false)
    setBreakNote(null)
    setBreakError(false)
    setCareReply(null)
    setDropped(null)
    setDealTitle(t.title)
    setBrokenSteps(list)
    setShowAll(false)
    selectStep(list[0])
    upsertDeal(t.title, list)
  }
  /** Первое дробление дела: готовое дело — шаги сразу, иначе модель. Одно и то же с Дома, из «Дел», «Не могу начать» и кнопкой здесь */
  async function requestBreak() {
    if (!breakable(task)) return setBreakNote(BREAK_TOO_SHORT)
    // готовые разбивки (goblin.tools, затем наши шаблоны) сервер отдаёт сразу, без модели: база готовых дел живёт на
    // сервере и в телефон не качается, сколько бы дел в ней ни было (владелец 16.11: «в будущем хоть 1000 дел»)
    void breakDown()
  }
  async function breakDown(finer = false, e: Energy | null = energy) {
    const target = task.trim()
    if (!target || breaking) return
    setBreaking(true)
    setBreakError(false)
    setFinerError(false)
    setBreakNote(null)
    setDropped(null)
    try {
      const res = await fetch('/api/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: target,
          memory: memoryForTask(),
          energy: e ?? undefined,
          fineness: finer ? 'fine' : fineness === 'normal' ? undefined : fineness,
          // шаг дробится внутри своего дела: модель видит дело целиком и не повторяет соседние шаги
          ...(finer && dealTitle && dealTitle !== target
            ? { parent: dealTitle, siblings: (brokenSteps ?? []).map((b) => b.text).filter((t) => t !== target).slice(0, 12) }
            : {}),
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as { steps: string[] | null; minutes?: (number | null)[]; wait?: boolean[]; reply?: string; source?: string; unclear?: boolean; title?: string }
        if (data.reply) setCareReply(data.reply)
        else if (data.unclear) setBreakNote(BREAK_UNCLEAR)
        // модели не ответили, пришла заготовка «для любого дела» — это не план: честно «не вышло, ещё раз»
        else if (data.source === 'fallback') {
          if (finer) setFinerError(true)
          else setBreakError(true)
        }
        else if (data.steps && data.steps.length) {
          const fresh: BStep[] = data.steps.map((t, i) => ({ text: t, minutes: data.minutes?.[i] ?? undefined, ...(data.wait?.[i] ? { wait: true } : {}) }))
          // дело из базы готовых, написанное с опечаткой («сдклать презентацию»), записывается правильно
          const title = finer && dealTitle ? dealTitle : (data.title ?? target)
          let list = fresh
          if (finer && brokenSteps) {
            const i = brokenSteps.findIndex((b) => b.text === target)
            list = [...brokenSteps.slice(0, Math.max(0, i)), ...fresh, ...brokenSteps.slice(i + 1)]
          }
          setDealTitle(title)
          setBrokenSteps(list)
          setShowAll(false)
          selectStep(fresh[0])
          // сил почти нет, а оценки шага модель не дала — ставим 5 минут сами: «просто начать»
          if (e === 'low' && !fresh[0].minutes && !durationTouched) setMinutes(5)
          // все шаги дела — в «Дела»: следующий будет ждать там и на финале
          upsertDeal(title, list)
          // шаги сделаны с навыками, подходящими к делу: отмечаем их «применён», старт в ближайшие полчаса зачтётся им
          // (тот же учёт, что в чате; lib/memory.ts markSkillsShown)
          if (data.source === 'model') markSkillsShown(target)
        }
        else setBreakError(true)
      } else {
        if (finer) setFinerError(true)
        else setBreakError(true)
      }
    } catch {
      if (finer) setFinerError(true)
      else setBreakError(true)
    } finally {
      setBreaking(false)
    }
  }
  function dropStep() {
    if (!brokenSteps || !dealTitle) return
    const i = Math.max(0, brokenSteps.findIndex((b) => b.text === task))
    const list = brokenSteps.filter((_, k) => k !== i)
    if (!list.length) return
    setDropped({ step: brokenSteps[i], index: i })
    setBrokenSteps(list)
    upsertDeal(dealTitle, list)
    selectStep(list[Math.min(i, list.length - 1)])
  }
  function undoDrop() {
    if (!dropped || !brokenSteps || !dealTitle) return
    const list = [...brokenSteps.slice(0, dropped.index), dropped.step, ...brokenSteps.slice(dropped.index)]
    setBrokenSteps(list)
    upsertDeal(dealTitle, list)
    selectStep(dropped.step)
    setDropped(null)
  }
  function renameStep(text: string) {
    if (!brokenSteps || !dealTitle) return
    const i = Math.max(0, brokenSteps.findIndex((b) => b.text === task))
    const list = brokenSteps.map((b, k) => (k === i ? { text } : b))
    setBrokenSteps(list)
    setTask(text)
    setEstimate(null)
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

  // Защита состояния потока: пока идёт сессия, нижний таб-бар (Дом/Мир)
  // — это всегда видимая рампа выхода ровно в тот момент, когда мы держим
  // человека в фокусе. Flow требует убрать конкурирующие affordance'ы
  // действия (так же гаснет HUD в играх на катсцене, прячется хром в
  // видеоплеере). Не ловушка: «Закончить раньше» на экране остаётся, и
  // это его собственный таймер. На фазе 'done' (награда + план) навигация
  // возвращается — уйти на выросший остров как раз желанно.
  // Нав живёт в layout, фаза — здесь, поэтому связь через data-атрибут body.
  // useLayoutEffect: атрибут должен стоять до первой отрисовки — иначе при входе прямо в старт меню мелькает
  // Последовательное раскрытие: сначала находка одна на экране
  // (пик без конкурентов), потом появляются план и кнопки
  const [restRevealed, setRestRevealed] = useState(false)
  useLayoutEffect(() => {
    // Меню возвращается не в момент финала, а когда находка отыграла: главная кнопка «Сделал» стоит внизу экрана,
    // и второй тап по ней попадал бы во вкладку меню, выросшую на её месте, мимо пика награды (e2e «двойной тап»)
    const immersive = phase === 'starting' || phase === 'running' || (phase === 'done' && !restRevealed)
    if (immersive) document.body.dataset.focusImmersive = 'true'
    else delete document.body.dataset.focusImmersive
    return () => {
      delete document.body.dataset.focusImmersive
    }
  }, [phase, restRevealed])


  // Обратный отсчёт для СДВГ — давление дедлайна. Цифры можно спрятать:
  // остаются существо и полоска. Выбор запоминается.
  // тоже до первого кадра: иначе у того, кто прятал цифры, при открытии сессии сначала мелькали цифры
  const [hideDigits, setHideDigits] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(HIDE_DIGITS_KEY) === '1'
    } catch {
      return false
    }
  })
  // Эмбиент костра: опт-ин, паттерн Calm — тихий фон снижает
  // perceived effort. Играет только пока идёт сессия.
  // Звук на выбор: костёр, дождь, ровный шум или тишина (components/sound-chip.tsx). Прежний переключатель
  // «зажечь костёр» переезжает как есть: у кого костёр был включён, тот его и услышит
  // выбор звука — до первого кадра: иначе плашка сначала показывала «Тишина», а потом переключалась
  const [sound, setSound] = useState<SoundChoice>(() => {
    try {
      if (typeof window === 'undefined') return 'off'
      const v = localStorage.getItem(SOUND_KEY)
      if (v === 'fire' || v === 'rain' || v === 'noise') return v
      return v !== 'off' && localStorage.getItem(AMBIENT_KEY) === '1' ? 'fire' : 'off'
    } catch {
      return 'off'
    }
  })
  useEffect(() => {
    if (phase === 'running' && sound !== 'off') startAmbient(sound)
    else stopAmbient()
    return () => stopAmbient()
  }, [phase, sound])
  function chooseSound(v: SoundChoice) {
    stopAmbient()
    setSound(v)
    try {
      localStorage.setItem(SOUND_KEY, v)
      localStorage.setItem(AMBIENT_KEY, v === 'off' ? '0' : '1')
    } catch {
      /* приватный режим */
    }
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

  const speak = useCallback((moment: Moment, taskLabel: string) => {
    if (firedMomentsRef.current.has(moment)) return
    firedMomentsRef.current.add(moment)
    fetchVoice(moment, taskLabel).then(setVoice)
  }, [])

  // Мягкий возврат из отвлечения: СДВГ-мозг уходит в другую вкладку —
  // это норма, а не провал. Вернулся — встречаем без упрёка.
  const hiddenAtRef = useRef<number | null>(null)
  const [backFromDrift, setBackFromDrift] = useState(false)
  // Пауза — одна за сессию, без вопросов (research/24 C); время на паузе не идёт и не считается
  const pausedAtRef = useRef<number | null>(null)
  const [paused, setPaused] = useState(false)
  const [pauseUsed, setPauseUsed] = useState(false)
  // «Отвлёкся»: мысль уходит в записку («Дела → Мысли на потом»), таймер идёт дальше
  const [thoughtOpen, setThoughtOpen] = useState(false)
  const [thought, setThought] = useState('')
  const [thoughtSaved, setThoughtSaved] = useState(false)
  // финал: «Как было?» по желанию и три пути
  const [howWas, setHowWas] = useState<string | null>(null)
  const [worked, setWorked] = useState(0)
  const cardIdRef = useRef<string | null>(null)
  const [dayDone, setDayDone] = useState(false)
  const [nextTime, setNextTime] = useState<string | null>(null)
  const [breakEnd, setBreakEnd] = useState(0)
  const [breakLeft, setBreakLeft] = useState(0)

  // Честный таймер: остаток вычисляется от абсолютного времени старта,
  // а не тиками — фоновая вкладка и троттлинг браузера не искажают часы.
  useEffect(() => {
    if (phase !== 'running') return
    const update = () => {
      if (pausedAtRef.current) return
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
          // источник (from, t, s, метки ролика) оставляем — перезагрузка после финиша ведёт туда же
          const keep = new URLSearchParams(window.location.search)
          for (const k of ['step', 'auto', 'd', 'plan']) keep.delete(k)
          const q = keep.toString()
          window.history.replaceState(null, '', q ? `/app/session?${q}` : '/app/session')
          void start()
        } else if (breakOnOpen) {
          // «Разломать на шаг» с Дома: дело уже в поле — дробим сразу, человек выбирает шаг и жмёт старт сам.
          // Пометку убираем из адреса: перезагрузка не должна дробить второй раз
          const keep = new URLSearchParams(window.location.search)
          keep.delete('break')
          const q = keep.toString()
          window.history.replaceState(null, '', q ? `/app/session?${q}` : '/app/session')
          void requestBreak()
        }
        return
      }
      if (searchParams.get('break') === '1') {
        // сессия уже идёт — новое дело с Дома не теряем: оно ждёт в «Делах», разломаем после этой сессии
        if (breakable(prefilledStep) && prefilledStep !== s.task) upsertDeal(prefilledStep)
        const keep = new URLSearchParams(window.location.search)
        keep.delete('break')
        const q = keep.toString()
        window.history.replaceState(null, '', q ? `/app/session?${q}` : '/app/session')
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
    // Только при открытии: восстановить идущую сессию или автостарт — один раз (restoredRef бережёт от повтора).
    // start создаётся заново на каждом рендере: в зависимостях эффект срабатывал бы каждый раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const cheerTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (phase !== 'running' || totalRef.current === 0 || pausedAtRef.current) return
    // Четверть считается от настоящих часов, а не от остатка на экране: «+5» меняет общую длину сразу, а остаток —
    // следующим кадром, и между ними выходило «прошла четверть» на десятой секунде (гонка, поймана на съёмке 15.11)
    const q = Math.floor(((Date.now() - startedAtRef.current) / 1000 / totalRef.current) * 4)
    if (q > lastQuarterRef.current && q < 4) {
      lastQuarterRef.current = q
      setCheering(true)
      // таймер живёт в ref: раньше его снимала уборка эффекта на следующем же тике секунды, и радость с репликой
      // «Четверть пути позади» оставались до конца сессии (было и в main)
      if (cheerTimerRef.current) window.clearTimeout(cheerTimerRef.current)
      cheerTimerRef.current = window.setTimeout(() => setCheering(false), 2600)
    }
  }, [secondsLeft, phase])
  useEffect(
    () => () => {
      if (cheerTimerRef.current) window.clearTimeout(cheerTimerRef.current)
    },
    [],
  )

  // реплика кота во время сессии видна 8 секунд после каждого события, потом гаснет
  const [lineShown, setLineShown] = useState(true)
  useEffect(() => {
    if (phase !== 'running') return
    setLineShown(true)
    const t = window.setTimeout(() => setLineShown(false), 8000)
    return () => window.clearTimeout(t)
  }, [phase, voice, cheering, backFromDrift, thoughtSaved, paused])

  // «закончишь к 19:40»: считается от часов в эффекте (чтение времени при рендере — нечистая функция)
  const [endLabel, setEndLabel] = useState('')
  useEffect(() => {
    if (phase === 'running') setEndLabel(endClock(Date.now() + secondsLeft * 1000))
  }, [phase, secondsLeft])

  // Реплики по ходу сессии
  useEffect(() => {
    if (phase !== 'running' || totalRef.current === 0) return
    const progress = 1 - secondsLeft / totalRef.current
    if (progress >= 0.85) speak('late', task)
    else if (progress >= 0.5) speak('middle', task)
  }, [secondsLeft, phase, speak, task, minutes])

  // двойной тап по «Закончить раньше»: второй вызов писал бы минуты и награду повторно
  const finishingRef = useRef(false)
  async function start(label: string = task) {
    if (!label.trim()) return
    if (label !== task) setTask(label)
    const task_ = label
    hapticStart()
    playStartSigh()
    totalRef.current = minutes * 60
    setSecondsLeft(minutes * 60)
    firedMomentsRef.current = new Set()
    lastQuarterRef.current = 0
    finishingRef.current = false
    pausedAtRef.current = null
    setPaused(false)
    setPauseUsed(false)
    setThoughtOpen(false)
    setThoughtSaved(false)
    setHowWas(null)
    setDayDone(false)
    setNextTime(null)
    // остальные шаги дела — в старую очередь тоже (финал и Дом прошлых версий читают её)
    // ключ — то, что дробили (дело или шаг очереди), а не выбранный подшаг: иначе подшаги не вставали на место
    // раздробленного шага и остальные шаги дела пропадали (e2e «дробление следующего шага не стирает очередь»)
    if (brokenSteps) void spliceQueue(dealTitle ?? task_, brokenSteps.map((b) => b.text).filter((t) => t !== task_))
    setVoice(fallbackVoice.start)
    // Хореография: интерфейс растворяется, существо садится рядом,
    // таймер проявляется. При reduced-motion — сразу к делу.
    setPhase(reducedMotion ? 'running' : 'starting')
    startedAtRef.current = Date.now()

    // Старт записывается в момент старта: инициация — и есть валюта
    const entry = await recordStart({ label: task_, fromPlan, planned: minutes })
    trackEvent('session_started')
    startIdRef.current = entry.id

    // Если шаг взят из очереди дробления — он исполнен, очередь короче
    await consumeQueueStep(task_)

    // Сессия переживает закрытие вкладки
    await saveActiveSession({
      startedAt: startedAtRef.current,
      minutes,
      task: task_,
      startId: entry.id,
    })

    // План исполнен — убираем: и когда старт пришёл из плана, и когда
    // человек сам начал шаг, лежащий в плане (иначе утром продукт
    // предложит уже сделанное — стейл-план подрывает доверие к памяти)
    const plan = await getPlan()
    // шаг из адреса обрезан до STEP_MAX и без пробелов по краям — сравниваем в том же виде, иначе длинный шаг плана
    // от ИИ, начатый из чата, не закрывал план
    // старт с Дома по плану (plan=1) закрывает план любой даты: вчерашний («ПРОДОЛЖИМ») и завтрашний, начатый раньше —
    // иначе Дом показывал бы его снова (проверка 13.11); шаг мог быть и раздроблен — тогда он уже не равен firstStep
    if (plan && (fromPlan || plan.firstStep.trim().slice(0, STEP_MAX) === task_.trim())) {
      await clearPlan()
    }

    speak('start', task_)
  }

  async function finish(early: boolean, claimedDone = false) {
    if (finishingRef.current) return
    finishingRef.current = true
    pausedAtRef.current = null
    setPaused(false)
    markStepDone(task)
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
    // «Сделал» раньше времени — победа, а не «бросил»: шанс редкой находки честно зависит от отработанного, слова — нет
    setEndedEarly(early && !claimedDone)
    setFirstEver(n === 1)
    setDoneVoice(null)
    setRestRevealed(false)

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
    // следующий шаг того же дела — из «Дел» (там вся цепочка), иначе из старой очереди
    const fromDeal = nextAfter(task)
    const nextStep = fromDeal?.step.text ?? queue?.steps[0] ?? null
    setNextUp({
      step: nextStep,
      queueTask: fromDeal?.deal.title ?? queue?.task ?? null,
      tease,
    })
    // карточка итога ложится в копилку «Дел» (три строки: получилось, дальше, понял — последнюю человек выберет сам)
    setWorked(Math.round(workedMin))
    cardIdRef.current = addCard({ win: task, next: nextStep ?? undefined, minutes: Math.round(workedMin) }).id

    setPhase('done')
    trackEvent('session_completed')
    fetchVoice(early && !claimedDone ? 'early-exit' : 'done', task).then(setDoneVoice)
  }

  function togglePause() {
    if (paused) {
      const away = Date.now() - (pausedAtRef.current ?? Date.now())
      startedAtRef.current += away
      pausedAtRef.current = null
      setPaused(false)
      void saveActiveSession({ startedAt: startedAtRef.current, minutes: totalRef.current / 60, task, startId: startIdRef.current ?? '' })
    } else if (!pauseUsed) {
      pausedAtRef.current = Date.now()
      setPaused(true)
      setPauseUsed(true)
    }
  }
  function plusFive() {
    totalRef.current += 5 * 60
    setMinutes((m) => m + 5)
    setSecondsLeft((v) => v + 5 * 60)
    void saveActiveSession({ startedAt: startedAtRef.current, minutes: totalRef.current / 60, task, startId: startIdRef.current ?? '' })
  }
  function saveThought() {
    addThought(thought)
    setThought('')
    setThoughtOpen(false)
    setThoughtSaved(true)
    window.setTimeout(() => setThoughtSaved(false), 5000)
  }
  function answerHowWas(v: string) {
    setHowWas(v)
    if (cardIdRef.current) updateCard(cardIdRef.current, { insight: v })
    try {
      const prev = JSON.parse(localStorage.getItem(HOW_WAS_KEY) ?? '[]') as unknown[]
      localStorage.setItem(HOW_WAS_KEY, JSON.stringify([...prev.slice(-49), { v, at: Date.now(), task }]))
    } catch {
      /* приватный режим */
    }
  }
  // перерыв 5 минут: кот спит, время идёт, потом «Продолжим?»
  useEffect(() => {
    if (phase !== 'break') return
    const tick = () => setBreakLeft(Math.max(0, Math.ceil((breakEnd - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [phase, breakEnd])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')
  const progress = totalRef.current > 0 ? 1 - secondsLeft / totalRef.current : 0

  if (phase === 'setup') {
    const sel = brokenSteps ? Math.max(0, brokenSteps.findIndex((b) => b.text === task)) : -1
    const others = brokenSteps ? brokenSteps.filter((_, i) => i !== sel) : []
    const line = breakNote
      ? breakNote
      : finerError
      ? 'Не вышло разломать мельче, сеть подвела. *Попробуем ещё раз?*'
      : dropped
      ? `Убрал «${trimLabel(dropped.step.text, 28)}».`
      : brokenSteps
      ? 'Начнём *с этого*. Остальное я положил в Дела.'
      : breaking
        ? 'Секунду, *разламываю*…'
        : buildSetupLine(prefilledStep, priorSessions, companionName)
    return (
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
        <h1 className="sr-only">Фокус-сессия: выбери первый шаг</h1>
        {/* Сцена: существо в центре внимания, а не в углу формы */}
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <MascotSvg expression="calm" action={breaking ? 'think' : 'idle'} label={companionName ?? 'Напарник'} size={brokenSteps ? 120 : 150} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={line}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reducedMotion ? 0.1 : 0.22, ease: [0.05, 0.7, 0.1, 1] }}
              className="glass max-w-80 text-balance rounded-2xl px-4 py-2 text-center font-sans text-[0.95rem] leading-relaxed"
            >
              <EmphasisText text={line} />
              {dropped && (
                <button type="button" onClick={undoDrop} className="press ml-2 inline-flex min-h-11 items-center px-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Вернуть
                </button>
              )}
            </motion.p>
          </AnimatePresence>
        </div>
        {/* листы появляются в разметке (и в сети) только после первого открытия */}
        {sheetsUsed.templates && <TemplatesSheet open={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={applyTemplate} />}
        {sheetsUsed.prefs && <BreakdownPrefs open={prefsOpen} onClose={() => setPrefsOpen(false)} fineness={fineness} onFineness={setFineness} />}
        <div className="flex flex-col gap-4">
          {brokenSteps ? (
            // Этап 1 (research/24 C): один шаг крупно и уже выбран, ещё два — мельче, остальные свёрнуты. Полный список
            // с суммой минут делает дело «длиннее» (Kruger & Evans 2004); близкая подцель сильнее далёкой (Bandura & Schunk)
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary/90">
                  первый шаг · {trimLabel(dealTitle ?? '', 30)}
                </p>
                {/* размер шагов и просьбы — настройка, а не действие: значок в строке подписи, а не четвёртая кнопка-слово */}
                <button
                  type="button"
                  onClick={() => setPrefsOpen(true)}
                  aria-label="Как дробить: размер шагов и просьбы"
                  className="press -my-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <SlidersHorizontal className="size-[18px]" aria-hidden="true" />
                </button>
              </div>
              <div className="glass rounded-2xl border border-primary/40 px-4 pb-3 pt-3.5">
                {editing ? (
                  <input
                    autoFocus
                    value={task}
                    maxLength={STEP_MAX}
                    onChange={(e) => renameStep(e.target.value)}
                    onBlur={() => setEditing(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
                    aria-label="Шаг своими словами"
                    className="field field-compact"
                  />
                ) : (
                  // смена шага — причина и следствие видны: старый уходит вверх за 140 мс, новый приходит за 220 мс
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={breaking ? '…' : task}
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, transition: { duration: 0.14 } }}
                      transition={{ duration: reducedMotion ? 0.1 : 0.22, ease: [0.05, 0.7, 0.1, 1] }}
                      className="text-pretty text-[1.15rem] font-bold leading-snug"
                    >
                      {breaking ? 'Разламываю…' : task}
                    </motion.p>
                  </AnimatePresence>
                )}
                {!editing && (estimate || brokenSteps[sel]?.wait) && (
                  <p className="mt-1 font-mono text-[10.5px] uppercase tracking-widest text-primary/80">
                    {brokenSteps[sel]?.wait && <span className="text-reward">пока ждёшь · </span>}
                    {estimate ? `≈ ${estimate} мин · уже поставил ниже` : ''}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={breaking}
                    onClick={() => void breakDown(true)}
                    className="press inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring gap-1.5 rounded-full bg-primary/15 px-3 text-[13px] font-semibold text-primary disabled:opacity-60"
                  >
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    {breaking ? 'Дроблю…' : 'Ещё мельче'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="press inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full border border-white/10 px-3 text-[13px] font-medium text-foreground/85"
                  >
                    Своими словами
                  </button>
                  {others.length > 0 && (
                    <button
                      type="button"
                      onClick={dropStep}
                      className="press inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full border border-white/10 px-3 text-[13px] font-medium text-muted-foreground"
                    >
                      Не то
                    </button>
                  )}
                </div>
              </div>
              {/* развёрнутый список длинного дела прокручивается сам: кнопка старта не должна уезжать под меню */}
              <div className={showAll ? 'flex max-h-[9.5rem] flex-col gap-2 overflow-y-auto overscroll-contain pr-1' : 'contents'}>
              {(showAll ? others : others.slice(0, 2)).map((st, i) => (
                <motion.button
                  key={st.text}
                  type="button"
                  onClick={() => selectStep(st)}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: reducedMotion ? 0 : 0.04 * i, ease: [0.05, 0.7, 0.1, 1] }}
                  className="press flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-[13.5px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span className="line-clamp-1">{st.text}</span>
                  {st.wait && <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-widest text-reward/90">пока ждёшь</span>}
                </motion.button>
              ))}
              </div>
              {others.length > 2 && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="min-h-11 self-start px-3 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ещё {others.length - 2} — ждут в Делах
                </button>
              )}
            </div>
          ) : (
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Первый шаг
            </span>
            {/* готовые шаги — только когда дела ещё нет: с делом с Дома второй список шагов был лишним выбором */}
            {!prefilledStep && (
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
            )}
            <input
              value={task}
              maxLength={STEP_MAX}
              onChange={(e) => {
                setTask(e.target.value)
                setBrokenSteps(null)
                setBreakNote(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && task.trim()) {
                  void start()
                }
              }}
              autoFocus={!prefilledStep}
              enterKeyHint="go"
              placeholder="Открыть файл презентации"
              className="field"
              autoCapitalize="sentences"
            />
          </label>
          )}

          {!brokenSteps && (
            <div className="flex flex-wrap gap-2">
              {breakable(task) && !stepChips.includes(task) && (
                <button
                  type="button"
                  onClick={() => void requestBreak()}
                  disabled={breaking}
                  className="glass glass-interactive press inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                >
                  <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {breaking ? 'Дроблю…' : 'Раздробить'}
                </button>
              )}
              {/* готовые разбивки бытовых дел: шаги без ожидания ИИ (lib/templates.ts) */}
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="glass glass-interactive press inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground"
              >
                <LayoutList className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Готовые дела
              </button>
            </div>
          )}
          {careReply && (
            <p role="status" className="glass rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed text-foreground">
              {careReply}
            </p>
          )}
          {breakError && !brokenSteps && !breaking && (
            <div
              role="status"
              className="flex items-center gap-2 self-start rounded-full border border-white/10 bg-background/70 px-4 py-2 text-xs leading-relaxed text-muted-foreground"
            >
              Не вышло раздробить — сеть подвела.
              <button
                type="button"
                onClick={() => void requestBreak()}
                className="press inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ещё раз
              </button>
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
                    className={`w-full rounded-xl border px-2 py-3 text-sm font-semibold transition-colors ${
                      minutes === d
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'glass text-muted-foreground transition-[filter] duration-150 hover:text-foreground hover:brightness-125'
                    }`}
                  >
                    {d} мин
                  </button>
                  {!durationTouched && d === 25 && (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary/70">
                      рекомендуем
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {minutes === 5
                ? '5 — просто начать. Часто этого хватает, чтобы поехало'
                : minutes === 15
                  ? '15 — короткий разгон, если просто нужно сдвинуться с места'
                  : minutes === 25
                    ? '25 — классический фокус-блок, не выматывает'
                    : '45 — для дела, в которое стоит погрузиться'}
            </p>
          </div>
          <motion.div whileTap={reducedMotion ? undefined : { scale: 0.96 }}>
            <Button
              size="lg"
              onClick={() => void start()}
              disabled={!task.trim() || breaking}
              className="h-14 w-full text-[17px]"
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
      <div data-vt-arrived="session" className="vt-session relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
        <h1 className="sr-only">Напарник садится рядом</h1>
        <motion.div
          className="vt-cat"
          initial={{ scale: 1.06 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        >
          <MascotSvg expression="happy" action="wave" label="Напарник садится рядом" size={170} />
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
    const C = 2 * Math.PI * 72
    const line = thoughtSaved
      ? 'Положил в Дела. *Возвращаемся*.'
      : paused
        ? 'Пауза. Я *подожду*.'
        : backFromDrift
          ? 'Я тут. *Продолжаем?*'
          : cheering
            ? '*Четверть пути* позади. Идём.'
            : voice
    return (
      <>
        {/* Мир гаснет на время сессии — как у Focus Friend: комната уходит в серый, на экране остаются персонаж, цифры и
            одна кнопка (research/25-deep-teardowns/img/focusfriend-appstore-strip.jpg, последний кадр). Затемнение на весь
            экран, а не на нижнюю треть: гряда с ориентирами, очаг и существо у костра не тянут взгляд. Контраст текста
            от этого только выше (фон темнее коридора 0,152–0,172 не становится: 0,135 поверх сцены даёт ~0,14–0,15). */}
        {/* key: иначе React переиспользовал корневой <div> экрана «starting» под это затемнение и давал сдвиг вёрстки */}
        <div key="running-scrim" aria-hidden="true" className="focus-dim pointer-events-none fixed inset-0 bg-[oklch(0.135_0.012_130/0.8)]" />
        <motion.div
          className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="sr-only">Идёт фокус-сессия</h1>
          {/* Верхний ряд — как у таймера Tiimo: слева плашка звука, справа круглая кнопка вида (у нас — спрятать цифры) */}
          <div className="flex w-full items-center justify-between">
            <SoundChip value={sound} onChange={chooseSound} />
            <button
              type="button"
              onClick={toggleDigits}
              aria-pressed={hideDigits}
              aria-label={hideDigits ? 'Показать цифры' : 'Спрятать цифры'}
              className="press grid size-11 place-items-center rounded-full border border-white/10 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {hideDigits ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
            </button>
          </div>
          {/* Название дела — над кругом (Tiimo: «Laundry» над таймером; Focus Friend: строка над персонажем). Не больше
              двух строк, перенос по любому месту: вставленная ссылка иначе растягивала страницу */}
          <p className="mt-[clamp(0.25rem,2.5dvh,1.5rem)] line-clamp-2 max-w-full text-center font-mono text-[13px] font-semibold uppercase tracking-widest text-foreground/85 [overflow-wrap:anywhere]">
            «{task}»
          </p>
          {/* Круг с котом. Дуга показывает ОСТАВШЕЕСЯ время и тает по часовой стрелке от 12 часов (Tiimo: сиреневая дуга
              убывает, на её конце искра). Видимое, убывающее количество времени — приём Time Timer при слепоте ко времени.
              Трек и дуга — два отдельных <svg>: свечение — фильтр на целом <svg> дуги, его применяет видеокарта (14.11);
              искра — HTML-обёртка, которая поворачивается вместе со временем (transform, без перерисовки). */}
          <div className="focus-ring-wrap relative mt-[clamp(1.25rem,5dvh,4.5rem)] mb-[clamp(0.5rem,3dvh,2rem)] flex items-center justify-center [@media(max-height:600px)]:mt-5 [@media(max-height:600px)]:mb-1">
            <svg className="pointer-events-none absolute -left-4 -top-4 size-[calc(100%+2rem)]" viewBox="0 0 156 156" aria-hidden="true">
              <circle cx="78" cy="78" r="72" fill="none" stroke="color-mix(in oklab, var(--foreground) 14%, transparent)" strokeWidth="6.5" />
            </svg>
            <svg className="focus-ring-arc pointer-events-none absolute -left-4 -top-4 size-[calc(100%+2rem)]" viewBox="0 0 156 156" aria-hidden="true">
              <circle
                cx="78"
                cy="78"
                r="72"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="6.5"
                strokeLinecap="round"
                style={{
                  strokeDasharray: `${C * (1 - progress)} ${C}`,
                  strokeDashoffset: -C * progress,
                  transform: 'rotate(-90deg)',
                  transformOrigin: '78px 78px',
                  transition: reducedMotion ? 'none' : 'stroke-dashoffset 1s linear, stroke-dasharray 1s linear',
                }}
              />
            </svg>
            {progress < 0.995 && (
              <div
                className="focus-ring-head"
                aria-hidden="true"
                style={{ transform: `rotate(${progress * 360}deg)`, transition: reducedMotion ? 'none' : 'transform 1s linear' }}
              >
                <span />
              </div>
            )}
            {/* Кот в своём квадрате стоит низко — подъём уравнивает зазоры до кольца (замер ringgap.mjs, 11.11) */}
            <div className="-translate-y-[12%]">
              <motion.div
                animate={reducedMotion || paused ? undefined : { y: [0, -4, 0], rotate: [0, 0, -1.5, 0, 1.5, 0, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              >
                <MascotSvg
                  expression={paused ? 'sleepy' : cheering || backFromDrift ? 'happy' : 'focused'}
                  label="Напарник работает рядом"
                  size={188}
                  className="size-[var(--focus-cat)]"
                />
              </motion.div>
            </div>
          </div>
          {hideDigits ? (
            <p className="flex h-[68px] items-center font-sans text-lg text-muted-foreground">
              <EmphasisText text={paused ? 'пауза' : 'время идёт, я *слежу*'} />
            </p>
          ) : (
            // без aria-live: role="timer" по умолчанию молчит, иначе скринридер объявлял бы каждую секунду
            <div className="flex h-[68px] flex-col items-center">
              <div role="timer" className="text-5xl font-bold tabular-nums tracking-tight">
                {mm}:{ss}
              </div>
              {/* время окончания словами: при слепоте ко времени «к 19:40» понятнее, чем «осталось 12:31» */}
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-primary/85">
                {paused ? 'на паузе' : endLabel ? `закончишь к ${endLabel}` : ''}
              </p>
            </div>
          )}
          {/* Под цифрами — как у Tiimo: «+5» и пауза рядом с временем, всегда на месте (в прототипе «+5» появлялась только
              в последние 5 минут — у источника она есть всю сессию: продлить хочется в любой момент, когда пошло).
              Третья — «мысль»: отвлёкся — записал, таймер идёт. Подписи под значками: значок без слова пришлось бы угадывать */}
          <div className="mt-2 flex items-start justify-center gap-5 [@media(max-height:600px)]:mt-0">
            <RoundControl label="+5 мин" onClick={plusFive} ariaLabel="Добавить пять минут">
              <span className="font-mono text-[15px] font-bold">+5</span>
            </RoundControl>
            <RoundControl
              label={paused ? 'дальше' : pauseUsed ? 'была' : 'пауза'}
              onClick={togglePause}
              disabled={pauseUsed && !paused}
              active={paused}
              big
              ariaLabel={paused ? 'Продолжить' : 'Пауза'}
            >
              {paused ? <Play className="size-6 fill-current" aria-hidden="true" /> : <Pause className="size-6 fill-current" aria-hidden="true" />}
            </RoundControl>
            <RoundControl label="мысль" onClick={() => setThoughtOpen((v) => !v)} active={thoughtOpen} ariaLabel="Отвлёкся: записать мысль на потом">
              <NotebookPen className="size-[19px]" aria-hidden="true" />
            </RoundControl>
          </div>
          <div className={`mt-2 flex min-h-[52px] w-full items-center justify-center ${thoughtOpen ? '' : '[@media(max-height:600px)]:hidden'}`}>
            {thoughtOpen ? (
              // «Отвлёкся»: мысль не держим в голове и не бросаем дело — кладём в записку, таймер идёт
              <form
                className="glass flex w-full max-w-80 items-center gap-2 rounded-2xl p-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  saveThought()
                }}
              >
                <label className="sr-only" htmlFor="thought">
                  Что пришло в голову? Положу в Дела, вернёшься потом
                </label>
                <input
                  id="thought"
                  autoFocus
                  value={thought}
                  maxLength={200}
                  onChange={(e) => setThought(e.target.value)}
                  placeholder="Что пришло в голову?"
                  className="field field-compact flex-1"
                  enterKeyHint="done"
                  autoCapitalize="sentences"
                />
                <button type="submit" disabled={!thought.trim()} className="btn-press h-12 shrink-0 rounded-[14px] bg-primary px-4 text-[15px] font-bold text-primary-foreground disabled:opacity-50">
                  В Дела
                </button>
              </form>
            ) : (
              // Реплика кота — ответ на событие (старт, четверть пути, возврат, пауза), а не постоянная табличка: через
              // 8 секунд она гаснет, место под неё остаётся — ничего не прыгает (контингентность, CLAUDE.md §3)
              <p
                className={`glass max-w-72 text-balance rounded-2xl px-4 py-2 text-center font-sans text-[0.95rem] leading-relaxed transition-opacity duration-500 ${
                  lineShown || paused ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden={!(lineShown || paused)}
              >
                <EmphasisText text={line} />
              </p>
            )}
          </div>
          {/* Одна главная кнопка (Focus Friend: на экране фокуса одна «STOP FOCUSING»). У нас она не «бросить», а «сделал»:
              выйти раньше — тоже победа, наказаний нет. Раньше здесь были две кнопки рядом, «Сделал» и «Закончить раньше» */}
          <button
            type="button"
            onClick={() => finish(progress < 0.6, true)}
            onTouchStart={() => {}}
            className="btn-chunky mt-auto block w-full select-none rounded-[16px] outline-none"
          >
            <span className="btn-face flex h-[56px] items-center justify-center rounded-[16px] bg-primary px-6 text-[18px] font-bold tracking-[-0.01em] text-primary-foreground">
              Сделал
            </span>
          </button>
        </motion.div>
      </>
    )
  }

  if (phase === 'break') {
    const bm = String(Math.floor(breakLeft / 60)).padStart(2, '0')
    const bs = String(breakLeft % 60).padStart(2, '0')
    return (
      // кот и время — по центру свободного места, кнопки прижаты к низу над меню: в зоне большого пальца (Hoober)
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-5 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-8">
        <h1 className="sr-only">Перерыв</h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <MascotSvg expression="sleepy" label="Напарник отдыхает" size={160} />
        <div className="text-center">
          <p className="text-4xl font-bold tabular-nums">{breakLeft > 0 ? `${bm}:${bs}` : 'Отдохнули'}</p>
          <p className="mt-1 text-[0.95rem] text-muted-foreground">
            {breakLeft > 0 ? 'Встань, попей воды, посмотри в окно. Я подремлю.' : 'Продолжим? Можно и не продолжать.'}
          </p>
        </div>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button
            size="lg"
            className="h-auto min-h-14 py-3 text-[17px] whitespace-normal"
            onClick={() => {
              setGrownElement(null)
              if (nextUp.step) void start(nextUp.step)
              else {
                setTask('')
                setPhase('setup')
              }
            }}
          >
            {nextUp.step ? `Продолжим: «${trimLabel(nextUp.step, 40)}»` : 'Продолжим'}
          </Button>
          <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => { setGrownElement(null); setRestRevealed(true); setPhase('done'); setDayDone(true) }}>
            На сегодня всё
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 pt-4">
      <MascotSvg expression="excited" action="celebrate" label="Напарник радуется" size={72} />
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold">
          {firstEver ? 'Первое дело сдвинуто.' : endedEarly ? 'Ты начал.' : 'Сделано.'}
        </h1>
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
          {/* Пока находка прорастает, карточка не кликается: второй тап по «Закончить раньше» приходился ровно на
              неё (она встаёт на место кнопки) и уводил в Мир мимо самого пика награды */}
          <Link
            href="/app/world"
            aria-disabled={!restRevealed}
            tabIndex={restRevealed ? undefined : -1}
            style={{ pointerEvents: restRevealed ? undefined : 'none' }}
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
            <span className="sr-only">Смотреть остров целиком</span>
          </Link>
        </motion.div>
      )}

      {/* План и кнопки появляются после того, как находка отыграла свой момент */}
      <motion.div
        className="flex w-full flex-col items-center gap-3"
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
            href={
              fromTest
                ? withAttribution(testNext, typeof window === 'undefined' ? '' : window.location.search)
                : fromOnb
                  ? withAttribution(onbNext, typeof window === 'undefined' ? '' : window.location.search)
                  : '/app'
            }
            onTouchStart={() => {}}
            className="btn-chunky block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
              {fromTest || fromOnb ? 'Дальше' : 'Дальше — в мой дом'}
            </span>
          </Link>
          <Button
            variant="ghost"
            className="h-11 text-muted-foreground"
            onClick={() => {
              setTask(nextUp.step ?? task)
              // первая сессия была двухминутной (FIRST_MINUTES) — «подольше» значит обычные 25, не те же 2
              setMinutes(25)
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
      {/* Три карточки итога (Shimmer: Win / Action / Insight) — сразу после находки, до кнопок: сначала «что вышло»,
          потом «что дальше». Третью человек заполняет одним тапом, можно не отвечать */}
      {restRevealed && !dayDone && <WinCards win={task} minutes={worked} next={nextUp.step} howWas={howWas} onHowWas={answerHowWas} />}
      {/* Этап 1 (research/24 C/A): «Как было?» по желанию, потом три пути — следующий шаг сразу с тем же котом /
          перерыв 5 минут / «на сегодня всё» + «когда следующий раз?». Раньше здесь были «план на завтра» и «ещё одна» */}
      {!dayDone ? (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setGrownElement(null)
              setDoneVoice(null)
              setEndedEarly(false)
              if (nextUp.step) void start(nextUp.step)
              else {
                setTask('')
                setPhase('setup')
              }
            }}
            onTouchStart={() => {}}
            className="btn-chunky block w-full select-none rounded-[16px] text-left outline-none"
          >
            <span className="btn-face flex min-h-[56px] flex-col justify-center rounded-[16px] bg-primary px-5 py-2 text-primary-foreground">
              <span className="text-[16px] font-bold">{nextUp.step ? 'Следующий шаг' : 'Ещё одна сессия'}</span>
              {nextUp.step && <span className="line-clamp-1 text-[13px] opacity-80">«{trimLabel(nextUp.step, 60)}» · кот остаётся рядом</span>}
            </span>
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBreakEnd(Date.now() + 5 * 60 * 1000)
                setPhase('break')
              }}
              className="glass glass-interactive press h-12 flex-1 rounded-2xl text-sm font-semibold"
            >
              Перерыв 5 минут
            </button>
            <button
              type="button"
              onClick={() => setDayDone(true)}
              className="glass glass-interactive press h-12 flex-1 rounded-2xl text-sm font-semibold"
            >
              На сегодня всё
            </button>
          </div>
        </div>
      ) : !nextTime ? (
        <div className="glass flex w-full flex-col gap-3 rounded-2xl p-4">
          <p className="text-center text-sm font-semibold">Когда следующий раз?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Сегодня вечером', 'Завтра утром', 'Завтра вечером', 'Пока не знаю'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setNextTime(t)
                  if (t !== 'Пока не знаю')
                    void savePlan({ task: nextUp.queueTask ?? task, firstStep: nextUp.step ?? task, startTime: t })
                }}
                className="press h-11 rounded-full border border-white/10 px-3.5 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <div className="glass flex w-full flex-col gap-1 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold">
              {nextTime === 'Пока не знаю' ? 'Хорошо. Шаг подождёт в Делах.' : `Договорились: ${nextTime.toLowerCase()}.`}
            </p>
            {nextUp.step && <p className="text-sm text-muted-foreground">«{trimLabel(nextUp.step, 60)}» ждёт в Делах. Ничего не сгорит.</p>}
            {/* Уйти с назначенным временем (Shimmer: человек уходит с первой встречи с уже записанной следующей).
                Настоящее напоминание у нас двух видов: Telegram, если связан, и файл календаря на завтра */}
            {nextTime.startsWith('Завтра') && (
              <button
                type="button"
                onClick={() => void import('@/lib/calendar').then((m) => m.downloadIcs(nextTime.toLowerCase(), nextTime === 'Завтра утром' ? '09:00' : '19:00', nextUp.step ?? task))}
                className="press mx-auto mt-2 inline-flex h-11 items-center rounded-full border border-white/10 px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Добавить в календарь
              </button>
            )}
            {nextTime !== 'Пока не знаю' && (
              <div className="flex justify-center">
                <TgRemind plan={{ task: nextUp.queueTask ?? task, firstStep: nextUp.step ?? task, startTime: nextTime }} current />
              </div>
            )}
          </div>
          <Button render={<Link href="/app" />} nativeButton={false} variant="ghost" className="h-11 text-muted-foreground">
            На Дом
          </Button>
        </div>
      )}
      </>
      )}
      </motion.div>
    </div>
  )
}


/** Круглая кнопка под цифрами таймера с подписью (у Tiimo — «+5» и пауза под временем) */
function RoundControl({
  label,
  ariaLabel,
  onClick,
  children,
  big = false,
  active = false,
  disabled = false,
}: {
  label: string
  ariaLabel: string
  onClick: () => void
  children: React.ReactNode
  big?: boolean
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="press group flex w-16 flex-col items-center gap-1 focus-visible:outline-none disabled:opacity-40"
    >
      <span
        className={`grid place-items-center rounded-full transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-ring ${
          big ? 'size-14' : 'mt-1 size-12'
        } ${
          active
            ? 'bg-primary text-primary-foreground'
            : big
              ? 'bg-[oklch(0.97_0.005_100)] text-[oklch(0.2_0.02_130)] shadow-[0_3px_0_oklch(0.7_0.01_100)]'
              : 'border border-white/15 bg-white/5 text-foreground/90'
        }`}
      >
        {children}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </button>
  )
}
