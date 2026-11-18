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
export type Deal = { id: string; title: string; steps: DealStep[]; createdAt: number; when?: DayPart }
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
