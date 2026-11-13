/**
 * Знакомство (v2, документ владельца 10.11): пять вопросов → «твоя цифра» → первый шаг → сборка → план →
 * договор с «если — то» → сессия 2 минуты. Экран-крючок «Привет, я не буду тебя торопить…» владелец убрал: знакомство
 * начинается сразу с первого вопроса, как и раньше.
 *
 * Правило Appelune из базы знаний: каждый вопрос обязан менять то, что человек увидит дальше, иначе его не задают.
 * «Что висит» меняет шаги и заголовки, «сколько висит» — цену бездействия, «что мешает» — реплику, приём и «если — то»,
 * «ради чего» — строку «Ты через 7 дней», «сколько ест» — «твою цифру». Ответы лежат локально (как вся память
 * продукта). Цифра — только из слов самого человека: кот её умножает, а не выдумывает.
 */

export type Sphere = 'study' | 'work' | 'home' | 'message' | 'unsure'
export type Hanging = 'day' | 'week' | 'month' | 'unknown'
export type Blocker = 'where' | 'phone' | 'fear' | 'boring' | 'tired'
export type Motive = 'relief' | 'people' | 'safety' | 'rest' | 'proof'
export type Cost = 'q15' | 'hour' | 'two' | 'allday' | 'unknown'

export const FIRST_MINUTES = 2

/** Шаги знакомства: пять вопросов, «твоя цифра», первый шаг, план, договор (сборка — между шагом и планом) */
export const STEP_SPHERE = 1
export const STEP_HANGING = 2
export const STEP_BLOCKER = 3
export const STEP_MOTIVE = 4
export const STEP_COST = 5
export const STEP_FIGURE = 6
export const STEP_FIRST = 7
export const STEP_PLAN = 8
export const LAST_STEP = 9

export const SPHERES: { key: Sphere; label: string; echo: string; word: string; noun: string }[] = [
  {
    key: 'study',
    label: 'Учёба',
    echo: 'Учёба. Её любят откладывать на «когда настроение будет». Не будем ждать настроения.',
    word: 'учёба',
    noun: 'Учебная задача',
  },
  {
    key: 'work',
    label: 'Работа / проекты',
    echo: 'Работа. Понимаю — она ещё и в голове ночью сидит.',
    word: 'работа и проекты',
    noun: 'Рабочая задача',
  },
  {
    key: 'home',
    label: 'Дом и быт',
    echo: 'Дом. Вроде мелочи, а копятся в одну большую гору.',
    word: 'дом и быт',
    noun: 'Домашнее дело',
  },
  {
    key: 'message',
    label: 'Написать или позвонить',
    echo: 'Сообщение или звонок. Самое липкое — разберём.',
    word: 'сообщение или звонок',
    noun: 'Сообщение или звонок',
  },
  {
    key: 'unsure',
    label: 'Пока не знаю',
    echo: 'Это нормально. Иногда висит всё сразу. Начнём с того, чтобы вытащить это из головы.',
    word: 'пока без названия',
    noun: 'Это дело',
  },
]

/**
 * «Сколько уже висит?» — сразу после «что висит». Ответ без оценки: кот не считает, сколько потеряно, а снимает
 * вес. Длинный срок без упрёка снимает стыд, на котором держится избегание (Fee и Tangney). Вставка про механизм —
 * только для «месяц и дольше» и «не помню»: вина переезжает с характера на то, как устроено неприятие ожидания.
 */
export const HANGING: { key: Hanging; label: string; echo: string; chip: string; since: string; insert?: string }[] = [
  { key: 'day', label: 'Пару дней', echo: 'Хорошо, что ловим рано. Чем раньше — тем легче.', chip: 'Висит пару дней', since: 'пару дней' },
  {
    key: 'week',
    label: 'Неделю-две',
    echo: 'Пара недель — уже начинает давить. Давай снимем это давление.',
    chip: 'Висит неделю-две',
    since: 'неделю-две',
  },
  {
    key: 'month',
    label: 'Месяц или дольше',
    echo: 'Месяц — это много носить в голове. Хорошо, что ты здесь, а не ещё один месяц там.',
    chip: 'Висит месяц и дольше',
    since: 'месяц',
    insert:
      'Это не лень. У людей с СДВГ мозг сильнее обычного не любит ждать награды — исследования это показывают. Поэтому большие дела «залипают». Хорошая новость: короткие шаги с быстрой наградой работают как раз для такого мозга. Это и есть наш метод.',
  },
  {
    key: 'unknown',
    label: 'Не помню — давно',
    echo: 'Если не помнишь, когда началось, — это уже стало фоном. Фон тоже можно выключить.',
    chip: '',
    since: 'давно',
    insert:
      'Это не лень. У людей с СДВГ мозг сильнее обычного не любит ждать награды — исследования это показывают. Поэтому большие дела «залипают». Хорошая новость: короткие шаги с быстрой наградой работают как раз для такого мозга. Это и есть наш метод.',
  },
]

export const BLOCKERS: {
  key: Blocker
  label: string
  echo: string
  /** «Наш приём» — на экране плана */
  approach: string
  /** «Если — то» — на договоре */
  ifThen: string
}[] = [
  {
    key: 'where',
    label: 'Не знаю, с чего начать',
    echo: 'Когда непонятно, с чего начать, мозг считает это одной огромной задачей. Отрежем кусочек, который понятен.',
    approach: 'Только первый шаг',
    ifThen: 'Если не понимаю, что дальше — пишу любое первое слово',
  },
  {
    key: 'phone',
    label: 'Рука сама тянется к телефону',
    echo: 'Телефон — самый быстрый способ сбежать. Не будем с ним воевать — просто уберём на 2 минуты.',
    approach: 'Телефон экраном вниз — я посторожу',
    ifThen: 'Если рука тянется к телефону — кладу его экраном вниз и смотрю на кота',
  },
  {
    key: 'fear',
    label: 'Боюсь, что выйдет плохо',
    echo: 'Значит, тебе не всё равно. На 2 минуты разрешаю сделать плохо. Черновик — это не результат.',
    approach: 'Плохой черновик разрешён',
    ifThen: 'Если кажется, что выходит плохо — продолжаю: это черновик',
  },
  {
    key: 'boring',
    label: 'Скучно, сбегаю в другое',
    echo: 'Скучно — честно. Две минуты скуки выдержать можно, а потом ты свободен(на).',
    approach: '2 минуты — и можно остановиться',
    ifThen: 'Если становится скучно — смотрю на таймер: осталось меньше, чем кажется',
  },
  {
    key: 'tired',
    label: 'Нет сил даже начать',
    echo: 'Тогда выберем такой маленький шаг, что сил на него точно хватит. Даже просто открыть.',
    approach: 'Шаг меньше, чем кажется возможным',
    ifThen: 'Если не хочется — делаю хотя бы первое движение: открыть',
  },
]

/** «Ради чего?» — человек сам называет выгоду (самоубеждение); ответ ведёт строку «Ты через 7 дней» */
export const MOTIVES: { key: Motive; label: string; echo: string; future: string }[] = [
  { key: 'relief', label: 'Голова освободится', echo: 'Да. Как закрыть сто вкладок в браузере.', future: 'В голове на одну вкладку меньше' },
  {
    key: 'people',
    label: 'Кто-то перестанет ждать',
    echo: 'Значит, это ещё и про людей. Ответить — это забота.',
    future: 'Человек дождался ответа',
  },
  {
    key: 'safety',
    label: 'Не будет проблем — долгов, штрафов, разборок',
    echo: 'Лучше маленький шаг сейчас, чем большая проблема потом.',
    future: 'Бумажки сдвинулись',
  },
  {
    key: 'rest',
    label: 'Смогу отдыхать без фона «я же не сделал(а)»',
    echo: 'Отдых без чувства вины — честная цель.',
    future: 'Отдыхаешь без фона',
  },
  {
    key: 'proof',
    label: 'Докажу себе, что могу',
    echo: 'Хорошая причина. Начнём доказывать прямо сегодня.',
    future: 'Доказано: я могу начинать',
  },
]

/**
 * «Сколько это ест?» — цена бездействия ТОЛЬКО из числа человека: кот умножает его оценку на 30 и говорит об этом
 * под числом. Ни одной чужой статистики. Без числа («весь день», «не могу сказать») — честный ответ без цифры.
 */
export const COSTS: { key: Cost; label: string; figure: string; monthly?: string; perDay?: string }[] = [
  {
    key: 'q15',
    label: 'Минут 15',
    figure: '15 минут в день — это около *7,5 часа в месяц*. Целый рабочий день на «потом».',
    monthly: 'около 7,5 часа',
    perDay: 'около 15 минут',
  },
  {
    key: 'hour',
    label: 'Около часа',
    figure: 'Час в день — около *30 часов в месяц*. Почти рабочая неделя уходит на то, чтобы носить это в голове.',
    monthly: 'около 30 часов',
    perDay: 'около часа',
  },
  {
    key: 'two',
    label: 'Пару часов',
    figure: 'Два часа в день — около *60 часов в месяц*. Полторы рабочие недели.',
    monthly: 'около 60 часов',
    perDay: 'около двух часов',
  },
  {
    key: 'allday',
    label: 'Весь день фоном',
    figure: 'Когда фоном весь день — это не часы, это силы. Их съедает то, что даже не начато.',
  },
  { key: 'unknown', label: 'Не могу сказать', figure: 'Ничего. Посчитаем по-другому — по тому, насколько станет легче.' },
]

export const COST_CAPTION = 'Это твоя оценка, не наша. Я просто умножил на 30.'

/**
 * Связка срока и цены: «Рабочая задача висит уже месяц…». Только из ответов человека. Для «месяц» — слово в слово
 * пример документа; для коротких сроков без «этого месяца»; сообщение + месяц — отдельная строка про тревогу.
 */
export function costBundle(state: OnboardingState): string | null {
  const cost = COSTS.find((c) => c.key === state.cost)
  const sphere = SPHERES.find((s) => s.key === state.sphere)
  const hanging = HANGING.find((h) => h.key === state.hanging)
  if (state.sphere === 'message' && state.hanging === 'month') {
    return 'Одно сообщение висит месяц — и всё это время ты помнишь о нём каждый день. Ответ займёт меньше времени, чем один такой день тревоги.'
  }
  if (!cost?.monthly || !cost.perDay || !sphere || !hanging) return null
  if (hanging.key === 'month') {
    return `${sphere.noun} висит уже месяц. По твоей оценке, она забирает ${cost.perDay} в день — примерно ${cost.monthly.replace('около ', '')} только за этот месяц. Если ничего не менять, следующий месяц возьмёт ещё столько же. Мы предлагаем вместо этого 2 минуты — прямо сейчас.`
  }
  const since = hanging.key === 'unknown' ? 'висит давно' : `висит уже ${hanging.since}`
  return `${sphere.noun} ${since}. По твоей оценке, она забирает ${cost.perDay} в день — это ${cost.monthly} в месяц. Мы предлагаем вместо этого 2 минуты — прямо сейчас.`
}

/** Первый шаг: физический, смешно маленький, меньше 2 минут (Fogg, Barkley). */
export const STEPS: Record<Sphere, string[]> = {
  study: ['Открыть файл или учебник', 'Написать заголовок и 1 строку', 'Найти, что именно задано'],
  work: ['Открыть документ или задачу', 'Написать 3 строки черновика', 'Выписать первый шаг'],
  home: ['Убрать одну поверхность', 'Собрать 10 вещей на место', 'Завести стирку'],
  message: ['Открыть переписку', 'Написать черновик ответа (не отправлять)', 'Найти нужный номер'],
  unsure: ['Выписать всё, что висит, за 2 минуты', 'Выбрать одно'],
}

export const FIRST_STEP_WRITE = 'Выписать первый шаг'

/** Шаги для сферы с поправкой на помеху: «не знаю, с чего» — первым идёт «Выписать первый шаг» */
export function stepsFor(sphere: Sphere | null, blocker: Blocker | null): string[] {
  const base = STEPS[sphere ?? 'unsure']
  // три шага, как у остальных: «Выписать первый шаг» встаёт первым, последний уходит (иначе экран не помещался)
  if (blocker === 'where' && !base.includes(FIRST_STEP_WRITE)) return [FIRST_STEP_WRITE, ...base].slice(0, 3)
  if (blocker === 'where') return [FIRST_STEP_WRITE, ...base.filter((s) => s !== FIRST_STEP_WRITE)]
  return base
}

/**
 * Шаг по умолчанию: самый маленький (первый в списке — «открыть…»). «Боюсь, что плохо» — черновик, который
 * не отправляется; «не знаю, с чего» — «выписать первый шаг» (он первый в списке).
 */
export function defaultStep(sphere: Sphere | null, blocker: Blocker | null): string {
  const list = stepsFor(sphere, blocker)
  if (blocker === 'fear') {
    const draft = list.find((s) => /черновик|строк/i.test(s))
    if (draft) return draft
  }
  return list[0]
}

/** Подсказка кота «Подскажи» под полем «Своё…»: следующий шаг из списка сферы, а если выбраны все — первый */
export function suggestStep(sphere: Sphere | null, blocker: Blocker | null, current: string | null): string {
  const list = stepsFor(sphere, blocker)
  const i = current ? list.indexOf(current) : -1
  return list[(i + 1) % list.length]
}

export type OnboardingState = {
  step: number
  sphere: Sphere | null
  hanging: Hanging | null
  blocker: Blocker | null
  motive: Motive | null
  cost: Cost | null
  firstStep: string | null
}

const KEY = 'naparnik:onboarding'

export const EMPTY_ONBOARDING: OnboardingState = {
  step: STEP_SPHERE,
  sphere: null,
  hanging: null,
  blocker: null,
  motive: null,
  cost: null,
  firstStep: null,
}

/** Шаг онбординга переживает перезагрузку: вернулся — продолжаем, не с нуля. */
export function readOnboarding(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY_ONBOARDING
    const saved = { ...EMPTY_ONBOARDING, ...(JSON.parse(raw) as Partial<OnboardingState>) }
    // шаг из чужой/старой записи (строка, NaN, номер прежней схемы) — не дальше последнего, не раньше первого
    const step = Number.isFinite(saved.step) ? Math.min(LAST_STEP, Math.max(STEP_SPHERE, saved.step)) : STEP_SPHERE
    return { ...saved, step }
  } catch {
    return EMPTY_ONBOARDING
  }
}

/**
 * Человек отвечает в знакомстве — значит, хочет, чтобы эти ответы помнили. Снимает метку «Забудь всё» из чата
 * (`naparnik:profileForgotten`, lib/memory.ts forgetEverything): без этого новые ответы после «забудь» Дом и кот не
 * видели бы никогда (13.11). Само открытие знакомства метку не снимает — только ответ.
 */
export function rememberAnswers() {
  try {
    window.localStorage.removeItem('naparnik:profileForgotten')
  } catch {
    /* хранилище недоступно — помнить всё равно нечем */
  }
}

export function writeOnboarding(state: OnboardingState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* приватный режим — онбординг просто не запомнит шаг */
  }
}

/**
 * Шаг и ответы знакомства — в адресе (`/app/start?step=4&s=study&h=week&b=phone&m=relief&c=hour&f=0`), как у Noom:
 * «Назад» браузера открывает предыдущий вопрос, перезагрузка и ссылка в новой вкладке или в Safari (из встроенного
 * браузера Instagram переносится только адрес) — тот же вопрос с теми же ответами. В адресе только ключи вариантов
 * и номер шаблонного шага; свой текст человека («Своё дело…») в адрес не попадает — `f=own`, сам текст остаётся на
 * устройстве.
 */
const SPHERE_KEYS = new Set<string>(SPHERES.map((s) => s.key))
const HANGING_KEYS = new Set<string>(HANGING.map((h) => h.key))
const BLOCKER_KEYS = new Set<string>(BLOCKERS.map((b) => b.key))
const MOTIVE_KEYS = new Set<string>(MOTIVES.map((m) => m.key))
const COST_KEYS = new Set<string>(COSTS.map((c) => c.key))

export const ONBOARDING_QUERY_KEYS = ['step', 's', 'h', 'b', 'm', 'c', 'f'] as const

export function onboardingToQuery(state: OnboardingState): Record<string, string> {
  const q: Record<string, string> = { step: String(state.step) }
  if (state.sphere) q.s = state.sphere
  if (state.hanging) q.h = state.hanging
  if (state.blocker) q.b = state.blocker
  if (state.motive) q.m = state.motive
  if (state.cost) q.c = state.cost
  if (state.firstStep) {
    const i = stepsFor(state.sphere, state.blocker).indexOf(state.firstStep)
    q.f = i >= 0 ? String(i) : 'own'
  }
  return q
}

/**
 * Состояние из адреса. `saved` — запись с устройства: из неё берётся только свой текст шага (`f=own`).
 * Шаг не может быть дальше первого вопроса без ответа — по ссылке нельзя «перепрыгнуть» к договору без дела.
 * Нет `step` в адресе — null (берём запись с устройства).
 */
export function onboardingFromQuery(params: URLSearchParams, saved: OnboardingState): OnboardingState | null {
  const rawStep = Number(params.get('step'))
  if (!params.has('step') || !Number.isInteger(rawStep)) return null
  const pick = <T extends string>(key: string, keys: Set<string>) => {
    const v = params.get(key)
    return v && keys.has(v) ? (v as T) : null
  }
  const sphere = pick<Sphere>('s', SPHERE_KEYS)
  const hanging = pick<Hanging>('h', HANGING_KEYS)
  const blocker = pick<Blocker>('b', BLOCKER_KEYS)
  const motive = pick<Motive>('m', MOTIVE_KEYS)
  const cost = pick<Cost>('c', COST_KEYS)
  const f = params.get('f')
  let firstStep: string | null = null
  const list = stepsFor(sphere, blocker)
  if (f === 'own') {
    firstStep = saved.firstStep && !list.includes(saved.firstStep) ? saved.firstStep : null
  } else if (f !== null && /^\d$/.test(f)) {
    firstStep = list[Number(f)] ?? null
  }
  // дальше первого вопроса без ответа не пускаем; после «цены» — первый шаг, после него — план и договор
  const reachable = !sphere
    ? STEP_SPHERE
    : !hanging
      ? STEP_HANGING
      : !blocker
        ? STEP_BLOCKER
        : !motive
          ? STEP_MOTIVE
          : !cost
            ? STEP_COST
            : !firstStep
              ? STEP_FIRST
              : LAST_STEP
  let step = Math.min(Math.max(1, rawStep), reachable)
  // «твоя цифра» есть только при числе: без него по ссылке — сразу выбор шага
  if (step === STEP_FIGURE && !COSTS.find((c) => c.key === cost)?.monthly) step = STEP_FIRST
  return { step, sphere, hanging, blocker, motive, cost, firstStep }
}

/** Экран «Твой план»: каждая строка — ответ самого человека (без общих фраз, подходящих всем) */
export function planLines(state: OnboardingState, step: string) {
  const sphere = SPHERES.find((s) => s.key === state.sphere)
  const hanging = HANGING.find((h) => h.key === state.hanging)
  const blocker = BLOCKERS.find((b) => b.key === state.blocker)
  const motive = MOTIVES.find((m) => m.key === state.motive)
  const since = hanging ? (hanging.key === 'unknown' ? 'давно' : `уже ${hanging.since}`) : null
  const title: Record<Sphere, string> = {
    study: 'Твой план для учёбы',
    work: 'Твой план для работы и проектов',
    home: 'Твой план для дома и быта',
    message: 'Твой план для сообщений и звонков',
    unsure: 'Твой план',
  }
  return {
    title: title[state.sphere ?? 'unsure'],
    hanging: [sphere?.word, since].filter(Boolean).join(' — '),
    blocker: blocker?.label ?? null,
    approach: blocker?.approach ?? null,
    motive: motive ? motive.label.charAt(0).toLowerCase() + motive.label.slice(1) : null,
    today: `2 минуты — «${step}»`,
    week: '7 коротких стартов. Остров вырастет вместе с ними.',
    future: motive?.future ?? null,
  }
}
