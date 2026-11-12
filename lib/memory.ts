/**
 * Память напарника.
 *
 * Сейчас — localStorage на устройстве (анонимно, без регистрации).
 * Интерфейс намеренно асинхронный: замена на базу данных позже —
 * это замена реализации, а не рефакторинг всех вызовов.
 */
import { activeFacts, applyFactOps, FACT_CATEGORIES, type Fact, type FactOp, type OpResult } from '@/lib/ai/memory/facts'
import { activeSkills, applySkillOps, curate, relevantSkills, type Skill, type SkillOp, type SkillOpResult } from '@/lib/ai/memory/skills'

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
  /** Сколько минут человек выбрал на сессию (нет у стартов до 12.11) — для вывода «доводит до конца» */
  planned?: number
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
  /** Окно из трёх часов, когда человек обычно начинает, с основанием «n из of» (≥ 5 стартов, доля ≥ 40 %) */
  startWindow: { from: number; to: number; n: number; of: number } | null
  /** Сколько сессий каждой длительности доведено до конца (≥ 3 сессии этой длительности) */
  durations: { minutes: number; done: number; of: number }[]
}

const KEYS = {
  plan: 'naparnik:plan',
  starts: 'naparnik:starts',
  notes: 'naparnik:notes',
  facts: 'naparnik:facts',
  onboarding: 'naparnik:onboarding',
  profileForgotten: 'naparnik:profileForgotten',
  skills: 'naparnik:skills',
  skillShown: 'naparnik:skillShown',
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
      // …но только там, где строка — законное значение (имя). Для плана, очереди, сессии сырая строка `abc`
      // раньше проходила мимо гарда «планом», и Дом падал на plan.firstStep.toLowerCase() — навсегда.
      if (bare && !bare.startsWith('{') && !bare.startsWith('[') && (!guard || guard(bare))) {
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
const CATEGORIES = new Set<string>(FACT_CATEGORIES)
const isFact: Guard<Fact> = (v): v is Fact =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.category) &&
  CATEGORIES.has(v.category) &&
  isStr(v.text) &&
  (v.source === 'explicit' || v.source === 'stated') &&
  isStr(v.createdAt) &&
  isStr(v.updatedAt) &&
  (v.status === 'active' || v.status === 'superseded') &&
  (v.expiresOn === undefined || isStr(v.expiresOn)) &&
  (v.evidence === undefined || isStr(v.evidence)) &&
  (v.supersedes === undefined || isStr(v.supersedes))

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
  /** выбранная длительность сессии */
  planned?: number
}): Promise<StartEntry> {
  const entry: StartEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: todayKey(),
    startedAt: new Date().toISOString(),
    // потолок длины: подпись старта уходит в промпт напарника и на кнопки «Повторить» — не простыня из ссылки
    label: input.label.trim().slice(0, 200),
    fromPlan: input.fromPlan ?? false,
    minutes: input.minutes ?? 0,
    ...(input.planned ? { planned: input.planned } : {}),
  }
  const starts = await getStarts()
  starts.push(entry)
  write(KEYS.starts, starts)
  creditSkills()
  keepMemory()
  markHome(true)
  return entry
}

/**
 * Просим браузер считать память сайта постоянной: без этого при нехватке места на устройстве Chrome/Edge/Safari
 * вправе молча стереть localStorage целиком — остров, имя, переписку. Chrome и Safari решают сами, без окна
 * (вовлечённость, установка на экран «Домой»); Firefox показал бы человеку непонятный запрос — там не спрашиваем.
 * Зовём после старта: ценность уже заработана, и браузер видит живое использование.
 */
export function keepMemory(): void {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage?.persist || /Firefox\//.test(navigator.userAgent)) return
    void storage.persisted().then((already) => (already ? true : storage.persist())).catch(() => {})
  } catch {
    /* нет API — живём как раньше */
  }
}

/**
 * Метка «уже свой» для сервера — как вход в аккаунт у Duolingo, только без аккаунта: в cookie лишь «1», никаких данных.
 * По ней Vercel уводит с лендинга и знакомства на /app ещё ДО загрузки страницы (next.config.ts, redirects).
 * Метку ставит СЕРВЕР (POST /api/home): cookie, записанные скриптом, Safari держит ~7 дней, серверные — 400 дней.
 * Скрипт пишет её сам только как мгновенную запасную, пока ответ сервера в пути; продлеваем раз в 30 дней.
 * Встроенный скрипт (components/returning-redirect.tsx) — последний запасной путь. Нет стартов — метку снимаем.
 */
const HOME_COOKIE = 'naparnik_home'
const HOME_REFRESH_KEY = 'naparnik:homeAt'
const HOME_REFRESH_MS = 30 * 86_400_000
// markHome зовут на каждую запись в память и на каждое возвращение во вкладку. Пока ответ сервера в пути (или если он
// не пришёл: нет сети, 429), каждая следующая запись слала POST /api/home ещё раз — 3–4 запроса за первые 100 мс старта
// сессии и бесконечные повторы без сети. Один запрос за раз и не чаще раза в минуту.
let homePostAt = 0
const HOME_RETRY_MS = 60_000
export function markHome(hasStarts: boolean): void {
  try {
    if (typeof document === 'undefined') return
    const has = document.cookie.split('; ').includes(`${HOME_COOKIE}=1`)
    if (!hasStarts) {
      if (has) document.cookie = `${HOME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`
      return
    }
    let last = 0
    try {
      last = Number(window.localStorage.getItem(HOME_REFRESH_KEY)) || 0
    } catch {
      /* хранилище недоступно — просто попросим сервер ещё раз */
    }
    if (has && Date.now() - last < HOME_REFRESH_MS) return
    if (!has) document.cookie = `${HOME_COOKIE}=1; Max-Age=34560000; Path=/; SameSite=Lax; Secure`
    if (Date.now() - homePostAt < HOME_RETRY_MS) return
    homePostAt = Date.now()
    void fetch('/api/home', { method: 'POST', keepalive: true, credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) return
        try {
          window.localStorage.setItem(HOME_REFRESH_KEY, String(Date.now()))
        } catch {
          /* не запомнили — продлим при следующем визите */
        }
      })
      .catch(() => {
        /* нет сети — сработает скриптовая метка и встроенный скрипт */
      })
  } catch {
    /* cookie запрещены — сработает встроенный скрипт */
  }
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

// ---------- Память о человеке: факты (lib/ai/memory/facts.ts) ----------

/** Прежние заметки (до 12.11) — только для переноса в факты */
function peekLegacyNotes(): CompanionNote[] {
  return readList(KEYS.notes, isNote)
}

const newFactId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Все факты, включая заменённые (история «было → стало»). При первом чтении после обновления прежние заметки
 * переносятся в факты «о себе» — один раз: дальше ключ фактов есть, и заметки больше не читаются (сам ключ заметок
 * не стираем: старая вкладка, открытая до обновления, продолжит работать).
 */
export function peekAllFacts(): Fact[] {
  const facts = readList(KEYS.facts, isFact)
  if (facts.length > 0 || !isBrowser()) return facts
  let hasKey = false
  try {
    hasKey = window.localStorage.getItem(KEYS.facts) !== null
  } catch {
    return facts
  }
  if (hasKey) return facts
  const notes = peekLegacyNotes()
  if (notes.length === 0) return facts
  const seen = new Set<string>()
  const migrated: Fact[] = []
  for (const n of notes) {
    const text = n.text.trim().slice(0, 160)
    if (!text || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    const at = isStr(n.createdAt) ? n.createdAt : new Date().toISOString()
    migrated.push({ id: newFactId(), category: 'about', text, source: 'stated', createdAt: at, updatedAt: at, status: 'active' })
  }
  write(KEYS.facts, migrated)
  return migrated
}

/** Факты, которые сейчас идут в разговор: активные и не истёкшие, в порядке, который видит модель */
export function peekFacts(): Fact[] {
  return activeFacts(peekAllFacts(), todayKey())
}

/**
 * Применить операции памяти на устройстве. Содержание уже проверено (схема инструмента / ответ выжимки после
 * write-guard на сервере и ещё раз в чате); здесь — дубли, замена, лимит и сроки (те же правила, что на сервере).
 */
export async function applyMemoryOps(ops: readonly FactOp[]): Promise<OpResult[]> {
  if (ops.length === 0) return []
  const { facts, results } = applyFactOps(peekAllFacts(), ops, { now: new Date().toISOString(), newId: newFactId, today: todayKey() })
  write(KEYS.facts, facts)
  // «забудь всё» — это и ответы знакомства, и навыки о человеке: кот больше не опирается на них (сами ответы
  // остаются знакомству)
  if (ops.some((o) => o.op === 'forgetAll')) {
    write(KEYS.profileForgotten, true)
    write(KEYS.skills, [])
    write(KEYS.skillShown, null)
  }
  return results
}

// ---------- Навыки кота о человеке (lib/ai/memory/skills.ts) ----------

const isSkill: Guard<Skill> = (v): v is Skill =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.name) &&
  isStr(v.when) &&
  isStr(v.steps) &&
  (v.avoid === undefined || isStr(v.avoid)) &&
  isStr(v.createdAt) &&
  isStr(v.updatedAt) &&
  isNum(v.uses) &&
  isNum(v.wins) &&
  (v.lastUsedAt === undefined || isStr(v.lastUsedAt)) &&
  (v.status === 'active' || v.status === 'archived')

/** Все навыки, включая архив; Curator проходит при чтении (дубли, давно не применявшиеся, лимит) */
export function peekAllSkills(): Skill[] {
  const raw = readList(KEYS.skills, isSkill)
  const curated = curate(raw, todayKey())
  if (JSON.stringify(curated) !== JSON.stringify(raw)) write(KEYS.skills, curated)
  return curated
}

/** Активные навыки в порядке, который видит модель: номер навыка = место в этом списке */
export function peekSkills(): Skill[] {
  return activeSkills(peekAllSkills())
}

export async function applySkillMemoryOps(ops: readonly SkillOp[]): Promise<SkillOpResult[]> {
  if (ops.length === 0) return []
  const { skills, results } = applySkillOps(peekAllSkills(), ops, { now: new Date().toISOString(), newId: newFactId })
  write(KEYS.skills, skills)
  return results
}

const SKILL_WIN_MS = 30 * 60_000

/**
 * Навыки, которые раскроются в этом ходе (тот же отбор, что на сервере, memory/render.ts), отмечаются «применён»;
 * если в ближайшие полчаса будет старт — «после него был старт». Эти счётчики — основа решений Curator.
 */
export function markSkillsShown(lastUserText: string): void {
  const all = peekAllSkills()
  const shown = relevantSkills(all, lastUserText)
  if (shown.length === 0) return
  const now = new Date().toISOString()
  const ids = new Set(shown.map((s) => s.id))
  write(KEYS.skills, all.map((s) => (ids.has(s.id) ? { ...s, uses: s.uses + 1, lastUsedAt: now } : s)))
  write(KEYS.skillShown, { ids: [...ids], at: Date.now() })
}

function creditSkills(): void {
  const shown = read<{ ids: string[]; at: number } | null>(KEYS.skillShown, null, (v): v is { ids: string[]; at: number } =>
    isObj(v) && Array.isArray(v.ids) && v.ids.every(isStr) && isNum(v.at),
  )
  if (!shown || Date.now() - shown.at > SKILL_WIN_MS) return
  const ids = new Set(shown.ids)
  write(KEYS.skills, peekAllSkills().map((s) => (ids.has(s.id) ? { ...s, wins: s.wins + 1 } : s)))
  write(KEYS.skillShown, null)
}

// ---------- Паттерны (производные) ----------

export async function getPatterns(): Promise<Patterns> {
  return peekPatterns()
}

export function peekPatterns(): Patterns {
  const starts = peekStarts()
  if (starts.length === 0) {
    return { totalStarts: 0, runningDays: 0, favoriteHour: null, lastStartDate: null, daysAway: null, startWindow: null, durations: [] }
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

  const startWindow = windowOf(starts, today)
  const durations = durationsOf(starts, read<ActiveSession | null>(KEYS.activeSession, null, isActiveSession)?.startId)

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

  return { totalStarts: starts.length, runningDays, favoriteHour, lastStartDate, daysAway, startWindow, durations }
}

/*
 * Выводы по стартам (ярус Т4, memory-personalization.md §8) — считает код, не модель: детерминированно и с числом-
 * основанием. Кот вправе сказать «обычно» только с ним («9 из 14»), иначе это эффект Барнума.
 */
const WINDOW_MIN_STARTS = 5
const WINDOW_MIN_SHARE = 0.4
const HALF_LIFE_DAYS = 21

/** Три часа подряд (по кругу суток), на которые приходится больше всего стартов с учётом свежести */
export function windowOf(starts: readonly StartEntry[], today: string): Patterns['startWindow'] {
  if (starts.length < WINDOW_MIN_STARTS) return null
  const now = new Date(today + 'T12:00:00').getTime()
  const weight = new Array<number>(24).fill(0)
  const count = new Array<number>(24).fill(0)
  let total = 0
  for (const s of starts) {
    const t = new Date(s.startedAt)
    if (Number.isNaN(t.getTime())) continue
    const age = Math.max(0, (now - t.getTime()) / 86_400_000)
    const w = Math.pow(0.5, age / HALF_LIFE_DAYS)
    weight[t.getHours()] += w
    count[t.getHours()] += 1
    total += w
  }
  if (total === 0) return null
  let best = -1
  let bestW = 0
  for (let h = 0; h < 24; h++) {
    const w = weight[(h + 23) % 24] + weight[h] + weight[(h + 1) % 24]
    if (w > bestW) {
      bestW = w
      best = h
    }
  }
  if (best < 0 || bestW / total < WINDOW_MIN_SHARE) return null
  const n = count[(best + 23) % 24] + count[best] + count[(best + 1) % 24]
  // основание в сырых числах тоже должно быть весомым: свежесть не превращает «2 из 12» в «обычно» (аудит 12.11)
  if (n < WINDOW_MIN_STARTS || n / starts.length < WINDOW_MIN_SHARE) return null
  return { from: (best + 23) % 24, to: (best + 1) % 24, n, of: starts.length }
}

const DURATION_MIN_SESSIONS = 3

/** Доведено до конца — отработано не меньше выбранного (минута запаса на округление и закрытую вкладку) */
export function durationsOf(starts: readonly StartEntry[], runningId?: string): Patterns['durations'] {
  const by = new Map<number, { done: number; of: number }>()
  for (const s of starts) {
    // идущая сессия ещё не «не доведена»
    if (!s.planned || s.id === runningId) continue
    const d = by.get(s.planned) ?? { done: 0, of: 0 }
    d.of += 1
    if (s.minutes >= s.planned - 1) d.done += 1
    by.set(s.planned, d)
  }
  return [...by.entries()]
    .filter(([, d]) => d.of >= DURATION_MIN_SESSIONS)
    .sort((a, b) => b[1].of - a[1].of || a[0] - b[0])
    .slice(0, 3)
    .map(([minutes, d]) => ({ minutes, ...d }))
}

// ---------- Компактный контекст для LLM ----------

export type MemoryContext = {
  plan: Plan | null
  recentStarts: Array<Pick<StartEntry, 'date' | 'label' | 'minutes' | 'fromPlan'>>
  patterns: Patterns
  /** Факты о человеке для разговора (номер факта для модели — место в этом списке) */
  facts: Array<{ category: Fact['category']; text: string; since: string }>
  /** id тех же фактов в том же порядке: по ним устройство переводит номер из ответа модели обратно в факт */
  factIds: string[]
  /** Навыки кота о человеке — номер навыка для модели = место в списке */
  skills: Array<{ name: string; when: string; steps: string; avoid?: string }>
  skillIds: string[]
  /** Ответы знакомства — ключи вариантов (подписи подставляет сервер) */
  profile: { sphere?: string; hanging?: string; blocker?: string; motive?: string } | null
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
  // не больше лимита снимка (lib/ai/memory/schema.ts): лишний факт выключил бы память целиком
  const facts = peekFacts().slice(0, 20)
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
    facts: facts.map((f) => ({ category: f.category, text: f.text, since: f.createdAt.slice(0, 10) })),
    factIds: facts.map((f) => f.id),
    ...(() => {
      const skills = peekSkills()
      return {
        skills: skills.map(({ name, when, steps, avoid }) => ({ name, when, steps, avoid })),
        skillIds: skills.map((s) => s.id),
      }
    })(),
    profile: peekProfile(),
    recentFinds: finds.slice(-3).map(({ name, rarity, date }) => ({ name, rarity, date })),
    companionName,
  }
}

/** Ответы знакомства (lib/onboarding.ts хранит их сам) — только ключи; сервер проверит их по списку вариантов */
function peekProfile(): MemoryContext['profile'] {
  if (read<boolean>(KEYS.profileForgotten, false, (v): v is boolean => typeof v === 'boolean')) return null
  // читаем сами, без read(): чужой ключ при неожиданной форме нельзя стирать — им владеет знакомство
  let raw: unknown = null
  try {
    raw = isBrowser() ? JSON.parse(window.localStorage.getItem(KEYS.onboarding) ?? 'null') : null
  } catch {
    return null
  }
  if (!isObj(raw)) return null
  const pick = (k: string) => (isStr(raw[k]) ? (raw[k] as string).slice(0, 20) : undefined)
  const profile = { sphere: pick('sphere'), hanging: pick('hanging'), blocker: pick('blocker'), motive: pick('motive') }
  return Object.values(profile).some(Boolean) ? profile : null
}
