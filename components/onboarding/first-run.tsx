'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  BatteryLow,
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleQuestionMark,
  Compass,
  Dices,
  Dumbbell,
  Feather,
  Handshake,
  Hourglass,
  House,
  MessageCircle,
  PenLine,
  ShieldCheck,
  Smartphone,
  Sofa,
  Sparkles,
  Sun,
  Timer,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { MascotDoll as MascotSvg } from '@/components/mascot-doll';
import { type MascotAction, type MascotExpression } from '@/components/mascot-doll'
import { EmphasisText } from '@/components/emphasis-text'
import { HoldToStart } from '@/components/onboarding/hold-to-start'
import { NightScene } from '@/components/landing/night-scene'
import { navigateWithTransition } from '@/lib/view-transition'
import { withAttribution } from '@/lib/visitor'
import { getPatterns, peekStarts } from '@/lib/memory'
import { useClientMount } from '@/hooks/use-client-mount'
import { hapticThreshold } from '@/lib/haptics'
import { firstStepFor } from '@/lib/ai-client'
import {
  BLOCKERS,
  COSTS,
  COST_CAPTION,
  EMPTY_ONBOARDING,
  FIRST_MINUTES,
  HANGING,
  LAST_STEP,
  MOTIVES,
  SPHERES,
  STEP_BLOCKER,
  STEP_COST,
  STEP_FIGURE,
  STEP_FIRST,
  STEP_HANGING,
  STEP_MOTIVE,
  STEP_PLAN,
  STEP_SPHERE,
  ONBOARDING_QUERY_KEYS,
  costBundle,
  defaultStep,
  onboardingFromQuery,
  onboardingToQuery,
  planLines,
  readOnboarding,
  stepsFor,
  suggestStep,
  writeOnboarding,
  type Blocker,
  type Cost,
  type Hanging,
  type Motive,
  type OnboardingState,
  type Sphere,
} from '@/lib/onboarding'

/**
 * Первый вход в стиле Duolingo (v2, документ владельца 10.11): пять вопросов чипами
 * (что висит, сколько, что мешает, ради чего, сколько ест) → «твоя цифра» → первый шаг → «собираю» → план →
 * договор с «если — то» и «удерживай, чтобы начать» → сразу 2-минутная сессия.
 *
 * Откуда каждое решение (knowledge/playbook в youtube_researcher):
 * - онбординг = первое реальное действие, не слайды-тур (90% их пропускают);
 * - один вопрос на экран, прогресс сверху виден с первого вопроса (Particle);
 * - каждый ответ меняет следующий экран (Appelune), кот сразу реагирует
 *   на выбор — контингентная обратная связь, а не молчаливая форма;
 * - «Пока не знаю» — честный вариант ответа, а не стыдный пропуск (DAD-тест);
 * - главная кнопка всегда в одном месте у большого пальца, как на лендинге;
 * - цена бездействия — только из числа, которое назвал сам человек (кот умножает на 30 и говорит об этом);
 * - удержание вместо тапа — ритуал обязательства (Chilli/How We Feel),
 *   заодно защита от случайного старта;
 * - шаг переживает перезагрузку: вернулся — продолжаем, а не с нуля.
 */

const SPHERE_ICON: Record<Sphere, LucideIcon> = {
  study: BookOpen,
  work: Briefcase,
  home: House,
  message: MessageCircle,
  unsure: Compass,
}

const HANGING_ICON: Record<Hanging, LucideIcon> = {
  day: Sun,
  week: CalendarDays,
  month: CalendarClock,
  unknown: CircleQuestionMark,
}

const BLOCKER_ICON: Record<Blocker, LucideIcon> = {
  where: Compass,
  phone: Smartphone,
  boring: Hourglass,
  fear: Feather,
  tired: BatteryLow,
}

const MOTIVE_ICON: Record<Motive, LucideIcon> = {
  relief: Wind,
  people: Handshake,
  safety: ShieldCheck,
  rest: Sofa,
  proof: Dumbbell,
}

const COST_ICON: Record<Cost, LucideIcon> = {
  q15: Timer,
  hour: Hourglass,
  two: CalendarClock,
  allday: BatteryLow,
  unknown: CircleQuestionMark,
}

/** Адрес знакомства для состояния: наш шаг и ответы плюс всё, что уже было в адресе (метка ролика и т. п.) */
function onboardingUrl(state: OnboardingState): string {
  const current = new URLSearchParams(window.location.search)
  for (const k of ONBOARDING_QUERY_KEYS) current.delete(k)
  const out = new URLSearchParams(onboardingToQuery(state))
  current.forEach((v, k) => out.append(k, v))
  return `${window.location.pathname}?${out.toString()}`
}

/** Время для защиты от двойного тапа — вне компонента: это событие, а не часть отрисовки */
const clock = () => performance.now()

export function FirstRun() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  // Переход внутри сайта (встроенный скрипт страницы тут не срабатывает): у кого уже есть старты, первый вопрос
  // не рисуем даже на кадр — эффект ниже сразу уводит домой
  const clientMount = useClientMount()
  const [returning] = useState(() => clientMount && peekStarts().length > 0)
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING)
  // Шаг ещё не прочитан из адреса: пузырь и варианты не показываем. Иначе при открытии ссылки на середине (перезагрузка,
  // «Открыть в Safari») на миг мелькал первый вопрос и уезжал, уступая нужному
  const [ready, setReady] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [custom, setCustom] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  // человек сам нажал на шаг (а не оставил предвыбранный) — кот откликается
  // «Сколько висит?»: после ответа с пояснением список свёрнут до выбранного; «Другой ответ» — снова весь список
  const [hangOpen, setHangOpen] = useState(false)
  const [pickedStep, setPickedStep] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Кот отзывается на каждое «Продолжить» (Duolingo: сова жмурится и искрит на каждый шаг)
  const [hop, setHop] = useState(false)
  const hopTimer = useRef(0)
  // «Собираю под тебя» между выбором шага и договором (Duolingo, Simple, Headway — честная «иллюзия работы»,
  // Growth.Design): кот думает, ответы человека отмечаются по одной — видно, что договор собран из них, а не шаблон
  const [building, setBuilding] = useState(false)
  // Кот отвечает на выбор позой, а не только репликой (Headway: своя поза на каждый ответ; Duolingo: реакция
  // в 0,2 с после тапа). Короткая поза, потом обычное лицо по реплике
  const [react, setReact] = useState<{ face: MascotExpression; action: MascotAction } | null>(null)
  const reactTimer = useRef(0)
  function catReact(face: MascotExpression, action: MascotAction, ms = 850) {
    if (reduceMotion) return
    window.clearTimeout(reactTimer.current)
    setReact({ face, action })
    reactTimer.current = window.setTimeout(() => setReact(null), ms)
  }
  useEffect(() => () => window.clearTimeout(reactTimer.current), [])

  // «Подскажи» через обвязку (lib/ai): своё дело в поле → первый крошечный шаг для НЕГО; поле пустое, в нём уже
  // подсказка из списка или обвязка не ответила — мгновенная подсказка сферы, как раньше
  const [thinking, setThinking] = useState(false)
  const [careReply, setCareReply] = useState<string | null>(null)
  const suggestAbort = useRef<AbortController | null>(null)
  useEffect(() => () => suggestAbort.current?.abort(), [])
  // текущее значение поля для ответа, пришедшего после ожидания (замыкание suggest видит старое)
  const customRef = useRef(custom)
  useEffect(() => {
    customRef.current = custom
  }, [custom])
  function cancelSuggest() {
    suggestAbort.current?.abort()
    setThinking(false)
    setCareReply(null)
  }
  async function suggest() {
    hapticThreshold()
    setNudge(false)
    setCareReply(null)
    const typed = custom.trim()
    const local = () => suggestStep(state.sphere, state.blocker, typed || state.firstStep)
    if (typed.length < 3 || stepsFor(state.sphere, state.blocker).includes(typed)) {
      catReact('happy', 'wave', 700)
      setCustom(local())
      return
    }
    suggestAbort.current?.abort()
    const ctrl = new AbortController()
    suggestAbort.current = ctrl
    setThinking(true)
    setReact({ face: 'focused', action: 'think' })
    const answer = await firstStepFor(
      typed,
      { sphere: SPHERES.find((x) => x.key === state.sphere)?.label, blocker: BLOCKERS.find((b) => b.key === state.blocker)?.label },
      { signal: ctrl.signal },
    )
    if (ctrl.signal.aborted) return
    setThinking(false)
    setReact(null)
    // человек за время ожидания поменял поле или ушёл с шага — его текст важнее подсказки
    if (customRef.current.trim() !== typed) return
    if (answer?.kind === 'care') {
      setCareReply(answer.reply)
      return
    }
    catReact('happy', 'wave', 700)
    setCustom(answer?.step ?? local())
  }

  const buildTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(buildTimer.current), [])

  // Направление перехода: вперёд экран уезжает влево, назад — вправо
  const dirRef = useRef(1)

  // Шаг и ответы в адресе (ниже): шаг, который сейчас в адресе (null — адрес ещё не прочитан), сколько записей
  // истории добавили мы сами и пришло ли изменение от «Назад»/«Вперёд» браузера
  const urlStepRef = useRef<number | null>(null)
  const pushedRef = useRef(0)
  const fromPopRef = useRef(false)
  const leavingRef = useRef(false)

  // Уже есть старты — онбординг не нужен: человек вернулся, ведём домой.
  useEffect(() => {
    let alive = true
    void getPatterns().then((p) => {
      if (!alive) return
      if (p.totalStarts > 0) {
        router.replace('/app')
        return
      }
      // адрес главнее записи на устройстве: ссылка, открытая в Safari из Instagram, ведёт на тот же вопрос
      const saved = readOnboarding()
      const initial = onboardingFromQuery(new URLSearchParams(window.location.search), saved) ?? saved
      writeOnboarding(initial)
      urlStepRef.current = initial.step
      window.history.replaceState(null, '', onboardingUrl(initial))
      setState(initial)
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [router])

  // Нижнего меню на знакомстве нет: AppNav не рисует его на /app/start (components/app-nav.tsx).

  // Шаг и ответы — в адресе (lib/onboarding.ts, onboardingToQuery). Новый вопрос — новая запись истории: «Назад»
  // браузера (и свайп на iPhone) открывает предыдущий вопрос. Ответ на том же вопросе — замена записи.
  // urlStepRef — шаг, который сейчас в адресе (объявлен выше, у чтения адреса при открытии).
  useEffect(() => {
    // Уход на сессию уже начат (begin): Next считает replaceState/pushState во время перехода новой навигацией
    // и молча отменяет router.push — кнопка навсегда оставалась на «Поехали» (iPhone владельца, 11.11)
    if (urlStepRef.current === null || leavingRef.current) return
    const url = onboardingUrl(state)
    if (state.step !== urlStepRef.current && !fromPopRef.current) {
      window.history.pushState(null, '', url)
      pushedRef.current += 1
    } else {
      window.history.replaceState(null, '', url)
    }
    fromPopRef.current = false
    urlStepRef.current = state.step
  }, [state])
  useEffect(() => {
    function onPop() {
      const next = onboardingFromQuery(new URLSearchParams(window.location.search), readOnboarding())
      if (!next) return
      fromPopRef.current = true
      pushedRef.current = Math.max(0, pushedRef.current - 1)
      window.clearTimeout(buildTimer.current)
      setBuilding(false)
      setNudge(false)
      setState((prev) => {
        dirRef.current = next.step >= prev.step ? 1 : -1
        writeOnboarding(next)
        return next
      })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function update(patch: Partial<OnboardingState>) {
    setState((s) => {
      const next = { ...s, ...patch }
      writeOnboarding(next)
      return next
    })
  }

  function go(step: number) {
    window.clearTimeout(buildTimer.current)
    setBuilding(false)
    dirRef.current = step > state.step ? 1 : -1
    setNudge(false)
    update({ step })
  }

  const step = state.step
  // Шрифты карточки договора (моноширинный надзаголовок и рукопись 400) больше нигде в знакомстве не нужны и
  // начинали грузиться только на ней: 0,3 с (на 3G — секунды) строки стояли пустыми (font-display: block).
  // Просим браузер загрузить их заранее, пока человек отвечает на вопросы (аудит 02.11).
  useEffect(() => {
    const fonts = document.fonts
    if (!fonts?.load) return
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-jetbrains-mono').split(',')[0].trim()
    const sample = 'Твои первые минуты'
    if (mono) void fonts.load(`600 11px ${mono}`, sample).catch(() => {})
    void fonts.load('400 19px Caveat', sample).catch(() => {})
  }, [])
  // экран старта загружаем заранее, пока человек читает договор: переход после удержания не ждёт сеть
  useEffect(() => {
    if (step === LAST_STEP) router.prefetch('/app/session')
  }, [step, router])
  const steps = stepsFor(state.sphere, state.blocker)
  const chosenStep = customOpen ? custom.trim() : state.firstStep
  const sphere = SPHERES.find((x) => x.key === state.sphere)
  const hanging = HANGING.find((h) => h.key === state.hanging)
  const blocker = BLOCKERS.find((b) => b.key === state.blocker)
  const motive = MOTIVES.find((m) => m.key === state.motive)
  const cost = COSTS.find((c) => c.key === state.cost)
  const bundle = costBundle(state)

  // Можно ли идти дальше с текущего экрана (крючок, «цифра» и план — без ответа)
  const canContinue =
    (step === STEP_SPHERE && !!state.sphere) ||
    (step === STEP_HANGING && !!state.hanging) ||
    (step === STEP_BLOCKER && !!state.blocker) ||
    (step === STEP_MOTIVE && !!state.motive) ||
    (step === STEP_COST && !!state.cost) ||
    step === STEP_FIGURE ||
    (step === STEP_FIRST && !!chosenStep) ||
    step === STEP_PLAN

  // двойной клик по «Продолжить» пролетал через шаг: на шаге выбора дела выбор уже предзаполнен, и второй клик сразу
  // уводил дальше — вопрос «с чего начнём» человек так и не видел. Пока слайд въезжает, клики не считаются.
  const lastGoRef = useRef(0)
  function next() {
    if (building || clock() - lastGoRef.current < 400) return
    if (thinking) cancelSuggest() // ушли с шага — поздняя подсказка ничего не перезапишет
    if (!canContinue) {
      // Не немая кнопка: кот мягко подсказывает, что сделать
      setNudge(true)
      return
    }
    // на выборе дела предвыбран самый маленький шаг (с поправкой на помеху); ответы могли смениться — старый выбор сбрасывается
    const toFirst = step === STEP_FIGURE || (step === STEP_COST && !cost?.monthly)
    if (toFirst && (!state.firstStep || !steps.includes(state.firstStep))) {
      update({ firstStep: defaultStep(state.sphere, state.blocker) })
    }
    if (step === STEP_FIRST && customOpen && custom.trim()) {
      update({ firstStep: custom.trim() })
    }
    lastGoRef.current = clock()
    setHop(true)
    window.clearTimeout(hopTimer.current)
    hopTimer.current = window.setTimeout(() => setHop(false), 900)
    // без числа («весь день фоном», «не могу сказать») экрана «твоя цифра» нет: кот уже сказал своё на этом вопросе
    if (step === STEP_COST && !cost?.monthly) {
      setPickedStep(false)
      go(STEP_FIRST)
      return
    }
    if (step === STEP_FIGURE) setPickedStep(false)
    if (step === STEP_FIRST) {
      // «Собираю твой план» (2,5 с): три строки отмечаются по одной — план собран из его ответов, а не шаблон
      setBuilding(true)
      buildTimer.current = window.setTimeout(() => go(STEP_PLAN), reduceMotion ? 700 : BUILD_MS)
      return
    }
    go(step + 1)
  }

  // Модель клавиатуры radiogroup (ARIA APG): стрелки двигают фокус И выбор,
  // Tab входит в группу одной точкой (roving tabindex ниже, в Option)
  function onRadioKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']
    if (!keys.includes(e.key)) return
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'),
    )
    if (radios.length === 0) return
    const at = radios.indexOf(document.activeElement as HTMLButtonElement)
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
    const next = radios[(at + dir + radios.length) % radios.length]
    e.preventDefault()
    next.focus()
    next.click()
  }

  function begin() {
    if (leavingRef.current) return
    const label = chosenStep || steps[0]
    leavingRef.current = true
    setLeaving(true)
    // меню прячем ещё до перехода: страница Фокуса монтируется не в том же кадре, что новый адрес, и меню успевало
    // мелькнуть между знакомством и стартом. Дальше флагом владеет сессия; на других экранах его снимает AppNav.
    document.body.dataset.focusImmersive = 'true'
    // в память, но не в состояние: новое состояние запустило бы синхронизацию адреса посреди перехода
    writeOnboarding({ ...state, step: LAST_STEP, firstStep: label })
    // from=onb + ответы: финал первой сессии ведёт на «Как было?» (/app/start/after), а не сразу домой
    const params = new URLSearchParams({
      step: label,
      d: String(FIRST_MINUTES),
      auto: '1',
      from: 'onb',
    })
    if (state.motive) params.set('m', state.motive)
    if (state.blocker) params.set('b', state.blocker)
    if (state.sphere) params.set('s', state.sphere)
    // Пропуск автостарта: auto=1 срабатывает, только если его выдала эта кнопка. Иначе чужая ссылка
    // /app/session?step=…&auto=1 сама запускала сессию и записывала свой текст в старты — а старты уходят
    // в промпт напарника при каждом разговоре (components/focus-session.tsx, AUTO_START_KEY).
    try {
      window.sessionStorage.setItem("naparnik:autoStart", label);
    } catch {
      /* хранилище недоступно — человек нажмёт «старт» сам */
    }
    // кот из карточки договора перелетает в центр старта (lib/view-transition.ts)
    navigateWithTransition(
      () => router.push(withAttribution(`/app/session?${params.toString()}`, window.location.search)),
      'session',
    )
  }

  // Что говорит кот и с каким лицом — реакция на выбор, а не статичный текст. Тексты — документ владельца 10.11
  let line = ''
  let face: MascotExpression = 'calm'
  if (step === STEP_SPHERE) {
    line = nudge
      ? 'Выбери любой вариант — *ошибиться нельзя*.'
      : sphere
        ? sphere.echo
        : 'Что сейчас *висит* больше всего?'
    face = sphere ? 'happy' : nudge ? 'listening' : 'calm'
  } else if (step === STEP_HANGING) {
    line = nudge ? 'Примерно — *этого хватит*.' : hanging ? hanging.echo : 'А сколько это уже *висит*?'
    face = hanging ? 'happy' : 'listening'
  } else if (step === STEP_BLOCKER) {
    line = nudge ? 'Любой ответ подойдёт — *я подстроюсь*.' : blocker ? blocker.echo : 'Что обычно *мешает начать*?'
    face = blocker ? 'happy' : 'listening'
  } else if (step === STEP_MOTIVE) {
    line = nudge
      ? 'Выбери то, что *ближе всего*.'
      : motive
        ? motive.echo
        : 'Представь: это больше не висит. Что изменится *первым*?'
    face = motive ? 'happy' : 'listening'
  } else if (step === STEP_COST) {
    line = nudge
      ? 'Примерно — *этого хватит*.'
      : cost
        ? cost.monthly
          ? 'Записал. Сейчас *посчитаю*.'
          : cost.figure
        : 'Честно: сколько в день уходит на то, чтобы думать об этом, откладывать, снова вспоминать?'
    face = cost ? 'happy' : 'calm'
  } else if (step === STEP_FIGURE) {
    line = cost?.figure ?? ''
    face = 'calm'
  } else if (step === STEP_FIRST && building) {
    line = 'Секунду, собираю…'
    face = 'calm'
  } else if (step === STEP_FIRST) {
    line = nudge
      ? 'Напиши хоть одно слово — *этого хватит*.'
      : pickedStep && !customOpen && state.firstStep
        ? `Беру: «${state.firstStep}». *${FIRST_MINUTES} минут* хватит.`
        : `Давай найдём самый маленький кусочек. Такой, чтобы на него хватило ${FIRST_MINUTES} минут. Выбери или напиши свой.${state.blocker === 'tired' ? ' Можно ещё меньше.' : ''}`
    face = pickedStep ? 'happy' : 'calm'
  } else if (step === STEP_PLAN) {
    line = 'Это не план «стать продуктивным». Это план начать. Начинать — это и есть навык.'
    face = 'happy'
  }

  // Шаг как у Duolingo: кот и пузырь стоят, ответы уезжают в сторону хода (вперёд — влево), новые въезжают
  // с другой стороны; «назад» — зеркально. Уход 0,24 с с ускорением, въезд 0,38 с с торможением и паузой 0,1 с —
  // старое уходит быстрее, чем приходит новое (NN/g: выход ≈ 60–70 % входа).
  const dir = dirRef.current
  const listMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } }
    : {
        // прозрачность гаснет раньше, чем доезжает сдвиг, а новое начинает проявляться, когда старого уже нет —
        // ответы двух шагов не накладываются друг на друга
        initial: { opacity: 0, x: 96 * dir },
        animate: {
          opacity: 1,
          x: 0,
          transition: {
            x: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const, delay: 0.18 },
            opacity: { duration: 0.22, ease: 'easeOut' as const, delay: 0.18 },
          },
        },
        exit: {
          opacity: 0,
          x: -96 * dir,
          transition: { x: { duration: 0.26, ease: [0.4, 0, 1, 1] as const }, opacity: { duration: 0.16, ease: 'linear' as const } },
        },
      }
  // договор: кот и карточка сами перелетают на место (layoutId), контейнер не двигаем — иначе кот уехал бы вбок
  const commitMotion = { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: listMotion.exit }

  if (returning) return <main className="h-dvh" aria-busy="true" />

  return (
    <>
    {/* Ночное небо лендинга остаётся фоном всего знакомства (cofounder.co: после кнопки встречает тот же мир) —
        человек ещё «снаружи»; небо приложения (AppBackdrop под этим слоем) открывается на старте сессии */}
    <div className="pointer-events-none fixed inset-0">
      <NightScene />
    </div>
    <main data-vt-arrived="onb" className="vt-onb night-glass relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="sr-only">Знакомство с Напарником</h1>
      {/* Где я: назад + прогресс. На приветствии шкалы нет — вопросов ещё не было */}
      <div className="flex h-12 shrink-0 items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 1) router.push(withAttribution('/', window.location.search))
              // предыдущий вопрос уже есть в истории — уходим на него, а не плодим новую запись
              else if (pushedRef.current > 0) window.history.back()
              else go(step - 1)
            }}
            aria-label="Назад"
            className="press -ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-11 shrink-0" />
        )}
        {step > 0 && (
          <div
            role="progressbar"
            aria-label="Шаг знакомства"
            aria-valuemin={1}
            aria-valuemax={LAST_STEP}
            aria-valuenow={step}
            className="relative h-3 flex-1 rounded-full bg-foreground/12"
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary shadow-[0_0_8px_0_color-mix(in_oklab,var(--primary)_28%,transparent),0_0_18px_1px_color-mix(in_oklab,var(--primary)_10%,transparent)]"
              initial={false}
              animate={{ width: `${(step / LAST_STEP) * 100}%` }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 24 }}
            >
              {/* Блик сверху — объём, как у кнопки, не плоская полоса */}
              <span className="absolute inset-x-2 top-[3px] h-[3px] rounded-full bg-white/35" />
            </motion.div>
          </div>
        )}
        <span className="size-11 shrink-0" />
      </div>

      {/* Ничего не прокручивается: на iPhone в Safari (видимая высота ≈ 650 px) раньше список вариантов прокручивался под
          пузырём и резался жёсткой линией. Размеры кота, пузыря и вариантов те же — на низких экранах (≤ 700 px) сжаты
          только отступы, и всё помещается. Запасной случай (экраны ниже 600 px) — весь блок целиком, не вложенный список */}
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-[calc(6rem+env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [@media(max-height:700px)]:pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
      {/* Кот — один на всё знакомство (одна кукла, не пересоздаётся): на вопросах слева от пузыря, на договоре
          переезжает в центр и растёт. Уходящие ответы закреплены внутри этого же блока — не прыгают, когда
          меняется шапка */}
      <div className={`relative flex min-h-full shrink-0 flex-col ${step === LAST_STEP ? 'justify-center' : ''}`}>
      {step >= 1 && step <= LAST_STEP && (
        <CatAsks
          line={line}
          face={step === LAST_STEP ? 'calm' : react && !building ? react.face : hop && !building ? 'happy' : face}
          action={react && !building ? react.action : undefined}
          nudge={nudge}
          hop={hop && !building}
          think={building}
          step={building ? step + 0.5 : step}
          commit={step === LAST_STEP}
          hideBubble={!ready}
        />
      )}
      {/* до чтения адреса вариантов нет вовсе — иначе на ссылке на середину на кадр мелькал первый вопрос */}
      {ready && (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={building ? 'build' : step}
          {...(step === LAST_STEP ? commitMotion : listMotion)}
          className="flex flex-col"
        >
          {building && (
            <BuildList
              rows={[
                `Шаг на 2 минуты: ${chosenStep || steps[0]}`,
                blocker ? `Приём против «${blocker.label}»` : 'Приём под твою помеху',
                motive
                  ? `Неделя маленьких стартов — ради «${motive.label.charAt(0).toLowerCase()}${motive.label.slice(1)}»`
                  : 'Неделя маленьких стартов',
              ]}
            />
          )}
          {!building && step === STEP_FIGURE && <FigureCard caption={cost?.monthly ? COST_CAPTION : null} bundle={bundle} />}
          {!building && step === STEP_PLAN && <PlanCard state={state} step={chosenStep || steps[0]} />}
          {!building && ((step >= STEP_SPHERE && step <= STEP_COST) || step === STEP_FIRST) && (
            <>
              <div
                className="mt-5 flex flex-col gap-2.5 pb-2 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:gap-1.5"
                role="radiogroup"
                aria-label={
                  step === STEP_SPHERE
                    ? 'Что висит'
                    : step === STEP_HANGING
                      ? 'Сколько уже висит'
                      : step === STEP_BLOCKER
                        ? 'Что мешает начать'
                        : step === STEP_MOTIVE
                          ? 'Ради чего'
                          : step === STEP_COST
                            ? 'Сколько это ест'
                            : 'Первый шаг'
                }
                onKeyDown={onRadioKeys}
              >
                {step === STEP_SPHERE &&
                  SPHERES.map((s, i) => (
                    <Option
                      key={s.key}
                      firstTab={i === 0 && !state.sphere}
                      icon={SPHERE_ICON[s.key]}
                      hue={OPTION_HUES[i % OPTION_HUES.length]}
                      label={s.label}
                      selected={state.sphere === s.key}
                      onSelect={() => {
                        if (state.sphere !== s.key) {
                          hapticThreshold()
                          catReact('excited', 'celebrate')
                        }
                        setNudge(false)
                        // Новая сфера — новые шаги: старый выбор шага сбрасываем
                        update({ sphere: s.key, firstStep: null })
                      }}
                    />
                  ))}
                {step === STEP_HANGING &&
                  // ответ с пояснением («месяц и дольше», «не помню»): остальные варианты уходят, на их месте — пояснение
                  // кота (ответ → объяснение, как в квизах). Так всё помещается без прокрутки и без уменьшения размеров;
                  // «Другой ответ» возвращает список
                  HANGING.filter((h) => !hanging?.insert || hangOpen || h.key === hanging.key).map((h, i) => (
                    <Option
                      key={h.key}
                      firstTab={i === 0 && !state.hanging}
                      icon={HANGING_ICON[h.key]}
                      hue={OPTION_HUES[i % OPTION_HUES.length]}
                      label={h.label}
                      selected={state.hanging === h.key}
                      onSelect={() => {
                        if (state.hanging !== h.key) {
                          hapticThreshold()
                          // свежее — кот оживляется, долгое — спокойно слушает (без упрёка), «не помню» — пожимает плечами
                          if (h.key === 'day') catReact('excited', 'celebrate')
                          else if (h.key === 'week') catReact('happy', 'wave')
                          else if (h.key === 'month') catReact('listening', 'idle')
                          else catReact('calm', 'think')
                        }
                        setNudge(false)
                        setHangOpen(false)
                        update({ hanging: h.key })
                      }}
                    />
                  ))}
                {step === STEP_HANGING && hanging?.insert && !hangOpen && (
                  <>
                    {/* вина — с характера на механизм: только для «месяц и дольше» и «не помню», остальным не тратим секунды */}
                    <p className="glass-hearthside mt-1 rounded-2xl px-4 py-3 text-[15px] leading-snug text-foreground/90">{hanging.insert}</p>
                    <button
                      type="button"
                      onClick={() => setHangOpen(true)}
                      className="press min-h-11 self-start rounded-full px-3 text-[15px] font-semibold text-muted-foreground"
                    >
                      Другой ответ
                    </button>
                  </>
                )}
                {step === STEP_BLOCKER &&
                  BLOCKERS.map((b, i) => (
                    <Option
                      key={b.key}
                      firstTab={i === 0 && !state.blocker}
                      icon={BLOCKER_ICON[b.key]}
                      hue={OPTION_HUES[i % OPTION_HUES.length]}
                      label={b.label}
                      selected={state.blocker === b.key}
                      onSelect={() => {
                        if (state.blocker !== b.key) {
                          hapticThreshold()
                          // «нет сил» — кот сначала сонно соглашается, «боюсь» — слушает, «телефон» — машет «я посторожу», «скучно» — оживляется
                          if (b.key === 'tired') catReact('sleepy', 'idle', 1100)
                          else if (b.key === 'fear') catReact('listening', 'idle')
                          else if (b.key === 'where') catReact('calm', 'think')
                          else if (b.key === 'phone') catReact('happy', 'wave')
                          else catReact('excited', 'celebrate')
                        }
                        setNudge(false)
                        // Новая помеха — новый порядок и умолчание шагов: старый выбор шага сбрасываем
                        update({ blocker: b.key, firstStep: null })
                      }}
                    />
                  ))}
                {step === STEP_MOTIVE &&
                  MOTIVES.map((m, i) => (
                    <Option
                      key={m.key}
                      firstTab={i === 0 && !state.motive}
                      icon={MOTIVE_ICON[m.key]}
                      hue={OPTION_HUES[i % OPTION_HUES.length]}
                      label={m.label}
                      selected={state.motive === m.key}
                      onSelect={() => {
                        if (state.motive !== m.key) {
                          hapticThreshold()
                          catReact(m.key === 'proof' ? 'excited' : 'happy', m.key === 'proof' ? 'celebrate' : 'wave')
                        }
                        setNudge(false)
                        update({ motive: m.key })
                      }}
                    />
                  ))}
                {step === STEP_COST &&
                  COSTS.map((c, i) => (
                    <Option
                      key={c.key}
                      firstTab={i === 0 && !state.cost}
                      icon={COST_ICON[c.key]}
                      hue={OPTION_HUES[i % OPTION_HUES.length]}
                      label={c.label}
                      selected={state.cost === c.key}
                      onSelect={() => {
                        if (state.cost !== c.key) {
                          hapticThreshold()
                          catReact('listening', 'idle')
                        }
                        setNudge(false)
                        update({ cost: c.key })
                      }}
                    />
                  ))}
                {step === STEP_FIRST && (
                  <>
                    {steps.map((s, i) => (
                      <Option
                        key={s}
                        firstTab={i === 0 && customOpen === false && !state.firstStep}
                        icon={Sparkles}
                        hue={OPTION_HUES[i % OPTION_HUES.length]}
                        label={s}
                        selected={!customOpen && state.firstStep === s}
                        onSelect={() => {
                          if (customOpen || state.firstStep !== s) {
                            hapticThreshold()
                            catReact('happy', 'wave', 700)
                          }
                          setNudge(false)
                          setCustomOpen(false)
                          setPickedStep(true)
                          update({ firstStep: s })
                        }}
                      />
                    ))}
                    {customOpen ? (
                      <input
                        autoFocus
                        value={custom}
                        onChange={(e) => {
                          if (thinking || careReply) cancelSuggest()
                          setCustom(e.target.value)
                          setNudge(false)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing && custom.trim()) next()
                        }}
                        enterKeyHint="next"
                        maxLength={80}
                        aria-label="Свой первый шаг"
                        placeholder="Например: открыть черновик"
                        className="h-14 rounded-2xl border-2 border-primary bg-primary/10 px-4 text-base outline-none placeholder:text-muted-foreground"
                      />
                    ) : (
                      <Option
                        icon={PenLine}
                        label="Своё дело…"
                        selected={false}
                        onSelect={() => {
                          setCustomOpen(true)
                          setNudge(false)
                        }}
                      />
                    )}
                    {/* «Подскажи» (как «перемешать» у Finch): под полем «Своё…», чтобы не застрять на пустом */}
                    {customOpen && (
                    <button
                      type="button"
                      disabled={thinking}
                      aria-busy={thinking}
                      onClick={suggest}
                      className="press flex min-h-11 items-center gap-2 self-start rounded-full px-3 text-[15px] font-semibold text-muted-foreground disabled:opacity-70"
                    >
                      <Dices className="size-[18px]" aria-hidden="true" />
                      {thinking ? 'Думаю…' : 'Подскажи'}
                    </button>
                    )}
                    {careReply && (
                      <p role="status" className="text-[15px] leading-snug text-foreground/90">
                        {careReply}
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {step === LAST_STEP && (
            <Commit
              label={chosenStep || steps[0]}
              ifThen={blocker?.ifThen ?? null}
              answers={[sphere?.label, hanging?.chip, blocker?.label].filter(
                (x): x is string => !!x && x !== 'Пока не знаю',
              )}
            />
          )}
        </motion.div>
      </AnimatePresence>
      )}
      </div>
      </section>

      {/* Главное действие — всегда в одной точке у большого пальца */}
      <div className="thumb-cta vt-cta fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))]">
        {step === LAST_STEP ? (
          <HoldToStart onComplete={begin} busy={leaving} />
        ) : (
          <button
            type="button"
            onClick={next}
            onTouchStart={() => {}}
            data-idle={canContinue && !building ? undefined : ''}
            className="btn-chunky btn-wake block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
              {step === STEP_PLAN ? `Начать первые ${FIRST_MINUTES} минуты` : 'Продолжить'}
            </span>
          </button>
        )}
      </div>
    </main>
    </>
  )
}

/**
 * Кот слева, вопрос в пузыре справа (раскладка Duolingo). layoutId общий с
 * приветствием — кот не исчезает, а переезжает: одно существо, один разговор.
 */
export function CatAsks({
  line,
  face,
  nudge,
  hop,
  think = false,
  action,
  step,
  commit,
  hideBubble = false,
}: {
  hideBubble?: boolean
  line: string
  face: MascotExpression
  nudge: boolean
  hop: boolean
  think?: boolean
  action?: MascotAction
  step: number
  commit: boolean
}) {
  const reduce = useReducedMotion()
  const move = { layout: { duration: reduce ? 0 : 0.6, ease: [0.65, 0, 0.35, 1] as const } }
  return (
    <div className={commit ? 'flex flex-col items-center pb-4' : 'flex items-end gap-3 pt-2 [@media(max-height:700px)]:pt-0'}>
      <motion.div
        layout
        className="vt-cat relative z-10 shrink-0"
        animate={nudge ? { rotate: [0, -6, 5, -3, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5, ...move }}
      >
        <MascotSvg
          expression={face}
          action={think ? 'think' : action ?? (hop ? 'wave' : 'idle')}
          size={148}
          className={commit ? 'size-[148px]' : 'size-[104px]'}
          label={commit ? 'Напарник готов' : 'Напарник'}
        />
      </motion.div>
      <AnimatePresence initial={false} mode="popLayout">
      {!commit && (
      <motion.div
        key="bubble"
        exit={{ opacity: 0, transition: { duration: 0.14 } }}
        className={`relative mb-3 min-h-[3.5rem] flex-1 [@media(max-height:700px)]:mb-1 ${hideBubble ? 'invisible' : ''}`}
      >
        {/* новый вопрос — новый пузырь: старый гаснет, новый «выпрыгивает» от кота, как у Duolingo */}
        <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 30, delay: 0.12 }}
          style={{ transformOrigin: '0% 100%' }}
          className="glass-hearthside min-h-[3.5rem] rounded-2xl rounded-bl-sm px-4 py-3 [@media(max-height:700px)]:py-2"
        >
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={line}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            aria-live="polite"
            className="font-hand text-[21px] font-medium leading-snug text-secondary-foreground"
          >
            <EmphasisText text={line} />
          </motion.p>
        </AnimatePresence>
        </motion.div>
        </AnimatePresence>
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Карточка-вариант: крупная (56px), иконка слева, галочка справа у
 * выбранной — выбор читается не только цветом. Нажатие проседает на 2px,
 * как у главной кнопки: один физический язык на весь продукт.
 */
// Свой оттенок у каждого варианта (Duolingo, Brilliant: цветные иконки, а не серые контурные «как в настройках»).
// Тёплые и холодные вперемешку, лайм не берём — он за выбором и главной кнопкой
export const OPTION_HUES = [65, 205, 330, 150, 265, 25]

export function Option({
  icon: Icon,
  label,
  selected,
  onSelect,
  hue,
  firstTab = false,
}: {
  icon: LucideIcon
  label: string
  selected: boolean
  onSelect: () => void
  /** оттенок плитки иконки (oklch hue); без него — нейтральная плитка */
  hue?: number
  /** Точка входа Tab, пока ничего не выбрано (roving tabindex) */
  firstTab?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected || firstTab ? 0 : -1}
      onClick={onSelect}
      onTouchStart={() => {}}
      data-selected={selected ? '' : undefined}
      className="option-card flex min-h-14 w-full shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left"
    >
      {/* плитка 32×32 своего оттенка; у выбранного цвет ярче и плотнее */}
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-200"
        style={
          hue === undefined
            ? { background: 'oklch(1 0 0 / 0.07)', color: 'oklch(0.75 0.01 250)' }
            : {
                background: `oklch(${selected ? 0.8 : 0.72} 0.12 ${hue} / ${selected ? 0.3 : 0.16})`,
                color: `oklch(${selected ? 0.93 : 0.85} ${selected ? 0.14 : 0.12} ${hue})`,
              }
        }
      >
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className={`flex-1 text-base font-semibold ${selected ? 'text-primary' : 'text-foreground'}`}>
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
          selected ? 'scale-100 border-primary bg-primary' : 'scale-90 border-foreground/20'
        } motion-reduce:transition-none motion-reduce:transform-none`}
      >
        {selected && <Check className="size-3.5 text-primary-foreground" strokeWidth={3.5} />}
      </span>
    </button>
  )
}

/** Договор перед стартом: что именно делаем, сколько и почему не страшно */
/** Ответы человека отмечаются по одной (раз в 0,4 с): договор собран из них, а не взят из шаблона */
const BUILD_MS = 2500
function BuildList({ rows }: { rows: string[] }) {
  const reduce = useReducedMotion()
  return (
    <ul className="mt-5 flex flex-col gap-2.5" aria-label="Собираю твой план">
      {rows.map((row, i) => (
        <motion.li
          key={i}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.15 + i * 0.7 }}
          className="option-card flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3"
        >
          <motion.span
            aria-hidden="true"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0.1 } : { type: 'spring', stiffness: 520, damping: 22, delay: 0.4 + i * 0.7 }}
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary"
          >
            <Check className="size-3.5 text-primary-foreground" strokeWidth={3.5} />
          </motion.span>
          <span className="flex-1 text-base font-semibold text-foreground">{row}</span>
        </motion.li>
      ))}
    </ul>
  )
}

/** «Твоя цифра»: подпись «это твоя оценка» — под числом, а связка со сроком — только из его ответов */
function FigureCard({ caption, bundle }: { caption: string | null; bundle: string | null }) {
  if (!caption && !bundle) return null
  return (
    <div className="glass-hearthside mt-5 flex flex-col gap-2.5 rounded-2xl px-4 py-4">
      {caption && <p className="text-[13px] font-semibold leading-snug text-muted-foreground">{caption}</p>}
      {bundle && <p className="text-[15px] leading-snug text-foreground/90">{bundle}</p>}
    </div>
  )
}

/** Экран плана: в каждой строке — ответ самого человека, без «эффекта Барнума» (общих фраз, подходящих всем) */
function PlanCard({ state, step }: { state: OnboardingState; step: string }) {
  const plan = planLines(state, step)
  const rows: [string, ReactNode][] = [
    ['Что висит', plan.hanging],
    ['Что мешает', plan.blocker ? `${plan.blocker} → наш приём: ${plan.approach}` : null],
    ['Ради чего', plan.motive],
    ['Сегодня', plan.today],
    ['Неделя', plan.week],
  ]
  return (
    <div className="glass-hearthside mt-5 shrink-0 rounded-2xl px-4 py-4 [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:py-3">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
        {plan.title}
      </p>
      <ul className="mt-3 flex flex-col gap-2.5 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:gap-2">
        {rows
          .filter(([, v]) => !!v)
          .map(([k, v]) => (
            <li key={k} className="flex gap-2.5 text-[15px] leading-snug">
              <span aria-hidden="true" className="mt-[7px] size-2 shrink-0 rotate-45 rounded-[2px] bg-primary" />
              <span>
                <span className="font-semibold">{k}:</span> {v}
              </span>
            </li>
          ))}
      </ul>
      {plan.future && (
        <p className="mt-3.5 border-t border-white/10 pt-3 text-[15px] leading-snug [@media(max-height:700px)]:mt-2.5 [@media(max-height:700px)]:pt-2">
          <span className="font-semibold">Ты через 7 дней:</span> <span className="font-hand text-[19px]">«{plan.future}»</span>
        </p>
      )}
    </div>
  )
}

function Commit({ label, ifThen, answers }: { label: string; ifThen: string | null; answers: string[] }) {
  const promises: { text: ReactNode }[] = [
    { text: 'Кот сидит рядом' },
    { text: 'Плохо — можно' },
    { text: `Остановиться через ${FIRST_MINUTES} минуты — можно` },
  ]
  return (
    <div className="flex flex-col items-center">
      {/* карточка поднимается снизу, когда кот почти долетел до центра (Duolingo: сначала сова встаёт на место,
          потом итог) — их пути не пересекаются */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
        className="glass-hearthside commit-card w-full rounded-3xl px-5 pb-5 pt-4 text-center"
      >
        <div>
        {/* твои ответы — на виду: договор собран под тебя (Duolingo «Here's what you can achieve») */}
        {answers.length > 0 && (
          <div className="mb-3 flex flex-wrap justify-center gap-1.5">
            {answers.map((a) => (
              <span key={a} className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[13px] font-semibold text-foreground/85">
                {a}
              </span>
            ))}
          </div>
        )}
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          следующие {FIRST_MINUTES} минуты я делаю только одно
        </p>
        <p className="mt-2 line-clamp-3 break-words text-balance text-[clamp(24px,4.4dvh,32px)] font-bold leading-[1.1] tracking-tight">
          {label}
        </p>
        {ifThen && <p className="mt-3 font-hand text-[19px] leading-snug text-secondary-foreground">{ifThen}</p>}
        <ul className="mt-4 flex flex-col gap-2 text-left [@media(max-height:700px)]:hidden">
          {promises.map((p, i) => (
            // светлее muted: под карточкой ночной горизонт лендинга светлее фона приложения (на 1280×720 было 4,1:1)
            <li key={i} className="flex items-center gap-2.5 text-[15px] text-foreground/80">
              <Check className="size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
              {p.text}
            </li>
          ))}
        </ul>
        </div>
      </motion.div>
    </div>
  )
}
