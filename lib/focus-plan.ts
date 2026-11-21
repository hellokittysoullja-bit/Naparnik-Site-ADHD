/**
 * Открытая разбивка в Фокусе (владелец 21.11: «обновил страницу — остался тот же экран, без анимации»).
 *
 * В адресе только метка `?view=plan` (как id документа у Google Docs и Notion): сами шаги — слова человека, им не место
 * в ссылке (уходят в историю браузера, в превью, к тому, кому ссылку переслали). Содержимое лежит на устройстве, рядом с
 * остальной памятью. Разбивка живёт, пока человек не ушёл с неё назад, не начал по ней сессию или не прошли сутки.
 */
export type FocusPlanStep = { text: string; minutes?: number; wait?: boolean }
export type FocusPlan = { title: string; steps: FocusPlanStep[]; task: string; receipt?: string | null; at: number }

const KEY = 'naparnik:focusPlan'
const TTL_MS = 24 * 60 * 60 * 1000
const MAX_STEPS = 40
const MAX_TEXT = 300

function isStep(s: unknown): s is FocusPlanStep {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  return (
    typeof o.text === 'string' &&
    o.text.trim().length > 0 &&
    o.text.length <= MAX_TEXT &&
    (o.minutes === undefined || (typeof o.minutes === 'number' && Number.isFinite(o.minutes) && o.minutes > 0)) &&
    (o.wait === undefined || typeof o.wait === 'boolean')
  )
}

/** запись проверяется целиком: битая или чужая форма — разбивки нет, экран открывается как обычно */
export function parseFocusPlan(raw: unknown, now = Date.now()): FocusPlan | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.title !== 'string' || !o.title.trim() || o.title.length > MAX_TEXT) return null
  if (typeof o.task !== 'string' || !o.task.trim() || o.task.length > MAX_TEXT) return null
  if (typeof o.at !== 'number' || !Number.isFinite(o.at) || now - o.at > TTL_MS || o.at - now > 60_000) return null
  if (!Array.isArray(o.steps) || !o.steps.length || o.steps.length > MAX_STEPS || !o.steps.every(isStep)) return null
  const receipt = typeof o.receipt === 'string' && o.receipt.length <= MAX_TEXT ? o.receipt : null
  return { title: o.title, task: o.task, steps: o.steps as FocusPlanStep[], receipt, at: o.at }
}

export function readFocusPlan(): FocusPlan | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? parseFocusPlan(JSON.parse(raw)) : null
  } catch {
    // Safari с блокировкой хранилища бросает SecurityError — просто нет разбивки
    return null
  }
}

export function saveFocusPlan(plan: Omit<FocusPlan, 'at'>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...plan, at: Date.now() }))
  } catch {
    /* хранилище недоступно или полно — экран работает и без сохранения */
  }
}

export function clearFocusPlan(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* нечего чистить */
  }
}
