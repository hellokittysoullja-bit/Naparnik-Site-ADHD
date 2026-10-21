'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { MascotSvg, type MascotAction, type MascotExpression } from '@/components/mascot-svg'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  Check,
  Mic,
  Play,
  Sparkles,
  Sprout,
  Square,
  X,
} from 'lucide-react'
import { useDictation } from '@/hooks/use-dictation'
import { PullToStretch } from '@/components/pull-to-stretch'
import { hapticStart } from '@/lib/haptics'
import { ChatBubble, BubbleTail, type Reaction } from '@/components/chat-bubble'
import { EmphasisText } from '@/components/emphasis-text'
import { SPRING_ITEM, SPRING_REVEAL, SPRING_SNAPPY, stagger } from '@/lib/motion'
import Link from 'next/link'
import {
  addNote,
  buildMemoryContext,
  getChatMessages,
  getChatTimestamps,
  saveChatMessages,
  saveChatTimestamps,
  savePlan,
  todayKey,
  type MemoryContext,
} from '@/lib/memory'
import { scriptedReply } from '@/lib/scripted-companion'

type CompanionChatProps = {
  mode: 'companion' | 'focus'
  greeting: string
  placeholder?: string
  onPlanSaved?: () => void
  /** Скрыть чипы-подсказки пустого чата. Нужно, когда над чатом уже показан
      свой набор чипов (стартер-чипы новичка на HomeScreen) — два визуально
      одинаковых ряда пилюль подряд, ведущих к разным действиям (мгновенный
      старт vs сообщение боту), путают сильнее, чем помогают. */
  showSuggestions?: boolean
  /** Закреплённый контекст в начале ленты (карточки «Дома»): рендерится
      ВНУТРИ скролл-контейнера над приветствием, так что весь экран —
      единый скролл, а не две конкурирующие зоны. Когда header задан, лента
      открывается СВЕРХУ (человек видит контекст и приветствие), а не
      проматывается к последней реплике. */
  header?: ReactNode
  /** #23 · Обновление данных по pull-to-refresh. Передаётся только там, где
      наверху ленты реально есть что обновлять (карточки «Дома») — в чистом
      чате жест был бы пустым обещанием. */
  onPullRefresh?: () => Promise<void> | void
}

function CompanionAvatar({
  reacting = false,
  expression = 'calm',
  action = 'idle',
}: {
  reacting?: boolean
  expression?: MascotExpression
  action?: MascotAction
}) {
  // Кружок-подложка: тёмный кот на тёмном фоне читался пятнышком.
  // Тёплое кольцо — тот же очаг, что горит на лендинге и на «Доме»:
  // отделяет существо от фона и держит один световой язык во всём
  // продукте. Реакция на новую реплику — контингентный социальный
  // отклик: существо отзывается на СОБЫТИЕ, а не мигает по таймеру.
  // Два независимых сигнала: reacting — «это только что пришло» (кольцо),
  // expression — «что вообще сказано» (мимика, читается из текста реплики
  // в inferExpression). Радость от новизны и тон сообщения не всегда
  // совпадают: кот может искренне обрадоваться (кольцо), сказав при этом
  // что-то сфокусированное — оба сигнала живут не подменяя друг друга.
  // Скейл-попап (#28) добавлен к кольцу: раньше «реакция» была только
  // светом, без движения тела — существо будто моргало лампочкой, а не
  // отзывалось. Один упругий вдох (1→1.2→1) на то же событие, что и
  // кольцо — тот же контингентный триггер, ничего нового не добавлено
  // в критерии срабатывания, только сила самого отклика.
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-secondary/80"
      animate={
        reduceMotion ? undefined : { scale: reacting ? [1, 1.2, 1] : 1 }
      }
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      style={{
        boxShadow: reacting
          ? '0 0 0 2px oklch(0.72 0.17 55 / 0.35), 0 0 14px -2px oklch(0.72 0.17 55 / 0.5)'
          : '0 0 0 1px oklch(0.72 0.17 55 / 0.12)',
        transition: 'box-shadow 260ms ease-out',
      }}
    >
      <MascotSvg expression={reacting ? 'happy' : expression} action={action} size={30} />
    </motion.div>
  )
}

/** Мимика существа считается из содержимого его же реплики — ноль
    дополнительного состояния, тот же приём, что у героя лендинга.
    Карточка «Начинаю» — само предвкушение старта, excited оправдан сюжетно
    сильнее, чем нейтральный calm. */
function inferExpression(text: string, hasStartCard: boolean): MascotExpression {
  if (hasStartCard) return 'excited'
  if (/(!|отлично|получилось|горжусь|ура|красота|засчитан)/i.test(text)) return 'happy'
  if (/\?\s*$/.test(text)) return 'focused'
  return 'calm'
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * #16 · Контекстные быстрые ответы вместо трёх фиксированных.
 *
 * Три вечных чипа («Не могу начать», «Раздроби задачу», «Тяжело сегодня») не
 * попадают в момент: утром с готовым планом человеку нужно не «раздроби», а
 * «поехали»; после недельной паузы — не «тяжело», а способ вернуться без
 * объяснений. По Hick's Law промах по варианту стоит не лишнего чтения, а
 * остановки: для СДВГ-аудитории это выход из приложения.
 *
 * Всегда ровно три (Хик), и первый — самый вероятный в этот момент.
 */
function buildSuggestions(memory: MemoryContext | null, hour: number): string[] {
  const chips: string[] = []
  const plan = memory?.plan ?? null
  const daysAway = memory?.patterns?.daysAway ?? null
  const totalStarts = memory?.patterns?.totalStarts ?? 0

  // Вернулся после паузы — это главный контекст, важнее времени суток.
  // Возврат без объяснений и без стыда: ровно то, чего проект не делает.
  if (daysAway !== null && daysAway >= 3) {
    chips.push('Меня не было — начнём заново')
  }

  // Есть незакрытый план: первый шаг уже сформулирован, нужен только толчок.
  if (plan?.firstStep) {
    chips.push(`Поехали: ${truncateChip(plan.firstStep)}`)
  } else if (hour >= 20 || hour < 4) {
    // Вечер — время положить план на утро, а не начинать спринт.
    chips.push('Положим план на утро')
  } else {
    chips.push('Не могу заставить себя начать')
  }

  if (!plan) chips.push('Раздроби мне задачу')
  if (hour >= 20 || hour < 4) chips.push('Не могу остановиться и лечь')
  else chips.push('Просто тяжело сегодня')

  // Новичку нужен самый маленький возможный вход.
  if (totalStarts === 0) chips.push('С чего вообще начать')

  return Array.from(new Set(chips)).slice(0, 3)
}

/** Чип должен читаться одним взглядом — длинный первый шаг режем по слову. */
function truncateChip(s: string): string {
  const t = s.trim()
  if (t.length <= 22) return t
  const cut = t.slice(0, 22)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 10 ? cut.slice(0, sp) : cut).trim()}…`
}

/** Ярлык дня для разделителя переписки: «Сегодня» / «Вчера» / дата */
function formatDayLabel(iso: string): string {
  const d = new Date(iso)
  const key = todayKey(d)
  if (key === todayKey()) return 'Сегодня'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === todayKey(yesterday)) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function CompanionChat({
  mode,
  greeting,
  placeholder,
  onPlanSaved,
  showSuggestions = true,
  header,
  onPullRefresh,
}: CompanionChatProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const memoryRef = useRef<MemoryContext | null>(null)
  const reduceMotion = useReducedMotion()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Счётчик отправок — ключ для "запуска" стрелки: старая улетает вверх,
  // новая приходит снизу. Реальный отклик на КЛЮЧЕВОЕ редкое действие
  // (не команда с клавиатуры сотни раз в день — Эмиль здесь не запрещает).
  const [sendCount, setSendCount] = useState(0)

  // Кот прикрывает глаза, когда человек надолго замолчал НАД непустым полем —
  // присутствие, не нетерпение: реагирует на паузу в мысли (см. mascot-svg.tsx
  // expression="listening"), не на пустое поле — там существу нечего ждать,
  // это уже состояние покоя. Возврат мгновенный, по любому вводу или отправке.
  const [userIdle, setUserIdle] = useState(false)
  useEffect(() => {
    if (!input.trim()) {
      setUserIdle(false)
      return
    }
    setUserIdle(false)
    const id = window.setTimeout(() => setUserIdle(true), 4500)
    return () => window.clearTimeout(id)
  }, [input])

  // Долгое нажатие (копирование + реакции) переехало в ChatBubble вместе с
  // остальными жестами реплики — держать таймер здесь, а меню там, значило
  // бы разрывать один жест между двумя файлами.

  // Растущее поле ввода вместо однострочного input: длинная мысль не
  // обрезается и не скроллится внутри крошечной строки — само поле
  // раскрывается вверх, как в любом настоящем мессенджере.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  // Контекст держим И в ref (тело запроса читает его без рендера), И в
  // state: от него зависят быстрые ответы (#16), а ref перерисовку не
  // вызывает. clientHour тоже в state — на сервере часа клиента нет, и
  // расчёт чипов прямо в рендере дал бы расхождение гидратации.
  const [memoryCtx, setMemoryCtx] = useState<MemoryContext | null>(null)
  const [clientHour, setClientHour] = useState<number | null>(null)

  useEffect(() => {
    setClientHour(new Date().getHours())
    buildMemoryContext().then((m) => {
      memoryRef.current = m
      setMemoryCtx(m)
    })
  }, [])

  const suggestionChips = useMemo(
    () =>
      clientHour === null
        ? // До монтирования — нейтральный набор, совпадающий с серверной
          // разметкой: подсказки не должны прыгать на первом кадре.
          ['Не могу заставить себя начать', 'Раздроби мне задачу', 'Просто тяжело сегодня']
        : buildSuggestions(memoryCtx, clientHour),
    [memoryCtx, clientHour],
  )

  const { messages, sendMessage, status, addToolOutput, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/companion',
      body: () => ({
        mode,
        memory: memoryRef.current,
        clientHour: new Date().getHours(),
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    // Graceful degradation: LLM недоступен (нет ключа, лимит, сеть) —
    // напарник отвечает скриптовым мозгом из своей памяти. Никогда не молчит.
    onError() {
      setMessages((prev) => {
        const lastUser = [...prev].reverse().find((m) => m.role === 'user')
        const userText =
          lastUser?.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p.type === 'text' ? p.text : ''))
            .join(' ') ?? ''
        const reply = scriptedReply(userText, memoryRef.current, new Date().getHours())

        const parts: (typeof prev)[number]['parts'] = [{ type: 'text', text: reply.text }]
        if (reply.startStep) {
          parts.push({
            type: 'tool-startFocus',
            toolCallId: `scripted-${Date.now()}`,
            state: 'output-available',
            input: { firstStep: reply.startStep, minutes: reply.minutes ?? 15 },
            output: 'Кнопка «Начинаю» показана в чате.',
          } as (typeof prev)[number]['parts'][number])
        }

        // Убираем возможный пустой/оборванный ответ ассистента после ошибки
        const cleaned =
          prev.length > 0 && prev[prev.length - 1].role === 'assistant'
            ? prev.slice(0, -1)
            : prev

        return [
          ...cleaned,
          { id: `scripted-${Date.now()}`, role: 'assistant' as const, parts },
        ]
      })
    },
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return

      if (toolCall.toolName === 'savePlan') {
        const { task, firstStep, startTime } = toolCall.input as {
          task: string
          firstStep: string
          startTime?: string
        }
        savePlan({ task, firstStep, startTime }).then(async () => {
          const fresh = await buildMemoryContext()
          memoryRef.current = fresh
          // Чипы читают память из state — без этого «Поехали: <первый шаг>»
          // не появится до перезагрузки, хотя план уже сохранён.
          setMemoryCtx(fresh)
          onPlanSaved?.()
          addToolOutput({
            tool: 'savePlan',
            toolCallId: toolCall.toolCallId,
            output: 'План сохранён. Утром напомнишь про первый шаг.',
          })
        })
      }

      if (toolCall.toolName === 'rememberFact') {
        const { fact } = toolCall.input as { fact: string }
        addNote(fact).then(async () => {
          memoryRef.current = await buildMemoryContext()
          addToolOutput({
            tool: 'rememberFact',
            toolCallId: toolCall.toolCallId,
            output: 'Запомнил.',
          })
        })
      }

      if (toolCall.toolName === 'startFocus') {
        // Карточку с кнопкой рисует разметка ниже; здесь просто подтверждаем
        addToolOutput({
          tool: 'startFocus',
          toolCallId: toolCall.toolCallId,
          output: 'Кнопка «Начинаю» показана в чате.',
        })
      }
    },
  })

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // «Он тебя помнит»: разговор переживает перезагрузку страницы.
  // Восстанавливаем последние сообщения при открытии чата.
  const chatRestoredRef = useRef(false)
  // Момент первого появления каждой реплики — в state (не в ref), иначе
  // свежий таймстемп новой реплики никогда не попадёт на экран: ref не
  // вызывает перерендер сам по себе.
  const [times, setTimes] = useState<Record<string, string>>({})
  useEffect(() => {
    if (chatRestoredRef.current) return
    chatRestoredRef.current = true
    Promise.all([
      getChatMessages<(typeof messages)[number]>(),
      getChatTimestamps(),
    ]).then(([saved, loadedTimes]) => {
      setTimes(loadedTimes)
      if (saved.length > 0) setMessages(saved)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Сохраняем после каждого завершённого обмена (не во время стриминга)
  useEffect(() => {
    if (!chatRestoredRef.current) return
    if (status === 'streaming' || status === 'submitted') return
    if (messages.length === 0) return
    saveChatMessages(messages)
    // Метка времени — на момент ПЕРВОГО появления реплики, а не на момент
    // сохранения: иначе восстановленная история переписывала бы себе
    // время каждым визитом.
    setTimes((prev) => {
      let changed = false
      const next = { ...prev }
      for (const m of messages) {
        if (!next[m.id]) {
          next[m.id] = new Date().toISOString()
          changed = true
        }
      }
      if (changed) saveChatTimestamps(next)
      return changed ? next : prev
    })
  }, [messages, status])

  // U4: скроллим по факту нового сообщения, а не на каждый чанк стрима —
  // scrollIntoView на каждом токене дёргал ленту.
  //
  // Скроллим сам контейнер, а не через scrollIntoView на маркере: при
  // восстановлении переписки из памяти лента открывалась на scrollTop 0 —
  // человек видел САМОЕ СТАРОЕ сообщение, а свежее было срезано нижней
  // кромкой. Обещание «он тебя помнит» встречало старым контекстом.
  // Первый скролл — мгновенный (это не анимация, это стартовая позиция),
  // последующие — плавные. rAF: к моменту эффекта шрифты могли ещё не
  // примениться, и высота ленты была занижена.
  /*
   * «Стартовая фаза» = первые 400 мс жизни экрана. Раньше признаком первого
   * захода служил сам факт первого срабатывания эффекта, и на ЧИСТОМ старте
   * это ломало главный сценарий: при пустой истории эффект на монтировании
   * выходил досрочно (messages.length === 0), поэтому «первым» считался уже
   * ответ на первое сообщение человека — и правило «с шапкой открываем
   * сверху» глушило скролл к нему. Проверено в браузере: scrollTop оставался
   * 0, до низа 305 px, ответ напарника целиком лежал под композером.
   * Время разделяет два разных события честно: восстановление истории
   * происходит на монтировании, новая реплика — всегда позже.
   */
  const initialPhaseOverRef = useRef(false)
  useEffect(() => {
    const t = window.setTimeout(() => {
      initialPhaseOverRef.current = true
    }, 400)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    const el = scrollRef.current
    if (!el) return
    const instant = !initialPhaseOverRef.current
    // С закреплённой шапкой «Дома» экран открывается СВЕРХУ: человек должен
    // увидеть карточку награды и приветствие, а не проскочить мимо всего
    // контекста к последней реплике восстановленной истории.
    if (instant && header) return
    const run = (behavior: ScrollBehavior) =>
      el.scrollTo({ top: el.scrollHeight, behavior })

    if (instant) {
      // Первый заход требует нескольких точек синхронизации: на момент
      // коммита рукописный Caveat ещё не применён, лента ниже вьюпорта не
      // переполнена, и scrollTo молча схлопывается в ноль. Повторяем после
      // кадра, после готовности шрифтов и с запасом по таймеру.
      run('auto')
      requestAnimationFrame(() => run('auto'))
      let cancelled = false
      const guarded = () => {
        if (!cancelled) run('auto')
      }
      document.fonts?.ready.then(guarded).catch(() => {})
      const t = window.setTimeout(guarded, 300)
      return () => {
        cancelled = true
        window.clearTimeout(t)
      }
    }

    /*
     * Новая реплика: одного scrollTo мало. Лента ПРОДОЛЖАЕТ расти после
     * него — дорисовывается карточка первого шага, приезжают чипы, шрифт
     * пересчитывает высоту абзаца. Единственный плавный скролл уезжал по
     * старой высоте, и свежий ответ снова оказывался под кромкой.
     * Поэтому держим низ ~900 мс: каждый кадр подтягиваем, пока контент
     * устаканивается. Прерываемся сразу, как человек сам увёл ленту вверх —
     * автоскролл, спорящий с рукой, хуже отсутствия автоскролла.
     */
    run('smooth')
    let raf = 0
    const until = performance.now() + 900
    const follow = () => {
      if (performance.now() > until) return
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop
      // > 240 px — это не «контент подрос», это человек листает историю
      if (distance > 240) return
      if (distance > 1) el.scrollTop = el.scrollHeight
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, status])

  // Контингентный отклик существа: реагирует на ПРИХОД новой реплики, а не
  // на каждый рендер. Восстановленную из памяти историю не отыгрываем —
  // иначе кот «радуется» вчерашнему сообщению при каждом открытии.
  const [reactingId, setReactingId] = useState<string | null>(null)
  const lastAssistantIdRef = useRef<string | null>(null)
  const seenHistoryRef = useRef(false)
  // Экранный диктор молчал про новые реплики целиком (aria-live нигде не
  // стоял) — человек с диктором не узнавал, что напарник ответил, пока не
  // ощупает ленту вручную. Тот же гейт «это только что пришло, а не старая
  // история», что уже отделяет реакцию кота от простого рендера.
  const [announceText, setAnnounceText] = useState('')
  const pendingAnnounceIdRef = useRef<string | null>(null)
  useEffect(() => {
    let lastAssistant: (typeof messages)[number] | undefined
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistant = messages[i]
        break
      }
    }
    if (!lastAssistant) return
    if (!seenHistoryRef.current) {
      seenHistoryRef.current = true
      lastAssistantIdRef.current = lastAssistant.id
      return
    }
    if (lastAssistant.id === lastAssistantIdRef.current) return
    lastAssistantIdRef.current = lastAssistant.id
    // Помечаем как «ждём объявления» — само объявление уходит диктору
    // ниже, только когда текст этой реплики перестанет меняться. ID
    // появляется в ленте ДО того, как стриминг долетит до конца: объявить
    // прямо здесь значило бы читать диктору одно первое слово навсегда.
    pendingAnnounceIdRef.current = lastAssistant.id
    setReactingId(lastAssistant.id)
    const t = window.setTimeout(() => setReactingId(null), 1600)
    return () => window.clearTimeout(t)
  }, [messages])

  // Фиксируем текст объявления, когда обмен реально завершился (не во время
  // streaming/submitted — тот же признак «устаканилось», что уже использует
  // эффект сохранения в память чуть ниже). pendingAnnounceIdRef гасится сразу
  // после — при восстановленной истории он просто никогда не выставлен.
  useEffect(() => {
    if (!pendingAnnounceIdRef.current) return
    if (status === 'streaming' || status === 'submitted') return
    const id = pendingAnnounceIdRef.current
    const msg = messages.find((m) => m.id === id)
    pendingAnnounceIdRef.current = null
    if (!msg) return
    setAnnounceText(
      msg.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join(' '),
    )
  }, [messages, status])

  // Ушёл вверх по переписке — показываем возврат вниз. Стандартная
  // аффорданса чата, без неё длинная история становится ловушкой.
  const [atBottom, setAtBottom] = useState(true)

  /*
   * #13 · ГЛУБИНА ПО СКРОЛЛУ. Считаем не в CSS и не на каждый кадр скролла в
   * state (это гнало бы рендер всей ленты на каждый пиксель), а по позициям
   * DOM-узлов: сколько реплика уже ушла за верхнюю кромку вьюпорта ленты.
   *
   * scroll-timeline тут не подходит: у каждой реплики своя глубина, и она
   * зависит от положения относительно контейнера, а контейнер — не сам
   * документ. rAF-троттлинг: один пересчёт на кадр максимум.
   */
  const [depths, setDepths] = useState<Record<string, number>>({})
  const rowsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const recompute = () => {
      rafRef.current = null
      const box = el.getBoundingClientRect()
      const next: Record<string, number> = {}
      for (const [id, node] of rowsRef.current) {
        if (!node.isConnected) continue
        const r = node.getBoundingClientRect()
        // 0 — реплика ещё ниже верхней кромки; 1 — ушла на 220px выше неё.
        // 220px ≈ две-три реплики: столько нужно, чтобы отъезд читался
        // постепенным, а не мгновенным переключением состояния.
        const past = box.top - r.bottom
        next[id] = Math.max(0, Math.min(1, past / 220))
      }
      setDepths(next)
    }

    const onScroll = () => {
      setAtBottom(el.scrollHeight - el.clientHeight - el.scrollTop < 24)
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(recompute)
    }

    onScroll()
    recompute()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [messages.length])

  function depthOf(id: string): number {
    return depths[id] ?? 0
  }

  // #11 · Реакции на реплику. Ключ — `${messageId}-${partIndex}`.
  const [reactions, setReactions] = useState<Record<string, Reaction>>({})

  // #12 · Цитата: что именно отвечаем. Живёт до отправки или отмены.
  const [replyTo, setReplyTo] = useState<{ text: string; isUser: boolean } | null>(null)
  useEffect(() => {
    // Ответ на реплику — это приглашение писать: фокус в поле сразу, иначе
    // жест требует второго действия и теряет смысл.
    if (replyTo) textareaRef.current?.focus()
  }, [replyTo])

  // #15 · Диктовка дописывает распознанное в конец поля, а не заменяет его:
  // человек мог начать печатать, потом переключиться на голос.
  const dictation = useDictation((text) => {
    setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text))
  })

  // ОЧАГ ОТВЕЧАЕТ НА РЕЧЬ. Пока напарник думает или только что заговорил,
  // костёр в сцене разгорается (.app-hearth в globals.css) — принцип
  // контингентности сцены, применённый к её главному источнику света.
  // Флаг на <body>, а не проп: AppBackdrop живёт в layout и о существовании
  // чата не знает (и не должен). Тот же механизм уже используется для
  // data-focus-immersive, так что это язык проекта, а не новая конвенция.
  // reactingId в условии обязателен: скриптовый мозг отвечает мгновенно и
  // фазу 'streaming' не проходит вообще — без него очаг молчал бы ровно там,
  // где чат работает без ключа к модели, то есть в большинстве случаев.
  const speaking =
    status === 'submitted' || status === 'streaming' || reactingId !== null
  useEffect(() => {
    if (speaking) document.body.setAttribute('data-companion-speaking', '')
    else document.body.removeAttribute('data-companion-speaking')
    return () => document.body.removeAttribute('data-companion-speaking')
  }, [speaking])

  // После скриптового ответа статус может быть 'error' — чат должен жить дальше
  const canSend = status === 'ready' || status === 'error'
  // Слот справа в композере: микрофон/стоп остаётся, пока реально идёт
  // запись (даже если частичный транскрипт уже что-то вписал в поле),
  // иначе — кнопка отправки, если есть текст или диктовка недоступна вовсе
  // (тогда disabled-отправка — тот же фолбэк, что был всегда).
  const dictationActiveControl = dictation.supported && (dictation.listening || !input.trim())

  function submit() {
    if (!input.trim() || !canSend) return
    // Диктовка активна — отправка её закрывает: иначе микрофон продолжает
    // писать в уже опустевшее поле.
    if (dictation.listening) dictation.stop()
    // Подтверждение телом в момент отправки: действие получает отклик
    // раньше, чем придёт ответ по сети.
    hapticStart()
    // #12 · Цитату передаём модели как контекст, а не как украшение в UI:
    // ответ «на это» бессмысленен, если напарник не знает, на что именно.
    const text = replyTo
      ? `> ${replyTo.text.replace(/\n/g, ' ')}\n\n${input}`
      : input
    sendMessage({ text })
    setInput('')
    setReplyTo(null)
    setSendCount((c) => c + 1)
  }

  // Таймстемп группируется по роли, но быстрый диалог («он ответил — я
  // ответил») чередует роли на каждой реплике — тогда КАЖДОЕ сообщение
  // формально становится «последним в своей группе», и одна и та же минута
  // повторяется под каждым пузырём подряд. Реальные мессенджеры схлопывают
  // это по времени: показывают метку только когда она реально изменилась
  // (плюс всегда на самом последнем сообщении, чтобы «когда мы говорили в
  // последний раз» было видно однозначно). lastShownClock — счётчик,
  // сбрасывающийся на каждый рендер (не state), ровно для этой цели.
  let lastShownClock: string | null = null
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Диктор молчал про новые реплики целиком — announceText обновляется
          только на СВОЮ, только что завершённую реплику (см. эффекты выше),
          восстановленная история и статус «печатает» сюда не попадают. */}
      <div aria-live="polite" className="sr-only">
        {announceText}
      </div>
      {/* justify-end на мобильном: сообщения примыкают к полю ввода, короткий
          чат (1-2 реплики) выглядит обжитым, а не оборванным. На десктопе
          (md:justify-start) высота вьюпорта велика — при justify-end единственная
          реплика улетала к низу, а между ней и приветствием-шапкой зияла
          пропасть, читавшаяся как «не прогрузилось». Сверху вниз реплики
          примыкают к шапке, а свободное место уходит вниз к полю ввода — это
          нормальный «пустой чат в ожидании», а не разрыв. Overflow и autoscroll
          на bottomRef не затронуты. */}
      {/* U3: сообщения растут сверху, инпут прижат к таб-бару (sticky) —
          прежний justify-end на мобиле прижимал одинокий гритинг к низу и
          оставлял мёртвую дыру посреди экрана */}
      {/* Локальный очаг переписки: эхо AppBackdrop гаснет к тому месту, где
          реально идёт разговор — здесь он читается собственным тёплым
          пятном. Статично (Operate-поверхность, без анимации), в DOM ДО
          скролл-контейнера — оба слоя static/auto, порядок в разметке сам
          кладёт пятно позади содержимого без единого z-index. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/4 rounded-full opacity-80 blur-3xl sm:h-80 sm:w-80"
        style={{
          background:
            'radial-gradient(ellipse at center, oklch(0.72 0.17 55 / 0.2) 0%, transparent 70%)',
        }}
      />
      {/* #23 · Кот потягивается при pull-to-refresh. Рендерим только там, где
          наверху ленты реально есть что обновлять (передан onPullRefresh):
          жест без результата хуже, чем отсутствие жеста. */}
      {onPullRefresh && (
        <PullToStretch scrollRef={scrollRef} onRefresh={onPullRefresh} />
      )}
      <div
        ref={scrollRef}
        // Верхняя маска-затухание — только БЕЗ шапки. С закреплённым
        // контекстом «Дома» верх ленты в покое (scrollTop 0) — это маскот и
        // приветствие: гасить их первые пиксели нельзя. Шапка и так открывает
        // ленту с чистого края (pt-4), растворять там нечего.
        className={`flex flex-1 flex-col overflow-y-auto ${
          header
            ? ""
            : "[mask-image:linear-gradient(to_bottom,transparent_0,black_24px)]"
        }`}
      >
        {/* pb-24, не py-4: композер ниже — sticky и перекрывает своим
            градиентом нижнюю часть ленты. Замерено рендером: без запаса
            последний чип-подсказка целиком лежал под композером
            (elementFromPoint в его центре возвращал textarea, не сам чип) —
            реальному пальцу нечем было в него попасть без скролла. */}
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-4 pb-6">
          {/* Закреплённый контекст «Дома»: карточки едут в общем скролле над
              перепиской. Отделён от разговора крупной паузой (pb-2 + hairline),
              чтобы «контекст» и «беседа» читались как разные слои. */}
          {header ? (
            <div className="flex flex-col gap-5 border-b border-white/[0.06] pb-5">
              {header}
            </div>
          ) : null}
          {/* Полоса «переписка / напарник рядом» — только там, где над ней
              уже стоит закреплённый контекст «Дома»: она отделяет «карточки
              статуса» от «живого разговора» как два разных слоя экрана.
              В чистом чате (Фокус) это нечего было бы отделять. */}
          {header ? (
            <div className="conversation-rail flex items-center justify-between gap-3 px-1 pt-1">
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
                переписка
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-primary shadow-[0_0_7px_oklch(0.86_0.22_130/0.5)]"
                />
                напарник рядом
              </span>
            </div>
          ) : null}
          <motion.div
            className="flex items-start gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_ITEM}
          >
            <CompanionAvatar expression={userIdle ? 'listening' : 'calm'} />
            {/* Тот же материал, что у реплик ниже (.chat-bubble-cat):
                приветствие и сообщения произносит один и тот же персонаж —
                и один и тот же материал, с гарантированным контрастом
                текста независимо от участка сцены под пузырём.
                rounded-tl-sm раньше имитировал «хвостик» скруглением угла —
                ровно то приближение, ради которого в chat-bubble.tsx
                нарисован настоящий SVG-хвостик (BubbleTail). Приветствие —
                первая реплика, которую видит человек: она обязана нести ту
                же деталь материала, что и все остальные, не урезанную
                версию. --tail-fill/--tail-stroke зеркалят те же значения,
                что ChatBubble ставит для isUser=false. */}
            <div
              className="chat-bubble-cat relative max-w-[88%] rounded-2xl px-4 py-2.5 font-sans text-[0.95rem] leading-relaxed text-secondary-foreground"
              style={{
                ['--tail-fill' as string]: 'oklch(0.4 0.02 150 / 0.9)',
                ['--tail-stroke' as string]: 'oklch(1 0 0 / 0.2)',
              }}
            >
              <BubbleTail side="left" />
              <EmphasisText text={greeting} />
            </div>
          </motion.div>

          {messages.length === 0 && showSuggestions && (
            <motion.div
              className="ml-10 flex flex-col gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_ITEM, delay: 0.35 }}
            >
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                можно просто нажать
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestionChips.map((chip, ci) => (
                  // Stagger 45мс — в стандартном диапазоне 20–80мс и только
                  // при первом появлении списка: ряд «собирается», а не
                  // выпрыгивает плитой. Дальше чипы исчезают навсегда, так
                  // что повторной ценой это не станет.
                  <motion.button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (!canSend) return
                      hapticStart()
                      sendMessage({ text: chip })
                    }}
                    disabled={!canSend}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    // #27 · Чипы приходят лестницей после приветствия:
                    // stagger из lib/motion — один шаг ритма на весь продукт.
                    transition={{ ...SPRING_SNAPPY, delay: stagger(ci, 0.4) }}
                    // disabled: пока запрос уже летит, повторный тап по чипу
                    // раньше тихо отправлял дубль — теперь кнопка блокируется,
                    // тот же гард, что уже стоит на форме композера ниже.
                    className="glass glass-interactive press inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm text-foreground shadow-[0_4px_14px_-8px_oklch(0_0_0/0.45)] hover:text-primary disabled:pointer-events-none disabled:opacity-45"
                  >
                    {chip}
                  </motion.button>
                ))}
              </div>
              {/* min-h-11: цель была 143×17px — ниже минимума 24px по
                  WCAG 2.5.8, при том что это единственный быстрый выход
                  из чата прямо к сессии */}
              <Link
                href="/app/session"
                className="mt-1 inline-flex min-h-11 w-fit items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
              >
                или сразу к делу
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          )}

          {messages.map((message, mi) => {
            // Группировка подряд идущих реплик одного говорящего — то, что
            // отличает переписку от списка блоков. Хвостик у пузыря здесь
            // сверху (rounded-tl-sm/tr-sm), поэтому «голова» группы — ПЕРВОЕ
            // сообщение: только оно получает хвост и аватар, остальные
            // прижимаются к нему и идут с ровными углами.
            const prev = messages[mi - 1]
            const next = messages[mi + 1]
            const isFirstOfGroup = !prev || prev.role !== message.role
            const isLastOfGroup = !next || next.role !== message.role
            const isUser = message.role === 'user'

            // Мимика существа — из содержимого ЕГО ЖЕ реплики, ноль
            // дополнительного состояния (тот же приём, что у героя
            // лендинга). Карточка «Начинаю» — само предвкушение старта.
            const fullText = message.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p.type === 'text' ? p.text : ''))
              .join(' ')
            const hasStartCard = message.parts.some((p) => p.type === 'tool-startFocus')
            const expression: MascotExpression = isUser
              ? 'calm'
              : inferExpression(fullText, hasStartCard)

            // Разделитель дня: только когда дата реально СМЕНИЛАСЬ между
            // соседними репликами — на свежем чате без истории делитель
            // не нужен, «Сегодня» перед первой же репликой — просто шум.
            const thisTime = times[message.id]
            const prevTime = prev ? times[prev.id] : undefined
            const showDayDivider =
              !!thisTime &&
              !!prevTime &&
              todayKey(new Date(thisTime)) !== todayKey(new Date(prevTime))

            // Схлопываем повтор одной и той же минуты подряд (см. комментарий
            // у lastShownClock выше) — но последнее сообщение в ленте всегда
            // получает метку, иначе непонятно, когда шёл разговор в последний раз.
            const clockLabel = thisTime ? formatClock(thisTime) : null
            if (showDayDivider) lastShownClock = null
            const isLastMessageOverall = mi === messages.length - 1
            const showTimestamp =
              isLastOfGroup && !!thisTime && (isLastMessageOverall || clockLabel !== lastShownClock)
            if (showTimestamp) lastShownClock = clockLabel

            return (
            <div
              key={message.id}
              // Узел нужен для замера глубины (#13): реф-колбэк, а не querySelector
              ref={(node) => {
                if (node) rowsRef.current.set(message.id, node)
                else rowsRef.current.delete(message.id)
              }}
              className="flex flex-col gap-2"
            >
              {showDayDivider && (
                <div className="my-1 flex items-center justify-center">
                  {/* Был плоский bg-white/5 — единственный элемент во всей
                      переписке без .glass-материала, который несёт
                      буквально всё остальное здесь (реплики, чипы, цитата
                      ответа). Разделитель дня выглядел вклеенным из другого
                      компонента. */}
                  <span className="glass rounded-full px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {formatDayLabel(thisTime)}
                  </span>
                </div>
              )}
              <div
                className={`flex flex-col gap-2 ${isFirstOfGroup ? '' : '-mt-2'} ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <motion.div
                      key={i}
                      className="flex w-full items-start gap-2"
                      // Нюанс «своей стороны» (iMessage/Telegram): реплика
                      // едва подъезжает СО СТОРОНЫ своего отправителя (8px —
                      // в пределах 4-8px нормы для входа элемента, не рывок),
                      // а не одинаково всплывает снизу вне зависимости от
                      // того, чья это реплика.
                      initial={
                        reduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 10, scale: isUser ? 0.97 : 0.9, x: isUser ? 8 : -8 }
                      }
                      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                      // Пришедшая реплика бота стартует ниже по scale и оседает
                      // мягче (ниже stiffness/damping) — читается как «слегка
                      // расширяется», в отличие от короткого щелчка своей же
                      // отправленной реплики (SPRING_SNAPPY без изменений).
                      transition={
                        reduceMotion
                          ? { duration: 0.15 }
                          : {
                              ...SPRING_SNAPPY,
                              scale: isUser
                                ? SPRING_SNAPPY
                                : { type: 'spring', stiffness: 220, damping: 16 },
                            }
                      }
                    >
                      {!isUser &&
                        (isFirstOfGroup ? (
                          <CompanionAvatar
                            reacting={reactingId === message.id}
                            expression={userIdle ? 'listening' : expression}
                          />
                        ) : (
                          // Место аватара держим всегда: без распорки вторая
                          // реплика группы уезжала под аватар и колонка «плыла»
                          <div className="size-9 shrink-0" aria-hidden="true" />
                        ))}
                      {/* Материал реплики вынесен в ChatBubble: там живут
                          SVG-хвостик (#10), глубина по скроллу (#13), реакции
                          долгим нажатием (#11) и swipe-to-reply (#12). */}
                      <ChatBubble
                        text={part.text}
                        isUser={isUser}
                        isFirstOfGroup={isFirstOfGroup}
                        depth={depthOf(message.id)}
                        reaction={reactions[`${message.id}-${i}`] ?? null}
                        onReact={(r) =>
                          setReactions((prev) => {
                            const key = `${message.id}-${i}`
                            const next = { ...prev }
                            if (r) next[key] = r
                            else delete next[key]
                            return next
                          })
                        }
                        onReply={() => setReplyTo({ text: part.text, isUser })}
                        reduceMotion={!!reduceMotion}
                      />
                    </motion.div>
                  )
                }

                if (part.type === 'tool-savePlan' && part.state === 'output-available') {
                  const plan = part.input as {
                    task: string
                    firstStep: string
                    startTime?: string
                  }
                  return (
                    <div
                      key={i}
                      className="chat-bubble-cat ml-10 flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3"
                    >
                      <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-primary">
                        <CalendarCheck className="size-3.5" aria-hidden="true" />
                        план положен
                      </span>
                      <span className="text-sm font-semibold">{plan.task}</span>
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        Первый шаг: {plan.firstStep}
                        {plan.startTime ? ` — ${plan.startTime}` : ''}
                      </span>
                    </div>
                  )
                }

                if (part.type === 'tool-startFocus' && part.state === 'output-available') {
                  const { firstStep, minutes } = part.input as {
                    firstStep: string
                    minutes?: number
                  }
                  const d = minutes && [15, 25, 45].includes(minutes) ? minutes : 15
                  return (
                    <div
                      key={i}
                      className="glass start-card-breathe ml-10 flex max-w-[85%] flex-col gap-2 rounded-2xl px-4 py-3"
                      style={{ '--glass-border': 'color-mix(in oklab, var(--primary) 45%, transparent)' } as CSSProperties}
                    >
                      <span className="font-mono text-xs uppercase tracking-widest text-primary">
                        готов к старту · {d} мин
                      </span>
                      <span className="text-sm font-semibold">{firstStep}</span>
                      <Button
                        size="sm"
                        className="cta-sheen gap-1.5 font-semibold"
                        onClick={() =>
                          router.push(
                            `/app/session?step=${encodeURIComponent(firstStep)}&d=${d}`,
                          )
                        }
                      >
                        <Play className="size-3.5" aria-hidden="true" />
                        Начинаю
                      </Button>
                      {/* Связка «нажал → выросло» видна и внутри самого
                          диалога, не только в карточке вехи наверху экрана —
                          та же механика упомянута там, где реально жмут. */}
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Sprout className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                        этот старт вырастит что-то на острове
                      </span>
                    </div>
                  )
                }

                if (part.type === 'tool-rememberFact' && part.state === 'output-available') {
                  const { fact } = part.input as { fact: string }
                  return (
                    <span
                      key={i}
                      className="ml-10 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      <Sparkles className="size-3" aria-hidden="true" />
                      запомнил: {fact}
                    </span>
                  )
                }

                return null
              })}
              {/* Таймстемп — раз на группу (у последней реплики), а не на
                  каждую: как в реальных мессенджерах, не как лог событий.
                  Галочка — только у своих и только когда реплика ушла
                  (не во время стриминга: секунду назад это было бы ложью). */}
              {showTimestamp && (
                // text-muted-foreground БЕЗ доп. /70: сам токен уже даёт
                // 6.63:1 на фоне сцены (замерено попиксельно через canvas),
                // а «/70» поверх него утапливал 12px-текст до 3.81:1 — ниже
                // порога 4.5:1 для обычного текста (WCAG 1.4.3; исключение
                // 3:1 тут не действует, это не крупный текст). Приглушение
                // уже заложено в самом токене, второй слой альфы его просто
                // проваливал.
                <span
                  className={`flex items-center gap-1 px-1 font-mono text-xs text-muted-foreground ${
                    isUser ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {clockLabel}
                  {/* text-primary: галочка «доставлено» — акцентный сигнал
                      подтверждения (тот же приём, что синие галочки в
                      мессенджерах), не просто ещё один серый символ рядом
                      с временем */}
                  {isUser && status !== 'streaming' && status !== 'submitted' && (
                    <Check className="size-3 text-primary" aria-hidden="true" />
                  )}
                </span>
              )}
              </div>
            </div>
            )
          })}

          {/* AnimatePresence: без ннего исчезновение индикатора не анимировано
              вообще (exit требует контекста AnimatePresence) — пузырь просто
              обрывался кадром, пока настоящий ответ не появлялся рядом. */}
          <AnimatePresence>
          {status === 'submitted' && (
            <motion.div
              key="typing"
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              transition={SPRING_SNAPPY}
            >
              {/* expression="focused", не reacting: reacting-кольцо семантически
                  означает «реплика только что пришла» (см. комментарий в
                  CompanionAvatar) — во время печати ничего ещё не пришло,
                  кот думает, а не радуется. */}
              {/* Кот «думает»: глаза вверх, мысли всплывают точками —
                  диегетичное ожидание вместо безликого спиннера */}
              <CompanionAvatar expression="calm" action="think" />
              {/* Тот же .glass + тень, что у реплик: пузырь-ожидание — это
                  форма реплики В ПРОЦЕССЕ, а не отдельный виджет рядом с ней.
                  Три тлеющих угля (.ember-dot, globals.css) — тот же огонь,
                  что горит в кольце аватара и в фоне сцены, вместо безликих
                  серых точек. Три разных периода мерцания. */}
              <span
                className="glass flex items-center gap-1 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-[0_4px_16px_-8px_oklch(0_0_0/0.5)]"
                aria-label="Напарник печатает"
              >
                <span className="ember-dot size-1.5 rounded-full" style={{ animationDuration: '0.9s' }} />
                <span className="ember-dot size-1.5 rounded-full" style={{ animationDuration: '1.15s', animationDelay: '0.15s' }} />
                <span className="ember-dot size-1.5 rounded-full" style={{ animationDuration: '0.8s', animationDelay: '0.3s' }} />
              </span>
            </motion.div>
          )}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Возврат к свежему: появляется только когда лента реально уведена
          вверх. Выход быстрее входа (140 против 200мс) — появление можно
          рассматривать, исчезновение только ждать. */}
      <AnimatePresence>
        {!atBottom && messages.length > 0 && (
          <motion.button
            type="button"
            onClick={() => {
              const el = scrollRef.current
              el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            }}
            aria-label="К свежим сообщениям"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            // Справа и НЕпрозрачная: кнопка плавает над лентой, а стекло
            // пропускало текст сообщения насквозь и читалось как дефект.
            // Край вместо центра — тот же выбор, что в мессенджерах: не
            // закрывает середину реплики, куда смотрят при чтении.
            className="press pointer-events-auto absolute bottom-28 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-white/12 bg-secondary shadow-[0_6px_18px_-6px_oklch(0_0_0/0.7)]"
          >
            <ArrowDown className="size-4 text-foreground" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Плавающая "капсула" вместо сплошной панели во весь экран: градиент
          растворяет уходящие вверх реплики в фон ДО композера — та же
          маска-затухание, что у премиальных чатов (Linear, iMessage), а
          не жёсткий обрез бордером. items-end: поле растёт вверх, кнопка
          остаётся прижатой к низу строки, как у любого настоящего мессенджера.
          Просто докнутый flex-сосед, не sticky: теперь, когда родительский
          <main> реально ограничен по высоте (h-dvh), лента над ним скроллится
          по-настоящему внутри себя — композеру не нужно цепляться за скролл
          всей страницы, он и так всегда внизу колонки. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="z-10 bg-gradient-to-t from-background via-background/85 to-transparent px-4 pt-6 pb-3"
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
                  onClick={() => setReplyTo(null)}
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
          className={`chat-input-dock glass mx-auto flex max-w-md items-end gap-2 rounded-3xl px-3 py-1.5 shadow-[0_10px_30px_-12px_oklch(0_0_0/0.55)] transition-[transform,box-shadow,border-color] duration-200 ${input.trim() ? 'is-typing' : ''}`}
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
            className="min-h-11 max-h-[7.5rem] flex-1 resize-none bg-transparent py-1.5 text-base leading-relaxed text-foreground caret-primary outline-none focus-visible:outline-none placeholder:text-muted-foreground"
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
          <span className="relative flex size-11 shrink-0 items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {dictationActiveControl ? (
                <motion.button
                  key="mic"
                  type="button"
                  initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0.1 } : SPRING_SNAPPY}
                  onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                  aria-label={dictation.listening ? 'Остановить диктовку' : 'Диктовать голосом'}
                  aria-pressed={dictation.listening}
                  className={`press absolute inset-0 flex items-center justify-center rounded-xl transition-colors ${
                    dictation.listening
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {dictation.listening ? (
                    <span className="relative flex items-center justify-center">
                      {/* Пульс — контингентный сигнал «идёт запись», ровно на
                          время жеста, а не бесконечная анимация в интерфейсе. */}
                      <span className="absolute size-7 animate-ping rounded-full bg-primary/25 motion-reduce:animate-none" />
                      <Square className="relative size-4 fill-current" aria-hidden="true" />
                    </span>
                  ) : (
                    <Mic className="size-5" aria-hidden="true" />
                  )}
                </motion.button>
              ) : (
                <motion.span
                  key="send"
                  initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                  transition={reduceMotion ? { duration: 0.1 } : SPRING_SNAPPY}
                  className="absolute inset-0"
                >
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!canSend || !input.trim()}
                    aria-label="Отправить"
                    // size-11, не size-10: 40px — тоже ниже минимума 44px
                    className="size-11 shrink-0 rounded-xl"
                  >
                    {/* Разметка НЕ ветвится по reduceMotion. Раньше здесь стояло
                        {reduceMotion ? <ArrowUp/> : <AnimatePresence>…}, и это давало
                        разное дерево на сервере (useReducedMotion → null) и на клиенте
                        при гидратации (→ true) — React #418, воспроизводилось только
                        в режиме «уменьшить движение». Структура теперь одна и та же,
                        варьируется лишь длительность: при reduced-motion стрелка
                        меняется мгновенно, без полёта. */}
                    <span className="relative flex size-5 items-center justify-center overflow-hidden">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          key={sendCount}
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -14, opacity: 0 }}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                          }
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <ArrowUp className="size-5" />
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  </Button>
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
      </form>
    </div>
  )
}
