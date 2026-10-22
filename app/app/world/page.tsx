import type { Metadata } from 'next'
import { Island } from '@/components/island'
import { preloadFonts } from '@/lib/font-preload'

export const metadata: Metadata = {
  title: 'Мир — Напарник',
  description: 'Остров напарника — дневник твоих стартов. Ничего не сгорает.',
}

export default function WorldPage() {
  preloadFonts('manrope-700-cyr') // жирные подписи острова на первом экране
  return (
    <main className="app-page-enter flex min-h-dvh flex-col pb-20">
      <Island />
    </main>
  )
}
