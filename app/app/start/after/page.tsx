import type { Metadata } from 'next'
import { AfterFirst } from '@/components/onboarding/after-first'

export const metadata: Metadata = {
  title: 'Как было? — Напарник',
  description: 'После первых двух минут: как прошло и когда посидим завтра.',
}

export default function AfterFirstPage() {
  return <AfterFirst />
}
