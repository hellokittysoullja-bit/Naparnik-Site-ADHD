'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useReducedMotion } from 'motion/react'
import { celebrateCat, nextBreakCount, playLogReveal, preloadReveal, wordCount } from '@/components/break-reveal/log-reveal'
import { NoteDeco, WaitLog, WoodWords } from '@/components/break-reveal/note-parts'
import { hapticReaction, hapticReward } from '@/lib/haptics'

/** Сколько шагов видно под запиской в знакомстве: остальные ждут в «Делах» */
const MAX_ROWS = 5

/**
 * Знакомство, «Работа / проекты» + «Не знаю, с чего начать» (владелец 20.11): своё дело разламывается тем же «Поленом»,
 * что в Фокусе. Пока шагов нет, полено ждёт удара; пришли шаги — кот бьёт лапой, полено колется, куски садятся
 * табличками в записку «Твой 1 шаг:» и в строки под ней. Кот и пузырь — те же, что у вопросов знакомства (не двигаются).
 */
export function OnbBreak({ task, steps, done = false, onDone }: { task: string; steps: string[] | null; /** уже разломано (вернулись на экран): итог сразу, без сцены */ done?: boolean; onDone: () => void }) {
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLParagraphElement>(null)
  const [split, setSplit] = useState(done)
  const [playing, setPlaying] = useState(false)
  const played = useRef(done)
  const doneRef = useRef(onDone)
  useLayoutEffect(() => {
    doneRef.current = onDone
  })
  useLayoutEffect(() => preloadReveal(), [])

  useLayoutEffect(() => {
    if (!steps?.length || played.current) return
    played.current = true
    const catWrap = document.querySelector<HTMLElement>('[data-onb-cat]')
    const cat = (catWrap?.firstElementChild as HTMLElement | null) ?? catWrap
    const bubble = document.querySelector<HTMLElement>('[data-onb-bubble]')
    const slot = slotRef.current
    const source = sourceRef.current
    if (reduce || !cat || !bubble || !slot || !source) {
      setSplit(true)
      doneRef.current()
      return
    }
    let alive = true
    let scene: ReturnType<typeof playLogReveal> | null = null
    const onDown = () => scene?.skip()
    const play = () => {
      if (!alive) return
      setPlaying(true)
      scene = playLogReveal({ cat, catBody: cat, bubble, slot, source, fromWait: true }, nextBreakCount(), {
        pieces: wordCount(steps.slice(0, MAX_ROWS + 1)),
        onImpact: hapticReaction,
        split: () => {
          flushSync(() => setSplit(true))
          const root = rootRef.current
          if (!root) return null
          return {
            card: root.querySelector<HTMLElement>('[data-rv-card]'),
            texts: [...root.querySelectorAll<HTMLElement>('[data-rv-step]')],
            bullets: [...root.querySelectorAll<HTMLElement>('[data-rv-bullet]')],
            list: root.querySelector<HTMLElement>('[data-rv-list]'),
            stamp0: null,
            labelRow: null,
          }
        },
      })
      document.addEventListener('pointerdown', onDown, true)
      const s = scene
      void s.finished.then(() => {
        document.removeEventListener('pointerdown', onDown, true)
        if (!alive) return
        flushSync(() => setPlaying(false))
        s.stop()
        hapticReward()
        celebrateCat(cat, [bubble])
        doneRef.current()
      })
    }
    // шрифт табличек — до раскола: иначе слова меряются в запасном шрифте и куски садятся мимо (как в Фокусе)
    const fam = getComputedStyle(source).fontFamily
    const fonts = document.fonts?.load
      ? Promise.race([
          Promise.all([document.fonts.load(`700 18px ${fam}`, steps[0]), document.fonts.load(`600 14px ${fam}`, steps.join(' '))]),
          new Promise((r) => setTimeout(r, 1500)),
        ])
      : Promise.resolve()
    void fonts.then(play, play)
    return () => {
      alive = false
      document.removeEventListener('pointerdown', onDown, true)
      scene?.stop()
    }
  }, [steps, reduce])

  const rows = steps ? steps.slice(1, MAX_ROWS + 1) : []
  return (
    <div ref={rootRef} data-rv={playing ? 'playing' : undefined} className="mt-5 flex flex-col gap-3 [@media(max-height:700px)]:mt-3">
      {!split && (
        <div ref={slotRef} data-rv-slot className="relative mt-3 h-[4.25rem] w-full shrink-0">
          {/* дело словами человека: шрифт резьбы и текст полена; на экране не видно */}
          <p ref={sourceRef} data-rv-source aria-hidden="true" className="pointer-events-none invisible absolute inset-x-4 top-3.5 text-pretty text-[1.15rem] font-bold leading-snug">
            {task}
          </p>
          <WaitLog text={task} />
        </div>
      )}
      {split && steps && (
        <>
          {/* поля вокруг записки: печать «×N» и петельки выходят за её край и не должны обрезаться краем экрана */}
          <div data-rv-card className="note-card relative mx-2.5 mt-2 flex flex-col pb-[3.25rem] pl-4 pr-16 pt-3.5 [@media(max-width:380px)]:pl-3">
            {/* лапки и звёздочки — та же группа, что в Фокусе, опущена под шаг (владелец 20.11) */}
            <NoteDeco steps={steps.length} follow />
            {/* подпись над шагом (владелец 20.11): чёрным жирным */}
            <p className="text-[18px] font-extrabold leading-6 text-[#1d140d]">Твой первый шаг:</p>
            <p data-rv-step className="mt-1.5 text-pretty text-[1.15rem] font-bold leading-[1.8rem]">
              <WoodWords text={steps[0]} />
            </p>
          </div>
          {rows.length > 0 && (
            <div data-rv-list className="flex flex-col gap-1 px-1">
              {rows.map((st) => (
                <div key={st} className="flex items-center gap-2 px-3 py-[5px] text-[13.5px] text-muted-foreground">
                  <span data-rv-bullet aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span data-rv-step className="block font-semibold leading-[22px]">
                    <WoodWords text={st} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
