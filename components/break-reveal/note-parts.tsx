'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { catShade, drawLog } from '@/components/break-reveal/log-reveal'

/* Части «Полена», общие для Фокуса и знакомства: полено ожидания, слова-таблички, убранство записки */

/** Полено, которое ждёт удара, пока кот разламывает дело на сервере: та же картинка, что у сцены «Полено»
 *  (components/break-reveal/log-reveal.ts), под котом — во всё место полена */
export function WaitLog({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    // место и шрифт берём из разметки, а не из ref родителя: эффект ребёнка идёт раньше, чем React привяжет ref родителя
    const slot = el?.parentElement
    if (!el || !slot) return
    const draw = () => {
      const r = slot.getBoundingClientRect()
      if (!r.width) return
      Object.assign(el.style, { width: `${r.width}px`, height: `${r.height}px`, top: '0' })
      const font = slot.querySelector('[data-rv-source]')
      // кот сидит над поленом (элемент перед местом полена): его тень падает на кору
      const cat = slot.previousElementSibling
      drawLog(el, r.width, r.height, text, font ? getComputedStyle(font).font : '700 18px sans-serif', 7, cat ? catShade(cat.getBoundingClientRect(), r) : undefined)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(slot)
    return () => ro.disconnect()
  }, [text])
  return <div ref={ref} data-rv-waitlog aria-hidden="true" className="rv-wait pointer-events-none absolute left-0" />
}

/** Шаг дела — слова на деревянных табличках: в них превращаются куски полена, и таблички остаются (владелец 17.11).
 *  Пробелы между табличками — обычные: текст читается и копируется как раньше */
export function WoodWords({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).filter(Boolean).map((p, i) => (/^\s+$/.test(p) ? ' ' : <span key={i} className="wood-word">{p}</span>))}
    </>
  )
}

/** Убранство карточки-записки: петельки на трёх углах (четвёртый держит печать), печать-звезда «×N», лапки кота,
 *  мерцающие звёздочки. Только украшение — для диктора его нет */
export function NoteDeco({ steps, follow = false, room }: { steps: number; /** с follow: на сколько px группа может опуститься; ниже — прячется (Фокус: под ней кнопки, при шаге в две строки места нет) */ room?: number; /** левые лапки и звёздочки идут за шагом: та же группа и те же расстояния, только ниже на столько, на сколько шаг ниже, чем в Фокусе (знакомство: над шагом подпись) */ follow?: boolean }) {
  // заголовок в две строки (узкий телефон, длинный шаг) занимает место левых лапок — тогда они и звёздочки под строкой
  // прячутся, иначе их кусочки торчат из-под табличек. На большом телефоне заголовок в одну строку — всё на месте
  const ref = useRef<HTMLSpanElement>(null)
  const [wrap, setWrap] = useState(false)
  const [drop, setDrop] = useState(0)
  useLayoutEffect(() => {
    const card = ref.current?.parentElement
    const title = card?.querySelector<HTMLElement>('[data-rv-step]')
    if (!title || !card) return
    // низ шага в Фокусе — 43 px от верха записки (одна строка); группа лапок стоит от него на тех же расстояниях
    const check = () => {
      if (follow) {
        const t = title.getBoundingClientRect()
        setDrop(Math.max(0, Math.round(t.bottom - card.getBoundingClientRect().top - 43)))
      } else setWrap(title.getBoundingClientRect().height > 40)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(title)
    return () => ro.disconnect()
  })
  // правая группа (две лапки и звёздочка) — под табличками, если её не опустить вместе с шагом; опускаем, только когда есть кнопки (room)
  const shift = room !== undefined ? Math.min(drop, room) : 0
  const under = wrap || (room !== undefined && drop > room) ? ' hidden' : ''
  const loop = (
    <svg viewBox="0 0 26 26" className="size-full overflow-visible">
      <path d="M5 5 C12 7 20 13 20 18 C20 22.5 15 23.5 12.5 20.5 C10 17.5 9.5 11 5 5 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="4.6" fill="currentColor" />
    </svg>
  )
  return (
    <span ref={ref} aria-hidden="true" data-wrap={wrap ? '' : undefined} className="pointer-events-none absolute inset-0">
      <span className="note-loop -left-[7px] -top-[7px]">{loop}</span>
      <span className="note-loop -bottom-[7px] -left-[7px] -scale-y-100">{loop}</span>
      <span className="note-loop -bottom-[7px] -right-[7px] -scale-100">{loop}</span>
      <span className="note-seal -right-[18px] -top-[20px]">
        <span className="note-seal-star" />
        <span className="relative">×{steps}</span>
      </span>
      <span style={{ top: 46 + shift }} className="note-paw right-[14px] rotate-[14deg]" />
      <span style={{ top: 58 + shift }} className="note-paw right-[40px] rotate-[4deg] scale-75 opacity-80" />
      {/* следы кота слева — как в макете варианта 4, который выбрал владелец, и маленькая звёздочка под левой лапкой */}
      <span style={{ top: 50 + drop }} className={`note-paw left-[14px] rotate-[80deg] scale-[.7] opacity-90${under}`} />
      <span style={{ top: 58 + drop }} className={`note-paw left-[44px] rotate-[80deg] scale-[.7] opacity-90${under}`} />
      <span style={{ top: 50 + drop }} className={`note-paw left-[74px] rotate-[80deg] scale-[.7] opacity-90${under}`} />
      <span style={{ top: 70 + drop }} className={`note-star left-[20px] size-[8px] [animation-delay:.3s]${under}`} />
      <span style={{ top: 62 + drop }} className={`note-star left-[46%] size-[10px] [animation-delay:.6s]${under}`} />
      <span style={{ top: 48 + shift }} className="note-star right-[70px] size-[9px] [animation-delay:1.1s]" />
    </span>
  )
}

