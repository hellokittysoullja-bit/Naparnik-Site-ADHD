'use client'

import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { beginTgLink, peekTgState, refreshTgState, type PlanForBot, type TgState } from '@/lib/tg-link'

/**
 * Под карточкой плана: «Напоминать в Telegram». Кот сам написать первым не может, пока человек не связал сайт с
 * ботом; эта кнопка и есть связь (одно касание, без аккаунта: lib/tg/link.ts). Правила экрана:
 *  - бота нет или сервер не ответил — ничего не рисуем: обещание без исполнения хуже отсутствия кнопки;
 *  - уже связан — вместо кнопки одна тихая строка, что напоминание придёт;
 *  - без toast: состояние читается на месте (CLAUDE.md §3).
 */
export function TgRemind({ plan }: { plan: PlanForBot }) {
  const [state, setState] = useState<TgState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
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
  }, [])

  if (!state?.available) return null
  if (state.linked) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Send className="size-3.5 shrink-0 text-primary/70" aria-hidden="true" />
        {state.active ? 'Напомню в Telegram' : 'Telegram подключён, напоминания там выключены'}
      </span>
    )
  }
  return (
    <button
      type="button"
      disabled={busy}
      className="mt-1 flex min-h-11 items-center gap-1.5 self-start rounded-xl px-1 text-sm font-semibold text-primary disabled:opacity-60"
      onClick={async () => {
        setBusy(true)
        const url = await beginTgLink(plan)
        setBusy(false)
        // тот же таб: на телефоне ссылка открывает приложение Telegram, вкладка сайта остаётся на месте
        if (url) window.location.href = url
        else setState({ available: false, linked: false, active: false })
      }}
    >
      <Send className="size-4 shrink-0" aria-hidden="true" />
      {busy ? 'Открываю Telegram…' : 'Напоминать в Telegram'}
    </button>
  )
}
