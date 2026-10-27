'use client'

import './globals.css'

/**
 * Последний рубеж: ошибка в самом корневом layout (app/error.tsx её не ловит — он живёт ВНУТРИ layout).
 * Без этого файла Next показывал бы свою белую английскую страницу. Здесь намеренно ничего тяжёлого: ни кота,
 * ни фона — компоненты, которые могли и уронить layout. Только голос напарника и кнопка «ещё раз».
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru" className="bg-background">
      <body className="antialiased font-sans">
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
          <div className="flex flex-col gap-2">
            <p className="font-hand text-3xl text-foreground">Ой. Я споткнулся.</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Что-то пошло не так, но твой остров и старты целы. Попробуем ещё раз?
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Попробовать снова
          </button>
        </main>
      </body>
    </html>
  )
}
