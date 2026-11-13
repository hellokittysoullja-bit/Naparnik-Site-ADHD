import { SPHERES, STEPS, FIRST_MINUTES, type Sphere } from '@/lib/onboarding'
import { linkCode } from './link'
import { HISTORY_MAX, HISTORY_TTL_MS, LINK_TTL_S, type LinkPayload, type Store, type TgUser, type Tone } from './store'

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
/** care — в поле дела кризисный текст: вместо шагов проверенный бережный ответ обвязки */
export type Breakdown = (task: string) => Promise<{ steps: string[]; fallback: boolean; care?: string }>

/** Реплика кота на свободный текст (обвязка lib/ai): текст, кнопка старта, согласованный план */
export type CatReply = {
  text: string
  startFocus?: { firstStep: string; minutes?: number }
  plan?: { task: string; firstStep: string; startTime?: string }
}
/** null — модели не ответили: бот отвечает по правилам без ИИ (дробление, заготовки) */
export type Converse = (u: TgUser, text: string) => Promise<CatReply | null>

export type Deps = {
  store: Store
  send: Send
  now: () => number
  /** https://adhd-naparnik.vercel.app — для ссылок «Сесть рядом» */
  site: string
  breakdown: Breakdown
  /** разговор с котом через обвязку; без него бот работает по правилам */
  converse?: Converse
  /** Подпись ссылки «Сесть рядом» (lib/tg/telegram.ts) */
  sign: (value: string) => string
}

type Button = { text: string; callback_data?: string; url?: string }
type Keyboard = Button[][]

export type TgUpdate = {
  update_id?: number
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

// Голос кота (правила владельца 12.11): без тире, без рода, по-разговорному
export const T = {
  hello:
    'Приветик. Я Напарник, кот, который сидит рядом, пока ты делаешь что-то маленькое. Без стыда и без серий, которые сгорают.\n\nЧто сейчас висит? Нажми или напиши своими словами.',
  helloBack: 'О, привет-привет! Что сейчас висит? Нажми или напиши своими словами.',
  step: (step: string) => `Самый маленький шаг: «${step}».\nДве минуты. Я рядом.`,
  stepFromTask: (task: string, step: string) => `Разломал «${task}». Первый кусочек: «${step}».\nДве минуты. Я рядом.`,
  thinking: 'Секунду, ломаю на кусочки…',
  askRemind:
    'Хочешь, буду звать тебя раз в день? Одно сообщение, в то время, которое выберешь. Выключить можно в любой момент.',
  remindSet: (h: number, tz: number) =>
    `Договорились: напишу в ${hh(h)} ${tzLabel(tz)}. Если у тебя другой часовой пояс, жми /time.`,
  askHour: `Напиши час, когда звать, от ${HOUR_MIN} до ${HOUR_MAX}. Например, 10 или 20.`,
  badHour: `Мне нужен час от ${HOUR_MIN} до ${HOUR_MAX}: ночью не беспокою. Например, 10. Или выбери кнопкой: /remind.`,
  noRemind: 'Хорошо, без напоминаний. Захочешь вернуть, жми /remind.',
  askTone: 'И последнее: как мне с тобой говорить?',
  toneSet: { soft: 'Принято. Буду мягко.', short: 'Принято. Коротко.', humor: 'Принято. Без шуток не обойдётся.' } as Record<Tone, string>,
  timeSet: (tz: number) => `Понял, время ${tzLabel(tz)}.`,
  badTime: 'Не понял время. Напиши так: 14:30.',
  skip: 'Принято. Остров никуда не денется.',
  pause: (until: string) => `Пауза до ${until}. Потом напишу сам, или раньше, если позовёшь.`,
  stop: 'Больше не пишу. Захочешь вернуть, жми /remind.',
  farewell: 'Я замолчу, чтобы не мешать. Напиши «привет», когда захочешь. Остров ждёт.',
  help:
    'Я помогаю начать дело за 2 минуты.\n\nНапиши, что висит, и разломаю на маленький шаг.\n/step новый шаг\n/remind когда звать\n/tone как говорить\n/time твой часовой пояс\n/pause пауза на неделю\n/stop без напоминаний\n/unlink отвязать сайт\n/forget стереть всё, что я о тебе знаю',
  timeAsk: 'Сколько у тебя сейчас времени? Напиши, например, 14:30.',
  // привязка сайта (lib/tg/link.ts)
  linked: 'Готово, мы на связи: сайт и этот чат теперь вместе.',
  linkedPlan: (step: string, h: number, tz: number) => `Готово, мы на связи. Напишу в ${hh(h)} ${tzLabel(tz)} и позову на шаг «${step}».`,
  linkedStep: (step: string) => `Готово, мы на связи. Твой шаг: «${step}».`,
  linkExpired: 'Эта ссылка уже не работает: она живёт 15 минут и срабатывает один раз. Открой сайт и нажми «Напоминать в Telegram» ещё раз.',
  linkAsk: (step?: string) =>
    `Связать этот чат с сайтом, где открыт Напарник?${step ? ` Оттуда придёт шаг «${step}», и я буду звать на него.` : ''} Нажимай «Да», только если эту кнопку на сайте нажал ты сам.`,
  linkNo: 'Хорошо, не связываю. Здесь всё осталось как было.',
  unlinked: 'Готово, сайт отвязан: планы оттуда сюда больше не приходят. Напоминания выключает /stop.',
  notLinked: 'Этот чат и так не связан с сайтом.',
  planSaved: (step: string, h: number, tz: number) => `Записал. Напишу в ${hh(h)} ${tzLabel(tz)} и позову на шаг «${step}».`,
  planSavedNoHour: (step: string) => `Записал шаг «${step}». Скажи, во сколько позвать?`,
  forgotten: 'Готово, стёр всё, что знал: дело, шаг, время напоминаний и нашу переписку. Писать больше не буду. Захочешь начать заново, жми /start.',
  aiDown: 'Я на минутку отвлёкся на рыбалку. Напиши дело одной фразой, и разломаю его на шаги.',
}

/** Напоминания: первая строка нейтральная (экран блокировки), вариант меняется по кругу — новизна */
const REMIND: Record<Tone, ((step: string, greet: string) => string)[]> = {
  soft: [
    (s, g) => `${g}. Я тут.\n2 минуты на «${s}»?`,
    (s, g) => `${g}. Посидим рядом пару минут?\nШаг: «${s}».`,
    (s) => `Я у костра.\nЕсли есть 2 минуты, вот шаг: «${s}».`,
  ],
  short: [(s) => `2 минуты: «${s}»?`, (s) => `Шаг: «${s}». Начнём?`, (s) => `Кот на месте. «${s}», 2 минуты.`],
  humor: [
    (s) => `Кот разжёг костёр и делает вид, что не ждёт.\n«${s}», 2 минуты?`,
    (s) => `Минутка славы для «${s}»?\nДве минуты, и я отстану.`,
    (s) => `Мур. План на сегодня: «${s}», 2 минуты.\nПодпись: кот.`,
  ],
}

function greeting(hour: number) {
  return hour < 12 ? 'Утро' : hour < 17 ? 'День' : 'Вечер'
}

export function reminderText(u: TgUser, now: number) {
  const list = u.tone && Object.hasOwn(REMIND, u.tone) ? REMIND[u.tone] : REMIND.soft
  return list[u.variant % list.length](currentStep(u), greeting(localHour(now, u.tz)))
}

function currentStep(u: TgUser) {
  // план с сайта или из разговора важнее шагов по сфере: о нём человек договорился сам
  return u.plan?.firstStep ?? u.steps?.[u.stepIdx ?? 0] ?? (u.sphere ? STEPS[u.sphere][0] : STEPS.unsure[0])
}

const DAYPART = '(?:\\s*(утра|дня|вечера|ночи))?'
const CLOCK = new RegExp(`(?<![\\d.:])(\\d{1,2}):(\\d{2})(?![\\d:])${DAYPART}`, 'i')
const AT_HOUR = new RegExp(`(?<![\\p{L}\\d])(?:в|к|на)\\s+(\\d{1,2})(?:[.](\\d{2}))?(?![\\d.:])(?:\\s*(?:час(?:ов|а)?|ч\\.?))?${DAYPART}(?!\\s*(?:минут|мин\\b|секунд|дн|недел|январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр))`, 'iu')
const BARE_HOUR = new RegExp(`^\\s*(\\d{1,2})(?:[.](\\d{2}))?(?:\\s*(?:час(?:ов|а)?|ч\\.?))?${DAYPART}\\s*$`, 'i')

/**
 * «09:00», «завтра в 10», «в 9 вечера», «15.11 в 18:00» → час напоминания, если он в разрешённых пределах.
 * «10 минут», «через 2 часа», «после обеда», «в 10 вечера» (ночь) → null: бот переспросит, а не поставит час наугад.
 * Минуты отбрасываются: напоминание приходит в начале часа, и бот называет это время сам («напишу в 9:00»).
 */
export function hourOf(startTime: string | undefined): number | null {
  if (!startTime) return null
  const m = startTime.match(CLOCK) ?? startTime.match(AT_HOUR) ?? startTime.match(BARE_HOUR)
  if (!m) return null
  let h = Number(m[1])
  if (m[2] !== undefined && Number(m[2]) > 59) return null
  const part = m[3]?.toLowerCase()
  if (part === 'ночи') return null
  if (part === 'вечера' && h < 12) h += 12
  if (part === 'дня' && h <= 6) h += 12
  if (part === 'утра' && h >= 12) return null
  return h >= HOUR_MIN && h <= HOUR_MAX ? h : null
}

/** Свежая часть разговора с котом: не больше HISTORY_MAX реплик и не старше суток */
export function recentHistory(u: TgUser, now: number) {
  return (u.history ?? []).filter((h) => now - h.at < HISTORY_TTL_MS).slice(-HISTORY_MAX)
}

function remember(u: TgUser, who: 'user' | 'cat', text: string, now: number) {
  u.history = [...recentHistory(u, now), { who, text: text.slice(0, 600), at: now }].slice(-HISTORY_MAX)
}

/** План (с сайта или из разговора) → дело, шаг и, если время понятно, час напоминания */
export function applyPlan(u: TgUser, plan: { task?: string; firstStep?: string; startTime?: string }, opts: { resume?: boolean } = {}): number | null {
  if (!plan.firstStep) return null
  u.plan = { task: (plan.task ?? plan.firstStep).slice(0, 200), firstStep: plan.firstStep.slice(0, 160), startTime: plan.startTime?.slice(0, 40) }
  u.task = u.plan.task
  u.steps = undefined
  u.stepIdx = 0
  const hour = hourOf(plan.startTime)
  if (hour !== null) {
    u.hour = hour
    // «Стоп» и паузу снимает только сам человек в боте (привязка, разговор, /remind): план, молча присланный сайтом,
    // не вправе снова включить сообщения, которые человек выключил
    if (opts.resume !== false) {
      u.stopped = false
      u.pausedUntil = undefined
    }
  }
  return hour
}

/** «/start l_<код>»: чат связывается с устройством, план с сайта становится напоминанием */
async function link(d: Deps, u: TgUser, payload: LinkPayload) {
  // прежняя связь этого чата с другим устройством и прежний чат этого устройства больше ничего не значат
  if (u.device && u.device !== payload.device && (await d.store.chatOfDevice(u.device)) === u.id) await d.store.bindDevice(u.device, null)
  const prev = await d.store.chatOfDevice(payload.device)
  if (prev !== null && prev !== u.id) {
    const other = await d.store.getUser(prev)
    if (other?.device === payload.device) {
      other.device = undefined
      await d.store.saveUser(other)
    }
  }
  u.pendingLink = undefined
  u.device = payload.device
  if (typeof payload.tz === 'number' && Number.isFinite(payload.tz) && Math.abs(payload.tz) <= 14 * 60) u.tz = Math.round(payload.tz / 30) * 30
  const hour = applyPlan(u, payload)
  await d.store.saveUser(u)
  await d.store.bindDevice(payload.device, u.id)
  await reschedule(d, u)
  if (u.plan && hour !== null) return say(d, u.id, T.linkedPlan(u.plan.firstStep, hour, u.tz), stepKeyboard(d, u))
  if (u.plan) {
    await say(d, u.id, T.linkedStep(u.plan.firstStep), stepKeyboard(d, u))
    if (u.hour == null) await say(d, u.id, T.askRemind, remindKeyboard())
    return
  }
  await say(d, u.id, T.linked)
  if (u.hour == null) await say(d, u.id, T.askRemind, remindKeyboard())
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
  // у шага из плана «другого» нет: о нём человек договорился сам
  return u.plan ? [[{ text: 'Сесть рядом →', url: goUrl(d, u) }]] : [[{ text: 'Сесть рядом →', url: goUrl(d, u) }], [{ text: 'Другой шаг', callback_data: 'nx' }]]
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
  // без превью и без разметки: текст шага приходит от человека, бот не должен превращать его в карточку чужого сайта
  d.send('sendMessage', { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) })

// ——— состояние ———

/** Любой ответ человека: снова «живой», счётчик молчания обнуляется, прощание отменяется */
function touch(u: TgUser, now: number) {
  u.lastActive = now
  u.ignored = 0
  u.quiet = false
  u.history = recentHistory(u, now)
  if (u.pendingLink && now - u.pendingLink.at > LINK_TTL_S * 1000) u.pendingLink = undefined
}

export async function reschedule(d: Pick<Deps, 'store' | 'now'>, u: TgUser) {
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
  // Telegram повторяет апдейт, если не дождался ответа: второй раз тот же разговор не ведём
  if (typeof update.update_id === 'number' && (await d.store.seen(update.update_id))) return
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
    const code = linkCode(payload)
    if (code) {
      touch(u, now)
      u.awaiting = null
      const linkPayload = await d.store.takeLink(code)
      if (!linkPayload) {
        await d.store.saveUser(u)
        return void (await say(d, chat, T.linkExpired))
      }
      // новый чат связываем сразу; знакомый (есть дело, время или другое устройство) — только после «Да»: чужая
      // ссылка «открой бота» иначе молча подменила бы человеку шаг и забрала его напоминания себе
      if (isNew || u.device === linkPayload.device) return void (await link(d, u, linkPayload))
      u.pendingLink = { payload: linkPayload, at: now }
      await d.store.saveUser(u)
      return void (await say(d, chat, T.linkAsk(linkPayload.firstStep), [[
        { text: 'Да, связать', callback_data: 'lk:yes' },
        { text: 'Нет', callback_data: 'lk:no' },
      ]]))
    }
    if (isNew && SOURCE.test(payload)) {
      u.src = payload
      await d.store.countSource(payload)
    }
    touch(u, now)
    u.awaiting = null
    await d.store.saveUser(u)
    if (isNew) {
      // Первое знакомство — открытка с котом у костра (та же, что в превью ссылки на сайт): человек сразу видит,
      // кто с ним говорит. Не загрузилась картинка — то же приветствие текстом.
      const sent = await d.send('sendPhoto', {
        chat_id: chat,
        photo: `${d.site}/opengraph-image.png`,
        caption: T.hello,
        reply_markup: { inline_keyboard: sphereKeyboard() },
      })
      if (!sent) await say(d, chat, T.hello, sphereKeyboard())
    } else {
      await say(d, chat, T.helloBack, sphereKeyboard())
    }
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
    u.pausedUntil = undefined
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
  } else if (cmd === '/forget' || /^(забудь\s+(меня|вс[её])|удали\s+(меня|вс[её]))$/i.test(text)) {
    // стирается запись целиком: дело, шаг, время, переписка, связь с сайтом. Проверяемо и без оператора
    await d.store.deleteUser(u)
    await say(d, chat, T.forgotten)
    return
  } else if (cmd === '/unlink') {
    const had = u.device
    if (had && (await d.store.chatOfDevice(had)) === u.id) await d.store.bindDevice(had, null)
    u.device = undefined
    u.pendingLink = undefined
    await d.store.saveUser(u)
    await say(d, chat, had ? T.unlinked : T.notLinked)
  } else if (cmd === '/help') {
    await d.store.saveUser(u)
    await say(d, chat, T.help)
  } else if (u.awaiting === 'time' && /\d/.test(text)) {
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
  } else if (u.awaiting === 'hour' && /\d/.test(text)) {
    const h = hourOf(text)
    if (h === null) {
      await d.store.saveUser(u)
      await say(d, chat, T.badHour)
      return
    }
    u.awaiting = null
    await setHour(d, u, h)
  } else if (text.length >= 2 && !text.startsWith('/')) {
    // бот ждал время, а человек написал словами о другом: вопрос снят, разговор идёт дальше (а не «мне нужен час» по кругу)
    u.awaiting = null
    await freeText(d, u, text, isNew)
  } else {
    await d.store.saveUser(u)
    await say(d, chat, T.help)
  }
}

/** Свободный текст — разговор с котом через обвязку (тот же кот, что на сайте: проверки, страховка моделей) */
async function freeText(d: Deps, u: TgUser, text: string, isNew: boolean) {
  const chat = u.id
  await d.send('sendChatAction', { chat_id: chat, action: 'typing' })
  const reply = d.converse ? await d.converse(u, text.slice(0, 2000)).catch(() => null) : null
  // пока кот думал, человек мог стереть себя (/forget): поздний ответ не должен вернуть запись
  if (!isNew && !(await d.store.getUser(chat))) return
  if (reply) return void (await catSays(d, u, text, reply))
  // модели не ответили или разговора нет: текст считаем делом и ломаем на шаги (у дробления своя заготовка)
  const task = text.slice(0, 120)
  const { steps, care } = await d.breakdown(task)
  if (care || steps.length === 0) {
    await d.store.saveUser(u)
    return void (await say(d, chat, care ?? T.aiDown))
  }
  u.task = task
  u.plan = undefined
  u.steps = steps
  u.stepIdx = 0
  await d.store.saveUser(u)
  await offerStep(d, u, T.stepFromTask(task, steps[0]))
}

/** Реплика кота из обвязки → сообщение бота: текст, кнопка старта, сохранённый план */
async function catSays(d: Deps, u: TgUser, userText: string, reply: CatReply) {
  const now = d.now()
  remember(u, 'user', userText, now)
  let text = reply.text.trim()
  let keyboard: Keyboard | undefined
  if (reply.plan) {
    const hour = applyPlan(u, reply.plan)
    // «записал, напишу в 10» говорит код по тому, что действительно сохранено, а не модель по своему ощущению
    const saved = hour !== null ? T.planSaved(u.plan!.firstStep, hour, u.tz) : T.planSavedNoHour(u.plan!.firstStep)
    text = text ? `${text}\n\n${saved}` : saved
    if (hour === null) u.awaiting = 'hour'
  }
  if (reply.startFocus) {
    // план, сохранённый этой же репликой, остаётся: кнопка ведёт на его шаг, и напоминание будет о нём же
    if (!reply.plan) {
      u.plan = undefined
      u.steps = [reply.startFocus.firstStep.slice(0, 160)]
      u.stepIdx = 0
    }
    keyboard = [[{ text: 'Сесть рядом →', url: goUrl(d, u) }]]
    text ||= T.step(reply.startFocus.firstStep)
  }
  if (!text) text = T.aiDown
  remember(u, 'cat', text, now)
  await d.store.saveUser(u)
  await reschedule(d, u)
  await say(d, u.id, text, keyboard)
}

async function setHour(d: Deps, u: TgUser, h: number) {
  const askTone = u.tone === undefined
  u.hour = h
  u.stopped = false
  // человек сам назвал час — пауза снята («или раньше, если позовёшь»)
  u.pausedUntil = undefined
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
    if (!Object.hasOwn(STEPS, sphere)) return
    u.sphere = sphere
    u.task = undefined
    u.steps = STEPS[sphere]
    u.stepIdx = 0
    await d.store.saveUser(u)
    await offerStep(d, u, T.step(u.steps[0]))
  } else if (data === 'nx') {
    const steps = u.steps ?? STEPS[u.sphere ?? 'unsure']
    u.steps = steps
    // «другой шаг» под шагом из плана (старая кнопка): план снят, показываем первый шаг по сфере, а не второй
    u.stepIdx = u.plan ? 0 : ((u.stepIdx ?? 0) + 1) % steps.length
    u.plan = undefined
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
    if (!Object.hasOwn(T.toneSet, tone)) return
    u.tone = tone
    await d.store.saveUser(u)
    await say(d, chat, T.toneSet[tone])
  } else if (data === 'lk:yes' || data === 'lk:no') {
    const pending = u.pendingLink
    u.pendingLink = undefined
    if (!pending) {
      await d.store.saveUser(u)
      await say(d, chat, T.linkExpired)
    } else if (data === 'lk:no') {
      await d.store.saveUser(u)
      await say(d, chat, T.linkNo)
    } else {
      await link(d, u, pending.payload)
    }
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
  const ids = await d.store.due(now, limit)
  let sent = 0
  // пачками по 10: сбой на одном человеке (битая запись, сеть) не останавливает остальных, а сотня не идёт гуськом
  for (let i = 0; i < ids.length; i += 10) {
    const results = await Promise.allSettled(ids.slice(i, i + 10).map((id) => remindOne(d, id, now)))
    for (const [k, r] of results.entries()) {
      if (r.status === 'fulfilled') sent += r.value
      else {
        console.error('[tg] tick', r.reason)
        // не оставляем человека первым в очереди: иначе каждый следующий запуск спотыкался бы о него же
        await d.store.schedule(ids[i + k], now + 3_600_000).catch(() => {})
      }
    }
  }
  return sent
}

async function remindOne(d: Deps, id: number, now: number): Promise<number> {
  const u = await d.store.getUser(id)
  if (!u || u.stopped || u.quiet || u.hour == null) {
    await d.store.schedule(id, null)
    return 0
  }
  if (u.pausedUntil && u.pausedUntil > now) {
    await reschedule(d, u)
    return 0
  }
  if (now - u.lastActive >= 21 * DAY) {
    u.quiet = true
    await d.store.saveUser(u)
    await d.store.schedule(id, null)
    await say(d, id, T.farewell)
    return 1
  }
  // сначала переносим на следующий раз, потом пишем: повторный или параллельный запуск не пришлёт второе сообщение
  await d.store.schedule(id, nextAt(u.hour, u.tz, now, intervalDays(u.ignored + 1)))
  await say(d, id, reminderText(u, now), reminderKeyboard(d, u))
  // пока сообщение шло, человек мог нажать «Стоп» или стереть себя: счётчики кладём в свежую запись, а не поверх неё
  const fresh = await d.store.getUser(id)
  if (!fresh) {
    await d.store.schedule(id, null)
    return 1
  }
  fresh.ignored += 1
  fresh.lastSent = now
  fresh.variant += 1
  fresh.history = recentHistory(fresh, now)
  await d.store.saveUser(fresh)
  if (fresh.stopped || fresh.hour == null) await d.store.schedule(id, null)
  return 1
}
