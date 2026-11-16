'use client'

import { Sheet } from '@/components/ui/sheet'
import { DealIcon } from '@/components/deal-icon'
import { TEMPLATE_GROUPS, type Template } from '@/lib/templates'

/**
 * «Готовые дела» — как «Шаблоны» у goblin.tools: окно со списком по группам, слева значок, справа число шагов; тап —
 * шаги сразу на экране (research/25-deep-teardowns/img/goblin-todo-templates-m.png). Оформление своё: лист снизу,
 * плитки-значки вместо эмодзи, под названием — сколько минут займёт всё дело.
 */
export function TemplatesSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Template) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Готовые шаги" caption="Уже разломаны на шаги. Выбери дело, и первый шаг встанет на экран.">
      <div className="flex flex-col gap-4 pt-1">
        {TEMPLATE_GROUPS.map((g) => (
          <section key={g.key}>
            <h3 className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary/90">{g.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {g.items.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => onPick(t)}
                    className="option-card flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
                  >
                    <DealIcon name={t.icon} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15.5px] font-semibold">{t.title}</span>
                      <span className="block font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
                        ≈ {t.steps.reduce((a, s) => a + s.minutes, 0)} мин · первый шаг {t.steps[0].minutes} мин
                      </span>
                    </span>
                    <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-white/8 px-2 font-mono text-[12px] font-semibold tabular-nums text-foreground/80">
                      {t.steps.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
