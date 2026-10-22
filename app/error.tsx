'use client'

import { AppBackdrop } from '@/components/app-backdrop'
import { MascotDoll as MascotSvg } from '@/components/mascot-doll'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <AppBackdrop />
      {/* Содержимое — в своём позиционированном слое: AppBackdrop fixed и без z-index, а непозиционированный
          текст и кнопка рисовались ПОД ним — на экране был только кот (он relative), без текста и кнопки */}
      <div className="relative flex flex-col items-center gap-6">
        <MascotSvg expression="sleepy" label="Напарник споткнулся" size={120} />
        <div className="flex flex-col gap-2">
          <p className="font-hand text-3xl text-foreground">Ой. Я споткнулся.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Что-то пошло не так, но твой остров и старты целы. Попробуем ещё раз?
          </p>
        </div>
        <Button onClick={reset} size="lg" className="font-semibold">
          Попробовать снова
        </Button>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          техническая ошибка — не твоя вина
        </span>
      </div>
    </main>
  )
}
