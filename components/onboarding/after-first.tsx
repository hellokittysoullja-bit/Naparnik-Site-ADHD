'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Coffee, Frown, Mail, Meh, Moon, Send, Smile, Utensils, Zap, type LucideIcon } from 'lucide-react'
import { CatAsks, OPTION_HUES, Option } from '@/components/onboarding/first-run'
import { downloadIcs } from '@/lib/calendar'
import { withAttribution } from '@/lib/visitor'
import { hapticThreshold } from '@/lib/haptics'
import type { MascotAction, MascotExpression } from '@/components/mascot-doll'

/**
 * После первой 2-минутной сессии из знакомства (документ владельца 10.11, экраны 12–14): «Как было?» → «Сохранить
 * остров» → «Когда завтра?» + вопрос-прогноз. Дальше — Дом.
 *
 * Честно по возможностям: бота и хранилища пока нет, поэтому «сохранить» не изображает сохранение, а напоминание —
 * настоящий файл календаря на завтра (единственное, что мы можем дать на устройстве). Экраны 15–18 документа
 * (аудит обвинений, пейвол, «второй шанс», после покупки) не здесь: у продукта нет приёма оплаты.
 */

const PLAN_KEY = 'naparnik:ifThen'
const BOT = process.env.NEXT_PUBLIC_TG_BOT?.trim() || ''

type Feel = 'easy' | 'ok' | 'hard' | 'fail'
const FEELS: { key: Feel; label: string; echo: string; icon: LucideIcon; face: MascotExpression; action: MascotAction }[] = [
  { key: 'easy', label: 'Легче, чем думал(а)', echo: 'Вот. Страшнее всего было до, а не во время. Запомним это.', icon: Zap, face: 'excited', action: 'celebrate' },
  { key: 'ok', label: 'Нормально', echo: 'Нормально — это отлично для первого раза.', icon: Smile, face: 'happy', action: 'wave' },
  { key: 'hard', label: 'Тяжело, но сделал(а)', echo: 'Тяжело и всё равно сделал(а). Вот это и есть характер.', icon: Meh, face: 'happy', action: 'idle' },
  { key: 'fail', label: 'Не получилось', echo: 'Ты сел(а) рядом и попробовал(а). Это тоже шаг. Завтра — шаг ещё меньше.', icon: Frown, face: 'listening', action: 'idle' },
]

type When = { key: 'morning' | 'lunch' | 'evening' | 'exact'; label: string; icon: LucideIcon; word: string; time: string }
const WHENS: When[] = [
  { key: 'morning', label: 'Утром с первым чаем или кофе', icon: Coffee, word: 'утром', time: '09:00' },
  { key: 'lunch', label: 'После обеда', icon: Utensils, word: 'после обеда', time: '13:00' },
  { key: 'evening', label: 'Вечером, пока не началось «потом»', icon: Moon, word: 'вечером', time: '19:00' },
  { key: 'exact', label: 'Точное время', icon: Clock, word: '', time: '' },
]

type Stage = 'how' | 'save' | 'when' | 'predict'

export function AfterFirst() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('how')
  const [feel, setFeel] = useState<Feel | null>(null)
  const [saveChoice, setSaveChoice] = useState<'tg' | 'mail' | null>(null)
  const [when, setWhen] = useState<When | null>(null)
  const [exact, setExact] = useState('')
  const [promise, setPromise] = useState<'yes' | 'try' | null>(null)
  const [nudge, setNudge] = useState(false)
  const [react, setReact] = useState<{ face: MascotExpression; action: MascotAction } | null>(null)

  const f = FEELS.find((x) => x.key === feel)
  const timeLabel = when ? (when.key === 'exact' ? (exact ? `в ${exact}` : '') : when.word) : ''
  const clock = when ? (when.key === 'exact' ? exact : when.time) : ''

  function savePlan() {
    if (!when || !clock) return
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify({ when: timeLabel, time: clock, at: Date.now() }))
    } catch {
      /* план просто не запомнится */
    }
  }

  let line = ''
  let face: MascotExpression = 'happy'
  let action: MascotAction | undefined
  if (stage === 'how') {
    line = nudge
      ? 'Выбери то, что ближе — *правильного ответа нет*.'
      : f
        ? f.echo
        : 'Ты начал(а). Это самое трудное — и это уже позади. Как было?'
    face = f ? f.face : 'happy'
    action = f ? f.action : 'celebrate'
  } else if (stage === 'save') {
    line =
      saveChoice === 'tg'
        ? BOT
          ? 'Откроется Telegram — сохраним остров там.'
          : 'Сохранение в Telegram скоро появится. Пока остров хранится на этом устройстве.'
        : saveChoice === 'mail'
          ? 'Сохранение на почту скоро появится. Пока остров хранится на этом устройстве.'
          : 'Остров уже твой. Давай сохраню его, чтобы он не потерялся.'
    face = 'happy'
  } else if (stage === 'when') {
    line = nudge ? 'Выбери любое время — *потом можно поменять*.' : 'Когда завтра посидим 2 минуты?'
    face = 'listening'
  } else {
    line = promise === 'try'
      ? 'Попробовать — уже план.'
      : promise === 'yes'
        ? 'Договорились. Жду тебя завтра.'
        : `Получится завтра ${timeLabel}?`
    face = promise ? 'happy' : 'listening'
  }

  function pulse(face: MascotExpression, action: MascotAction) {
    setReact({ face, action })
    window.setTimeout(() => setReact(null), 850)
  }

  function next() {
    if (stage === 'how') {
      if (!feel) return setNudge(true)
      setNudge(false)
      return setStage('save')
    }
    if (stage === 'save') {
      if (saveChoice === 'tg' && BOT) window.open(`https://t.me/${BOT}?start=island`, '_blank', 'noopener')
      return setStage('when')
    }
    if (stage === 'when') {
      if (!when || !clock) return setNudge(true)
      setNudge(false)
      return setStage('predict')
    }
    // predict → дом
    if (!promise) return setNudge(true)
    savePlan()
    router.push(withAttribution('/app', window.location.search))
  }

  const cta =
    stage === 'save' ? (saveChoice ? 'Дальше' : 'Позже') : stage === 'predict' ? 'В мой дом' : 'Продолжить'
  const idle =
    (stage === 'how' && !feel) || (stage === 'when' && (!when || !clock)) || (stage === 'predict' && !promise)

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="sr-only">Первые две минуты позади</h1>
      <section className="flex min-h-0 flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6">
        <CatAsks
          line={line}
          face={react ? react.face : face}
          action={react ? react.action : action}
          nudge={nudge}
          hop={false}
          step={stage === 'how' ? 1 : stage === 'save' ? 2 : stage === 'when' ? 3 : 4}
          commit={false}
        />
        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-2" role="radiogroup" aria-label={stage}>
          {stage === 'how' &&
            FEELS.map((x, i) => (
              <Option
                key={x.key}
                icon={x.icon}
                hue={OPTION_HUES[i % OPTION_HUES.length]}
                label={x.label}
                selected={feel === x.key}
                onSelect={() => {
                  if (feel !== x.key) {
                    hapticThreshold()
                    pulse(x.face, x.action)
                  }
                  setNudge(false)
                  setFeel(x.key)
                }}
              />
            ))}
          {stage === 'how' && f && (
            <p className="px-1 font-hand text-[21px] leading-snug text-secondary-foreground">Ты — человек, который начинает.</p>
          )}
          {stage === 'save' && (
            <>
              <Option
                icon={Send}
                hue={OPTION_HUES[1]}
                label="Сохранить через Telegram"
                selected={saveChoice === 'tg'}
                onSelect={() => {
                  hapticThreshold()
                  setSaveChoice('tg')
                }}
              />
              <Option
                icon={Mail}
                hue={OPTION_HUES[2]}
                label="Через email"
                selected={saveChoice === 'mail'}
                onSelect={() => {
                  hapticThreshold()
                  setSaveChoice('mail')
                }}
              />
            </>
          )}
          {stage === 'when' && (
            <>
              {WHENS.map((x, i) => (
                <Option
                  key={x.key}
                  icon={x.icon}
                  hue={OPTION_HUES[i % OPTION_HUES.length]}
                  label={x.label}
                  selected={when?.key === x.key}
                  onSelect={() => {
                    if (when?.key !== x.key) hapticThreshold()
                    setNudge(false)
                    setWhen(x)
                  }}
                />
              ))}
              {when?.key === 'exact' && (
                <input
                  type="time"
                  aria-label="Точное время"
                  value={exact}
                  autoFocus
                  onChange={(e) => {
                    setExact(e.target.value)
                    setNudge(false)
                  }}
                  className="h-14 rounded-2xl border-2 border-primary bg-primary/10 px-4 text-base outline-none"
                />
              )}
            </>
          )}
          {stage === 'predict' && (
            <>
              <Option
                icon={Smile}
                hue={OPTION_HUES[3]}
                label="Да, сделаю"
                selected={promise === 'yes'}
                onSelect={() => {
                  hapticThreshold()
                  setNudge(false)
                  setPromise('yes')
                  pulse('excited', 'celebrate')
                }}
              />
              <Option
                icon={Meh}
                hue={OPTION_HUES[4]}
                label="Попробую"
                selected={promise === 'try'}
                onSelect={() => {
                  hapticThreshold()
                  setNudge(false)
                  setPromise('try')
                  pulse('happy', 'wave')
                }}
              />
              {promise && (
                // единственное настоящее напоминание на устройстве — файл календаря (бота пока нет)
                <button
                  type="button"
                  onClick={() => downloadIcs(timeLabel, clock)}
                  className="press mt-1 flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-4 text-[16px] font-semibold"
                >
                  Добавить в календарь
                </button>
              )}
            </>
          )}
        </div>
      </section>
      <div className="thumb-cta fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[max(1.125rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={next}
          data-idle={idle ? '' : undefined}
          className="btn-chunky btn-wake block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
            {cta}
          </span>
        </button>
      </div>
    </main>
  )
}
