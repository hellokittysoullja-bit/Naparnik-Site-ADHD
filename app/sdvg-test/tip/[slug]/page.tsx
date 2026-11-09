import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MascotDoll } from '@/components/mascot-doll'
import copy from '@/content/sdvg-copy.ru.json'
import { TYPE_SLUG, typeFromSlug } from '@/lib/sdvg'

/**
 * Пересланная ссылка «Поделиться своим типом»: только тип, никогда балл или диапазон (research/14). Карточка ссылки
 * в Telegram и мессенджерах — картинка этого типа (public/og/sdvg-<slug>.png, design/brand/sdvg-og.mjs).
 */
export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(TYPE_SLUG).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const type = typeFromSlug(slug)
  if (!type) return {}
  const title = copy.types[type].title
  return {
    title: `Тип прокрастинации — ${title} | Напарник`,
    description: copy.friend.text,
    alternates: { canonical: '/sdvg-test' },
    robots: { index: false, follow: true },
    openGraph: {
      title: `Я — ${title}: ${copy.types[type].share}`,
      description: 'А ты? Тест на 1–2 минуты.',
      images: [{ url: `/og/sdvg-${slug}.png`, width: 1200, height: 630 }],
    },
  }
}

export default async function FriendTypePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const type = typeFromSlug(slug)
  if (!type) notFound()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-4 py-10 text-center text-foreground">
      <MascotDoll expression="happy" action="wave" size={140} label="Напарник" />
      <h1 className="text-[26px] font-bold leading-tight">{copy.friend.title.replace('{type}', copy.types[type].title)}</h1>
      <p className="font-hand text-[24px] leading-snug">{copy.friend.quote.replace('{line}', copy.types[type].share)}</p>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.friend.text}</p>
      <Link href="/sdvg-test?src=share" className="btn-chunky mt-2 block w-full select-none rounded-[16px]">
        <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 text-[17px] font-bold text-primary-foreground">
          {copy.friend.button}
        </span>
      </Link>
    </main>
  )
}
