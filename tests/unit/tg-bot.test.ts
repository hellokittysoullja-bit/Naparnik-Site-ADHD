import { describe, expect, it } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import { handleUpdate, intervalDays, nextAt, onGo, parseLocalTime, reminderText, tick, type Deps } from '@/lib/tg/bot'
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
  const texts = () => sent.filter((s) => s.method === 'sendMessage').map((s) => String(s.body.text))
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
    const plan = r.texts().find((t) => t.startsWith('Разломал'))!
    expect(plan).toBe('Разломал «Помыть посуду» на 3 шага:\n\n1. Собрать посуду в раковину · 2 мин\n2. Помыть тарелки · 10 мин\n3. Вытереть стол · 1 ч 30 мин\n\nНачнём с первого: «Собрать посуду в раковину». Я рядом.')
    const u = await r.store.getUser(CHAT)
    expect(u?.task).toBe('Помыть посуду')
    expect(u?.steps).toHaveLength(3)
    const kb = (r.sent.find((s) => String(s.body.text).startsWith('Разломал'))!.body.reply_markup as { inline_keyboard: { text: string }[][] }).inline_keyboard
    expect(kb[0][0].text).toBe('Сесть рядом →')
  })

  it('просьба без дела — вопрос, что разломать; дробление не зовётся', async () => {
    const r = rig()
    let calls = 0
    r.deps.breakdown = async () => (calls++, { steps: ['a', 'b', 'c'], fallback: false })
    await r.msg('/start')
    await r.msg('разбей')
    expect(calls).toBe(0)
    expect(r.texts().at(-1)).toMatch(/^Что разломать\?/)
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
    const plan = r.texts().find((t) => t.startsWith('Разломал'))!
    expect(plan).toContain(`«${want.steps[0]}»`)
    expect(plan.split('\n').filter((l) => /^\d+\. /.test(l))).toHaveLength(want.steps.length)
    expect(plan).toMatch(/ · \d+ (мин|ч)/)
  })
})
