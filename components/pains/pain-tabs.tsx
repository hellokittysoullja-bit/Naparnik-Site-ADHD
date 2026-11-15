'use client'

import { useState } from 'react'
import type { Pain } from '@/content/pains.ru'

/**
 * Вкладки болей (у Marvin — ряд кнопок «Time Blindness / Low Motivation / …», под ним панель выбранной). Панели
 * приходят с сервера готовыми и все лежат в HTML: без JS видна первая, поисковик и читалка видят все шесть.
 */
export function PainTabs({ pains, panels }: { pains: Pick<Pain, 'slug' | 'tab' | 'hue'>[]; panels: React.ReactNode[] }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div role="tablist" aria-label="Что мешает" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
        {pains.map((p, i) => (
          <button
            key={p.slug}
            type="button"
            role="tab"
            id={`pain-tab-${p.slug}`}
            aria-selected={i === active}
            aria-controls={`pain-${p.slug}`}
            onClick={() => setActive(i)}
            className={`press h-11 shrink-0 rounded-full border px-4 text-[14.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              i === active ? 'border-transparent bg-[oklch(0.97_0.005_100)] text-[#141a10] shadow-[0_2px_0_oklch(0.75_0.01_100)]' : 'border-white/12 bg-white/5 text-foreground/85'
            }`}
          >
            {p.tab}
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div key={pains[i].slug} role="tabpanel" id={`pain-${pains[i].slug}`} aria-labelledby={`pain-tab-${pains[i].slug}`} hidden={i !== active} className="pain-panel mt-6">
          {panel}
        </div>
      ))}
    </div>
  )
}
