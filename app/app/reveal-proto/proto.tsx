'use client'

import { useEffect, useState } from 'react'
import { loadDoll } from '@/components/mascot-doll'
import { BreakReveal, type RevealStep, type RevealVariant } from '@/components/break-reveal/break-reveal'

type Plan = { task: string; title: string; steps: RevealStep[] }

export function RevealProto({ plans }: { plans: Plan[] }) {
  const [v, setV] = useState<RevealVariant>('yarn')
  const [p, setP] = useState(0)
  const [nth, setNth] = useState(1)
  const [run, setRun] = useState(0)
  const [held, setHeld] = useState(false)
  const [bare, setBare] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.get('v') === 'paw' || q.get('v') === 'log') setV(q.get('v') as RevealVariant)
    if (q.get('p')) setP(Number(q.get('p')))
    if (q.get('n')) setNth(Number(q.get('n')))
    setBare(q.has('bare'))
    // для записи видео: сцена ждёт команды, кот прогревается заранее
    if (q.has('wait')) setHeld(true)
    void loadDoll()
    ;(window as unknown as { replay: () => void }).replay = () => {
      setHeld(false)
      setRun((r) => r + 1)
    }
  }, [])
  const plan = plans[p]
  return (
    <>
      {!bare && (
        <div className="relative z-[60] mx-auto flex w-full max-w-md flex-wrap gap-1.5 px-4 pt-3 text-[12px]">
          {(['log', 'yarn', 'paw'] as const).map((x) => (
            <button key={x} onClick={() => { setV(x); setRun((r) => r + 1) }} className={`rounded-full border px-3 py-1 ${v === x ? 'border-primary text-primary' : 'border-white/15'}`}>
              {x === 'yarn' ? 'Клубок' : x === 'log' ? 'Полено' : 'Лапой'}
            </button>
          ))}
          <select value={p} onChange={(e) => { setP(Number(e.target.value)); setRun((r) => r + 1) }} className="rounded-full border border-white/15 bg-transparent px-2">
            {plans.map((x, i) => <option key={x.task} value={i}>{x.task}</option>)}
          </select>
          <select value={nth} onChange={(e) => { setNth(Number(e.target.value)); setRun((r) => r + 1) }} className="rounded-full border border-white/15 bg-transparent px-2">
            <option value={1}>1-я разбивка (1,3 с)</option>
            <option value={5}>5-я (0,9 с)</option>
            <option value={12}>12-я (0,6 с)</option>
          </select>
          <button onClick={() => setRun((r) => r + 1)} className="rounded-full border border-white/15 px-3 py-1">Ещё раз</button>
        </div>
      )}
      {!held && <BreakReveal key={`${v}-${p}-${nth}-${run}`} task={plan.task} title={plan.title} steps={plan.steps} variant={v} nth={nth} />}
    </>
  )
}
