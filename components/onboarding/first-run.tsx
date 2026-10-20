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
import { MascotSvg, type MascotExpression } from '@/components/mascot-svg'
import { EmphasisText } from '@/components/emphasis-text'
import { HoldToStart } from '@/components/onboarding/hold-to-start'
import { getPatterns } from '@/lib/memory'
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
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING)
  const [ready, setReady] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [custom, setCustom] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
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
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [router])

  // Нижний таб-бар прячем: онбординг — один путь, без боковых выходов
  // (тот же механизм, что у иммерсивной сессии).
  useEffect(() => {
    document.body.dataset.focusImmersive = 'true'
    return () => {
      delete document.body.dataset.focusImmersive
    }
  }, [])

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
  const steps = state.sphere ? STEPS[state.sphere] : STEPS.unsure
  const chosenStep = customOpen ? custom.trim() : state.firstStep
  const blocker = BLOCKERS.find((b) => b.key === state.blocker)

  // Можно ли идти дальше с текущего экрана
  const canContinue =
    (step === 1 && !!state.sphere) ||
    (step === 2 && !!state.blocker) ||
    (step === 3 && !!chosenStep)

  function next() {
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
    update({ step: LAST_STEP, firstStep: label })
    const params = new URLSearchParams({
      step: label,
      d: String(FIRST_MINUTES),
      auto: '1',
    })
    router.push(`/app/session?${params.toString()}`)
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

  if (!ready) return <div className="h-dvh" aria-busy="true" />

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 28 * dirRef.current },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 * dirRef.current },
      }

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={step}
          {...slide}
          transition={{ duration: reduceMotion ? 0.15 : 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]"
        >
          {(step === 1 || step === 2 || step === 3) && (
            <>
              <CatAsks line={line} face={face} nudge={nudge} />
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
        </motion.section>
      </AnimatePresence>

      {/* Главное действие — всегда в одной точке у большого пальца */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))]">
        {step === LAST_STEP ? (
          <HoldToStart onComplete={begin} busy={leaving} />
        ) : (
          <button
            type="button"
            onClick={next}
            onTouchStart={() => {}}
            data-idle={canContinue ? undefined : ''}
            className="btn-chunky block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[15px] font-bold uppercase tracking-[0.06em] text-primary-foreground">
              Продолжить
            </span>
          </button>
        )}
      </div>
    </main>
  )
}

/**
 * Кот слева, вопрос в пузыре справа (раскладка Duolingo). layoutId общий с
 * приветствием — кот не исчезает, а переезжает: одно существо, один разговор.
 */
function CatAsks({ line, face, nudge }: { line: string; face: MascotExpression; nudge: boolean }) {
  return (
    <div className="flex items-end gap-3 pt-2">
      <motion.div
        layoutId="onb-cat"
        className="shrink-0"
        animate={nudge ? { rotate: [0, -6, 5, -3, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5 }}
      >
        <MascotSvg expression={face} size={104} label="Напарник" />
      </motion.div>
      <motion.div
        layoutId="onb-bubble"
        className="glass-hearthside relative mb-3 min-h-[3.5rem] flex-1 rounded-2xl rounded-bl-sm px-4 py-3"
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <motion.div layoutId="onb-cat">
        <MascotSvg expression="calm" size={148} label="Напарник готов" />
      </motion.div>
      <motion.div
        layoutId="onb-bubble"
        className="glass-hearthside w-full rounded-3xl px-5 pb-5 pt-4 text-center"
      >
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
            <li key={i} className="flex items-center gap-2.5 text-[15px] text-muted-foreground">
              <Check className="size-4 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
              {p.text}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  )
}
