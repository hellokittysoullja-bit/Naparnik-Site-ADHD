import { describe, expect, it } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { handleUpdate, intervalDays, T, nextAt, onGo, parseLocalTime, reminderText, tick, type Deps } from '@/lib/tg/bot'
import { MemoryStore, type TgUser } from '@/lib/tg/store'
import { verifyQStash } from '@/lib/tg/qstash'

const CHAT = 4242
// 3 ноября 2026, 06:00 UTC = 09:00 по Москве
const T0 = Date.UTC(2026, 10, 3, 6, 0)
const DAY = 86_400_000

function rig(start = T0) {
  const store = new MemoryStore()
  const sent: { method: string; body: Record<string, unknown> }[] = []
  let now = start
  store.now = () => now
  const deps: Deps = {
    store,
    send: async (method, body) => {
      sent.push({ method, body })
      return true
    },
    now: () => now,
    site: 'https://adhd-naparnik.vercel.app',
    breakdown: async (task) => ({ steps: [`Открыть «${task}»`, 'Шаг два', 'Шаг три'], fallback: false }),
    sign: (v) => `sig${v}`,
  }
  const msg = (text: string) => handleUpdate({ message: { chat: { id: CHAT, type: 'private' }, text } }, deps)
  const tap = (data: string) =>
    handleUpdate({ callback_query: { id: 'q', data, message: { chat: { id: CHAT }, message_id: 1 } } }, deps)
  // подсказка про нижнюю кнопку приходит один раз в каждом новом чате; её проверяет свой тест
  const texts = () => sent.filter((s) => s.method === 'sendMessage' && s.body.text !== T.menuHint).map((s) => String(s.body.text))
  const setNow = (t: number) => (now = t)
  return { store, sent, deps, msg, tap, texts, setNow }
}

describe('бот: первый разговор', () => {
  it('/start с меткой источника: приветствие, сферы кнопками, источник посчитан', async () => {
    const r = rig()
    await r.msg('/start c_lina')
    // первое знакомство — открытка с котом и приветствием в подписи
    expect(r.sent[0].method).toBe('sendPhoto')
    expect(r.sent[0].body.photo).toBe('https://adhd-naparnik.vercel.app/opengraph-image.png')
    expect(String(r.sent[0].body.caption)).toMatch(/^Приветик. Я Напарник/)
    const kb = (r.sent[0].body.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard
    expect(kb.flat().map((b) => b.text)).toContain('Учёба')
    expect(r.store.sources.get('c_lina')).toBe(1)
    expect((await r.store.getUser(CHAT))?.src).toBe('c_lina')
  })

  it('сфера → шаг на 2 минуты с кнопкой «Сесть рядом» и вопрос про напоминания', async () => {
    const r = rig()
    await r.msg('/start')
    await r.tap('sp:study')
    const t = r.texts()
    expect(t[0]).toContain('«Открыть файл или учебник»')
    expect(t[1]).toMatch(/буду звать тебя раз в день/)
    const go = (r.sent.find((s) => String(s.body.text).includes('Открыть файл или учебник'))!.body.reply_markup as {
      inline_keyboard: { url?: string }[][]
    }).inline_keyboard[0][0].url!
    expect(go).toMatch(/^https:\/\/adhd-naparnik\.vercel\.app\/api\/tg\/go\?c=4242&t=sig4242&s=/)
  })

  it('своё дело текстом → дробление нейросетью', async () => {
    const r = rig()
    await r.msg('курсовая по истории')
    expect(r.texts()[0]).toContain('Разломал «курсовая по истории». Первый кусочек: «Открыть «курсовая по истории»»')
  })

  it('время напоминания: 9:00 по Москве, потом вопрос про тон', async () => {
    const r = rig(T0 + 60_000) // 09:01 МСК — сегодняшние 9:00 уже прошли
    await r.msg('/start')
    await r.tap('rm:9')
    expect(r.texts().at(-2)).toMatch(/напишу в 9:00 по Москве/)
    expect(r.texts().at(-1)).toMatch(/как мне с тобой говорить/)
    expect(r.store.dueAt.get(CHAT)).toBe(T0 + DAY)
  })

  it('часовой пояс правит только /time: «11:30» после него — поправка', async () => {
    const r = rig()
    await r.tap('rm:9')
    await r.msg('/time')
    await r.msg('11:30') // в 06:00 UTC у человека 11:30 → UTC+5:30
    expect((await r.store.getUser(CHAT))?.tz).toBe(330)
  })
  it('«18:30» в разговоре (ответ коту «во сколько начнёшь») пояс не трогает', async () => {
    const r = rig()
    await r.tap('rm:9')
    await r.msg('18:30')
    expect((await r.store.getUser(CHAT))?.tz).toBe(180)
    expect(r.texts().join('\n')).not.toMatch(/UTC/)
  })
})

describe('бот: приветствие', () => {
  it('картинка не ушла — то же приветствие текстом; вернувшегося встречает без открытки', async () => {
    const r = rig()
    r.deps.send = async (method, body) => {
      r.sent.push({ method, body })
      return method === 'sendPhoto' ? null : true
    }
    await r.msg('/start')
    expect(r.texts()[0]).toMatch(/^Приветик. Я Напарник/)
    await r.msg('/start')
    expect(r.texts().at(-1)).toMatch(/^О, привет-привет!/)
  })
})

describe('бот: напоминания', () => {
  async function scheduled() {
    const r = rig(T0 - 3 * 3_600_000) // 06:00 МСК
    await r.msg('/start')
    await r.tap('sp:work')
    await r.tap('rm:9')
    await r.tap('tone:soft')
    r.sent.length = 0
    return r
  }

  it('в 9:00 приходит одно сообщение с шагом и кнопками; без ответа бот пишет реже', async () => {
    const r = await scheduled()
    r.setNow(T0)
    expect(await tick(r.deps)).toBe(1)
    expect(r.texts()[0]).toMatch(/Открыть документ или задачу/)
    const kb = (r.sent[0].body.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard.flat()
    expect(kb.map((b) => b.text)).toEqual(['Сесть рядом →', 'Не сегодня', 'Пауза на неделю', 'Стоп'])
    // повторно в ту же минуту — тишина: не больше одного в день
    expect(await tick(r.deps)).toBe(0)
    // три дня без ответа → дальше раз в 3 дня
    for (let i = 1; i < 3; i++) {
      r.setNow(T0 + i * DAY)
      await tick(r.deps)
    }
    expect(r.store.dueAt.get(CHAT)).toBe(T0 + 2 * DAY + 3 * DAY)
  })

  it('ответ человека возвращает ежедневный режим', async () => {
    const r = await scheduled()
    for (let i = 0; i < 4; i++) {
      r.setNow(T0 + i * DAY * 3)
      await tick(r.deps)
    }
    r.setNow(T0 + 12 * DAY + 3_600_000)
    await r.tap('skip')
    expect((await r.store.getUser(CHAT))?.ignored).toBe(0)
    expect(r.store.dueAt.get(CHAT)).toBe(T0 + 13 * DAY)
  })

  it('через 21 день тишины — одно прощание и больше ничего', async () => {
    const r = await scheduled()
    const u = (await r.store.getUser(CHAT))!
    u.lastActive = T0 - 22 * DAY
    await r.store.saveUser(u)
    r.setNow(T0)
    await tick(r.deps)
    expect(r.texts()[0]).toMatch(/Я замолчу/)
    expect(r.store.dueAt.has(CHAT)).toBe(false)
  })

  it('«Стоп» снимает напоминания, /remind возвращает выбор времени', async () => {
    const r = await scheduled()
    await r.tap('stop')
    expect(r.store.dueAt.has(CHAT)).toBe(false)
    await r.msg('/remind')
    expect(r.texts().at(-1)).toMatch(/буду звать тебя раз в день/)
  })

  it('«Пауза на неделю» переносит напоминание за паузу', async () => {
    const r = await scheduled()
    await r.tap('pause')
    expect(r.store.dueAt.get(CHAT)! - (T0 - 3 * 3_600_000)).toBeGreaterThan(7 * DAY)
  })

  it('клик «Сесть рядом» ведёт на 2-минутную сессию и считается ответом', async () => {
    const r = await scheduled()
    r.setNow(T0)
    await tick(r.deps)
    const url = await onGo(r.deps, CHAT, 'Открыть нужный файл')
    expect(url).toBe('https://adhd-naparnik.vercel.app/app/session?step=%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C+%D0%BD%D1%83%D0%B6%D0%BD%D1%8B%D0%B9+%D1%84%D0%B0%D0%B9%D0%BB&d=2&src=tg')
    expect((await r.store.getUser(CHAT))?.ignored).toBe(0)
  })

  it('первая строка напоминания (видна на экране блокировки) без слов боли', () => {
    const pain = /боюсь|стыд|лен|пропуст|нет сил|опять|должен/i
    for (const tone of ['soft', 'short', 'humor'] as const) {
      for (let v = 0; v < 6; v++) {
        const u: TgUser = { id: 1, createdAt: 0, tz: 180, ignored: 0, lastActive: 0, variant: v, tone, sphere: 'study' }
        expect(reminderText(u, T0).split('\n')[0]).not.toMatch(pain)
      }
    }
  })
})

describe('бот: расчёты', () => {
  it('nextAt: следующее 9:00 по местному времени', () => {
    expect(nextAt(9, 180, T0 - 1)).toBe(T0)
    expect(nextAt(9, 180, T0)).toBe(T0 + DAY)
    expect(nextAt(9, 180, T0, 3)).toBe(T0 + 3 * DAY)
  })
  it('реже без ответа: 1 → 3 → 7 дней', () => {
    expect([0, 2, 3, 6, 7, 20].map(intervalDays)).toEqual([1, 1, 3, 3, 7, 7])
  })
  it('parseLocalTime', () => {
    expect(parseLocalTime('09:00', T0)).toBe(180)
    expect(parseLocalTime('6.00', T0)).toBe(0)
    expect(parseLocalTime('привет', T0)).toBeNull()
  })
})

describe('QStash: подпись', () => {
  const key = 'sig_key_test'
  const make = (body: string, claims: Record<string, unknown>, k = key) => {
    const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({ iss: 'Upstash', body: createHash('sha256').update(body).digest('base64url'), ...claims }),
    ).toString('base64url')
    const sig = createHmac('sha256', k).update(`${head}.${payload}`).digest('base64url')
    return `${head}.${payload}.${sig}`
  }
  it('принимает подписанный QStash и отвергает подделку', () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = key
    const now = Date.now()
    const exp = Math.floor(now / 1000) + 300
    expect(verifyQStash(make('{}', { exp }), '{}', { now })).toBe(true)
    expect(verifyQStash(make('{}', { exp }, 'other'), '{}', { now })).toBe(false)
    expect(verifyQStash(make('{"x":1}', { exp }), '{}', { now })).toBe(false)
    expect(verifyQStash(make('{}', { exp: exp - 3600 }), '{}', { now })).toBe(false)
    expect(verifyQStash(null, '{}', { now })).toBe(false)
  })
})

describe('бот: «Разбей …» — база готовых планов (владелец 20.11)', () => {
  it('просьба разбить → дело без слова-просьбы', async () => {
    const { breakCommand } = await import('@/lib/tg/bot')
    const cases: [string, string | null][] = [
      ['Разбей помыть посуду', 'помыть посуду'],
      ['разбить: «Написать курсовую»', 'Написать курсовую'],
      ['Разбей на шаги помыть посуду', 'помыть посуду'],
      ['разбей помыть посуду на шаги', 'помыть посуду'],
      ['помоги разбить уборку', 'уборку'],
      ['Пожалуйста разбей мне дело: отчёт', 'отчёт'],
      ['раздроби сделать дз', 'сделать дз'],
      ['Разломай выбросить мусор!', 'выбросить мусор'],
      ['раздели на шаги переезд', 'переезд'],
      ['распиши по шагам ремонт', 'ремонт'],
      ['/break помыть пол', 'помыть пол'],
      ['/break@naparnik_bot помыть пол', 'помыть пол'],
      ['Разбей', ''],
      ['разбей на шаги', ''],
      // не просьба: настоящие дела и обычные слова
      ['Разложить вещи по местам', null],
      ['разбитая чашка', null],
      ['помыть посуду', null],
      ['раздробленность', null],
    ]
    for (const [text, want] of cases) expect([text, breakCommand(text)]).toEqual([text, want])
  })

  it('весь план списком с минутами, название из базы, кнопка «Сесть рядом»; модель разговора не зовётся', async () => {
    const r = rig()
    const asked: string[] = []
    r.deps.breakdown = async (task) => {
      asked.push(task)
      return { steps: ['Собрать посуду в раковину', 'Помыть тарелки', 'Вытереть стол'], fallback: false, minutes: [2, 10, 90], title: 'Помыть посуду' }
    }
    let talked = 0
    r.deps.converse = async () => (talked++, null)
    await r.msg('/start')
    await r.msg('разбей памыть пасуду')
    expect(asked).toEqual(['памыть пасуду'])
    expect(talked).toBe(0)
    const planMsg = r.sent.find((s) => String(s.body.text).startsWith('🐾 <b>'))!
    expect(planMsg.body.parse_mode).toBe('HTML')
    expect(planMsg.body.text).toBe('🐾 <b>Помыть посуду</b>\nРазломал на 3 микрошага · около 1\u00a0ч\u00a042\u00a0мин\n\n1️⃣ Собрать посуду в раковину\u00a0·\u00a0<i>2\u00a0мин</i>\n2️⃣ Помыть тарелки\u00a0·\u00a0<i>10\u00a0мин</i>\n3️⃣ Вытереть стол\u00a0·\u00a0<i>1\u00a0ч\u00a030\u00a0мин</i>\n\n👉 Начнём с первого. Я рядом.')
    const u = await r.store.getUser(CHAT)
    expect(u?.task).toBe('Помыть посуду')
    expect(u?.steps).toHaveLength(3)
    const kb = (planMsg.body.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard
    expect(kb[0].map((b) => b.text)).toEqual(['Сесть рядом →', 'Следующий шаг'])
    // «Следующий шаг» — по порядку, после последнего не по кругу
    await r.tap('nx')
    expect(r.texts().at(-1)).toBe('Шаг 2 из 3: «Помыть тарелки».\nЯ рядом.')
    await r.tap('nx')
    await r.tap('nx')
    expect(r.texts().at(-1)).toBe(T.planDone(3))
    expect((await r.store.getUser(CHAT))?.stepIdx).toBe(2)
  })

  it('просьба без дела — вопрос, что разломать; дробление не зовётся', async () => {
    const r = rig()
    let calls = 0
    r.deps.breakdown = async () => (calls++, { steps: ['a', 'b', 'c'], fallback: false })
    await r.msg('/start')
    await r.msg('разбей')
    expect(calls).toBe(0)
    expect(r.texts().at(-1)).toBe(T.breakAsk)
  })

  it('фраза целиком — дело базы, а остаток нет: ломается само дело («Разбить большой проект на части»)', async () => {
    const r = rig()
    const asked: string[] = []
    r.deps.known = (t) => t === 'Разбить большой проект на части'
    r.deps.breakdown = async (task) => (asked.push(task), { steps: ['a', 'b', 'c'], fallback: false })
    await r.msg('/start')
    await r.msg('Разбить большой проект на части')
    expect(asked).toEqual(['Разбить большой проект на части'])
  })

  it('бот ждёт час, а человек просит разбить дело со временем — это дело, а не час', async () => {
    const r = rig()
    const asked: string[] = []
    r.deps.breakdown = async (task) => (asked.push(task), { steps: ['a', 'b', 'c'], fallback: false })
    await r.msg('/start')
    const u = (await r.store.getUser(CHAT))!
    u.awaiting = 'hour'
    await r.store.saveUser(u)
    await r.msg('разбей сделать дз к 7')
    expect(asked).toEqual(['сделать дз к 7'])
    expect((await r.store.getUser(CHAT))?.hour).toBeUndefined()
  })

  it('настоящая база: «разбей помыть посуду» получает план и минуты из базы, без модели', async () => {
    const { botBreakdown } = await import('@/lib/tg/deps')
    const { readyPlan } = await import('@/lib/ai/agents/breakdown')
    const r = rig()
    r.deps.breakdown = botBreakdown
    r.deps.known = (t) => readyPlan(t) !== null
    await r.msg('/start')
    await r.msg('Разбей помыть посуду')
    const want = readyPlan('помыть посуду')!.value
    const plan = r.texts().find((t) => t.startsWith('🐾 <b>Помыть посуду</b>'))!
    expect(plan).toContain(`1️⃣ ${want.steps[0]}`)
    expect(plan.split('\n').filter((l) => /^\d\uFE0F\u20E3|^🔟/u.test(l))).toHaveLength(want.steps.length)
    expect(plan).toMatch(/\u00a0·\u00a0<i>\d+\u00a0(мин|ч)/)
  })
})

describe('бот: нижняя кнопка «🐾 Разбить задачу» (владелец 20.11)', () => {
  const menuOf = (s: { body: Record<string, unknown> }) => s.body.reply_markup as { keyboard?: { text: string }[][]; is_persistent?: boolean } | undefined

  it('после /start в чате постоянная нижняя клавиатура с одной кнопкой; второй раз подсказка не повторяется', async () => {
    const r = rig()
    await r.msg('/start')
    const withMenu = r.sent.filter((s) => menuOf(s)?.keyboard)
    expect(withMenu).toHaveLength(1)
    expect(menuOf(withMenu[0])).toMatchObject({ keyboard: [[{ text: '🐾 Разбить задачу' }]], is_persistent: true, resize_keyboard: true })
    await r.msg('/help')
    expect(r.sent.filter((s) => s.body.text === T.menuHint)).toHaveLength(1)
  })

  it('чат, начатый до кнопки: она появляется один раз после следующего сообщения', async () => {
    const r = rig()
    await r.msg('/start')
    const u = (await r.store.getUser(CHAT))!
    u.menu = undefined
    await r.store.saveUser(u)
    await r.msg('/help')
    await r.msg('/help')
    expect(r.sent.filter((s) => s.body.text === T.menuHint)).toHaveLength(2)
    expect(menuOf(r.sent.filter((s) => s.body.text === T.menuHint).at(-1)!)?.keyboard).toBeTruthy()
  })

  it('кнопка → «напиши задачу» → следующее сообщение разбивается как на сайте, весь план', async () => {
    const r = rig()
    const asked: string[] = []
    r.deps.breakdown = async (task) => (asked.push(task), { steps: ['Раз', 'Два', 'Три'], fallback: false })
    let talked = 0
    r.deps.converse = async () => (talked++, null)
    await r.msg('/start')
    await r.msg('🐾 Разбить задачу')
    expect(r.texts().at(-1)).toBe(T.breakAsk)
    expect((await r.store.getUser(CHAT))?.awaiting).toBe('task')
    await r.msg('помыть посуду')
    expect(asked).toEqual(['помыть посуду'])
    expect(talked).toBe(0)
    expect(r.texts().some((t) => t.startsWith('🐾 <b>помыть посуду</b>\nРазломал на 3 микрошага'))).toBe(true)
    // ожидание снято: следующее сообщение снова разговор с котом
    expect((await r.store.getUser(CHAT))?.awaiting).toBeNull()
    await r.msg('спасибо')
    expect(talked).toBe(1)
  })

  it('/break без дела и кнопка без эмодзи работают так же; команда после кнопки снимает ожидание', async () => {
    const r = rig()
    const asked: string[] = []
    r.deps.breakdown = async (task) => (asked.push(task), { steps: ['Раз', 'Два', 'Три'], fallback: false })
    await r.msg('/start')
    await r.msg('/break')
    expect(r.texts().at(-1)).toBe(T.breakAsk)
    await r.msg('/help')
    expect((await r.store.getUser(CHAT))?.awaiting).toBeNull()
    await r.msg('Разбить задачу')
    await r.msg('курсовая')
    expect(asked).toEqual(['курсовая'])
  })
})

describe('бот: оформление плана (вариант Б)', () => {
  it('текст человека экранируется: теги из дела не становятся разметкой', async () => {
    const { planText } = await import('@/lib/tg/bot')
    const t = planText('<b>я</b> & ты', ['Открыть <a href="x">ссылку</a>', 'Два'], [5, undefined])
    expect(t).toContain('🐾 <b>&lt;b&gt;я&lt;/b&gt; &amp; ты</b>')
    expect(t).toContain('1️⃣ Открыть &lt;a href="x"&gt;ссылку&lt;/a&gt;\u00a0·\u00a0<i>5\u00a0мин</i>')
    // минут нет у одного шага — общего времени нет, а не неправда
    expect(t).toContain('Разломал на 2 микрошага\n')
    expect(t).toContain('2️⃣ Два\n')
  })

  it('больше десяти шагов: после 🔟 обычные номера; склонение «микрошагов»', async () => {
    const { planText } = await import('@/lib/tg/bot')
    const steps = Array.from({ length: 12 }, (_, i) => `Шаг ${i + 1}`)
    const t = planText('Дело', steps)
    expect(t).toContain('Разломал на 12 микрошагов')
    expect(t).toContain('🔟 Шаг 10\n11. Шаг 11\n12. Шаг 12')
    expect(planText('Д', ['a'])).toContain('1 микрошаг\n')
  })
})

describe('бот: сообщения одного чата по очереди (замок чата)', () => {
  it('кнопка и задача почти одновременно: задача ждёт, пока бот ответит на кнопку, и разбивается', async () => {
    const r = rig()
    await r.msg('/start')
    const asked: string[] = []
    r.deps.breakdown = async (task) => (asked.push(task), { steps: ['Раз', 'Два', 'Три'], fallback: false })
    let talked = 0
    r.deps.converse = async () => (talked++, null)
    // Telegram отвечает медленно: без замка второе сообщение прочло бы запись до того, как первое её сохранило
    const send = r.deps.send
    r.deps.send = async (m, b) => (await new Promise((res) => setTimeout(res, 40)), send(m, b))
    await Promise.all([
      handleUpdate({ update_id: 1, message: { chat: { id: CHAT, type: 'private' }, text: '🐾 Разбить задачу' } }, r.deps),
      new Promise((res) => setTimeout(res, 5)).then(() => handleUpdate({ update_id: 2, message: { chat: { id: CHAT, type: 'private' }, text: 'помыть посуду' } }, r.deps)),
    ])
    expect(asked).toEqual(['помыть посуду'])
    expect(talked).toBe(0)
    expect(r.store.locks.size).toBe(0)
  })

  it('разные чаты друг друга не ждут; упавший обработчик снимает замок', async () => {
    const r = rig()
    await r.msg('/start')
    const send = r.deps.send
    r.deps.send = async () => {
      throw new Error('сеть')
    }
    await expect(r.msg('привет')).rejects.toThrow()
    expect(r.store.locks.size).toBe(0)
    r.deps.send = send
    const t0 = Date.now()
    await handleUpdate({ message: { chat: { id: 7, type: 'private' }, text: '/help' } }, r.deps)
    expect(Date.now() - t0).toBeLessThan(500)
  })

  it('напоминание не пишет в чат, который сейчас занят, и переносится на 10 минут', async () => {
    const r = rig()
    await r.msg('/start')
    const u = (await r.store.getUser(CHAT))!
    u.hour = 9
    await r.store.saveUser(u)
    await r.store.schedule(CHAT, T0)
    const token = await r.store.lock(CHAT, 60_000)
    const before = r.sent.length
    expect(await tick(r.deps)).toBe(0)
    expect(r.sent.length).toBe(before)
    expect(r.store.dueAt.get(CHAT)).toBe(T0 + 600_000)
    await r.store.unlock(CHAT, token!)
    r.setNow(T0 + 600_000)
    expect(await tick(r.deps)).toBe(1)
  })
})

describe('бот: полоска «котик разбивает задачу» превращается в план (владелец 20.11)', () => {
  function animated() {
    const r = rig()
    let next = 100
    const send = r.deps.send
    // настоящий Telegram возвращает сообщение с message_id; правка — true
    r.deps.send = async (m, b) => (await send(m, b), m === 'sendMessage' ? { message_id: next++ } : true)
    const waits: number[] = []
    r.deps.wait = async (ms) => void waits.push(ms)
    return { ...r, waits }
  }

  it('0% → 30 → 60 → 90 → 100 % тем же сообщением, потом это сообщение и есть план с кнопками', async () => {
    const r = animated()
    r.deps.breakdown = async () => ({ steps: ['Раз', 'Два', 'Три'], fallback: false, minutes: [1, 2, 3], title: 'Помыть посуду' })
    await r.msg('/start')
    const from = r.sent.length
    await r.msg('разбей помыть посуду')
    const ev = r.sent.slice(from)
    const first = ev.find((s) => s.method === 'sendMessage')!
    expect(first.body.text).toBe('🐈 котик разбивает задачу...\n[░░░░░░░░░░] 0%')
    const edits = ev.filter((s) => s.method === 'editMessageText')
    expect(edits.map((e) => String(e.body.text).split('\n')[1] ?? '')).toEqual(['[▓▓▓░░░░░░░] 30%', '[▓▓▓▓▓▓░░░░] 60%', '[▓▓▓▓▓▓▓▓▓░] 90%', '[▓▓▓▓▓▓▓▓▓▓] 100%', 'Разломал на 3 микрошага · около 6\u00a0мин'])
    // все правки — того же сообщения; последняя — план с разметкой и кнопками
    expect(new Set(edits.map((e) => e.body.message_id)).size).toBe(1)
    const last = edits.at(-1)!
    expect(last.body.parse_mode).toBe('HTML')
    expect(String(last.body.text)).toMatch(/^🐾 <b>Помыть посуду<\/b>/)
    expect((last.body.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard[0][0].text).toBe('Сесть рядом →')
    // плана новым сообщением нет — он вырос из полоски
    expect(ev.filter((s) => s.method === 'sendMessage' && String(s.body.text).startsWith('🐾'))).toHaveLength(0)
    expect(r.waits.every((w) => w >= 400)).toBe(true)
  })

  it('долгое дробление: полоска стоит на 90 % и не обгоняет результат', async () => {
    const r = animated()
    let release!: () => void
    const gate = new Promise<void>((res) => (release = res))
    r.deps.breakdown = async () => (await gate, { steps: ['Раз', 'Два', 'Три'], fallback: false })
    await r.msg('/start')
    const from = r.sent.length
    const run = r.msg('разбей отчёт')
    await new Promise((res) => setTimeout(res, 20))
    const shown = r.sent.slice(from).filter((s) => s.method === 'editMessageText').map((e) => String(e.body.text))
    expect(shown.at(-1)).toContain('90%')
    expect(shown.some((t) => t.includes('100%'))).toBe(false)
    release()
    await run
    expect(String(r.sent.filter((s) => s.method === 'editMessageText').at(-1)!.body.text)).toMatch(/^🐾 <b>отчёт<\/b>/)
  })

  it('дробление не вышло или упало — полоска превращается в честный ответ, а не висит', async () => {
    const r = animated()
    r.deps.breakdown = async () => {
      throw new Error('сеть')
    }
    await r.msg('/start')
    await r.msg('разбей отчёт')
    expect(r.sent.filter((s) => s.method === 'editMessageText').at(-1)!.body.text).toBe(T.aiDown)
  })

  it('правка не прошла (сообщение удалили) — план приходит новым сообщением', async () => {
    const r = animated()
    const send = r.deps.send
    r.deps.send = async (m, b) => (m === 'editMessageText' ? null : send(m, b))
    r.deps.breakdown = async () => ({ steps: ['Раз', 'Два', 'Три'], fallback: false })
    await r.msg('/start')
    await r.msg('разбей отчёт')
    expect(r.sent.some((s) => s.method === 'sendMessage' && String(s.body.text).startsWith('🐾 <b>отчёт</b>'))).toBe(true)
  })
})
