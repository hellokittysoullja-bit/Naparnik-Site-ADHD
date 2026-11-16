import type { Metadata } from 'next'
import { PainsPage } from '@/components/pains/pains-page'
import { preloadFonts } from '@/lib/font-preload'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Что мешает начать и что с этим делает Напарник',
  description: 'Не могу начать, дело слишком большое, время утекает, в голове каша, скучно, бросаю после пропуска. На каждую боль три приёма и экран, который открывается сразу.',
  alternates: { canonical: '/pomogaet' },
}

export default function Page() {
  preloadFonts('manrope-700-cyr')
  return <PainsPage />
}
