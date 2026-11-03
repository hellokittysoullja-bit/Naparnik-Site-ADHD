import { SPHERES, STEPS, FIRST_MINUTES, type Sphere } from '@/lib/onboarding'
import type { Store, TgUser, Tone } from './store'

/**
 * Логика бота «Напарник» без сети: на вход апдейт Telegram, на выход вызовы API через `send`. Так её можно
 * проверить тестами, а маршруты /api/tg и /api/tg/tick только подставляют настоящие хранилище и Telegram.
 *
 * Правила (research/07–08, CLAUDE.md §1 и §3):
 * - голос кота: тепло, без стыда, без «ты пропустил» и «серия сгорела»; в первой строке напоминания
 *   (её видно на экране блокировки) нет слов боли;
 * - не больше одного напоминания в день, в выбранный человеком час, ночью (22–9) тишина;
 * - без ответа бот пишет реже: после 3 подряд — раз в 3 дня, после 7 — раз в неделю; через 21 день тишины
 *   прощается и молчит, пока человек сам не напишет;
 * - «Пауза на неделю» и «Стоп» — одной кнопкой под каждым напоминанием.
 */

export type Send = (method: string, body: Record<string, unknown>) => Promise<unknown>
export type Breakdown = (task: string) => Promise<{ steps: string[]; fallback: boolean }>

export type Deps = {
  store: Store
  send: Send
  now: () => number
  /** https://adhd-naparnik.vercel.app — для ссылок «Сесть рядом» */
  site: string
  breakdown: Breakdown
  /** Подпись ссылки «Сесть рядом» (lib/tg/telegram.ts) */
  sign: (value: string) => string
}

type Button = { text: string; callback_data?: string; url?: string }
type Keyboard = Button[][]

export type TgUpdate = {
  message?: { chat: { id: number; type?: string }; text?: string; from?: { first_name?: string } }
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } }
}

const DAY = 86_400_000
const MSK = 180
/** Можно звать с 9 до 21 по местному времени: тихие часы 22–9 */
export const HOUR_MIN = 9
export const HOUR_MAX = 21
const PROMPT_HOURS = [9, 13, 19]

export function newUser(id: number, now: number): TgUser {
  return { id, createdAt: now, tz: MSK, ignored: 0, lastActive: now, variant: 0 }
}

/** Местный час для смещения tz (минуты) */
function localHour(ms: number, tz: number) {
  return new Date(ms + tz * 60_000).getUTCHours()
}

/** Следующее «часа H» по местному времени строго после `from`, плюс (days − 1) суток */
export function nextAt(hour: number, tz: number, from: number, days = 1): number {
  const local = new Date(from + tz * 60_000)
  let at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour) - tz * 60_000
  if (at <= from) at += DAY
  return at + (days - 1) * DAY
}

/** Реже, если не отвечает: 1 → 3 → 7 дней */
export function intervalDays(ignored: number) {
  return ignored >= 7 ? 7 : ignored >= 3 ? 3 : 1
}

/** «14:30» → смещение от UTC в минутах, с шагом 30 минут; null, если не похоже на время */
export function parseLocalTime(text: string, now: number): number | null {
  const m = text.trim().match(/^(\d{1,2})[:.\s](\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  const utc = new Date(now)
  let diff = h * 60 + min - (utc.getUTCHours() * 60 + utc.getUTCMinutes())
  if (diff > 14 * 60) diff -= 24 * 60
  if (diff < -12 * 60) diff += 24 * 60
  return Math.round(diff / 30) * 30
}

export function tzLabel(tz: number) {
  if (tz === MSK) return 'по Москве'
  const sign = tz >= 0 ? '+' : '−'
  const a = Math.abs(tz)
  return `по твоему времени (UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''})`
}

const hh = (h: number) => `${h}:00`

// ——— тексты ———

export const T = {
  hello:
    'Мяу. Я Напарник — кот, который сидит рядом, пока ты делаешь что-то маленькое. Без стыда и без серий, которые сгорают.\n\nЧто сейчас висит? Нажми или напиши своими словами.',
  helloBack: 'Мяу, ты вернулся — засчитано. Что сейчас висит? Нажми или напиши своими словами.',
  step: (step: string) => `Самый маленький шаг: «${step}».\nДве минуты. Я рядом.`,
  stepFromTask: (task: string, step: string) => `Разломал «${task}». Первый кусочек: «${step}».\nДве минуты. Я рядом.`,
  thinking: 'Секунду — ломаю на кусочки…',
  askRemind:
    'Хочешь, буду звать тебя раз в день? Одно сообщение, в то время, которое выберешь. Выключить можно в любой момент.',
  remindSet: (h: number, tz: number) =>
    `Договорились: напишу в ${hh(h)} ${tzLabel(tz)}. Живёшь в другом часовом поясе — напиши, сколько у тебя сейчас, например 14:30.`,
  askHour: `Напиши час, когда звать, — от ${HOUR_MIN} до ${HOUR_MAX}. Например: 8 не подойдёт, а 9 или 20 — да.`,
  badHour: `Мне нужен час от ${HOUR_MIN} до ${HOUR_MAX} — ночью не беспокою. Например: 10.`,
  noRemind: 'Хорошо, без напоминаний. Захочешь — /remind.',
  askTone: 'И последнее: как мне с тобой говорить?',
  toneSet: { soft: 'Принято. Буду мягко.', short: 'Принято. Коротко.', humor: 'Принято. Без шуток не обойдётся.' } as Record<Tone, string>,
  timeSet: (tz: number) => `Понял, время ${tzLabel(tz)}.`,
  badTime: 'Не понял время. Напиши так: 14:30.',
  skip: 'Принято. Остров никуда не денется.',
  pause: (until: string) => `Пауза до ${until}. Потом напишу сам — или раньше, если позовёшь.`,
  stop: 'Больше не пишу. Захочешь вернуть — /remind.',
  farewell: 'Я замолчу, чтобы не мешать. Напиши «привет», когда захочешь, — остров ждёт.',
  help:
    'Я помогаю начать дело за 2 минуты.\n\nНапиши, что висит, — разломаю на маленький шаг.\n/step — новый шаг\n/remind — когда звать\n/tone — как говорить\n/time — твой часовой пояс\n/pause — пауза на неделю\n/stop — без напоминаний',
  timeAsk: 'Сколько у тебя сейчас времени? Напиши, например, 14:30.',
}

/** Напоминания: первая строка нейтральная (экран блокировки), вариант меняется по кругу — новизна */
const REMIND: Record<Tone, ((step: string, greet: string) => string)[]> = {
  soft: [
    (s, g) => `${g}. Я тут.\n2 минуты на «${s}»?`,
    (s, g) => `${g}. Посидим рядом пару минут?\nШаг: «${s}».`,
    (s) => `Я у костра.\nЕсли есть 2 минуты — «${s}».`,
  ],
  short: [(s) => `2 минуты: «${s}»?`, (s) => `Шаг: «${s}». Начнём?`, (s) => `Кот на месте. «${s}» — 2 минуты.`],
  humor: [
    (s) => `Кот разжёг костёр и делает вид, что не ждёт.\n«${s}» — 2 минуты?`,
    (s) => `Минутка славы для «${s}»?\nДве минуты — и я отстану.`,
    (s) => `Мур. План на сегодня: «${s}», 2 минуты.\nПодпись: кот.`,
  ],
}

function greeting(hour: number) {
  return hour < 12 ? 'Утро' : hour < 17 ? 'День' : 'Вечер'
}

export function reminderText(u: TgUser, now: number) {
  const list = REMIND[u.tone ?? 'soft']
  return list[u.variant % list.length](currentStep(u), greeting(localHour(now, u.tz)))
}

function currentStep(u: TgUser) {
  return u.steps?.[u.stepIdx ?? 0] ?? (u.sphere ? STEPS[u.sphere][0] : STEPS.unsure[0])
}

// ——— клавиатуры ———

function sphereKeyboard(): Keyboard {
  const rows: Keyboard = []
  for (let i = 0; i < SPHERES.length; i += 2) {
    rows.push(SPHERES.slice(i, i + 2).map((s) => ({ text: s.label, callback_data: `sp:${s.key}` })))
  }
  return rows
}

function goUrl(d: Deps, u: TgUser) {
  const step = currentStep(u).slice(0, 120)
  const q = new URLSearchParams({ c: String(u.id), t: d.sign(String(u.id)), s: step })
  return `${d.site}/api/tg/go?${q.toString()}`
}

function stepKeyboard(d: Deps, u: TgUser): Keyboard {
  return [[{ text: 'Сесть рядом →', url: goUrl(d, u) }], [{ text: 'Другой шаг', callback_data: 'nx' }]]
}

function remindKeyboard(): Keyboard {
  return [
    PROMPT_HOURS.map((h) => ({ text: `${h < 12 ? 'Утро' : h < 17 ? 'День' : 'Вечер'} · ${hh(h)}`, callback_data: `rm:${h}` })),
    [
      { text: 'Своё время', callback_data: 'rm:own' },
      { text: 'Не надо', callback_data: 'rm:none' },
    ],
  ]
}

function toneKeyboard(): Keyboard {
  return [[
    { text: 'Мягко', callback_data: 'tone:soft' },
    { text: 'Коротко', callback_data: 'tone:short' },
    { text: 'С юмором', callback_data: 'tone:humor' },
  ]]
}

function reminderKeyboard(d: Deps, u: TgUser): Keyboard {
  return [
    [
      { text: 'Сесть рядом →', url: goUrl(d, u) },
      { text: 'Не сегодня', callback_data: 'skip' },
    ],
    [
      { text: 'Пауза на неделю', callback_data: 'pause' },
      { text: 'Стоп', callback_data: 'stop' },
    ],
  ]
}

const say = (d: Deps, chat: number, text: string, keyboard?: Keyboard) =>
  d.send('sendMessage', { chat_id: chat, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) })

// ——— состояние ———

/** Любой ответ человека: снова «живой», счётчик молчания обнуляется, прощание отменяется */
function touch(u: TgUser, now: number) {
  u.lastActive = now
  u.ignored = 0
  u.quiet = false
}

async function reschedule(d: Deps, u: TgUser) {
  const now = d.now()
  if (u.stopped || u.quiet || u.hour == null) return d.store.schedule(u.id, null)
  const from = u.pausedUntil && u.pausedUntil > now ? u.pausedUntil : now
  return d.store.schedule(u.id, nextAt(u.hour, u.tz, from, intervalDays(u.ignored)))
}

async function offerStep(d: Deps, u: TgUser, text: string) {
  await say(d, u.id, text, stepKeyboard(d, u))
  if (u.hour === undefined) await say(d, u.id, T.askRemind, remindKeyboard())
}

const SOURCE = /^[A-Za-z0-9_-]{1,64}$/

// ——— обработка апдейта ———

export async function handleUpdate(update: TgUpdate, d: Deps): Promise<void> {
  const chat = update.callback_query?.message?.chat.id ?? update.message?.chat.id
  if (update.callback_query) await onCallback(update.callback_query, d)
  else await onMessage(update.message, d)
  // человек откликнулся — следующее напоминание снова через сутки (а не через 3–7 дней «редкого» режима)
  const u = chat ? await d.store.getUser(chat) : null
  if (u) await reschedule(d, u)
}

async function onMessage(msg: TgUpdate['message'], d: Deps): Promise<void> {
  if (!msg || (msg.chat.type && msg.chat.type !== 'private')) return
  const chat = msg.chat.id
  const now = d.now()
  const text = (msg.text ?? '').trim()
  let u = await d.store.getUser(chat)
  const isNew = !u
  u ??= newUser(chat, now)

  if (text.startsWith('/start')) {
    const payload = text.slice(6).trim()
    if (isNew && SOURCE.test(payload)) {
      u.src = payload
      await d.store.countSource(payload)
    }
    touch(u, now)
    u.awaiting = null
    await d.store.saveUser(u)
    await say(d, chat, isNew ? T.hello : T.helloBack, sphereKeyboard())
    return
  }

  touch(u, now)
  const cmd = text.split(/\s+/)[0].toLowerCase()

  if (cmd === '/step') {
    u.awaiting = null
    await d.store.saveUser(u)
    await say(d, chat, 'Что сейчас висит? Нажми или напиши своими словами.', sphereKeyboard())
  } else if (cmd === '/remind') {
    u.stopped = false
    await d.store.saveUser(u)
    await say(d, chat, T.askRemind, remindKeyboard())
  } else if (cmd === '/tone') {
    await d.store.saveUser(u)
    await say(d, chat, 'Как мне с тобой говорить?', toneKeyboard())
  } else if (cmd === '/time') {
    u.awaiting = 'time'
    await d.store.saveUser(u)
    await say(d, chat, T.timeAsk)
  } else if (cmd === '/pause') {
    await pause(d, u)
  } else if (cmd === '/stop' || /^(стоп|хватит|отпишись)$/i.test(text)) {
    await stop(d, u)
  } else if (cmd === '/help') {
    await d.store.saveUser(u)
    await say(d, chat, T.help)
  } else if (u.awaiting === 'time') {
    const tz = parseLocalTime(text, now)
    if (tz === null) {
      await d.store.saveUser(u)
      await say(d, chat, T.badTime)
      return
    }
    u.tz = tz
    u.awaiting = null
    await d.store.saveUser(u)
    await reschedule(d, u)
    await say(d, chat, T.timeSet(tz))
  } else if (u.awaiting === 'hour') {
    const h = Number(text.replace(/[^\d]/g, ''))
    if (!Number.isInteger(h) || h < HOUR_MIN || h > HOUR_MAX || !/\d/.test(text)) {
      await d.store.saveUser(u)
      await say(d, chat, T.badHour)
      return
    }
    u.awaiting = null
    await setHour(d, u, h)
  } else if (parseLocalTime(text, now) !== null && u.hour != null) {
    // «14:30» сразу после «напишу в 9:00 по Москве» — это поправка часового пояса
    u.tz = parseLocalTime(text, now)!
    await d.store.saveUser(u)
    await reschedule(d, u)
    await say(d, chat, T.timeSet(u.tz))
  } else if (text.length >= 2 && !text.startsWith('/')) {
    // Любой другой текст — это дело: ломаем на шаги (то же дробление, что на сайте)
    await d.send('sendChatAction', { chat_id: chat, action: 'typing' })
    const task = text.slice(0, 120)
    const { steps } = await d.breakdown(task)
    u.task = task
    u.steps = steps
    u.stepIdx = 0
    await d.store.saveUser(u)
    await offerStep(d, u, T.stepFromTask(task, steps[0]))
  } else {
    await d.store.saveUser(u)
    await say(d, chat, T.help)
  }
}

async function setHour(d: Deps, u: TgUser, h: number) {
  const askTone = u.tone === undefined
  u.hour = h
  u.stopped = false
  await d.store.saveUser(u)
  await reschedule(d, u)
  await say(d, u.id, T.remindSet(h, u.tz))
  if (askTone) await say(d, u.id, T.askTone, toneKeyboard())
}

async function pause(d: Deps, u: TgUser) {
  const now = d.now()
  u.pausedUntil = now + 7 * DAY
  await d.store.saveUser(u)
  await reschedule(d, u)
  const until = new Date(u.pausedUntil + u.tz * 60_000)
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
  await say(d, u.id, T.pause(`${until.getUTCDate()} ${months[until.getUTCMonth()]}`))
}

async function stop(d: Deps, u: TgUser) {
  u.stopped = true
  await d.store.saveUser(u)
  await d.store.schedule(u.id, null)
  await say(d, u.id, T.stop)
}

async function onCallback(q: NonNullable<TgUpdate['callback_query']>, d: Deps) {
  // кнопка всегда «отпускается», даже если дальше что-то пойдёт не так
  await d.send('answerCallbackQuery', { callback_query_id: q.id })
  const chat = q.message?.chat.id
  if (!chat) return
  const now = d.now()
  const u = (await d.store.getUser(chat)) ?? newUser(chat, now)
  touch(u, now)
  const data = q.data ?? ''

  if (data.startsWith('sp:')) {
    const sphere = data.slice(3) as Sphere
    if (!STEPS[sphere]) return
    u.sphere = sphere
    u.task = undefined
    u.steps = STEPS[sphere]
    u.stepIdx = 0
    await d.store.saveUser(u)
    await offerStep(d, u, T.step(u.steps[0]))
  } else if (data === 'nx') {
    const steps = u.steps ?? STEPS[u.sphere ?? 'unsure']
    u.steps = steps
    u.stepIdx = ((u.stepIdx ?? 0) + 1) % steps.length
    await d.store.saveUser(u)
    await say(d, chat, T.step(steps[u.stepIdx]), stepKeyboard(d, u))
  } else if (data.startsWith('rm:')) {
    const v = data.slice(3)
    if (v === 'none') {
      u.hour = null
      await d.store.saveUser(u)
      await reschedule(d, u)
      await say(d, chat, T.noRemind)
    } else if (v === 'own') {
      u.awaiting = 'hour'
      await d.store.saveUser(u)
      await say(d, chat, T.askHour)
    } else {
      const h = Number(v)
      if (h >= HOUR_MIN && h <= HOUR_MAX) await setHour(d, u, h)
    }
  } else if (data.startsWith('tone:')) {
    const tone = data.slice(5) as Tone
    if (!(tone in T.toneSet)) return
    u.tone = tone
    await d.store.saveUser(u)
    await say(d, chat, T.toneSet[tone])
  } else if (data === 'skip') {
    await d.store.saveUser(u)
    await reschedule(d, u)
    await say(d, chat, T.skip)
  } else if (data === 'pause') {
    await pause(d, u)
  } else if (data === 'stop') {
    await stop(d, u)
  }
}

/** Клик «Сесть рядом»: человек откликнулся — считаем его активным. Вернёт адрес сессии. */
export async function onGo(d: Deps, chatId: number, step: string): Promise<string> {
  const u = await d.store.getUser(chatId)
  if (u) {
    touch(u, d.now())
    u.clicks = (u.clicks ?? 0) + 1
    await d.store.saveUser(u)
    await reschedule(d, u)
  }
  const q = new URLSearchParams({ step: step.slice(0, 120), d: String(FIRST_MINUTES), src: 'tg' })
  return `${d.site}/app/session?${q.toString()}`
}

/** Раз в 15 минут (QStash): разослать тем, кому пора. Возвращает, сколько сообщений ушло. */
export async function tick(d: Deps, limit = 100): Promise<number> {
  const now = d.now()
  let sent = 0
  for (const id of await d.store.due(now, limit)) {
    const u = await d.store.getUser(id)
    if (!u || u.stopped || u.quiet || u.hour == null) {
      await d.store.schedule(id, null)
      continue
    }
    if (now - u.lastActive >= 21 * DAY) {
      u.quiet = true
      await d.store.saveUser(u)
      await d.store.schedule(id, null)
      await say(d, id, T.farewell)
      sent++
      continue
    }
    await say(d, id, reminderText(u, now), reminderKeyboard(d, u))
    u.ignored += 1
    u.lastSent = now
    u.variant += 1
    await d.store.saveUser(u)
    await d.store.schedule(id, nextAt(u.hour, u.tz, now, intervalDays(u.ignored)))
    sent++
  }
  return sent
}
