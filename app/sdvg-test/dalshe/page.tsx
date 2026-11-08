import type { Metadata } from 'next'
import { AfterSession } from '@/components/sdvg/after-session'

export const metadata: Metadata = {
  title: 'Старт есть — Напарник',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-static'

export default function AfterSessionPage() {
  return <AfterSession />
}
