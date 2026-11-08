/**
 * Заголовок лендинга под конкретный ролик: `/?src=<ключ>` показывает обещание именно этого ролика
 * (как у BetterMe: номер воронки в адресе, `flow=2117`; план «школа 1», фаза 2). Остальное на лендинге не меняется.
 *
 * Как добавить ролик: новая запись `'reel-12': { … }` ниже — ключ в нижнем регистре латиницей, цифры и дефисы
 * (он же значение `src` в ссылке ролика). Неизвестный `src` показывает заголовок по умолчанию.
 * Для каждого ключа на этапе сборки готовится свой статический лендинг (app/v/[variant]/page.tsx), proxy.ts
 * подставляет его по `?src=` — адрес остаётся `/?src=…`, заголовок верный уже в HTML, без подмены и прыжка.
 *
 * Строка заголовка = `top` <перенос> `before` + выделенное `accent` (подчёркнуто каракулей) + `after`.
 * Длина как у заголовка по умолчанию — иначе на 360×640 кнопка уедет. После правки текста:
 * `python3 design/fonts/build.py` (вшитые шрифты первого экрана; `design/fonts/check.mjs` остановит сборку, если забыть).
 */
export type EntryHeadline = {
  top: string
  before: string
  accent: string
  after: string
}

export const DEFAULT_HEADLINE: EntryHeadline = {
  top: 'Сдвинем твоё',
  before: 'дело за ',
  accent: '2 минуты',
  after: '.',
}

/** Примеры под пять помех знакомства (lib/onboarding.ts) — заменить на обещания настоящих роликов */
export const ENTRY_VARIANTS: Record<string, EntryHeadline> = {
  'reel-phone': { top: 'Без ленты —', before: 'дело за ', accent: '2\u00a0минуты', after: '.' },
  'reel-where': { top: 'Начнём с малого —', before: 'всего ', accent: '2\u00a0минуты', after: '.' },
  'reel-fear': { top: 'Можно криво.', before: 'Дело за ', accent: '2\u00a0минуты', after: '.' },
  'reel-boring': { top: 'Скучное дело —', before: 'всего ', accent: '2\u00a0минуты', after: '.' },
  'reel-tired': { top: 'Сил нет? Хватит', before: 'и ', accent: '2\u00a0минут', after: '.' },
}

const KEY_RE = /^[a-z0-9-]{1,40}$/

export function entryVariantKey(src: string | null | undefined): string | null {
  if (!src) return null
  const key = src.trim().toLowerCase()
  return KEY_RE.test(key) && Object.hasOwn(ENTRY_VARIANTS, key) ? key : null
}
