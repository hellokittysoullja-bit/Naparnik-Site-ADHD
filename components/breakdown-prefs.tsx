'use client'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/sheet'
import { activeAsks, setAsk, type AskKey } from '@/lib/asks'

const ASKS: { key: AskKey; label: string; hint: string }[] = [
  { key: 'short', label: 'Отвечай короче', hint: 'Одна-две фразы, без вступлений' },
  { key: 'literal', label: 'Пиши буквально', hint: 'Без намёков и образов, прямо что делать' },
  { key: 'nojokes', label: 'Без шуток', hint: 'Спокойно и по делу' },
  { key: 'nopraise', label: 'Без похвалы', hint: 'Не хвалить за каждую мелочь' },
  { key: 'tiny', label: 'Шаги всегда мельче', hint: 'Каждый шаг на одну-две минуты' },
]
import { hapticThreshold } from '@/lib/haptics'

/**
 * «Как дробить»: размер шагов и просьбы к коту.
 *  - Размер шагов — «уровень остроты» goblin.tools: ползунок рядом с полем, подпись «Насколько подробно разбивать
 *    задачи? Вы можете изменить это в любое время, и настройка применится ко всем элементам»
 *    (research/25-deep-teardowns/img/goblin-todo-spiciness-m.png). У них 5 делений перчиками; у нас 3 деления со словами —
 *    пять уровней без подписей заставляют гадать, чем третий отличается от четвёртого.
 *  - Просьбы — их Pro-«инструкции»: задал один раз, слушаются все инструменты (lib/asks.ts).
 */
export type Fineness = 'coarse' | 'normal' | 'fine'
const KEY = 'naparnik:fineness'
const LEVELS: { key: Fineness; label: string; hint: string }[] = [
  // все уровни ведут дело до конца; меняется размер и число шагов (lib/ai/agents/breakdown.ts)
  { key: 'coarse', label: 'Крупнее', hint: 'Несколько крупных этапов, до 20 минут каждый' },
  { key: 'normal', label: 'Как обычно', hint: 'Шаги на несколько минут, от начала до конца' },
  { key: 'fine', label: 'Мельче', hint: 'Много шагов, каждый на одно движение рукой' },
]

export function readFineness(): Fineness {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'coarse' || v === 'fine' ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export function BreakdownPrefs({
  open,
  onClose,
  fineness,
  onFineness,
}: {
  open: boolean
  onClose: () => void
  fineness: Fineness
  onFineness: (f: Fineness) => void
}) {
  const [asks, setAsks] = useState<AskKey[]>([])
  useEffect(() => {
    if (open) setAsks(activeAsks())
  }, [open])
  const index = LEVELS.findIndex((l) => l.key === fineness)
  const pick = (i: number) => {
    const next = LEVELS[i].key
    if (next === fineness) return
    hapticThreshold()
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      /* приватный режим: выбор живёт до перезагрузки */
    }
    onFineness(next)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Как дробить" caption="Настрой один раз. Я запомню и буду так делать везде.">
      <section className="pt-2">
        <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary/90">размер шагов</h3>
        <div className="fineness mt-3" style={{ ['--i' as string]: index }}>
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={index}
            onChange={(e) => pick(Number(e.target.value))}
            aria-label="Размер шагов"
            aria-valuetext={LEVELS[index].label}
            className="fineness-range"
          />
          <div className="mt-1 grid grid-cols-3 text-center">
            {LEVELS.map((l, i) => (
              <button
                key={l.key}
                type="button"
                onClick={() => pick(i)}
                className={`min-h-11 text-[13.5px] font-semibold transition-colors ${i === 0 ? 'text-left' : i === 2 ? 'text-right' : ''} ${
                  i === index ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[14px] leading-snug text-muted-foreground">
          {LEVELS[index].hint}. Сменить можно в любой момент, следующее дело разломаю уже так.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary/90">просьбы ко мне</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ASKS.map((a) => {
            const on = asks.includes(a.key)
            return (
              <li key={a.key}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => {
                    hapticThreshold()
                    setAsks(setAsk(a.key, !on))
                  }}
                  className="option-card flex min-h-[58px] w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
                  data-selected={on ? '' : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15.5px] font-semibold ${on ? 'text-primary' : ''}`}>{a.label}</span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">{a.hint}</span>
                  </span>
                  <span aria-hidden="true" className={`switch ${on ? 'switch-on' : ''}`} />
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Просьбы лежат только на этом устройстве. Выключил, и я сразу говорю как раньше.</p>
      </section>
    </Sheet>
  )
}
