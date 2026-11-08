'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MascotDoll } from '@/components/mascot-doll'
import copy from '@/content/sdvg-copy.ru.json'
import { SPHERES, TYPES, type ProcType, type SdvgSphere } from '@/lib/sdvg'

/**
 * После первой сессии из теста (research/14-lead-magnets/owner-asrs-bridge.md): празднование, план «если — то» на
 * завтра, «1 из 7», затем «Сохранить прогресс и план на 7 дней» с отдельным неотмеченным согласием.
 * Сохранение: Telegram — если задан бот (NEXT_PUBLIC_TG_BOT, deep-link start=<тип>_<сфера>); почта и VK/MAX — когда
 * появится хранилище в РФ (файл владельца: «поднять хранение до включения "Сохранить прогресс"»). До тех пор честная
 * строка «скоро» и прогресс на устройстве. В бот уходят только тип и сфера — никогда балл и диапазон.
 */
const PLAN_KEY = 'naparnik:ifThen'
const BOT = process.env.NEXT_PUBLIC_TG_BOT?.trim() || ''

export function AfterSession() {
  const [type, setType] = useState<ProcType | null>(null)
  const [sphere, setSphere] = useState<SdvgSphere>('all')
  const [when, setWhen] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const [consent, setConsent] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const t = (q.get('t') ?? '').toUpperCase()
    const s = q.get('s') ?? ''
    if ((TYPES as readonly string[]).includes(t)) setType(t as ProcType)
    if ((SPHERES as readonly string[]).includes(s)) setSphere(s as SdvgSphere)
  }, [])

  const options = copy.after.options
  const chosen = when === options[3] ? custom.trim() : when
  useEffect(() => {
    if (!chosen) return
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify({ when: chosen, at: Date.now() }))
    } catch {
      /* план просто не запомнится */
    }
  }, [chosen])

  const tgLink = BOT && type ? `https://t.me/${BOT}?start=${type.toLowerCase()}_${sphere}` : ''

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-10 pt-8 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <MascotDoll expression="happy" action="celebrate" size={120} label="Напарник радуется" />
        <h1 className="text-[24px] font-bold leading-tight">{copy.after.done}</h1>
        <p className="font-mono text-sm text-muted-foreground">{copy.after.progress}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold">{copy.after.question}</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.after.question}>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={when === o}
              onClick={() => setWhen(o)}
              className={`min-h-11 rounded-full border px-4 text-[15px] ${when === o ? 'border-primary bg-primary/15' : 'border-border bg-card'}`}
            >
              {o}
            </button>
          ))}
        </div>
        {when === options[3] && (
          <input
            className="h-12 rounded-xl border border-border bg-card px-4 text-[17px] outline-none focus:ring-2 focus:ring-ring"
            placeholder={copy.after.customPlaceholder}
            maxLength={60}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        {chosen && <p className="text-[16px] leading-relaxed">{copy.after.plan.replace('{when}', chosen)}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[18px] font-semibold">{copy.after.save}</h2>
        <label className="flex items-start gap-3 text-sm leading-snug">
          <input type="checkbox" className="mt-0.5 size-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            {copy.after.consent} (
            <Link href="/privacy" className="underline">
              политика
            </Link>
            )
          </span>
        </label>
        {tgLink ? (
          <a
            href={consent ? tgLink : undefined}
            aria-disabled={!consent}
            className={`flex h-12 items-center justify-center rounded-xl border border-border text-[16px] font-semibold ${consent ? '' : 'pointer-events-none opacity-40'}`}
          >
            {copy.after.telegram}
          </a>
        ) : null}
        <p className="text-sm text-muted-foreground">{copy.after.soon}</p>
      </section>

      <Link href="/app" className="btn-chunky block w-full select-none rounded-[16px]">
        <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold text-primary-foreground">
          {copy.after.home}
        </span>
      </Link>
    </main>
  )
}
