'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  addFind,
  getFinds,
  getPatterns,
  getStarts,
  markWorldSeen,
  todayKey,
  type IslandFindEntry,
  type Patterns,
  type StartEntry,
  peekFinds,
  peekPatterns,
  peekStarts,
} from '@/lib/memory'
import { useClientMount } from '@/hooks/use-client-mount'
import {
  drawFind,
  ISLAND_ELEMENT_NAMES,
  ISLAND_POOL,
  LANDMARK_COUNT,
  RARITY_LABEL,
  type Rarity,
} from '@/lib/island-elements'
import {
  ISLAND_COLORS as c,
  findPosition,
  findSprites,
  landmarkNodes,
} from '@/lib/island-sprites'

/**
 * Остров — дневник стартов.
 * Старты 1–10 открывают ориентиры в фиксированных местах.
 * Старты 11+ приносят находки из пула: каждая навсегда встаёт туда,
 * где выросла (позиция из сида находки). Ничего никогда не исчезает.
 *
 * Рисунки ориентиров и находок живут в lib/island-sprites — тот же модуль
 * использует момент награды в конце фокус-сессии (components/reveal-island),
 * чтобы находка прорастала на настоящем острове, а не на отдельной карточке.
 */

function el(unlocked: boolean, children: React.ReactNode, isNext = false) {
  // Закрытое — не невидимое, а призрачное: остров показывает своё будущее.
  // Мозг видит, куда ведут старты (Зейгарник), без фальшивого прогресса —
  // силуэт обесцвечен и полупрозрачен, «наградой» он ещё не притворяется.
  // Следующий по очереди призрак «дышит» (медленная пульсация прозрачности):
  // предвкушение конкретной награды заякорено пространственно — дофамин
  // живёт в ожидании (Schultz, RPE), а не только в получении. Ровно один
  // дышащий элемент — иначе сигнал растворяется в шуме.
  if (!unlocked && isNext) {
    return (
      <g
        className="island-next-ghost"
        style={{ filter: 'saturate(0)' }}
        aria-hidden="true"
      >
        {children}
      </g>
    )
  }
  return (
    <g
      opacity={unlocked ? 1 : 0.13}
      style={{
        transition: 'opacity 700ms ease',
        filter: unlocked ? undefined : 'saturate(0)',
      }}
      aria-hidden={!unlocked}
    >
      {children}
    </g>
  )
}

type Landmark = {
  key: string
  name: (typeof ISLAND_ELEMENT_NAMES)[number]
  render: (unlocked: boolean, isNext?: boolean) => React.ReactNode
}

const landmarks: Landmark[] = ISLAND_ELEMENT_NAMES.map((name, i) => ({
  key: `landmark-${i}`,
  name,
  render: (u: boolean, isNext?: boolean) => el(u, landmarkNodes[i], isNext),
}))

// ---------- Дневник ----------

function formatDate(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]
  return `${d} ${months[(m ?? 1) - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`
}

type DiaryEntry = {
  id: string
  name: string
  rarity: Rarity | 'landmark'
  date: string
  label: string
  isNewToday: boolean
}

export function Island() {
  // Мерцание звёзд/воды/ореола редкой находки — SVG SMIL <animate>, не CSS:
  // ни один из @media (prefers-reduced-motion) блоков в globals.css его не
  // трогает (SMIL — отдельная система анимации). Условный рендер — единственный
  // способ отключить SMIL для reduced-motion.
  const reduceMotion = useReducedMotion()
  // переход по табу — остров из памяти в первом же кадре, без скелетона (hooks/use-client-mount.ts); бэкфилл
  // находок и отметка «увидел» — по-прежнему в эффекте
  const clientMount = useClientMount()
  const [starts, setStarts] = useState<StartEntry[] | null>(() => (clientMount ? peekStarts() : null))
  const [finds, setFinds] = useState<IslandFindEntry[]>(() => (clientMount ? peekFinds() : []))
  const [patterns, setPatterns] = useState<Patterns | null>(() => (clientMount ? peekPatterns() : null))

  useEffect(() => {
    async function load() {
      const [s, p] = await Promise.all([getStarts(), getPatterns()])
      let f = await getFinds()

      // Бэкфилл: старты сверх карты, сделанные до появления пула находок,
      // получают свои находки задним числом — история не теряется.
      const owed = Math.max(0, s.length - LANDMARK_COUNT) - f.length
      if (owed > 0) {
        const extraStarts = s.slice(LANDMARK_COUNT)
        for (const start of extraStarts) {
          if (f.some((x) => x.startId === start.id)) continue
          let pity = 0
          for (let i = f.length - 1; i >= 0 && f[i].rarity === 'common'; i--) pity++
          const draw = drawFind(false, pity)
          const entry = { ...draw, date: start.date, startId: start.id }
          await addFind(entry)
          f = [...f, entry]
        }
      }

      setStarts(s)
      setFinds(f)
      setPatterns(p)

      // Человек увидел свой остров — бейдж на табе «Мир» гаснет
      await markWorldSeen()
    }
    load()
  }, [])

  const count = starts?.length ?? 0
  const today = todayKey()
  const lastStart = starts && starts.length > 0 ? starts[starts.length - 1] : null
  const startedToday = lastStart?.date === today

  // Подсветка последней награды, если она заработана сегодня
  const newLandmarkIndex = startedToday && count <= LANDMARK_COUNT ? count - 1 : -1
  const newFindStartId =
    startedToday && count > LANDMARK_COUNT && lastStart
      ? finds.find((f) => f.startId === lastStart.id)?.startId ?? null
      : null

  // Дневник: ориентиры + находки одной лентой, свежее сверху
  const diary: DiaryEntry[] = []
  if (starts) {
    starts.forEach((start, i) => {
      if (i < LANDMARK_COUNT) {
        diary.push({
          id: start.id,
          name: landmarks[i].name,
          rarity: 'landmark',
          date: start.date,
          label: start.label,
          isNewToday: i === newLandmarkIndex,
        })
      } else {
        // Находка привязана к старту навсегда — сопоставляем по id, не по позиции
        const find = finds.find((f) => f.startId === start.id)
        if (find) {
          diary.push({
            id: start.id,
            name: find.name,
            rarity: find.rarity,
            date: start.date,
            label: start.label,
            isNewToday: find.startId === newFindStartId,
          })
        }
      }
    })
  }
  const recentDiary = diary.slice(-8).reverse()
  const rareCount = finds.filter((f) => f.rarity === 'rare').length

  // Тёплый отклик на прикосновение: остров — место, а не картинка.
  // Тап — существо вспоминает историю случайного выращенного элемента.
  const [lore, setLore] = useState<string | null>(null)
  const loreTimerRef = useRef<number | null>(null)
  function tapIsland() {
    if (diary.length === 0) {
      setLore('Пока тут тихо. Первый же старт — и у этого места появится первая история.')
    } else {
      const entry = diary[Math.floor(Math.random() * diary.length)]
      /*
       * Ни одна реплика не согласуется с родом названия — и это требование,
       * а не стиль. Имена приходят из двух источников с разным родом:
       * ориентиры («Домик», «Грядки», «Луна над островом») и находки
       * («Сосна», «Куст»). Прежние шаблоны жёстко ставили средний род —
       * «Домик… Появилось», «Грядки выросло не само», — и голос существа,
       * главный носитель доверия в продукте, спотыкался на ровном месте.
       * Поэтому подлежащее везде человек или старт, а название стоит в
       * кавычках: они снимают согласование по роду и падежу.
       */
      const templates = [
        `«${entry.name}» — это был твой старт «${entry.label}». Я помню.`,
        `Видишь «${entry.name}»? Это ты тогда взялся за «${entry.label}».`,
        `«${entry.name}» здесь из-за тебя. Ты начал «${entry.label}».`,
      ]
      setLore(templates[Math.floor(Math.random() * templates.length)])
    }
    if (loreTimerRef.current) window.clearTimeout(loreTimerRef.current)
    loreTimerRef.current = window.setTimeout(() => setLore(null), 6000)
  }
  useEffect(() => {
    return () => {
      if (loreTimerRef.current) window.clearTimeout(loreTimerRef.current)
    }
  }, [])

  return (
    // md:my-auto — на десктопе короткий остров центрируется по вертикали вместо
    // липания к верху над пустотой; длинный дневник прокручивается (auto-поля
    // схлопываются в ноль, когда контент выше вьюпорта — без обрезки сверху).
    // md:max-w-lg — острову-герою на широком экране дают чуть больше présence.
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-28 pt-6 md:my-auto md:max-w-lg">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Остров</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Каждый старт — новый кусочек. Ничего не сгорает и не откатывается.
        </p>
      </div>

      <button
        type="button"
        onClick={tapIsland}
        aria-label="Коснуться острова — напарник вспомнит историю"
        className="glass glass-interactive press cursor-pointer overflow-hidden rounded-3xl text-left focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          viewBox="0 0 380 216"
          role="img"
          aria-label={`Остров напарника: ${count} стартов, ${finds.length} находок`}
          className="block w-full"
        >
          <defs>
            {/* Ночное небо: глубина сверху, тёплая дымка у горизонта */}
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-background)" />
              <stop offset="72%" stopColor="var(--color-background)" />
              <stop offset="100%" stopColor="var(--color-secondary)" />
            </linearGradient>
            <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-secondary)" />
              <stop offset="100%" stopColor="var(--color-background)" />
            </linearGradient>
            <radialGradient id="moonhaze" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor={c.warm} stopOpacity="0.14" />
              <stop offset="100%" stopColor={c.warm} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* небо */}
          <rect x="0" y="0" width="380" height="162" fill="url(#sky)" />
          {/* звёзды: живут своей жизнью, каждая мерцает в своём ритме */}
          {[
            [24, 18, 1.1], [58, 40, 0.8], [96, 14, 1.3], [132, 52, 0.7],
            [168, 24, 1.0], [205, 44, 0.8], [242, 12, 1.2], [262, 56, 0.7],
            [292, 30, 1.0], [348, 20, 1.1], [362, 58, 0.8], [30, 66, 0.7],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--color-muted-foreground)" opacity="0.5">
              {!reduceMotion && (
                <animate
                  attributeName="opacity"
                  values="0.25;0.75;0.25"
                  dur={`${2.6 + (i % 5) * 0.9}s`}
                  begin={`${(i % 7) * 0.5}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
          ))}
          {/* дымка вокруг луны-ориентира — появляется вместе с ней (10-й старт) */}
          {count >= LANDMARK_COUNT && <circle cx="320" cy="44" r="42" fill="url(#moonhaze)" />}

          {/* вода */}
          <rect x="0" y="158" width="380" height="58" fill="url(#sea)" />
          {/* отражение острова */}
          <ellipse cx="190" cy="182" rx="130" ry="12" fill="var(--color-accent)" opacity="0.28" />
          {/* блики на воде: медленно дышат */}
          {[
            [52, 190, 26], [136, 198, 34], [230, 192, 22], [312, 200, 30], [180, 206, 40],
          ].map(([x, y, w], i) => (
            <line
              key={i}
              x1={x} y1={y} x2={x + w} y2={y}
              stroke="var(--color-muted-foreground)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.25"
            >
              {!reduceMotion && (
                <animate
                  attributeName="opacity"
                  values="0.1;0.35;0.1"
                  dur={`${3.4 + i * 0.7}s`}
                  begin={`${i * 0.8}s`}
                  repeatCount="indefinite"
                />
              )}
            </line>
          ))}

          {/* остров: песчаная кромка, объёмный холм травы, тень берега */}
          <ellipse cx="190" cy="156" rx="146" ry="26" fill={c.ground} />
          <path
            d="M50 156
               Q66 132 108 136 Q128 124 160 130 Q190 118 222 130
               Q254 122 276 134 Q312 130 330 156
               Q300 172 190 174 Q80 172 50 156 Z"
            fill={c.groundDark}
            opacity="0.7"
          />
          <ellipse cx="190" cy="160" rx="140" ry="17" fill={c.groundDark} opacity="0.35" />
          {landmarks.map((landmark, i) => (
            <g
              key={landmark.key}
              className={
                i < count
                  ? `island-grow${i === newLandmarkIndex ? ' island-new-element' : ''}`
                  : undefined
              }
              style={i < count ? { animationDelay: `${Math.min(i, 11) * 0.06}s` } : undefined}
            >
              {landmark.render(i < count, i === count)}
            </g>
          ))}
          {finds.map((find, i) => {
            const pos = findPosition(find, i)
            const sprite = findSprites[find.key]
            if (!sprite) return null
            return (
              // Позиционирующий transform живёт на ВНЕШНЕМ <g>, анимация
              // island-grow — на ВНУТРЕННЕМ: если оба атрибута трогают
              // transform на одном узле, CSS-анимация молча побеждает и
              // translate/scale находки теряется (CLAUDE.md §5.1) — тот же
              // паттерн, что уже используется у landmarks выше.
              <g key={find.startId} transform={`translate(${pos.x} ${pos.y}) scale(${pos.s})`}>
                <g
                  className={`island-grow${find.startId === newFindStartId ? ' island-new-element' : ''}`}
                  style={{ animationDelay: `${Math.min(i + LANDMARK_COUNT, 14) * 0.05}s` }}
                >
                  {/* Редкая находка светится золотом — тёплый жёлтый закреплён за rare */}
                  {find.rarity === 'rare' && (
                    <circle cx="0" cy="-10" r="20" fill="var(--color-reward)" opacity="0.16">
                      {!reduceMotion && (
                        <animate
                          attributeName="opacity"
                          values="0.08;0.2;0.08"
                          dur="3.2s"
                          repeatCount="indefinite"
                        />
                      )}
                    </circle>
                  )}
                  {sprite}
                </g>
              </g>
            )
          })}
        </svg>
      </button>

      {/* Голос острова: живёт 6 секунд после прикосновения */}
      {lore && (
        <p
          aria-live="polite"
          className="rounded-2xl bg-secondary px-4 py-2 text-center font-hand text-lg leading-snug"
        >
          {lore}
        </p>
      )}

      {starts !== null && count === 0 && (
        <div className="glass flex flex-col gap-2 rounded-2xl p-5">
          <p className="text-sm font-semibold">Видишь очертания? Это всё уже твоё.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Дерево, костёр, домик, причал — они ждут. Первый же старт, даже минутный, зажжёт
            первый росток.
          </p>
        </div>
      )}

      {starts !== null && count > 0 && count < LANDMARK_COUNT && (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {/* Именной тизер: конкретное «что дышит» сильнее абстрактных
              «очертаний» — предвкушение получает имя (goal gradient).

              Подлежащее здесь — СТАРТ, а не сам ориентир, и это не стилистика,
              а единственный способ не сломать русский. Прежняя формулировка
              «Это „X" — оно вырастет» подставляла средний род ко всем десяти
              названиям, хотя он верен только для «Дерева» и «Второго дерева»:
              на четвёртом старте выходило «„Домик" — оно вырастет», на пятом —
              «„Грядки" — оно вырастет». Согласовать местоимение нельзя без
              таблицы родов на каждое имя, поэтому местоимения нет вовсе:
              название стоит прямым объектом в кавычках, а они снимают и род,
              и падеж — работает и для «Луна над островом». */}
          Видишь, что дышит? Следующий старт вырастит здесь «
          {ISLAND_ELEMENT_NAMES[count]}». Коснись острова — вспомню, как что появилось.
        </p>
      )}

      {/* Витрина редких: найденные — в цвете, остальные — силуэты «???».
          Цель на горизонте: человек с первого дня видит, что есть что искать. */}
      {starts !== null && (
        <div className="glass flex flex-col gap-3 rounded-2xl p-4">
          <p className="text-sm font-semibold">Редкие события</p>
          <div className="grid grid-cols-4 gap-2">
            {ISLAND_POOL.filter((e) => e.rarity === 'rare').map((rare) => {
              const found = finds.some((f) => f.key === rare.key)
              const sprite = findSprites[rare.key]
              return (
                <div
                  key={rare.key}
                  // aria-label вместо голого «???»: скринридер иначе читает три
                  // литерных знака вопроса подряд, без всякого смысла — тут
                  // должно звучать «пока не найдено», как и выглядит визуально.
                  aria-label={found ? rare.name : 'Редкая находка, пока не найдена'}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center ${
                    found ? 'border-reward/60 shadow-[0_0_14px_-4px_var(--color-reward)]' : 'border-white/12'
                  }`}
                >
                  <svg viewBox="-32 -44 64 56" className="h-9 w-12" aria-hidden="true">
                    <g opacity={found ? 1 : 0.45} style={found ? undefined : { filter: 'saturate(0)' }}>
                      {sprite}
                    </g>
                  </svg>
                  <span
                    aria-hidden="true"
                    className={`text-[11px] font-semibold leading-tight ${
                      found ? '' : 'text-muted-foreground'
                    }`}
                  >
                    {found ? rare.name : '???'}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Полная сессия повышает шанс редкой находки
          </p>
        </div>
      )}

      {starts !== null && count > 0 && (
        <ul className="flex flex-col gap-2">
          {recentDiary.map((entry) => (
            <li
              key={entry.id}
              className="glass flex items-start justify-between gap-3 rounded-xl px-4 py-3"
              style={
                entry.isNewToday
                  ? ({ '--glass-border': 'oklch(0.86 0.22 130 / 0.5)' } as CSSProperties)
                  : undefined
              }
            >
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {entry.name}
                    {entry.rarity === 'rare' && (
                      <span className="rounded-full bg-reward/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-reward">
                      {RARITY_LABEL.rare}
                    </span>
                  )}
                  {entry.isNewToday && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      новое
                    </span>
                  )}
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {formatDate(entry.date)} — ты начал «{entry.label}»
                </span>
              </div>
            </li>
          ))}
          {diary.length > recentDiary.length && (
            <li className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-muted-foreground backdrop-blur-sm">
              И ещё {diary.length - recentDiary.length} записей раньше — всё это по-прежнему на
              острове.
            </li>
          )}
        </ul>
      )}

      {patterns && patterns.totalStarts > 0 && (
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Всего стартов: {patterns.totalStarts}
          {rareCount > 0 ? ` · редких находок: ${rareCount}` : ''}. Это число только растёт.
        </p>
      )}
    </div>
  )
}
