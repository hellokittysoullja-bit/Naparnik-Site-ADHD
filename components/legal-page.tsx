import Link from 'next/link'
import type { ReactNode } from 'react'
import { LEGAL_UPDATED, OPERATOR } from '@/content/operator'

/** Простая читаемая страница документа: без сцены и анимаций, на телефоне — 16 px поля, строки до ~70 знаков */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 text-foreground">
      <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← На главную
      </Link>
      <h1 className="mt-6 text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Редакция от {LEGAL_UPDATED}</p>
      <div className="legal mt-8 flex flex-col gap-6 text-[15px] leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </main>
  )
}

const PENDING = 'уточняется'

export function OperatorBlock() {
  return (
    <ul>
      <li>Оператор: {OPERATOR.name || PENDING}</li>
      <li>Реквизиты: {OPERATOR.ids || PENDING}</li>
      <li>
        Почта для обращений:{' '}
        {OPERATOR.email ? <a className="underline" href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> : PENDING}
      </li>
    </ul>
  )
}
