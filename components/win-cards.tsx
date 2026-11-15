'use client'

import { ArrowRight, Lightbulb, Trophy } from 'lucide-react'

/**
 * Три карточки после сессии — «Win / Action / Insight» у Shimmer (лента «Session summaries & insight cards»: цветные
 * карточки внахлёст под наклоном, у каждой бирка со значком; research/25-deep-teardowns/img/shimmer-appstore.png).
 * У них сводку пишет ИИ после разговора с коучем; у нас карточки собираются из того, что человек только что сделал:
 *  - «Получилось» — шаг и сколько минут он на самом деле занял;
 *  - «Дальше» — следующий шаг того же дела (или время следующего раза);
 *  - «Понял» — человек выбирает сам одним тапом, кот отвечает выводом на следующий раз.
 * Ничего не выдумывается: нет шага дальше — карточка так и говорит.
 */
const INSIGHT: Record<string, string> = {
  Легко: 'Такие шаги мне по силам. Можно брать чуть больше.',
  Нормально: 'Размер шага в самый раз. Так и держим.',
  Тяжело: 'Шаг был великоват. Следующий делаем мельче.',
}

export function WinCards({
  win,
  minutes,
  next,
  howWas,
  onHowWas,
}: {
  win: string
  minutes: number
  next: string | null
  howWas: string | null
  onHowWas: (v: string) => void
}) {
  return (
    <div className="relative z-[1] -mt-7 grid w-full grid-cols-3 gap-0 px-1" aria-label="Итог сессии">
      <article className="win-card relative z-[1] -mr-2 flex min-h-[104px] flex-col gap-1.5 rounded-2xl p-2.5" style={{ ['--tilt' as string]: '-3deg', ['--hue' as string]: 88, ['--d' as string]: '0ms' }}>
        <Tag icon={Trophy} label="Получилось" />
        <p className="line-clamp-3 text-[12.5px] font-bold leading-[1.25] [overflow-wrap:anywhere]">{win}</p>
        <p className="mt-auto font-mono text-[10px] font-semibold uppercase tracking-wider opacity-75">{minutes < 1 ? 'меньше минуты' : `${minutes} мин`}</p>
      </article>
      <article className="win-card relative z-[2] mt-3 flex min-h-[104px] flex-col gap-1.5 rounded-2xl p-2.5" style={{ ['--tilt' as string]: '2deg', ['--hue' as string]: 205, ['--d' as string]: '90ms' }}>
        <Tag icon={ArrowRight} label="Дальше" />
        <p className="line-clamp-4 text-[12.5px] font-bold leading-[1.25] [overflow-wrap:anywhere]">{next ?? 'Шагов в этом деле больше нет. Можно взять новое.'}</p>
      </article>
      <article className="win-card relative z-[3] -ml-2 flex min-h-[104px] flex-col gap-1.5 rounded-2xl p-2.5" style={{ ['--tilt' as string]: '-1.5deg', ['--hue' as string]: 320, ['--d' as string]: '180ms' }}>
        <Tag icon={Lightbulb} label="Понял" />
        <p className="text-[12.5px] font-bold leading-[1.25]">{howWas ? INSIGHT[howWas] : 'Как было? Ответь ниже, запишу вывод.'}</p>
      </article>
      {/* ответ — отдельным рядом под карточками: три кнопки внутри карточки выходили по 26 px, пальцем не попасть */}
      {!howWas && (
        <div className="col-span-3 mt-2.5 flex items-center justify-center gap-1.5" role="group" aria-label="Как было? Можно не отвечать">
          {Object.keys(INSIGHT).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onHowWas(v)}
              className="press h-11 flex-1 rounded-full border border-white/12 bg-white/5 text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Tag({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <p className="flex items-center gap-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] opacity-80">
      <Icon className="size-3" strokeWidth={2.6} aria-hidden="true" />
      {label}
    </p>
  )
}
