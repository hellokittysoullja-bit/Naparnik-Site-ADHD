'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { giveCookieConsent, hasCookieConsent } from '@/lib/cookie-consent'

/**
 * Плашка о cookie при первом визите (16.11, чек-лист РКН 2026, раздел 4): что ставим, ссылка на политику и явная
 * кнопка «Понятно». До нажатия метка посетителя не ставится (components/visit-beacon.tsx). Не toast: не исчезает
 * сама и не всплывает на событие, это постоянная строка до ответа человека.
 *
 * Где: на входных страницах (лендинг, первый экран теста, каталог, документы). На экранах приложения (/app) и на
 * шагах теста (?step=…, кроме первого экрана intro) её нет: наверху там «Назад», внизу главная кнопка и меню — плашка закрыла бы их. Место — над сценой, а не внизу:
 * внизу лендинга и теста стоит главная кнопка, плашка не должна её закрывать.
 * Рисуется только после монтирования (согласие лежит на устройстве) и лежит поверх страницы — вёрстку не сдвигает.
 */
export function CookieNotice() {
  const path = usePathname()
  const step = useSearchParams()?.get('step')
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(!hasCookieConsent())
  }, [])
  if (!show || path?.startsWith('/app') || (path === '/sdvg-test' && step && step !== 'intro')) return null
  return (
    <div
      role="region"
      aria-label="Cookie"
      className="cookie-notice fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[oklch(0.2_0.02_150/0.94)] py-2.5 pl-4 pr-2.5 text-[13px] leading-snug text-foreground/85 shadow-[0_12px_32px_-12px_oklch(0_0_0/0.6)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:top-auto"
    >
      <p className="min-w-0 flex-1">
        Сайт ставит cookie: метку посетителя и откуда вы пришли.{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          Подробнее
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          giveCookieConsent()
          setShow(false)
        }}
        className="h-10 shrink-0 rounded-xl bg-white/10 px-4 text-[14px] font-semibold text-foreground"
      >
        Понятно
      </button>
    </div>
  )
}
