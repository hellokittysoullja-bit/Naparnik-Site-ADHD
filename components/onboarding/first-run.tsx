'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  BatteryLow,
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  Compass,
  Feather,
  Hourglass,
  House,
  MessageCircle,
  PenLine,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { MascotDoll as MascotSvg } from '@/components/mascot-doll';
import { type MascotExpression } from '@/components/mascot-doll'
import { EmphasisText } from '@/components/emphasis-text'
import { HoldToStart } from '@/components/onboarding/hold-to-start'
import { NightScene } from '@/components/landing/night-scene'
import { navigateWithTransition } from '@/lib/view-transition'
import { getPatterns, peekStarts } from '@/lib/memory'
import { useClientMount } from '@/hooks/use-client-mount'
import { hapticThreshold } from '@/lib/haptics'
import {
  BLOCKERS,
  EMPTY_ONBOARDING,
  FIRST_MINUTES,
  SPHERES,
  STEPS,
  readOnboarding,
  writeOnboarding,
  type Blocker,
  type OnboardingState,
  type Sphere,
} from '@/lib/onboarding'

/**
 * Первый вход в стиле Duolingo: кот здоровается → два вопроса чипами →
 * первый шаг → «удерживай, чтобы начать» → сразу 2-минутная сессия.
 *
 * Откуда каждое решение (knowledge/playbook в youtube_researcher):
 * - онбординг = первое реальное действие, не слайды-тур (90% их пропускают);
 * - один вопрос на экран, прогресс сверху виден с первого вопроса (Particle);
 * - каждый ответ меняет следующий экран (Appelune), кот сразу реагирует
 *   на выбор — контингентная обратная связь, а не молчаливая форма;
 * - «Пока не знаю» — честный вариант ответа, а не стыдный пропуск (DAD-тест);
 * - главная кнопка всегда в одном месте у большого пальца, как на лендинге;
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

const BLOCKER_ICON: Record<Blocker, LucideIcon> = {
  where: Compass,
  boring: Hourglass,
  fear: Feather,
  tired: BatteryLow,
}

const SPHERE_REACTION: Record<Sphere, string> = {
  study: 'Учёба. Понял — начнём *с малого*.',
  work: 'Работа. Ок, без героизма — *один кусочек*.',
  home: 'Дом. Отлично: тут шаг *виден сразу*.',
  message: 'Сообщение или звонок. Самое *липкое* — разберём.',
  unsure: 'Нормально. Начнём с того, что *под рукой*.',
}

/** Вопросы и шаг выбора — 4 точки прогресса; приветствие вне шкалы */
const LAST_STEP = 4

export function FirstRun() {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  // Переход внутри сайта (встроенный скрипт страницы тут не срабатывает): у кого уже есть старты, первый вопрос
  // не рисуем даже на кадр — эффект ниже сразу уводит домой
  const clientMount = useClientMount()
  const [returning] = useState(() => clientMount && peekStarts().length > 0)
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING)
  const [nudge, setNudge] = useState(false)
  const [custom, setCustom] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  // Кот отзывается на каждое «Продолжить» (Duolingo: сова жмурится и искрит на каждый шаг)
  const [hop, setHop] = useState(false)
  const hopTimer = useRef(0)

  // Направление перехода: вперёд экран уезжает влево, назад — вправо
  const dirRef = useRef(1)

  // Уже есть старты — онбординг не нужен: человек вернулся, ведём домой.
  useEffect(() => {
    let alive = true
    void getPatterns().then((p) => {
      if (!alive) return
      if (p.totalStarts > 0) {
        router.replace('/app')
        return
      }
      setState(readOnboarding())
    })
    return () => {
      alive = false
    }
  }, [router])

  // Нижнего меню на знакомстве нет: AppNav не рисует его на /app/start (components/app-nav.tsx).

  function update(patch: Partial<OnboardingState>) {
    setState((s) => {
      const next = { ...s, ...patch }
      writeOnboarding(next)
      return next
    })
  }

  function go(step: number) {
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
  const steps = state.sphere ? STEPS[state.sphere] : STEPS.unsure
  const chosenStep = customOpen ? custom.trim() : state.firstStep
  const blocker = BLOCKERS.find((b) => b.key === state.blocker)

  // Можно ли идти дальше с текущего экрана
  const canContinue =
    (step === 1 && !!state.sphere) ||
    (step === 2 && !!state.blocker) ||
    (step === 3 && !!chosenStep)

  // двойной клик по «Продолжить» пролетал через шаг: на 3-м шаге выбор уже предзаполнен, и второй клик сразу
  // уводил на удержание — вопрос «с чего начнём» человек так и не видел. Пока слайд въезжает, клики не считаются.
  const lastGoRef = useRef(0)
  function next() {
    if (performance.now() - lastGoRef.current < 400) return
    if (!canContinue) {
      // Не немая кнопка: кот мягко подсказывает, что сделать
      setNudge(true)
      return
    }
    if (step === 1 && state.sphere && !state.firstStep) {
      update({ firstStep: STEPS[state.sphere][0] })
    }
    if (step === 3 && customOpen && custom.trim()) {
      update({ firstStep: custom.trim() })
    }
    lastGoRef.current = performance.now()
    setHop(true)
    window.clearTimeout(hopTimer.current)
    hopTimer.current = window.setTimeout(() => setHop(false), 900)
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
    const label = chosenStep || steps[0]
    setLeaving(true)
    // меню прячем ещё до перехода: страница Фокуса монтируется не в том же кадре, что новый адрес, и меню успевало
    // мелькнуть между знакомством и стартом. Дальше флагом владеет сессия; на других экранах его снимает AppNav.
    document.body.dataset.focusImmersive = 'true'
    update({ step: LAST_STEP, firstStep: label })
    const params = new URLSearchParams({
      step: label,
      d: String(FIRST_MINUTES),
      auto: '1',
    })
    // Пропуск автостарта: auto=1 срабатывает, только если его выдала эта кнопка. Иначе чужая ссылка
    // /app/session?step=…&auto=1 сама запускала сессию и записывала свой текст в старты — а старты уходят
    // в промпт напарника при каждом разговоре (components/focus-session.tsx, AUTO_START_KEY).
    try {
      window.sessionStorage.setItem("naparnik:autoStart", label);
    } catch {
      /* хранилище недоступно — человек нажмёт «старт» сам */
    }
    // кот из карточки договора перелетает в центр старта (lib/view-transition.ts)
    navigateWithTransition(() => router.push(`/app/session?${params.toString()}`), 'session')
  }

  // Что говорит кот и с каким лицом — реакция на выбор, а не статичный текст
  let line = ''
  let face: MascotExpression = 'calm'
  if (step === 1) {
    line = nudge
      ? 'Выбери любой вариант — *ошибиться нельзя*.'
      : state.sphere
        ? SPHERE_REACTION[state.sphere]
        : 'Что сейчас *висит* больше всего?'
    face = state.sphere ? 'happy' : nudge ? 'listening' : 'calm'
  } else if (step === 2) {
    line = nudge
      ? 'Любой ответ подойдёт — *я подстроюсь*.'
      : blocker
        ? blocker.reaction
        : 'А что обычно *мешает начать*?'
    face = blocker ? 'happy' : 'listening'
  } else if (step === 3) {
    line = nudge
      ? 'Напиши хоть одно слово — *этого хватит*.'
      : `Первый шаг на *${FIRST_MINUTES} минуты*. Выбери или напиши свой.`
    face = 'calm'
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
    <main data-vt-arrived="onb" className="vt-onb relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="sr-only">Знакомство с Напарником</h1>
      {/* Где я: назад + прогресс. На приветствии шкалы нет — вопросов ещё не было */}
      <div className="flex h-12 shrink-0 items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => (step === 1 ? router.push('/') : go(step - 1))}
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

      <section className="flex min-h-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Кот — один на всё знакомство (одна кукла, не пересоздаётся): на вопросах слева от пузыря, на договоре
          переезжает в центр и растёт. Уходящие ответы закреплены внутри этого же блока — не прыгают, когда
          меняется шапка */}
      <div className={`relative flex min-h-0 flex-1 flex-col ${step === LAST_STEP ? 'justify-center' : ''}`}>
      {step >= 1 && step <= LAST_STEP && (
        <CatAsks line={line} face={step === LAST_STEP ? 'calm' : hop ? 'happy' : face} nudge={nudge} hop={hop} step={step} commit={step === LAST_STEP} />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={step}
          {...(step === LAST_STEP ? commitMotion : listMotion)}
          className={step === LAST_STEP ? 'flex flex-col' : 'flex min-h-0 flex-1 flex-col'}
        >
          {(step === 1 || step === 2 || step === 3) && (
            <>
              <div
                className="mt-5 flex flex-col gap-2.5 overflow-y-auto pb-2"
                role="radiogroup"
                aria-label={step === 1 ? 'Что висит' : step === 2 ? 'Что мешает начать' : 'Первый шаг'}
                onKeyDown={onRadioKeys}
              >
                {step === 1 &&
                  SPHERES.map((s, i) => (
                    <Option
                      key={s.key}
                      firstTab={i === 0 && !state.sphere}
                      icon={SPHERE_ICON[s.key]}
                      label={s.label}
                      selected={state.sphere === s.key}
                      onSelect={() => {
                        if (state.sphere !== s.key) hapticThreshold()
                        setNudge(false)
                        // Новая сфера — новые шаги: старый выбор шага сбрасываем
                        update({ sphere: s.key, firstStep: STEPS[s.key][0] })
                      }}
                    />
                  ))}
                {step === 2 &&
                  BLOCKERS.map((b, i) => (
                    <Option
                      key={b.key}
                      firstTab={i === 0 && !state.blocker}
                      icon={BLOCKER_ICON[b.key]}
                      label={b.label}
                      selected={state.blocker === b.key}
                      onSelect={() => {
                        if (state.blocker !== b.key) hapticThreshold()
                        setNudge(false)
                        update({ blocker: b.key })
                      }}
                    />
                  ))}
                {step === 3 && (
                  <>
                    {steps.map((s, i) => (
                      <Option
                        key={s}
                        firstTab={i === 0 && customOpen === false && !state.firstStep}
                        icon={Sparkles}
                        label={s}
                        selected={!customOpen && state.firstStep === s}
                        onSelect={() => {
                          if (customOpen || state.firstStep !== s) hapticThreshold()
                          setNudge(false)
                          setCustomOpen(false)
                          update({ firstStep: s })
                        }}
                      />
                    ))}
                    {customOpen ? (
                      <input
                        autoFocus
                        value={custom}
                        onChange={(e) => {
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
                  </>
                )}
              </div>
            </>
          )}

          {step === LAST_STEP && (
            <Commit
              label={chosenStep || steps[0]}
              reason={blocker?.reaction ?? null}
            />
          )}
        </motion.div>
      </AnimatePresence>
      </div>
      </section>

      {/* Главное действие — всегда в одной точке у большого пальца */}
      <div className="vt-cta fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))]">
        {step === LAST_STEP ? (
          <HoldToStart onComplete={begin} busy={leaving} />
        ) : (
          <button
            type="button"
            onClick={next}
            onTouchStart={() => {}}
            data-idle={canContinue ? undefined : ''}
            className="btn-chunky btn-wake block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
              Продолжить
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
function CatAsks({
  line,
  face,
  nudge,
  hop,
  step,
  commit,
}: {
  line: string
  face: MascotExpression
  nudge: boolean
  hop: boolean
  step: number
  commit: boolean
}) {
  const reduce = useReducedMotion()
  const move = { layout: { duration: reduce ? 0 : 0.6, ease: [0.65, 0, 0.35, 1] as const } }
  return (
    <div className={commit ? 'flex flex-col items-center pb-4' : 'flex items-end gap-3 pt-2'}>
      <motion.div
        layout
        className="vt-cat relative z-10 shrink-0"
        animate={nudge ? { rotate: [0, -6, 5, -3, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5, ...move }}
      >
        <MascotSvg
          expression={face}
          action={hop ? 'wave' : 'idle'}
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
        className="relative mb-3 min-h-[3.5rem] flex-1"
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
          className="glass-hearthside min-h-[3.5rem] rounded-2xl rounded-bl-sm px-4 py-3"
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
function Option({
  icon: Icon,
  label,
  selected,
  onSelect,
  firstTab = false,
}: {
  icon: LucideIcon
  label: string
  selected: boolean
  onSelect: () => void
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
      className="option-card flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
    >
      <Icon
        className={`size-5 shrink-0 transition-colors ${selected ? 'text-primary' : 'text-muted-foreground'}`}
        aria-hidden="true"
      />
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
function Commit({ label, reason }: { label: string; reason: string | null }) {
  const promises: { text: ReactNode }[] = [
    { text: 'Я сижу рядом и молчу' },
    { text: 'Можно бросить в любой момент' },
    { text: 'Старт засчитается сразу' },
  ]
  return (
    <div className="flex flex-col items-center">
      {/* карточка поднимается снизу, когда кот почти долетел до центра (Duolingo: сначала сова встаёт на место,
          потом итог) — их пути не пересекаются */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
        className="glass-hearthside w-full rounded-3xl px-5 pb-5 pt-4 text-center"
      >
        <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          твои первые {FIRST_MINUTES} минуты
        </p>
        <p className="mt-2 line-clamp-3 break-words text-balance text-[clamp(24px,4.4dvh,32px)] font-bold leading-[1.1] tracking-tight">
          {label}
        </p>
        {reason && (
          <p className="mt-2 font-hand text-[19px] leading-snug text-secondary-foreground">
            <EmphasisText text={reason} />
          </p>
        )}
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
