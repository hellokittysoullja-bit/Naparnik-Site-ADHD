import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FocusSession } from '@/components/focus-session'
import { preloadCatPoster, preloadFonts } from '@/lib/font-preload'

export const metadata: Metadata = {
  title: 'Фокус — Напарник',
  description: 'Фокус-сессия вдвоём с напарником. Старт засчитывается сразу.',
}

export default function SessionPage() {
  preloadFonts('caveat-400-cyr') // рукопись в репликах напарника на первом экране
  preloadCatPoster() // кот — самый крупный элемент экрана, а сам экран появляется только после загрузки кода
  return (
    <main className="session-main app-page-enter flex min-h-dvh flex-col pb-16">
      <Suspense fallback={null}>
        <FocusSession />
      </Suspense>
    </main>
  )
}
