import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PainsPage } from '@/components/pains/pains-page'
import { PAINS } from '@/content/pains.ru'
import { preloadFonts } from '@/lib/font-preload'
import { JsonLd } from '@/components/json-ld'
import { pageLd } from '@/lib/structured-data'
import { pageMetadata } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return PAINS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const pain = PAINS.find((p) => p.slug === slug)
  if (!pain) return {}
  return pageMetadata({
    path: `/pomogaet/${pain.slug}`,
    title: `${pain.title} — Напарник`,
    description: `${pain.lead} ${pain.helps.map((h) => h.name).join(', ')}.`,
    type: 'article',
  })
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const pain = PAINS.find((p) => p.slug === slug)
  if (!pain) notFound()
  preloadFonts('manrope-700-cyr')
  const path = `/pomogaet/${pain.slug}`
  const ld = pageLd({
    path,
    name: pain.title,
    description: pain.lead,
    crumbs: [
      { name: 'Что мешает начать', path: '/pomogaet' },
      { name: pain.tab, path },
    ],
  })
  return (
    <>
      <PainsPage only={pain} />
      <JsonLd data={ld} />
    </>
  )
}
