/**
 * Память напарника.
 *
 * Сейчас — localStorage на устройстве (анонимно, без регистрации).
 * Интерфейс намеренно асинхронный: замена на базу данных позже —
 * это замена реализации, а не рефакторинг всех вызовов.
 */

export type Plan = {
  /** Дата, на которую положен план, YYYY-MM-DD */
  forDate: string
  /** Задача целиком, как её назвал человек */
  task: string
  /** Первый крошечный физический шаг */
  firstStep: string
  /** Примерное время старта, например «09:00» или «утром» */
  startTime?: string
  createdAt: string
}

export type StartEntry = {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** ISO-время старта */
  startedAt: string
  /** Что человек начал */
  label: string
  /** Старт был по вчерашнему плану */
  fromPlan: boolean
  /** Сколько минут отработано (0 — начал и вышел, это тоже старт) */
  minutes: number
}

export type CompanionNote = {
  text: string
  createdAt: string
}

export type Patterns = {
  totalStarts: number
  /** Дней подряд с хотя бы одним стартом (пропуск = пауза, не обнуление) */
  runningDays: number
  /** Час суток, в который человек чаще всего реально начинает (0-23), или null */
  favoriteHour: number | null
  lastStartDate: string | null
  /** Полных дней с последнего старта (0 = стартовал сегодня), null если стартов не было */
  daysAway: number | null
}

const KEYS = {
  plan: 'naparnik:plan',
  starts: 'naparnik:starts',
  notes: 'naparnik:notes',
  finds: 'naparnik:finds',
  worldSeen: 'naparnik:worldSeen',
  activeSession: 'naparnik:activeSession',
  chat: 'naparnik:chat',
  chatTimes: 'naparnik:chatTimes',
  companionName: 'naparnik:companionName',
} as const

function isBrowser() {
  return typeof window !== 'undefined'
}

/** Проверка формы прочитанного: запись могла остаться от старой версии, оборваться или быть чужой. */
type Guard<T> = (v: unknown) => v is T

function read<T>(key: string, fallback: T, guard?: Guard<T>): T {
  if (!isBrowser()) return fallback
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    // Хранилище заблокировано (Safari «Блокировать все cookie», встроенные браузеры соцсетей, песочница iframe):
    // getItem бросает SecurityError. Раньше исключение уходило из getPlan/getStarts в refresh() Дома — экран навсегда
    // оставался на скелетоне. Без хранилища продукт работает как первый визит.
    return fallback
  }
  if (raw === null) return fallback
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    /*
     * Битая запись НЕ должна навсегда обнулять память.
     * Найдено в браузере: в ключе имени лежала строка `Тень` без кавычек —
     * невалидный JSON. JSON.parse падал, read() молча отдавал null, и
     * напарник до конца жизни устройства звался «Я» при живом имени
     * рядом. Починить это человек не может: интерфейса для правки
     * localStorage нет, а данные вроде бы на месте.
     *
     * Причины реальны и вне нашего контроля: прерванная запись при
     * закрытии вкладки, старый формат ключа, ручная правка, чужой скрипт
     * на том же домене. Для продукта про доверие «тихо забыл имя» —
     * дорогая поломка.
     *
     * Поэтому: если fallback строковый, а в ключе лежит непустая строка —
     * принимаем её как есть (ровно случай сырого имени). Иначе стираем
     * мусор, чтобы следующая запись легла чисто и поломка не повторялась.
     */
    if (typeof fallback === 'string' || fallback === null) {
      const bare = raw.trim()
      if (bare && !bare.startsWith('{') && !bare.startsWith('[')) {
        return bare as unknown as T
      }
    }
    forget(key)
    return fallback
  }
  // JSON валиден, но форма чужая (`{"a":1}` вместо массива стартов): без проверки `.map`/`.filter` в вызывающем коде
  // роняли весь экран в страницу ошибки. null — законное «пусто» для ключей, которые очищаются записью null.
  if (parsed === null) return fallback
  if (guard && !guard(parsed)) {
    forget(key)
    return fallback
  }
  return parsed as T
}

function forget(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* приватный режим — просто живём с fallback */
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** Массив, из которого молча выброшены битые элементы — одна испорченная запись не стирает всю историю. */
function arrayOf<T>(item: Guard<T>) {
  return (v: unknown): v is T[] => Array.isArray(v) && v.every(item)
}
function readList<T>(key: string, item: Guard<T>): T[] {
  const raw = read<unknown[]>(key, [], Array.isArray as Guard<unknown[]>)
  return raw.filter(item)
}

const isPlan: Guard<Plan> = (v): v is Plan =>
  isObj(v) && isStr(v.forDate) && isStr(v.task) && isStr(v.firstStep) && (v.startTime === undefined || isStr(v.startTime))
const isStart: Guard<StartEntry> = (v): v is StartEntry =>
  isObj(v) && isStr(v.id) && isStr(v.date) && isStr(v.startedAt) && isStr(v.label) && isNum(v.minutes)
const isNote: Guard<CompanionNote> = (v): v is CompanionNote => isObj(v) && isStr(v.text)

function write(key: string, value: unknown) {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // квота/приватный режим — молча пропускаем, память просто не сохранится
  }
  // Живая сцена (components/app-backdrop.tsx) рисует гряду по числу стартов,
  // но живёт в layout и НЕ перемонтируется при переходах Дом/Фокус/Мир — без
  // этого сигнала остров на горизонте показывал бы вчерашнее состояние до
  // перезагрузки страницы. Событие шлём вне try записи: подписчик всё равно
  // перечитывает источник правды сам, поэтому знать о попытке ему полезно
  // даже когда запись не прошла по квоте.
  try {
    window.dispatchEvent(new CustomEvent('naparnik:memory', { detail: { key } }))
  } catch {
    /* CustomEvent недоступен — сцена обновится на следующем визите */
  }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function tomorrowKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return todayKey(d)
}

// ---------- План ----------

/*
 * peek* — тот же источник правды, но синхронно: для первого кадра экрана при переходе ВНУТРИ приложения
 * (hooks/use-client-mount.ts). Там гидратации нет, и данные можно отдать сразу — без кадра скелетона и прыжка
 * ленты на 270 px при каждом переключении таба (замер 27.10). Асинхронные get* остаются интерфейсом для всего
 * остального: замена хранилища на базу данных — по-прежнему замена реализации, peek* тогда станут чтением кэша.
 */
export function peekPlan(): Plan | null {
  return read<Plan | null>(KEYS.plan, null, isPlan)
}

export async function getPlan(): Promise<Plan | null> {
  return peekPlan()
}

export async function savePlan(input: {
  task: string
  firstStep: string
  startTime?: string
  forDate?: string
}): Promise<Plan> {
  const plan: Plan = {
    forDate: input.forDate ?? tomorrowKey(),
    task: input.task,
    firstStep: input.firstStep,
    startTime: input.startTime,
    createdAt: new Date().toISOString(),
  }
  write(KEYS.plan, plan)
  return plan
}

export async function clearPlan(): Promise<void> {
  write(KEYS.plan, null)
}

// ---------- Старты ----------

export function peekStarts(): StartEntry[] {
  return readList(KEYS.starts, isStart)
}

export async function getStarts(): Promise<StartEntry[]> {
  return peekStarts()
}

export async function recordStart(input: {
  label: string
  fromPlan?: boolean
  minutes?: number
}): Promise<StartEntry> {
  const entry: StartEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: todayKey(),
    startedAt: new Date().toISOString(),
    // потолок длины: подпись старта уходит в промпт напарника и на кнопки «Повторить» — не простыня из ссылки
    label: input.label.trim().slice(0, 200),
    fromPlan: input.fromPlan ?? false,
    minutes: input.minutes ?? 0,
  }
  const starts = await getStarts()
  starts.push(entry)
  write(KEYS.starts, starts)
  return entry
}

export async function updateStartMinutes(id: string, minutes: number): Promise<void> {
  const starts = await getStarts()
  const entry = starts.find((s) => s.id === id)
  if (!entry) return
  entry.minutes = Math.max(entry.minutes, Math.round(minutes))
  write(KEYS.starts, starts)
}

// ---------- Находки острова (старты сверх карты ориентиров) ----------

export type IslandFindEntry = {
  /** Ключ элемента из пула (lib/island-elements) */
  key: string
  name: string
  rarity: 'common' | 'uncommon' | 'rare'
  /** Сид позиции на карте — находка навсегда стоит там, где выросла */
  seed: number
  /** YYYY-MM-DD */
  date: string
  /** id старта, за который получена */
  startId: string
}

const isFind: Guard<IslandFindEntry> = (v): v is IslandFindEntry =>
  isObj(v) && isStr(v.key) && isStr(v.name) && isStr(v.startId) && isNum(v.seed) &&
  (v.rarity === 'common' || v.rarity === 'uncommon' || v.rarity === 'rare')

export function peekFinds(): IslandFindEntry[] {
  return readList(KEYS.finds, isFind)
}

export async function getFinds(): Promise<IslandFindEntry[]> {
  return peekFinds()
}

export async function addFind(find: IslandFindEntry): Promise<void> {
  const finds = await getFinds()
  if (finds.some((f) => f.startId === find.startId)) return
  finds.push(find)
  write(KEYS.finds, finds)
}

// ---------- Активная сессия (переживает закрытие вкладки) ----------

export type ActiveSession = {
  /** Unix ms момента старта — единственный источник правды для таймера */
  startedAt: number
  minutes: number
  task: string
  startId: string
}

const isActiveSession: Guard<ActiveSession> = (v): v is ActiveSession =>
  isObj(v) && isNum(v.startedAt) && isNum(v.minutes) && isStr(v.task) && isStr(v.startId)

export async function getActiveSession(): Promise<ActiveSession | null> {
  return read<ActiveSession | null>(KEYS.activeSession, null, isActiveSession)
}

export async function saveActiveSession(session: ActiveSession): Promise<void> {
  write(KEYS.activeSession, session)
}

export async function clearActiveSession(): Promise<void> {
  write(KEYS.activeSession, null)
}

// ---------- Очередь дробления (продукт помнит невыполненные шаги) ----------

export type StepQueue = {
  /** Задача, которую дробили */
  task: string
  /** Оставшиеся шаги в исходном порядке */
  steps: string[]
}

const STEP_QUEUE_KEY = 'naparnik:stepQueue'

const isStepQueue: Guard<StepQueue> = (v): v is StepQueue =>
  isObj(v) && isStr(v.task) && arrayOf(isStr)(v.steps)

export function peekStepQueue(): StepQueue | null {
  const q = read<StepQueue | null>(STEP_QUEUE_KEY, null, isStepQueue)
  return q && q.steps.length > 0 ? q : null
}

export async function getStepQueue(): Promise<StepQueue | null> {
  return peekStepQueue()
}

export async function saveStepQueue(task: string, steps: string[]): Promise<void> {
  const clean = steps.map((s) => s.trim()).filter(Boolean)
  write(STEP_QUEUE_KEY, clean.length > 0 ? { task, steps: clean } : null)
}

/** Шаг исполнен — очередь короче; пустая очередь очищается целиком */
export async function consumeQueueStep(step: string): Promise<void> {
  const q = await getStepQueue()
  if (!q) return
  const rest = q.steps.filter((s) => s !== step)
  write(STEP_QUEUE_KEY, rest.length > 0 ? { task: q.task, steps: rest } : null)
}

// ---------- Имя существа (endowment: названное — становится своим) ----------

export function peekCompanionName(): string | null {
  return read<string | null>(KEYS.companionName, null, isStr)
}

export async function getCompanionName(): Promise<string | null> {
  return peekCompanionName()
}

export async function saveCompanionName(name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 24)
  if (!trimmed) return
  write(KEYS.companionName, trimmed)
}

// ---------- Память разговора (котик помнит, о чём говорили) ----------

const MAX_CHAT_MESSAGES = 30

/**
 * Сохранённые сообщения чата в формате UIMessage (структурная копия).
 * Тип намеренно свободный: сообщения приходят из useChat и сериализуемы.
 */
// Реплика формата useChat: без parts (старый формат AI SDK — { role, content }) лента падала на message.parts.map,
// и Дом навсегда открывался страницей ошибки — «Попробовать снова» читал ту же запись
const isChatMessage = (v: unknown): v is Record<string, unknown> =>
  isObj(v) && isStr(v.id) && (v.role === 'user' || v.role === 'assistant') && Array.isArray(v.parts) && v.parts.every(isObj)

export function peekChatMessages<T>(): T[] {
  return readList(KEYS.chat, isChatMessage) as T[]
}

export async function getChatMessages<T>(): Promise<T[]> {
  return peekChatMessages<T>()
}

export async function saveChatMessages<T>(messages: T[]): Promise<void> {
  write(KEYS.chat, messages.slice(-MAX_CHAT_MESSAGES))
}

/**
 * Момент первого появления каждой реплики (ISO), по id сообщения.
 * Отдельная карта, а не поле на сообщении: тип UIMessage приходит из
 * useChat и не резервирует место под свои метки времени.
 */
export function peekChatTimestamps(): Record<string, string> {
  return read<Record<string, string>>(KEYS.chatTimes, {}, isObj as Guard<Record<string, string>>)
}

export async function getChatTimestamps(): Promise<Record<string, string>> {
  return peekChatTimestamps()
}

export async function saveChatTimestamps(map: Record<string, string>): Promise<void> {
  write(KEYS.chatTimes, map)
}

// ---------- Непросмотренное на острове (триггер возврата к награде) ----------

/**
 * Сколько стартов человек ещё не видел на острове.
 * Бейдж на табе «Мир» гаснет при заходе на страницу острова.
 */
export async function getUnseenWorldCount(): Promise<number> {
  const starts = await getStarts()
  const seen = read<number>(KEYS.worldSeen, 0, isNum)
  return Math.max(0, starts.length - seen)
}

export async function markWorldSeen(): Promise<void> {
  const starts = await getStarts()
  write(KEYS.worldSeen, starts.length)
}

// ---------- Заметки напарника ----------

const MAX_NOTES = 6

export function peekNotes(): CompanionNote[] {
  return readList(KEYS.notes, isNote)
}

export async function getNotes(): Promise<CompanionNote[]> {
  return peekNotes()
}

export async function addNote(text: string): Promise<void> {
  const notes = await getNotes()
  const trimmed = text.trim()
  if (!trimmed) return
  if (notes.some((n) => n.text === trimmed)) return
  notes.push({ text: trimmed, createdAt: new Date().toISOString() })
  write(KEYS.notes, notes.slice(-MAX_NOTES))
}

// ---------- Паттерны (производные) ----------

export async function getPatterns(): Promise<Patterns> {
  return peekPatterns()
}

export function peekPatterns(): Patterns {
  const starts = peekStarts()
  if (starts.length === 0) {
    return { totalStarts: 0, runningDays: 0, favoriteHour: null, lastStartDate: null, daysAway: null }
  }

  const dates = Array.from(new Set(starts.map((s) => s.date))).sort()
  const lastStartDate = dates[dates.length - 1]

  // «Дней подряд»: серия, заканчивающаяся сегодня или вчера.
  // Пропуск дня приостанавливает счёт, но история не сгорает.
  let runningDays = 0
  const cursor = new Date()
  const today = todayKey(cursor)
  cursor.setDate(cursor.getDate() - 1)
  const yesterday = todayKey(cursor)

  if (lastStartDate === today || lastStartDate === yesterday) {
    const dateSet = new Set(dates)
    const walk = new Date(lastStartDate + 'T12:00:00')
    while (dateSet.has(todayKey(walk))) {
      runningDays += 1
      walk.setDate(walk.getDate() - 1)
    }
  }

  const hourCounts = new Map<number, number>()
  for (const s of starts) {
    const h = new Date(s.startedAt).getHours()
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1)
  }
  let favoriteHour: number | null = null
  let best = 0
  for (const [h, count] of hourCounts) {
    if (count > best) {
      best = count
      favoriteHour = h
    }
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const daysAway = Math.max(
    0,
    Math.floor(
      (new Date(today + 'T12:00:00').getTime() - new Date(lastStartDate + 'T12:00:00').getTime()) /
        msPerDay,
    ),
  )

  return { totalStarts: starts.length, runningDays, favoriteHour, lastStartDate, daysAway }
}

// ---------- Компактный контекст для LLM ----------

export type MemoryContext = {
  plan: Plan | null
  recentStarts: Array<Pick<StartEntry, 'date' | 'label' | 'minutes' | 'fromPlan'>>
  patterns: Patterns
  notes: string[]
  /** Последние находки острова — напарник может вспоминать их в разговоре */
  recentFinds: Array<Pick<IslandFindEntry, 'name' | 'rarity' | 'date'>>
  /** Имя, которое человек дал существу (null — ещё не назвал) */
  companionName: string | null
}

export async function buildMemoryContext(): Promise<MemoryContext> {
  return peekMemoryContext()
}

export function peekMemoryContext(): MemoryContext {
  const plan = peekPlan()
  const starts = peekStarts()
  const patterns = peekPatterns()
  const notes = peekNotes()
  const finds = peekFinds()
  const companionName = peekCompanionName()
  return {
    plan,
    recentStarts: starts.slice(-5).map(({ date, label, minutes, fromPlan }) => ({
      date,
      label,
      minutes,
      fromPlan,
    })),
    patterns,
    notes: notes.map((n) => n.text),
    recentFinds: finds.slice(-3).map(({ name, rarity, date }) => ({ name, rarity, date })),
    companionName,
  }
}
