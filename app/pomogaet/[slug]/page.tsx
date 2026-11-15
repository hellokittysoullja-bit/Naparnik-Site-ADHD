import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PainsPage } from '@/components/pains/pains-page'
import { PAINS } from '@/content/pains.ru'
import { preloadFonts } from '@/lib/font-preload'

export const dynamicParams = false

export function generateStaticParams() {
  return PAINS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pain = PAINS.find((p) => p.slug === slug)
  if (!pain) return {}
  return { title: `${pain.title} — Напарник`, description: `${pain.lead} ${pain.helps.map((h) => h.name).join(', ')}.`, alternates: { canonical: `/pomogaet/${pain.slug}` } }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pain = PAINS.find((p) => p.slug === slug)
  if (!pain) notFound()
  preloadFonts('manrope-700-cyr', 'caveat-400-cyr')
  return <PainsPage only={pain} />
}
