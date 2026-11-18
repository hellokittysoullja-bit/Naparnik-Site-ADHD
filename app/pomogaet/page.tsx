import type { Metadata } from 'next'
import { PainsPage } from '@/components/pains/pains-page'
import { preloadFonts } from '@/lib/font-preload'
import { JsonLd } from '@/components/json-ld'
import { PAINS } from '@/content/pains.ru'
import { pageLd } from '@/lib/structured-data'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Что мешает начать и что с этим делает Напарник',
  description: 'Не могу начать, дело слишком большое, время утекает, в голове каша, скучно, бросаю после пропуска. На каждую боль три приёма и экран, который открывается сразу.',
  alternates: { canonical: '/pomogaet' },
}

// каталог как список страниц-болей: поисковику и нейропоиску видно, что у каждой боли своя страница
const ld = pageLd({
  path: '/pomogaet',
  name: 'Что мешает начать и что с этим делает Напарник',
  description: metadata.description ?? undefined,
  crumbs: [{ name: 'Что мешает начать', path: '/pomogaet' }],
  extra: {
    '@type': ['WebPage', 'CollectionPage'],
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: PAINS.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, url: siteUrl(`/pomogaet/${p.slug}`) })),
    },
  },
})

export default function Page() {
  preloadFonts('manrope-700-cyr')
  return (
    <>
      <PainsPage />
      <JsonLd data={ld} />
    </>
  )
}
