'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { giveCookieConsent, hasCookieConsent } from '@/lib/cookie-consent'

/**
 * Плашка о cookie при первом визите (16.11, чек-лист РКН 2026, раздел 4): что ставим, ссылка на политику и явная
 * кнопка «Разрешить и закрыть». До нажатия метка посетителя не ставится (components/visit-beacon.tsx). Не toast: не исчезает
 * сама и не всплывает на событие, это постоянная строка до ответа человека.
 *
 * Где: на входных страницах (лендинг, первый экран теста, каталог, документы). На экранах приложения (/app) и на
 * шагах теста (?step=…, кроме первого экрана intro) её нет: наверху там «Назад», внизу главная кнопка и меню — плашка закрыла бы их. Место — над сценой, а не внизу:
 * внизу лендинга и теста стоит главная кнопка, плашка не должна её закрывать.
 * Лежит поверх страницы — вёрстку не сдвигает.
 */
// До первой отрисовки: согласие уже дано или открыт шаг теста — плашку прячем атрибутом на <html> (правило в globals.css).
// Раньше плашка рисовалась только после загрузки кода и всплывала поверх готовой страницы, а на тесте ещё и исчезала и
// появлялась заново (16.11, покадровый аудит). Теперь она в HTML с первого кадра, а кому не нужна — не видят её ни на кадр.
const PREPAINT = `try{var h=document.documentElement;if(localStorage.getItem('naparnik:cookies')==='1')h.setAttribute('data-cookies-ok','');var s=new URLSearchParams(location.search).get('step');if(location.pathname==='/sdvg-test'&&s&&s!=='intro')h.setAttribute('data-test-step','')}catch(e){}`

/** шаг теста меняется без перезагрузки (history.pushState) — держим атрибут на <html> в курсе; Suspense нужен только ему */
function StepWatcher() {
  const path = usePathname()
  const step = useSearchParams()?.get('step')
  useEffect(() => {
    if (path === '/sdvg-test' && step && step !== 'intro') document.documentElement.setAttribute('data-test-step', '')
    else document.documentElement.removeAttribute('data-test-step')
  }, [path, step])
  return null
}

export function CookieNotice() {
  const path = usePathname()
  // в HTML плашка есть всегда (кроме /app); после загрузки кода — только пока нет согласия
  const [show, setShow] = useState(true)
  useEffect(() => {
    setShow(!hasCookieConsent())
  }, [])
  if (path?.startsWith('/app')) return null
  const watcher = (
    <Suspense fallback={null}>
      <StepWatcher />
    </Suspense>
  )
  if (!show) return watcher
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      {watcher}
    <div
      role="region"
      aria-label="Cookie"
      className="cookie-notice fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md flex-col items-center gap-2.5 rounded-2xl border border-white/10 bg-[oklch(0.2_0.02_150/0.94)] px-4 py-3 text-center text-[13px] leading-snug text-foreground/85 shadow-[0_12px_32px_-12px_oklch(0_0_0/0.6)] lg:inset-x-auto lg:bottom-6 lg:left-6 lg:top-auto"
    >
      {/* Текст как у образца владельца (16.11), но без «продолжая использование, вы соглашаетесь»: у нас метка ставится
          только после нажатия, и чек-лист РКН такую фразу согласием не считает */}
      <p>
        Мы используем файлы cookie, чтобы улучшить работу сайта. Нажимая «Разрешить и закрыть», вы соглашаетесь с нашей{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          политикой конфиденциальности
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          giveCookieConsent()
          document.documentElement.setAttribute('data-cookies-ok', '')
          setShow(false)
        }}
        className="h-11 w-full shrink-0 rounded-[14px] bg-white/12 px-6 text-[15px] font-semibold text-foreground"
      >
        Разрешить и закрыть
      </button>
    </div>
    </>
  )
}
