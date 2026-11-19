'use client'

import { memo, useEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hapticStart } from '@/lib/haptics'
import { SPRING_SNAPPY } from '@/lib/motion'

/**
 * Поле ввода переписки. Отдельный компонент, как у больших мессенджеров (Telegram Web, Slack, Discord держат
 * черновик вне списка сообщений): текст поля меняется на каждую букву, и раньше вместе с ним перерисовывалась вся
 * лента — 30 пузырей с котами (замер: CPU ×4, ~30 мс работы и ~200 мс до кадра на каждую букву). Теперь буква
 * трогает только поле, а лента перерисовывается, когда меняется она сама.
 */
export type ReplyTarget = { text: string; isUser: boolean }

export const ChatComposer = memo(function ChatComposer({
  textareaRef,
  placeholder,
  canSend,
  replyTo,
  onCancelReply,
  onSend,
  onIdleChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  placeholder?: string
  canSend: boolean
  replyTo: ReplyTarget | null
  onCancelReply: () => void
  onSend: (text: string) => void
  /** человек надолго замолчал над непустым полем — кот прикрывает глаза */
  onIdleChange: (idle: boolean) => void
}) {
  const reduceMotion = useReducedMotion()
  const [input, setInput] = useState('')
  // Счётчик отправок — ключ для "запуска" стрелки: старая улетает вверх,
  // новая приходит снизу. Реальный отклик на КЛЮЧЕВОЕ редкое действие
  // (не команда с клавиатуры сотни раз в день — Эмиль здесь не запрещает).
  const [sendCount, setSendCount] = useState(0)

  // Кот прикрывает глаза, когда человек надолго замолчал НАД непустым полем —
  // присутствие, не нетерпение: реагирует на паузу в мысли (см. mascot-doll.tsx,
  // expression="listening"), не на пустое поле — там существу нечего ждать,
  // это уже состояние покоя. Возврат мгновенный, по любому вводу или отправке.
  const idleRef = useRef(onIdleChange)
  useEffect(() => {
    idleRef.current = onIdleChange
  })
  useEffect(() => {
    idleRef.current(false)
    if (!input.trim()) return
    const id = window.setTimeout(() => idleRef.current(true), 4500)
    return () => window.clearTimeout(id)
  }, [input])

  // Растущее поле ввода вместо однострочного input: длинная мысль не
  // обрезается и не скроллится внутри крошечной строки — само поле
  // раскрывается вверх, как в любом настоящем мессенджере.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input, textareaRef])

  // Микрофона нет (владелец 19.11: диктовка была заглушкой) — справа в поле только стрелка, и только когда есть текст,
  // как в Telegram. Её появление анимируется лишь после ввода: в первом кадре поле пустое и ничего не «выпрыгивает»
  const hasText = input.trim() !== ''
  const swapIn = reduceMotion ? false : { scale: 0.6, opacity: 0 }
  const swapOut = reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }

  function submit() {
    if (!input.trim() || !canSend) return
    // Подтверждение телом в момент отправки: действие получает отклик
    // раньше, чем придёт ответ по сети.
    hapticStart()
    onSend(input)
    setInput('')
    setSendCount((c) => c + 1)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      // затухание тянется вниз до самого меню (-mb-20 — под отступ страницы под меню): раньше между полем и меню
      // оставалась полоса фона с зелёным отсветом холма и линией — «шов» (скриншот владельца 19.11)
      className="z-10 -mb-20 bg-gradient-to-t from-background via-background/85 to-transparent px-4 pt-6 pb-[calc(0.75rem+5rem)]"
    >
      {/* #12 · Цитата отвечаемой реплики. Появляется над полем, а не внутри
          него: текст ответа не должен смешиваться с текстом цитаты. Крестик
          обязателен — жест, из которого нет выхода, ощущается ловушкой. */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
            className="mx-auto mb-2 max-w-md overflow-hidden"
          >
            <div className="glass flex items-start gap-2 rounded-xl border-l-2 border-l-primary/70 px-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  {replyTo.isUser ? 'Твоя реплика' : 'Напарник'}
                </span>
                <p className="truncate text-xs leading-relaxed text-foreground/85">
                  {replyTo.text}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="Отменить ответ на реплику"
                className="press -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Мягкое гало вместо жёсткого кольца: тот же токен primary, но как
          рассеянный свет (тонкий контур + вынесенное свечение), а не
          сплошная неоновая обводка — так фокус читается премиально, а
          не как игровой хайлайт. chat-input-dock (globals.css) — готовый
          класс уже лежал в файле, но ни разу не был подключён к разметке;
          rounded-3xl роднит форму дока с капсулами чипов/пилюль по всему
          экрану, а не с прямоугольными углами reward-карточки. */}
      {/* py-1.5, не py-2: с одним слотом справа (см. ниже) вместо
          микрофона+отправки бок о бок доку больше не нужен запас под два
          44px-квадрата сразу — тоньше без потери тач-целей. */}
      {/* is-typing: поверхность реагирует именно на НАЧАЛО печати, не на
          фокус — тап в пустое поле не должен ничего «зажигать», иначе
          сигнал теряет смысл (реагирует на всё подряд). Только изменение
          света (тон границы/тени теплеет к primary), без анимации —
          тот же язык, что просил §7 разбора: поле как поверхность,
          которая ловит свет, а не мигает. */}
      <div
        // тоньше, как поле Telegram (владелец 19.11): 40 px в одну строку вместо 57, без значков внутри
        className={`chat-input-dock glass mx-auto flex max-w-md items-end gap-1 rounded-[1.25rem] py-0 pl-4 pr-1 shadow-[0_10px_30px_-12px_oklch(0_0_0/0.55)] transition-[transform,box-shadow,border-color] duration-200 ${hasText ? 'is-typing' : ''}`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder={placeholder ?? 'Напиши напарнику…'}
          aria-label="Сообщение напарнику"
          // text-base, не text-sm: меньше 16px — Safari на iOS зумит всю
          // страницу при фокусе на поле ввода, это ломает раскладку на
          // каждое открытие клавиатуры.
          // min-h-11: поле в одну строку (rows=1) мерилось 38px — ниже
          // минимума тач-зоны 44px (замерено рендером).
          // caret-primary: курсор мигает лаймом, не системным чёрным/белым —
          // дешёвая деталь, которую держат в голове дорогие продукты
          // (Linear, Arc), но обычно теряют в фоллбэке на браузерный дефолт.
          // focus-visible:outline-none ПОВЕРХ outline-none: у shadcn-ресета
          // есть правило :is(...,textarea,...):focus-visible{outline:2px
          // solid var(--ring)} специфичностью (0,1,1) — оно бьёт голый
          // .outline-none (0,1,0) и рисовало резкое лаймовое кольцо ПОВЕРХ
          // всей ручной работы с .chat-input-dock ниже, что и было
          // настоящим источником «неонового кольца», а не сам док.
          // focus-visible:outline-none даёт (0,2,0) и наконец побеждает.
          className="min-h-10 max-h-[7.5rem] flex-1 resize-none bg-transparent py-2 text-base leading-6 text-foreground caret-primary outline-none focus-visible:outline-none placeholder:text-muted-foreground"
        />
        {/* #29 · Один слот справа вместо двух одновременных иконок.
            Микрофон и «отправить» никогда не нужны в один и тот же
            момент: либо ещё не начал писать (доступна диктовка), либо
            уже что-то написал (нужна отправка) — то же поведение, что в
            самых массовых мессенджерах. Меньше одновременных целей на
            взгляд (Hick's Law), и композер визуально уже, а не веером из
            двух квадратов через всю ширину. dictationActiveControl:
            микрофон/стоп остаётся на месте, пока реально идёт запись,
            даже если частичный транскрипт уже успел заполнить поле —
            иначе кнопка «стоп» пропала бы посреди активной диктовки. */}
        <AnimatePresence initial={false}>
          {hasText && (
            <motion.span
              key="send"
              initial={swapIn}
              animate={{ scale: 1, opacity: 1 }}
              exit={swapOut}
              transition={reduceMotion ? { duration: 0.1 } : SPRING_SNAPPY}
              className="flex size-10 shrink-0 items-center justify-center"
            >
              <Button
                type="submit"
                size="icon"
                disabled={!canSend}
                aria-label="Отправить"
                className="size-8 shrink-0 rounded-full"
              >
                {/* Разметка НЕ ветвится по reduceMotion (иначе разное дерево на сервере и клиенте — React #418) */}
                <span className="relative flex size-4 items-center justify-center overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={sendCount}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -14, opacity: 0 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <ArrowUp className="size-4" />
                    </motion.span>
                  </AnimatePresence>
                </span>
              </Button>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  )
})
