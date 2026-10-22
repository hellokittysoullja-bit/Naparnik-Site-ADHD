'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { Check, Copy, Heart, PawPrint, Reply, Sparkle } from 'lucide-react'
import { SPRING_GESTURE, SPRING_SNAPPY } from '@/lib/motion'
import { hapticDone, hapticReaction, hapticThreshold } from '@/lib/haptics'
import { EmphasisText } from '@/components/emphasis-text'

/**
 * Материал одной реплики. Вынесен из companion-chat (900 строк) отдельным
 * компонентом, потому что здесь теперь живут четыре разных жеста, и внутри
 * .map() это была бы каша.
 *
 * #10 — ХВОСТИК настоящей SVG-формой вместо rounded-tl-sm. Скругление угла
 *       не делает «хвост»: у настоящего пузыря есть оттяжка к говорящему,
 *       которая переходит в тело плавной кривой. Рисуем SVG с тем же
 *       фоном/кромкой, что у пузыря, и позиционируем в угол.
 * #11 — РЕАКЦИИ долгим нажатием: раньше long-press умел только копировать —
 *       на реплику живого существа нельзя было ответить ничем, кроме текста.
 * #12 — SWIPE-TO-REPLY: горизонтальная протяжка цитирует реплику. Порог 44px,
 *       упругое сопротивление за ним.
 * #13 — ГЛУБИНА ПО СКРОЛЛУ задаётся снаружи пропом depth (0..1).
 */

export type Reaction = 'paw' | 'spark' | 'heart'

/*
 * Реакции — иконками, а не текстовыми глифами. Первая версия рисовала
 * '🐾' / '✦' / '❤', и на снимке из браузера средняя кнопка оказалась ПУСТОЙ:
 * '✦' (U+2726) нет ни в одном шрифте этого проекта, а эмодзи-лапка и '❤'
 * приходят из системного эмодзи-шрифта — три «иконки» жили в трёх разных
 * гарнитурах, с разным весом и базовой линией. Lucide даёт один вес, один
 * размер и один цвет, наследуемый от состояния кнопки.
 */
const REACTIONS: ReadonlyArray<{
  key: Reaction
  label: string
  Icon: typeof PawPrint
}> = [
  { key: 'paw', label: 'Лапка', Icon: PawPrint },
  { key: 'spark', label: 'Искра', Icon: Sparkle },
  { key: 'heart', label: 'Тепло', Icon: Heart },
]

/** Хвостик пузыря: оттяжка к говорящему, переходящая в тело кривой Безье.
    Экспортирован — приветственный пузырь в companion-chat.tsx рендерится
    отдельно от ChatBubble (он не часть messages[]) и раньше падал обратно на
    rounded-tl-sm, ровно то приближение, которое этот компонент был написан
    заменить (см. комментарий у #10 ниже). Один и тот же персонаж должен
    говорить одним и тем же материалом с первой же реплики, не только
    начиная со второй. */
export function BubbleTail({ side }: { side: 'left' | 'right' }) {
  const isLeft = side === 'left'
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 14"
      className={`absolute top-0 h-[14px] w-[10px] ${isLeft ? '-left-[7px]' : '-right-[7px] scale-x-[-1]'}`}
      style={{ overflow: 'visible' }}
    >
      {/* Тело хвоста повторяет заливку пузыря. Цвет берём из currentColor
          родителя через CSS-переменную, выставленную классами ниже: так
          хвост не расходится с пузырём при смене темы или материала. */}
      <path
        d="M10 0 C 10 5.5 6.5 10.5 0.6 13.2 C 5.2 11 8 6.4 8.4 0 Z"
        fill="var(--tail-fill)"
        stroke="var(--tail-stroke)"
        strokeWidth="0.7"
      />
    </svg>
  )
}

type ChatBubbleProps = {
  text: string
  isUser: boolean
  isFirstOfGroup: boolean
  /** 0 — свежая реплика у низа, 1 — уехала далеко вверх (#13) */
  depth: number
  reaction?: Reaction | null
  onReact: (r: Reaction | null) => void
  onReply: () => void
  reduceMotion: boolean
}

export function ChatBubble({
  text,
  isUser,
  isFirstOfGroup,
  depth,
  reaction,
  onReact,
  onReply,
  reduceMotion,
}: ChatBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const longPressTimer = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const x = useMotionValue(0)
  // Иконка ответа проявляется по мере протяжки — сам жест объясняет себя,
  // без подсказки-туториала.
  const replyOpacity = useTransform(x, isUser ? [-56, -18, 0] : [0, 18, 56], isUser ? [1, 0, 0] : [0, 0, 1])
  const replyScale = useTransform(x, isUser ? [-56, -20] : [20, 56], [1, 0.6])

  useEffect(() => {
    return () => {
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    }
  }, [])

  /*
   * Момент открытия меню. Нужен из-за реального бага, найденного удержанием
   * в браузере: меню появлялось на 450-й мс, пока палец ЕЩЁ ПРИЖАТ, и
   * подкладывало под себя оверлей-«клик вне». Отпускание того же самого
   * жеста прилетало в этот оверлей и закрывало меню мгновенно — выбрать
   * реакцию было физически невозможно ни мышью, ни пальцем.
   * Оверлей игнорирует всё, что прилетело в первые 300 мс своей жизни:
   * это хвост открывающего жеста, а не новый выбор пользователя.
   */
  const openedAt = useRef(0)

  function startLongPress() {
    longPressTimer.current = window.setTimeout(() => {
      if (draggingRef.current) return
      hapticReaction()
      openedAt.current = Date.now()
      setMenuOpen(true)
    }, 450)
  }
  /*
   * Отменяет только НЕ СРАБОТАВШЕЕ удержание. Раньше эта же функция висела
   * на onPointerLeave, и получался второй способ убить меню собственным
   * жестом: всплывшее меню перекрывает верх пузыря, курсор/палец оказывается
   * над ним → браузер шлёт pointerleave на пузырь → отмена. Мышью меню
   * умирало ровно в тот момент, когда его собирались использовать.
   * Теперь после открытия отменять уже нечего: таймер отработал.
   */
  function cancelLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
  }

  async function copyText() {
    try {
      await navigator.clipboard?.writeText(text)
      hapticDone()
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // буфер недоступен (не https/старый браузер) — молчим, как и вся
      // остальная опциональная периферия в этом проекте
    }
    setMenuOpen(false)
  }

  /*
   * #13 · Глубина. Ушедшее вверх отъезжает и теряет насыщенность — ровно то,
   * что делает воздушная перспектива в реальном мире. Держим мягко: масштаб
   * до 0.975 и прозрачность до 0.78. История остаётся фоном, но не становится
   * недоступной: переписка — память, а не декоративная глубина сцены.
   */
  const depthScale = reduceMotion ? 1 : 1 - depth * 0.025
  const depthOpacity = reduceMotion ? 1 : 1 - depth * 0.22
  const depthSaturate = reduceMotion ? 1 : 1 - depth * 0.25

  /*
   * Типографика: раньше вся речь напарника шла шрифтом Caveat целиком —
   * читаемо на одной фразе, утомительно на сотнях сообщений. Теперь оба
   * борта набраны ОДНИМ размером/интерлиньяжем (0.95rem/leading-relaxed) —
   * идентичная сетка вместо «у кота крупнее и теснее» — рукописный стиль
   * возвращается точечно, только на словах в *звёздочках* (EmphasisText).
   */
  const bubbleClass = isUser
    ? 'chat-bubble-user px-4 py-2.5 text-[0.95rem] leading-relaxed'
    : 'chat-bubble-cat px-4 py-2.5 font-sans text-[0.95rem] leading-relaxed text-secondary-foreground'

  return (
    <div className={`relative ${isUser ? 'ml-auto max-w-[82%]' : 'max-w-[88%]'}`}>
      {/* Иконка-цель ответа лежит ПОД пузырём и открывается протяжкой. */}
      <motion.span
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${isUser ? '-right-9' : '-left-9'}`}
        style={{ opacity: replyOpacity, scale: replyScale }}
      >
        <Reply className="size-4 text-primary" />
      </motion.span>

      <motion.div
        style={{
          x,
          scale: depthScale,
          opacity: depthOpacity,
          filter: `saturate(${depthSaturate})`,
          transformOrigin: isUser ? 'right center' : 'left center',
          // Переменные для SVG-хвостика: он всегда совпадает с пузырём.
          // Значение должно зеркалить заливку .chat-bubble-cat в globals.css —
          // когда контраст пузыря поднимали (0.16/0.62 → 0.4/0.9), эту
          // константу забыли обновить, и хвостик разошёлся цветом с телом
          // пузыря, к которому приклеен. Найдено сверкой с реальным
          // скриншотом устройства.
          ['--tail-fill' as string]: isUser
            ? 'oklch(0.9 0.21 130)'
            : 'oklch(0.4 0.02 150 / 0.9)',
          ['--tail-stroke' as string]: isUser
            ? 'transparent'
            : 'oklch(1 0 0 / 0.2)',
        }}
        // Тянуть можно только к своей стороне: реплика уходит «в ответ», а не
        // болтается в обе стороны. dragElastic — упругое сопротивление за
        // порогом: жест сообщает, что предел есть, без запрета.
        drag={reduceMotion ? false : 'x'}
        dragDirectionLock
        dragConstraints={isUser ? { left: -72, right: 0 } : { left: 0, right: 72 }}
        dragElastic={0.18}
        dragSnapToOrigin
        onDragStart={() => {
          draggingRef.current = true
          cancelLongPress()
        }}
        onDrag={(_, info) => {
          // Хаптика ровно на пересечении порога, один раз за жест.
          if (Math.abs(info.offset.x) > 44 && !crossedRef(draggingRef)) {
            hapticThreshold()
            markCrossed(draggingRef)
          }
        }}
        onDragEnd={(_, info) => {
          draggingRef.current = false
          resetCrossed(draggingRef)
          if (Math.abs(info.offset.x) > 44) onReply()
        }}
        transition={SPRING_GESTURE}
        whileTap={{ scale: depthScale * 0.98 }}
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerLeave={cancelLongPress}
        className={`glass-shine relative select-none whitespace-pre-wrap rounded-2xl ${bubbleClass} ${isUser ? 'message-land' : ''}`}
      >
        {/* #10 · Настоящий хвостик — только у головы группы, как в реальных
            мессенджерах: продолжение реплики хвоста не получает. */}
        {isFirstOfGroup && <BubbleTail side={isUser ? 'right' : 'left'} />}
        <EmphasisText text={text} />
      </motion.div>

      {/* Поставленная реакция живёт на кромке пузыря — она про эту реплику,
          а не отдельная строка в ленте. */}
      <AnimatePresence>
        {reaction && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.5, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={SPRING_GESTURE}
            onClick={() => {
              hapticReaction()
              onReact(null)
            }}
            aria-label="Убрать реакцию"
            // before:-inset-2.5: видимый бейдж остаётся size-7 (28px), но
            // тач-зона расширяется до ~44px (Fitts: цель больше, чем видна).
            className={`absolute -bottom-3 flex size-7 items-center justify-center rounded-full border border-white/12 bg-secondary text-xs shadow-[0_4px_12px_-4px_oklch(0_0_0/0.6)] before:absolute before:-inset-2.5 ${
              isUser ? 'left-1' : 'right-1'
            }`}
          >
            {(() => {
              const R = REACTIONS.find((r) => r.key === reaction)
              return R ? (
                <R.Icon
                  className="size-3.5 text-primary"
                  // fill для сердца и лапки: поставленная реакция — «залитая»,
                  // как в мессенджерах, а не контурная иконка-действие
                  fill="currentColor"
                  aria-hidden="true"
                />
              ) : null
            })()}
          </motion.button>
        )}
      </AnimatePresence>

      {/* #11 · Меню реакций + копирование. Всплывает над пузырём, закрывается
          тапом вне — стандартное поведение long-press-меню. */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onPointerDown={() => {
                if (Date.now() - openedAt.current < 300) return
                setMenuOpen(false)
              }}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.12 } }}
              transition={SPRING_GESTURE}
              className={`absolute -top-14 z-40 flex items-center gap-0.5 rounded-full border border-white/12 bg-secondary p-1 shadow-[0_8px_24px_-8px_oklch(0_0_0/0.7)] ${
                isUser ? 'right-0' : 'left-0'
              }`}
            >
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    hapticReaction()
                    onReact(reaction === r.key ? null : r.key)
                    setMenuOpen(false)
                  }}
                  aria-label={r.label}
                  className={`flex size-11 items-center justify-center rounded-full transition-colors ${
                    reaction === r.key ? 'bg-primary/20' : 'hover:bg-white/8'
                  }`}
                >
                  <r.Icon
                    className={`size-4 ${reaction === r.key ? 'text-primary' : 'text-foreground'}`}
                    fill={reaction === r.key ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                </button>
              ))}
              <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />
              <button
                type="button"
                onClick={copyText}
                aria-label="Скопировать"
                className="flex size-11 items-center justify-center rounded-full transition-colors hover:bg-white/8"
              >
                <Copy className="size-3.5 text-foreground" aria-hidden="true" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {copied && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={SPRING_SNAPPY}
            className={`absolute -top-7 flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-mono text-xs text-foreground shadow-[0_4px_14px_-6px_oklch(0_0_0/0.6)] ${
              isUser ? 'right-0' : 'left-0'
            }`}
          >
            <Check className="size-3 text-primary" aria-hidden="true" />
            Скопировано
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

/*
 * Отметка «порог пройден» держится на самом ref-объекте жеста, а не в state:
 * во время протяжки нельзя вызывать рендер на каждый кадр — это тот же
 * принцип, по которому таймер long-press в этом проекте живёт в ref.
 */
type CrossFlag = { crossed?: boolean }
function crossedRef(ref: React.MutableRefObject<boolean> & CrossFlag) {
  return ref.crossed === true
}
function markCrossed(ref: React.MutableRefObject<boolean> & CrossFlag) {
  ref.crossed = true
}
function resetCrossed(ref: React.MutableRefObject<boolean> & CrossFlag) {
  ref.crossed = false
}
