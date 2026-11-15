import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { asset } from '@/lib/asset-versions'
import type { Pain } from '@/content/pains.ru'

/** Одна боль: фраза человека, три приёма, настоящий экран и кнопка сразу в инструмент */
export function PainPanel({ pain, headingLevel = 2 }: { pain: Pain; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <article className="grid gap-6 md:grid-cols-[1fr_300px] md:items-start md:gap-10" style={{ ['--hue' as string]: pain.hue }}>
      <div>
        <H className="text-balance text-[26px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[34px]">{pain.title}</H>
        <p className="mt-3 font-hand text-[23px] leading-[1.25] text-[oklch(0.9_0.06_var(--hue))] md:text-[26px]">«{pain.lead}»</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {pain.helps.map((h) => (
            <li key={h.name} className="deal-card flex gap-3 rounded-[18px] p-3.5">
              <span
                aria-hidden="true"
                className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[oklch(0.74_0.12_var(--hue)/0.2)] text-[oklch(0.88_0.13_var(--hue))]"
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span>
                <span className="block text-[16px] font-bold leading-snug">{h.name}</span>
                <span className="mt-0.5 block text-[15px] leading-snug text-foreground/75">{h.text}</span>
              </span>
            </li>
          ))}
        </ul>
        <Link href={pain.href} className="btn-chunky mt-5 block w-full select-none rounded-[16px] outline-none md:max-w-sm">
          <span className="btn-face flex h-[56px] items-center justify-center gap-2 rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
            {pain.cta}
            <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden="true" />
          </span>
        </Link>
        <p className="mt-2 text-[13px] text-muted-foreground md:max-w-sm">Без регистрации. Откроется сразу нужный экран.</p>
      </div>
      {/* настоящий экран продукта в рамке телефона: не макет и не «пример», а снимок работающего сайта */}
      <figure className="phone-frame mx-auto w-[min(72vw,300px)] md:mx-0 md:w-[300px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(`/pomogaet/${pain.shot}.webp`)} alt={pain.shotAlt} width={390} height={844} loading="lazy" decoding="async" className="block h-auto w-full rounded-[26px]" />
      </figure>
    </article>
  )
}
