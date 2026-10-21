'use client'

import { AppBackdrop } from '@/components/app-backdrop'
import { MascotSvg } from '@/components/mascot-svg'
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
    </main>
  )
}
