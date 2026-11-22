'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { beginTgLink, linkTgInApp, peekTgState, refreshTgState, type PlanForBot, type TgState } from '@/lib/tg-link'
import { tgInitData, tgOpenLink } from '@/lib/tg-webapp'

/**
 * Под карточкой плана: «Напоминать в Telegram». Кот сам написать первым не может, пока человек не связал сайт с
 * ботом; эта кнопка и есть связь (одно касание, без аккаунта: lib/tg/link.ts). Правила экрана:
 *  - бота нет или сервер не ответил — ничего не рисуем: обещание без исполнения хуже отсутствия кнопки;
 *  - уже связан — вместо кнопки одна тихая строка, что напоминание придёт;
 *  - только под последним планом (current): бот зовёт на один шаг, и кнопка под старой карточкой подменила бы его;
 *  - без toast: состояние читается на месте (CLAUDE.md §3).
 */
export function TgRemind({ plan, current }: { plan: PlanForBot; current: boolean }) {
  const [state, setState] = useState<TgState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!current) return
    setState(peekTgState())
    void refreshTgState().then(setState)
    // человек сходил в Telegram и вернулся на вкладку: проверяем, связался ли
    const onBack = () => {
      if (document.visibilityState === 'visible') void refreshTgState(true).then(setState)
    }
    const onChange = () => setState(peekTgState())
    document.addEventListener('visibilitychange', onBack)
    window.addEventListener('naparnik:tg', onChange)
    return () => {
      document.removeEventListener('visibilitychange', onBack)
      window.removeEventListener('naparnik:tg', onChange)
    }
  }, [current])

  if (!current || !state?.available) return null
  if (state.linked) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Send className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
        {state.active ? 'Напомню в Telegram' : 'Telegram подключён, напоминания там выключены'}
      </span>
    )
  }
  // Кнопка передаёт дело и шаг на сервер бота: под ней согласие на обработку со ссылкой на политику
  // (16.11, чек-лист РКН 2026, раздел 3: «нажимая кнопку…» со ссылкой; галочек заранее не ставим)
  return (
    <div className="mt-1 flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-xl px-1 text-sm font-semibold text-primary disabled:opacity-60"
        onClick={async () => {
          setBusy(true)
          // внутри мини-аппа Telegram — сразу, без перехода в чат (сервер узнаёт человека по подписи Telegram)
          const init = tgInitData()
          const inApp = init ? await linkTgInApp(init, plan) : null
          if (inApp) {
            setBusy(false)
            setState(inApp)
            return
          }
          const url = await beginTgLink(plan)
          setBusy(false)
          // тот же таб: на телефоне ссылка открывает приложение Telegram, вкладка сайта остаётся на месте;
          // в мини-аппе ссылку открывает сам Telegram (окно сайта не уходит на t.me)
          if (url) {
            if (!tgOpenLink(url)) window.location.href = url
          } else setState({ available: false, linked: false, active: false })
        }}
      >
        <Send className="size-4 shrink-0" aria-hidden="true" />
        {busy ? (tgInitData() ? 'Подключаю…' : 'Открываю Telegram…') : 'Напоминать в Telegram'}
      </button>
      <p className="px-1 text-[12px] leading-snug text-muted-foreground">
        Нажимая, вы соглашаетесь на обработку дела и шага по{' '}
        <Link href="/privacy" className="underline underline-offset-2">
          политике конфиденциальности
        </Link>
      </p>
    </div>
  )
}
