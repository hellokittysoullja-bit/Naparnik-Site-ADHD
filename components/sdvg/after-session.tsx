'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MascotDoll } from '@/components/mascot-doll'
import copy from '@/content/sdvg-copy.ru.json'
import { SPHERES, TYPES, type ProcType, type SdvgSphere } from '@/lib/sdvg'
import { downloadIcs } from '@/lib/calendar'

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
  /** условие своими словами: подставляется из выбранного варианта, человек может дописать (эффект генерации) */
  const [cue, setCue] = useState('')
  const [time, setTime] = useState<string | null>(null)
  const [ownTime, setOwnTime] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [channel, setChannel] = useState<'tg' | 'email' | null>(null)
  const [consent, setConsent] = useState(false)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const t = (q.get('t') ?? '').toUpperCase()
    const s = q.get('s') ?? ''
    if ((TYPES as readonly string[]).includes(t)) setType(t as ProcType)
    if ((SPHERES as readonly string[]).includes(s)) setSphere(s as SdvgSphere)
  }, [])

  const options = copy.after.options
  const times = copy.after.times
  const chosen = cue.trim()
  const chosenTime = time === times[3] ? ownTime : time
  useEffect(() => {
    if (!chosen) return
    try {
      window.localStorage.setItem(PLAN_KEY, JSON.stringify({ when: chosen, time: chosenTime || undefined, at: Date.now() }))
    } catch {
      /* план просто не запомнится */
    }
  }, [chosen, chosenTime])

  const tgLink = BOT && type ? `https://t.me/${BOT}?start=${type.toLowerCase()}_${sphere}` : ''

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-10 pt-8 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <MascotDoll expression="happy" action="celebrate" size={120} label="Напарник радуется" />
        <h1 className="text-[24px] font-bold leading-tight">{copy.after.done}</h1>
        {type && <p className="text-[16px] leading-relaxed">{copy.types[type].after}</p>}
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
              onClick={() => {
                setWhen(o)
                setCue(o === options[3] ? '' : o)
              }}
              className={`min-h-11 rounded-full border px-4 text-[15px] ${when === o ? 'border-primary bg-primary/15' : 'border-border bg-card'}`}
            >
              {o}
            </button>
          ))}
        </div>
        {when && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] leading-relaxed">
            <span>{copy.after.planBefore}</span>
            <input
              className="h-11 min-w-0 flex-1 basis-40 rounded-xl border border-border bg-card px-3 text-[16px] outline-none focus:ring-2 focus:ring-ring"
              placeholder={copy.after.customPlaceholder}
              aria-label={copy.after.planAria}
              maxLength={60}
              value={cue}
              autoFocus={when === options[3]}
              onChange={(e) => setCue(e.target.value)}
            />
            <span>{copy.after.planAfter}</span>
          </p>
        )}
        {chosen && (
          <>
            <h3 className="pt-1 text-[16px] font-semibold">{copy.after.timeQuestion}</h3>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.after.timeQuestion}>
              {times.map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={time === o}
                  onClick={() => setTime(o)}
                  className={`min-h-11 rounded-full border px-4 text-[15px] ${time === o ? 'border-primary bg-primary/15' : 'border-border bg-card'}`}
                >
                  {o}
                </button>
              ))}
              {time === times[3] && (
                <input
                  type="time"
                  aria-label={copy.after.timeAria}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-[16px] outline-none focus:ring-2 focus:ring-ring"
                  value={ownTime}
                  onChange={(e) => setOwnTime(e.target.value)}
                />
              )}
            </div>
            {/* кнопка-обещание вместо «Дальше»; после неё — бронь в календарь, если выбрано время */}
            {agreed ? (
              <div className="flex flex-col gap-2">
                <p className="font-hand text-[20px]" role="status">
                  {copy.after.agreed}
                </p>
                {/^\d{1,2}:\d{2}$/.test(chosenTime ?? '') && (
                  <button
                    type="button"
                    className="h-12 rounded-xl border border-border text-[16px] font-semibold"
                    onClick={() => downloadIcs(chosen, chosenTime as string)}
                  >
                    {copy.after.calendar}
                  </button>
                )}
              </div>
            ) : (
              <button type="button" className="h-12 rounded-xl border border-primary bg-primary/15 text-[16px] font-bold" onClick={() => setAgreed(true)}>
                {copy.after.agree}
              </button>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[18px] font-semibold">{copy.after.save}</h2>
        {/* два шага (последовательность): сначала лёгкий выбор «куда», потом согласие и сам контакт */}
        <p className="text-[15px]">{copy.after.where}</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={copy.after.where}>
          {(['tg', 'email'] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={channel === c}
              onClick={() => setChannel(c)}
              className={`h-12 rounded-xl border text-[16px] font-semibold ${channel === c ? 'border-primary bg-primary/15' : 'border-border'}`}
            >
              {c === 'tg' ? copy.after.telegram : copy.after.email}
            </button>
          ))}
        </div>
        {channel === 'tg' && tgLink && (
          <>
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
            <a
              href={consent ? tgLink : undefined}
              aria-disabled={!consent}
              className={`flex h-12 items-center justify-center rounded-xl border border-border text-[16px] font-semibold ${consent ? '' : 'pointer-events-none opacity-40'}`}
            >
              {copy.after.tgOpen}
            </a>
          </>
        )}
        {channel === 'tg' && !tgLink && <p className="text-sm text-muted-foreground">{copy.after.tgSoon}</p>}
        {channel === 'email' && <p className="text-sm text-muted-foreground">{copy.after.emailSoon}</p>}
      </section>

      <Link href="/app" className="btn-chunky block w-full select-none rounded-[16px]">
        <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold text-primary-foreground">
          {copy.after.home}
        </span>
      </Link>
    </main>
  )
}
