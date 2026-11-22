import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FocusSession } from '@/components/focus-session'
import { FocusScene } from '@/components/focus-scene'
import { preloadCatPoster } from '@/lib/font-preload'

export const metadata: Metadata = {
  title: 'Фокус — Напарник',
  description: 'Фокус-сессия вдвоём с напарником.',
}

export default function SessionPage() {
  preloadCatPoster() // кот — самый крупный элемент экрана, а сам экран появляется только после загрузки кода
  return (
    <main className="session-main app-page-enter flex min-h-dvh flex-col pb-[calc(4.5rem+var(--sab))]">
      <FocusScene />
      <Suspense fallback={null}>
        <FocusSession />
      </Suspense>
    </main>
  )
}
