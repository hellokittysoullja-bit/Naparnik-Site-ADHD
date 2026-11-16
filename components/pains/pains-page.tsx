import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { asset } from '@/lib/asset-versions'
import { DOUBT, PAINS, type Pain } from '@/content/pains.ru'
import { PainPanel } from './pain-panel'
import { PainTabs } from './pain-tabs'
import { LegalLinks } from '@/components/legal-links'

/** Общая страница каталога (все боли вкладками) и страница одной боли (под ролик или поиск) — один каркас */
export function PainsPage({ only }: { only?: Pain }) {
  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-[max(1rem,env(safe-area-inset-top))] md:px-8">
      {/* небо — обычным слоем первым в разметке, без отрицательного z-index: он прячет fixed-слой под фон страницы (CLAUDE.md §3) */}
      <div aria-hidden="true" className="pains-sky pointer-events-none fixed inset-0" />
      <div className="relative">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-bold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset('/mascot/poster/neutral.webp')} alt="" width={36} height={36} className="size-9" />
          Напарник
        </Link>
        <Link href="/app/session" className="press inline-flex h-11 items-center rounded-full border border-white/15 px-4 text-[14px] font-semibold">
          Открыть
        </Link>
      </header>

      {only ? (
        <section className="mt-8 md:mt-12">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">что с этим делает Напарник</p>
          <div className="mt-3">
            <PainPanel pain={only} headingLevel={1} />
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 md:mt-14">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">боль → приём</p>
            <h1 className="mt-3 max-w-[18ch] text-balance text-[34px] font-bold leading-[1.08] tracking-[-0.025em] md:text-[56px]">
              С тобой всё в порядке. Просто начать трудно
            </h1>
            <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-foreground/80 md:text-[19px]">
              Выбери, что мешает прямо сейчас. Покажем, что именно с этим делает кот, и откроем нужный экран.
            </p>
          </section>
          <section className="mt-7 md:mt-10" aria-label="Что мешает и что с этим делать">
            <PainTabs pains={PAINS.map(({ slug, tab, hue }) => ({ slug, tab, hue }))} panels={PAINS.map((p) => <PainPanel key={p.slug} pain={p} />)} />
          </section>
        </>
      )}

      {/* Скепсис назван вслух и разобран по пунктам */}
      <section className="doubt mt-14 rounded-[28px] p-5 md:mt-20 md:p-9" aria-labelledby="doubt-title">
        <h2 id="doubt-title" className="max-w-[22ch] text-balance text-[26px] font-bold leading-[1.15] tracking-[-0.02em] md:text-[34px]">
          {DOUBT.title}
        </h2>
        <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-foreground/80">{DOUBT.lead}</p>
        <dl className="mt-5 grid gap-3 md:grid-cols-2">
          {DOUBT.points.map((p) => (
            <div key={p.name} className="rounded-[18px] border border-white/10 bg-[oklch(0.17_0.012_130/0.7)] p-4">
              <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-reward">{p.name}</dt>
              <dd className="mt-1.5 text-[15.5px] leading-snug">{p.text}</dd>
            </div>
          ))}
        </dl>
        <Link href={DOUBT.href} className="btn-chunky mt-5 block w-full select-none rounded-[16px] outline-none md:max-w-sm">
          <span className="btn-face flex h-[56px] items-center justify-center gap-2 rounded-[16px] bg-primary px-6 text-[17px] font-bold tracking-[-0.01em] text-primary-foreground">
            {DOUBT.cta}
            <ArrowRight className="size-5" strokeWidth={2.6} aria-hidden="true" />
          </span>
        </Link>
      </section>

      <nav className="mt-12" aria-label="Другие боли">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{only ? 'мешает другое?' : 'подробнее по каждой'}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PAINS.filter((p) => p.slug !== only?.slug).map((p) => (
            <li key={p.slug}>
              <Link href={`/pomogaet/${p.slug}`} className="press inline-flex h-11 items-center rounded-full border border-white/12 bg-white/5 px-4 text-[14.5px] font-semibold">
                {p.tab}
              </Link>
            </li>
          ))}
          {only && (
            <li>
              <Link href="/pomogaet" className="press inline-flex h-11 items-center rounded-full border border-primary/40 px-4 text-[14.5px] font-semibold text-primary">
                Все шесть
              </Link>
            </li>
          )}
        </ul>
      </nav>
      </div>
      <LegalLinks className="mt-12" />
    </main>
  )
}
