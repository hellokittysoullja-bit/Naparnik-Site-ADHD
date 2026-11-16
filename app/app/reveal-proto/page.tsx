import type { Metadata } from 'next'
import { readyPlan } from '@/lib/ai/agents/breakdown'
import { RevealProto } from './proto'

/** Стенд раскрытия разбивки для согласования с владельцем (16.11): не в меню, не индексируется. */
export const metadata: Metadata = { title: 'Раскрытие разбивки — стенд', robots: { index: false } }

const TASKS = ['Написать курсовую', 'Помыть посуду', 'Убраться в комнате', 'Сходить в магазин']

export default function Page() {
  const plans = TASKS.map((t) => {
    const hit = readyPlan(t)
    const v = hit?.value
    return {
      task: t,
      title: hit?.title ?? t,
      steps: (v?.steps ?? []).map((text, i) => ({ text, minutes: v?.minutes?.[i] ?? undefined, wait: v?.wait?.[i] || undefined })),
    }
  })
  return (
    <main className="flex min-h-dvh flex-col pb-16">
      <RevealProto plans={plans} />
    </main>
  )
}
