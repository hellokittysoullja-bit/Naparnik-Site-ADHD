/**
 * «Дела» (прототип этапа 2, research/24-product-teardown/PLAN.md): куда уходят шаги после дробления и мысли, которые
 * пришли во время сессии. Только на устройстве (localStorage), как вся память Напарника. Ничего не сгорает и не
 * помечается «просрочено»: у дела есть только сделанные и следующие шаги.
 */
export type DealStep = { text: string; minutes?: number; done?: boolean }
/** Часть дня вместо часов (у Tiimo: ANYTIME / MORNING / DAY / EVENING). Точного времени у дела нет: поминутный план
 *  у них же главная жалоба («отстаю и бросаю»), а «когда угодно» ничего не просрочивает */
export type DayPart = 'any' | 'morning' | 'day' | 'evening'
export const DAY_PARTS: { key: DayPart; label: string; short: string }[] = [
  { key: 'any', label: 'Когда угодно', short: 'Любое' },
  { key: 'morning', label: 'Утро', short: 'Утро' },
  { key: 'day', label: 'День', short: 'День' },
  { key: 'evening', label: 'Вечер', short: 'Вечер' },
]
export type Deal = {
  id: string
  title: string
  steps: DealStep[]
  createdAt: number
  when?: DayPart
  /** «Оценить» нажато: у дела и у шагов показано время (как у goblin.tools — по запросу, а не всегда) */
  estimated?: boolean
}
/** Карточка после сессии (у Shimmer — «Win / Action / Insight»): что получилось, что дальше, что понял */
export type WinCard = { id: string; at: number; win: string; next?: string; insight?: string; minutes?: number }
export type Thought = { id: string; text: string; at: number }

const DEALS_KEY = 'naparnik:deals'
const THOUGHTS_KEY = 'naparnik:thoughts'
const CARDS_KEY = 'naparnik:cards'
const EVENT = 'naparnik:memory'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* приватный режим — дела живут до перезагрузки */
  }
}
const uid = () => Math.random().toString(36).slice(2, 10)
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function getDeals(): Deal[] {
  const d = read<Deal[]>(DEALS_KEY, [])
  return Array.isArray(d) ? d.filter((x) => x && typeof x.title === 'string' && Array.isArray(x.steps)) : []
}

/** Положить дело (или обновить шаги у дела с тем же названием). Шаги уже сделанные — сохраняются. */
export function upsertDeal(title: string, steps: DealStep[] = []): Deal {
  const deals = getDeals()
  const found = deals.find((d) => same(d.title, title))
  if (found) {
    const done = found.steps.filter((s) => s.done)
    const fresh = steps.filter((s) => !done.some((d) => same(d.text, s.text)))
    found.steps = [...done, ...fresh]
    write(DEALS_KEY, deals)
    return found
  }
  const deal: Deal = { id: uid(), title: title.trim(), steps, createdAt: Date.now() }
  write(DEALS_KEY, [deal, ...deals])
  return deal
}

/** Шаг сделан (или начат и засчитан): отмечаем в любом деле, где он есть */
export function markStepDone(step: string) {
  const deals = getDeals()
  let changed = false
  for (const d of deals)
    for (const s of d.steps)
      if (!s.done && same(s.text, step)) {
        s.done = true
        changed = true
      }
  if (changed) write(DEALS_KEY, deals)
}

export function nextStepOf(deal: Deal): DealStep | null {
  return deal.steps.find((s) => !s.done) ?? null
}

/** Следующий шаг того же дела, к которому относится только что сделанный шаг */
export function nextAfter(step: string): { deal: Deal; step: DealStep } | null {
  for (const d of getDeals()) {
    if (d.steps.some((s) => same(s.text, step))) {
      const n = nextStepOf(d)
      return n ? { deal: d, step: n } : null
    }
  }
  return null
}

export function removeDeal(id: string) {
  write(DEALS_KEY, getDeals().filter((d) => d.id !== id))
}

export function getThoughts(): Thought[] {
  const t = read<Thought[]>(THOUGHTS_KEY, [])
  return Array.isArray(t) ? t : []
}
export function addThought(text: string) {
  const clean = text.trim().slice(0, 200)
  if (!clean) return
  write(THOUGHTS_KEY, [{ id: uid(), text: clean, at: Date.now() }, ...getThoughts()])
}
export function removeThought(id: string) {
  write(THOUGHTS_KEY, getThoughts().filter((t) => t.id !== id))
}

/** «Свалка» с Дома: несколько дел через запятую, точку с запятой или новую строку */
export function splitDump(text: string): string[] {
  return text
    // запятая, точка с запятой, перенос, точка между фразами и связки «ещё», «потом», «а также», «плюс»
    .split(/[,;\n]+|\.\s+|\s+(?:и\s+)?(?:ещё|еще|потом|а также|плюс)\s+/i)
    .map((s) => s.replace(/^(?:и|надо|нужно|мне надо|мне нужно)\s+/i, '').trim())
    // с заглавной буквы: в списке дел «отчёт» и «Курсовая» рядом выглядят как разные сорта записей
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .filter((s) => s.length >= 2)
    .slice(0, 8)
}


export function setDealWhen(id: string, when: DayPart) {
  const deals = getDeals()
  const d = deals.find((x) => x.id === id)
  if (!d) return
  d.when = when
  write(DEALS_KEY, deals)
}

/** Отметить или снять шаг руками (лента дня): возвращает, стал ли шаг сделанным */
export function toggleStep(id: string, index: number): boolean {
  const deals = getDeals()
  const st = deals.find((x) => x.id === id)?.steps[index]
  if (!st) return false
  st.done = !st.done
  write(DEALS_KEY, deals)
  return Boolean(st.done)
}

/** «Оценить»: время шагам. Уже стоящее у шага время не трогаем (оно из готового плана), дописываем только пустое */
export function setDealEstimate(id: string, minutes: (number | undefined)[]) {
  const deals = getDeals()
  const d = deals.find((x) => x.id === id)
  if (!d) return
  d.steps.forEach((st, i) => {
    const m = minutes[i]
    if (!st.minutes && typeof m === 'number' && m > 0) st.minutes = Math.round(m)
  })
  d.estimated = true
  write(DEALS_KEY, deals)
}

/** Время всего дела — все шаги, и сделанные тоже: «сколько это дело занимает» (как у goblin.tools) */
export function dealTotalMinutes(deal: Deal): number {
  return deal.steps.reduce((a, s) => a + (s.minutes ?? 0), 0)
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10
  const m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}
/** «1 шаг», «3 шага», «7 шагов» */
export const stepsCount = (n: number) => `${n} ${plural(n, 'шаг', 'шага', 'шагов')}`

/** «2 минуты», «1 час 57 минут», «3 дня и 8 часов» — как подписи goblin.tools, только по-русски */
export function formatDuration(min: number): string {
  const m = Math.max(1, Math.round(min))
  if (m < 60) return `${m} ${plural(m, 'минута', 'минуты', 'минут')}`
  const days = Math.floor(m / 1440)
  if (days > 0) {
    const h = Math.round((m - days * 1440) / 60)
    const d = `${days} ${plural(days, 'день', 'дня', 'дней')}`
    return h ? `${d} и ${h} ${plural(h, 'час', 'часа', 'часов')}` : d
  }
  const h = Math.floor(m / 60)
  const rest = m - h * 60
  const hs = `${h} ${plural(h, 'час', 'часа', 'часов')}`
  return rest ? `${hs} ${rest} ${plural(rest, 'минута', 'минуты', 'минут')}` : hs
}

/** Коротко для узких подписей (Фокус, «Готовые шаги»): «45 мин», «1 ч 30 мин», «2 дн» */
export function shortDuration(min: number): string {
  const m = Math.max(1, Math.round(min))
  if (m < 60) return `${m} мин`
  if (m < 1440) {
    const h = Math.floor(m / 60)
    const rest = m - h * 60
    return rest ? `${h} ч ${rest} мин` : `${h} ч`
  }
  const d = Math.floor(m / 1440)
  const h = Math.round((m - d * 1440) / 60)
  return h ? `${d} дн ${h} ч` : `${d} дн`
}

/** Свои готовые дела («Сохранить как готовое дело» в «Делах»): лежат на устройстве и встают первыми в «Готовых шагах» */
const MINE_KEY = 'naparnik:my-ready'
export type MyReady = { key: string; title: string; icon: string; steps: { text: string; minutes: number }[] }
export function getMyReady(): MyReady[] {
  const v = read<MyReady[]>(MINE_KEY, [])
  return Array.isArray(v) ? v.filter((x) => x && typeof x.title === 'string' && Array.isArray(x.steps) && x.steps.length > 0) : []
}
export function saveMyReady(deal: Deal): boolean {
  if (!deal.steps.length) return false
  const item: MyReady = {
    key: `mine-${uid()}`,
    title: deal.title,
    icon: dealIcon(deal.title),
    steps: deal.steps.map((s) => ({ text: s.text, minutes: s.minutes ?? 0 })),
  }
  // то же название — заменяем: последняя версия плана важнее
  write(MINE_KEY, [item, ...getMyReady().filter((x) => !same(x.title, deal.title))].slice(0, 40))
  return true
}
export function isMyReady(title: string): boolean {
  return getMyReady().some((x) => same(x.title, title))
}

export function dealMinutes(deal: Deal): number {
  return deal.steps.filter((s) => !s.done).reduce((a, s) => a + (s.minutes ?? 0), 0)
}

/** Иконка дела по словам названия (у Tiimo ИИ подбирает эмодзи и ошибается — у нас простой словарь и общий запасной значок) */
const ICON_WORDS: [string, RegExp][] = [
  ['utensils', /посуд|готов|ужин|обед|завтрак|кухн|еда|еду/],
  ['bath', /ванн|душ|туалет|раковин/],
  ['shirt', /стир|бель|одежд|вещи|глад/],
  ['sofa', /комнат|убор|убрат|пылесос|порядок|разобрать шкаф|стол/],
  ['trash', /мусор/],
  ['mail', /почт|письм|ответить|написать|сообщен|email/],
  ['phone', /позвон|звон|созвон/],
  ['book', /экзамен|учеб|учёб|конспект|лекци|билет|читать|домашк|реферат/],
  ['grad', /курсов|диплом|диссер/],
  ['file', /отч[её]т|документ|резюме|договор|текст|стать/],
  ['slides', /презентац|слайд/],
  ['stethoscope', /врач|поликлин|анализ|стоматолог|зубн/],
  ['landmark', /госуслуг|мфц|паспорт|заявлен|справк/],
  ['receipt', /налог|вычет|чек|деклар/],
  ['wallet', /оплат|счет|счёт|банк|деньг|перевод|кварт/],
  ['cart', /купить|магазин|продукт|заказ/],
  ['paw', /кот|кошк|собак|корм|ветеринар/],
  ['dumbbell', /спорт|зал|трениров|пробеж|зарядк/],
]
export function dealIcon(title: string): string {
  const t = title.toLowerCase()
  return ICON_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'spark'
}

export function getCards(): WinCard[] {
  const c = read<WinCard[]>(CARDS_KEY, [])
  return Array.isArray(c) ? c.filter((x) => x && typeof x.win === 'string') : []
}
export function addCard(card: Omit<WinCard, 'id' | 'at'>): WinCard {
  const full: WinCard = { ...card, id: uid(), at: Date.now() }
  write(CARDS_KEY, [full, ...getCards()].slice(0, 30))
  return full
}
export function updateCard(id: string, patch: Partial<WinCard>) {
  write(CARDS_KEY, getCards().map((c) => (c.id === id ? { ...c, ...patch } : c)))
}

/** «1 дело», «3 дела», «20 дел» */
export function dealsCount(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? "дело" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "дела" : "дел";
  return `${n} ${word}`;
}
