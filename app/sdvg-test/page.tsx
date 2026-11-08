import type { Metadata } from 'next'
import { SdvgTest } from '@/components/sdvg/sdvg-test'

export const metadata: Metadata = {
  title: 'Тест на СДВГ для взрослых онлайн — ASRS v1.1 (ВОЗ) и тип прокрастинации | Напарник',
  description:
    '6 вопросов опросника ВОЗ ASRS v1.1 о признаках СДВГ у взрослых и 4 вопроса о том, как ты откладываешь дела. Результат сразу, без почты и регистрации. Это самопроверка, а не диагноз.',
  alternates: { canonical: '/sdvg-test' },
  openGraph: {
    title: 'Что мешает тебе начинать дела?',
    description: 'Тест на 1–2 минуты: 6 вопросов ВОЗ + 4 вопроса от Напарника. Без почты и регистрации.',
    url: '/sdvg-test',
  },
}

export const dynamic = 'force-static'

export default function SdvgTestPage() {
  return <SdvgTest />
}
