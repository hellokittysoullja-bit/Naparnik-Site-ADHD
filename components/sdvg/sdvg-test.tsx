'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MascotDoll, type MascotAction, type MascotExpression } from '@/components/mascot-doll'
import copy from '@/content/sdvg-copy.ru.json'
import asrs from '@/content/asrs-ru.json'
import catLines from '@/content/cat-lines.ru.json'
import { CatNotebook } from '@/components/sdvg/cat-notebook'
import { notebookPage, notesOf } from '@/lib/sdvg-notebook'
import { withAttribution } from '@/lib/visitor'
import { trackEvent } from '@/lib/events'
import {
  EMPTY,
  SPHERES,
  STEPS,
  TYPES,
  TYPE_SLUG,
  asrsBand,
  asrsScore,
  effectiveType,
  firstMissing,
  questionNumber,
  readState,
  secondType,
  shadedFrom,
  stateHash,
  stateQuery,
  type ProcType,
  type SdvgState,
  type SdvgStep,
} from '@/lib/sdvg'

/**
 * Тест «Что мешает тебе начинать дела?» (/sdvg-test) — 1:1 по плану владельца 08.11
 * (research/14-lead-magnets/owner-asrs-bridge.md). Шаг — новый адрес (история браузера: «Назад» = предыдущий экран),
 * ответы ASRS — только во фрагменте `#a=…` и только в браузере. Имя — только на этом устройстве.
 */

const PROGRESS_KEY = 'naparnik:sdvg'
const NAME_KEY = 'naparnik:sdvgName'
const AUTO_START_KEY = 'naparnik:autoStart'
const CALC_MS = 3000
/** Ответ виден отмеченным и кот успевает черкнуть в блокноте, потом — следующий вопрос (ТЗ: 250–400 мс) */
const ADVANCE_MS = 320

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}

function nextStep(state: SdvgState): SdvgStep {
  const i = STEPS.indexOf(state.step)
  let next = STEPS[i + 1]
  // не взрослому — без опросника ВОЗ: после возраста сразу вопросы Напарника
  if (state.adult === false && (next === 'pre' || /^a\d$/.test(next) || next === 'sep')) next = 'q1'
  return next
}

export function SdvgTest() {
  const router = useRouter()
  const [state, setState] = useState<SdvgState>(EMPTY)
  const [resume, setResume] = useState<{ url: string; n: number } | null>(null)
  const [name, setName] = useState('')
  const [calcLine, setCalcLine] = useState(0)
  const [copied, setCopied] = useState(false)
  const readyRef = useRef(false)
  const urlStepRef = useRef<SdvgStep | null>(null)
  const fromPopRef = useRef(false)
  const advanceRef = useRef<number | null>(null)

  // Открытие: состояние из адреса (переживает «Открыть в Safari» и перезагрузку). Без шага в адресе — экран входа,
  // а если на устройстве есть незаконченный тест — предложение продолжить.
  useEffect(() => {
    const initial = readState(window.location.search, window.location.hash)
    try {
      setName(window.localStorage.getItem(NAME_KEY) ?? '')
      if (initial.step === 'intro') {
        const saved = window.localStorage.getItem(PROGRESS_KEY)
        if (saved) {
          const u = new URL(saved, window.location.origin)
          const s = readState(u.search, u.hash)
          const n = questionNumber(s.step)
          if (n) setResume({ url: saved, n })
        }
      }
    } catch {
      /* хранилище недоступно — просто без продолжения */
    }
    urlStepRef.current = initial.step
    readyRef.current = true
    window.history.replaceState(null, '', `${window.location.pathname}?${stateQuery(initial, window.location.search)}${stateHash(initial)}`)
    setState(initial)
  }, [])

  // Новый экран — новая запись истории; ответы на том же экране — замена записи. Расчёт сменяется результатом без
  // записи: «Назад» с результата не попадает снова в расчёт.
  useEffect(() => {
    // первый проход (ещё пустое состояние до чтения адреса) адрес не трогает: иначе в историю попадал лишний «вход»,
    // а в StrictMode повторный запуск открытия читал уже испорченный адрес и после перезагрузки сбрасывал на вход
    if (!readyRef.current || state === EMPTY) return
    const url = `${window.location.pathname}?${stateQuery(state, window.location.search)}${stateHash(state)}`
    const push = state.step !== urlStepRef.current && !fromPopRef.current && urlStepRef.current !== 'calc'
    if (push) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    fromPopRef.current = false
    urlStepRef.current = state.step
    try {
      if (state.step === 'intro') return
      if (state.step === 'result') window.localStorage.removeItem(PROGRESS_KEY)
      else window.localStorage.setItem(PROGRESS_KEY, url)
    } catch {
      /* без продолжения */
    }
  }, [state])

  useEffect(() => {
    // «Назад» открывает предыдущий экран С уже данными ответами (в той записи истории их ещё не было)
    function onPop() {
      fromPopRef.current = true
      const popped = readState(window.location.search, window.location.hash)
      setState((cur) => ({
        ...popped,
        adult: popped.adult ?? cur.adult,
        asrs: cur.asrs.length > popped.asrs.length ? cur.asrs : popped.asrs,
        l2: cur.l2.length > popped.l2.length ? cur.l2 : popped.l2,
        sphere: popped.sphere ?? cur.sphere,
      }))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Ушли с экрана (в т.ч. «Назад») — отложенный переход отменяется
  useEffect(() => {
    return () => {
      if (advanceRef.current) window.clearTimeout(advanceRef.current)
      advanceRef.current = null
    }
  }, [state.step])

  // «Напарник считает» — три настоящих шага, ~3 с, затем результат
  useEffect(() => {
    if (state.step !== 'calc') return
    setCalcLine(0)
    const t1 = window.setTimeout(() => setCalcLine(1), CALC_MS / 3)
    const t2 = window.setTimeout(() => setCalcLine(2), (CALC_MS * 2) / 3)
    const t3 = window.setTimeout(() => {
      setState((s) => ({ ...s, step: 'result' }))
      trackEvent('test_completed')
    }, CALC_MS)
    return () => [t1, t2, t3].forEach(window.clearTimeout)
  }, [state.step])

  function go(patch: Partial<SdvgState>) {
    setState((s) => {
      const merged = { ...s, ...patch }
      if (patch.l2) merged.chosen = null
      return { ...merged, step: nextStep(merged) }
    })
  }

  /** Ответ записывается сразу (отметка + черта в блокноте), экран сменяется через ADVANCE_MS; повторный тап — перезапуск */
  function answer(patch: Partial<SdvgState>) {
    if (advanceRef.current) window.clearTimeout(advanceRef.current)
    setState((s) => ({ ...s, ...patch, ...(patch.l2 ? { chosen: null } : {}) }))
    advanceRef.current = window.setTimeout(() => {
      advanceRef.current = null
      go({})
    }, ADVANCE_MS)
  }

  const step = state.step
  const n = questionNumber(step)
  const type = effectiveType(state)
  const sphere = state.sphere ?? 'all'

  function startSession() {
    if (!type) return
    const label = copy.types[type].steps[sphere]
    trackEvent('cta_clicked')
    try {
      window.sessionStorage.setItem(AUTO_START_KEY, label)
    } catch {
      /* без автостарта — человек нажмёт «старт» сам */
    }
    const params = new URLSearchParams({ step: label, d: '2', auto: '1', from: 'sdvg', t: type, s: sphere })
    router.push(withAttribution(`/app/session?${params.toString()}`, window.location.search))
  }

  async function share() {
    if (!type) return
    trackEvent('share_clicked')
    const url = `${window.location.origin}/sdvg-test/tip/${TYPE_SLUG[type]}?src=share`
    const text = fill(copy.cta.shareText, { type: copy.types[type].title })
    try {
      if (navigator.share) {
        await navigator.share({ text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
    } catch {
      /* отмена системного меню — ничего не делаем */
    }
  }

  let face: MascotExpression = 'calm'
  let action: MascotAction = 'idle'
  if (step === 'intro') action = 'wave'
  if (step === 'calc') action = 'think'
  // На результате кот одинаково тёплый при любом балле: разная реакция сама подсказала бы, какой балл «хороший»
  if (step === 'result') face = 'happy'
  const asrsPhase = /^a\d$/.test(step)
  const notesPhase = /^q\d$/.test(step) || step === 'sphere' || step === 'name' || step === 'calc'
  const answeredBefore = n !== null && n > 6 ? n - 7 : state.l2.length
  const lastL2 = step === 'sphere' ? state.l2[3] : n !== null && n > 7 ? state.l2[n - 8] : undefined
  const reaction = lastL2 ? catLines[lastL2][step === 'sphere' ? 3 : (n as number) - 8] : null
  const canGoBack = asrsPhase || notesPhase && step !== 'calc'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-6 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              type="button"
              className="h-11 pr-1 text-[15px] text-muted-foreground"
              onClick={() => window.history.back()}
            >
              ← {copy.cat.back}
            </button>
          )}
          {n ? <span className="font-mono text-xs text-muted-foreground">{n <= 6 ? `${n}/6` : `${n - 6}/4`}</span> : null}
        </div>
        <MascotDoll expression={face} action={action} size={72} label="Напарник" />
      </div>

      {asrsPhase && <CatNotebook mode="asrs" scribbles={state.asrs.length} />}
      {notesPhase && <CatNotebook mode="notes" notes={notesOf(state.l2.slice(0, step === 'sphere' || step === 'name' || step === 'calc' ? 4 : answeredBefore))} />}
      {reaction && (
        <p className="mt-3 rounded-2xl bg-card px-3 py-2 text-[15px] leading-snug" aria-live="polite">
          {reaction}
        </p>
      )}

      {step === 'intro' && (
        <Screen>
          <h1 className="text-[28px] font-bold leading-tight">{copy.entry.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.entry.subtitle}</p>
          <p className="font-hand text-[20px] leading-snug">{copy.cat.intro}</p>
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {copy.entry.points.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
          <Primary
            onClick={() => {
              trackEvent('test_started')
              setResume(null)
              go({ ...EMPTY })
            }}
          >
            {copy.entry.button}
          </Primary>
          {resume && (
            <button
              type="button"
              className="h-11 text-[15px] font-semibold text-primary"
              onClick={() => {
                const u = new URL(resume.url, window.location.origin)
                window.history.replaceState(null, '', resume.url)
                setState(readState(u.search, u.hash))
              }}
            >
              {fill(copy.entry.resume, { n: String(resume.n) })}
            </button>
          )}
          <p className="text-xs text-muted-foreground">{copy.entry.fine}</p>
        </Screen>
      )}

      {step === 'age' && (
        <Screen>
          <h2 className="text-2xl font-bold">{copy.age.question}</h2>
          <Choice onClick={() => go({ adult: true })}>{copy.age.yes}</Choice>
          <Choice onClick={() => go({ adult: false })}>{copy.age.no}</Choice>
        </Screen>
      )}

      {step === 'q1' && state.adult === false && state.l2.length === 0 && (
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{copy.age.noText}</p>
      )}

      {step === 'pre' && (
        <Screen>
          <p className="rounded-2xl bg-card px-3 py-2 font-hand text-[20px] leading-snug">{copy.cat.pre}</p>
          <p className="text-[17px] leading-relaxed">{copy.preAsrs.text}</p>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{asrs.instruction}</p>
          <Primary onClick={() => go({})}>{copy.preAsrs.button}</Primary>
        </Screen>
      )}

      {n !== null && n <= 6 && (
        <Screen key={step}>
          <h2 className="text-[20px] font-semibold leading-snug">{asrs.items[n - 1]}</h2>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={asrs.items[n - 1]}>
            {asrs.options.map((label, value) => (
              <Choice
                key={label}
                shaded={value >= shadedFrom(n - 1)}
                checked={state.asrs[n - 1] === value}
                onClick={() => answer({ asrs: [...state.asrs.slice(0, n - 1), value] })}
              >
                {label}
              </Choice>
            ))}
          </div>
        </Screen>
      )}

      {step === 'sep' && (
        <Screen>
          <CatNotebook mode="tear" scribbles={state.asrs.length} />
          <p className="font-hand text-[20px] leading-snug">
            {copy.cat.sep} {copy.cat.sepSelf}
          </p>
          <p className="text-[17px] leading-relaxed">{copy.separator.text}</p>
          <Primary onClick={() => go({})}>{copy.separator.button}</Primary>
        </Screen>
      )}

      {n !== null && n > 6 && (
        <Screen key={step}>
          <h2 className="text-[22px] font-semibold leading-snug">{copy.layer2[n - 7].question}</h2>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={copy.layer2[n - 7].question}>
            {TYPES.map((t) => (
              <Choice
                key={t}
                checked={state.l2[n - 7] === t}
                onClick={() => answer({ l2: [...state.l2.slice(0, n - 7), t] })}
              >
                {copy.layer2[n - 7].options[t]}
              </Choice>
            ))}
          </div>
        </Screen>
      )}

      {step === 'sphere' && (
        <Screen>
          <h2 className="text-[22px] font-semibold">{copy.sphere.question}</h2>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label={copy.sphere.question}>
            {SPHERES.map((s) => (
              <Choice key={s} checked={state.sphere === s} onClick={() => go({ sphere: s })}>
                {copy.sphere.options[s]}
              </Choice>
            ))}
          </div>
        </Screen>
      )}

      {step === 'name' && (
        <Screen>
          <h2 className="text-[22px] font-semibold">{copy.name.question}</h2>
          <p className="text-sm text-muted-foreground">{copy.name.hint}</p>
          <input
            className="h-12 rounded-xl border border-border bg-card px-4 text-[17px] outline-none focus:ring-2 focus:ring-ring"
            placeholder={copy.name.placeholder}
            maxLength={40}
            value={name}
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
          <Primary
            onClick={() => {
              try {
                window.localStorage.setItem(NAME_KEY, name.trim())
              } catch {
                /* имя просто не запомнится */
              }
              go({})
            }}
          >
            {copy.name.button}
          </Primary>
          <button type="button" className="h-11 text-muted-foreground" onClick={() => (setName(''), go({}))}>
            {copy.name.skip}
          </button>
        </Screen>
      )}

      {step === 'calc' && (
        <Screen>
          <p className="font-hand text-[22px]">{copy.cat.calcTitle}</p>
          <ul className="flex flex-col gap-3 text-[17px]" aria-live="polite">
            {copy.calc.map((line, i) => (
              <li key={line} className={i <= calcLine ? 'opacity-100' : 'opacity-30'}>
                {i < calcLine ? '✓ ' : '· '}
                {line}
              </li>
            ))}
          </ul>
        </Screen>
      )}

      {step === 'result' && type && (
        <Result
          state={state}
          type={type}
          name={name.trim()}
          copied={copied}
          onStart={startSession}
          onShare={share}
          onChoose={(t) => setState((s) => ({ ...s, chosen: t }))}
          onChange={() => setState((s) => ({ ...s, step: 'q1' }))}
        />
      )}

      {step === 'result' && !type && firstMissing(state) !== 'result' && (
        <Screen>
          <Primary onClick={() => setState((s) => ({ ...s, step: firstMissing(s) }))}>{copy.preAsrs.button}</Primary>
        </Screen>
      )}

      <footer className="mt-auto pt-10 text-[11px] leading-relaxed text-muted-foreground">
        <p>{copy.footer.copyright}</p>
        <p className="mt-1">{copy.footer.citation}</p>
        <p className="mt-2 flex gap-4">
          <Link href="/sdvg-test/metod" className="underline">
            {copy.footer.method}
          </Link>
          <Link href="/terms" className="underline">
            Условия
          </Link>
          <Link href="/privacy" className="underline">
            Конфиденциальность
          </Link>
        </p>
      </footer>
    </main>
  )
}

function Result({
  state,
  type,
  name,
  copied,
  onStart,
  onShare,
  onChoose,
  onChange,
}: {
  state: SdvgState
  type: ProcType
  name: string
  copied: boolean
  onStart: () => void
  onShare: () => void
  onChoose: (t: ProcType) => void
  onChange: () => void
}) {
  const [verdict, setVerdict] = useState<'open' | 'yes' | 'no'>('open')
  const screened = state.adult === true && state.asrs.length === 6
  const score = screened ? asrsScore(state.asrs) : null
  const band = score !== null ? asrsBand(score) : null
  const sphere = state.sphere ?? 'all'
  const t = copy.types[type]
  const page = notebookPage(state)
  const quoteOf = (x: ProcType) => copy.layer2[Math.max(0, state.l2.indexOf(x))].options[x]
  const text = fill(t.text, { name: name ? `${name}, ` : '', quote: quoteOf(type) })
  const second = secondType(state.l2, type)
  const others = TYPES.filter((x) => x !== type)
  return (
    <div className="mt-6 flex flex-col gap-6">
      {/* (а) «Что я записал» — первым: каждая строка из конкретного ответа; ответы ВОЗ сюда не попадают */}
      {page && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="nb-title">
          <h2 id="nb-title" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {copy.notebook.title}
          </h2>
          <ul className="flex flex-col gap-1 font-hand text-[20px] leading-snug">
            {page.notes.map((note, i) => (
              <li key={`${i}-${note}`}>«{note}»</li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1 text-[15px] leading-snug">
            {page.sphere && <li>{page.sphere}</li>}
            <li>{page.mechanism}</li>
            <li className="text-muted-foreground">{page.count}</li>
          </ul>
          <div className="flex flex-col gap-2 pt-1">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{copy.types.yourType}</p>
            <h2 className="text-[26px] font-bold leading-tight">{t.title}</h2>
            <p className="text-[16px] leading-relaxed">{text.charAt(0).toUpperCase() + text.slice(1)}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {copy.notebook.own}{' '}
            <button type="button" className="text-primary underline" onClick={onChange}>
              {copy.notebook.change}
            </button>
          </p>
          {verdict === 'open' && (
            <div className="grid grid-cols-2 gap-2">
              <Choice plain onClick={() => setVerdict('yes')}>{copy.notebook.yes}</Choice>
              <Choice plain onClick={() => setVerdict('no')}>{copy.notebook.no}</Choice>
            </div>
          )}
          {verdict === 'yes' && (
            <p className="font-hand text-[20px]" role="status">
              {copy.notebook.yesDone}
            </p>
          )}
          {verdict === 'no' && (
            <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
              <p className="text-[15px] font-semibold">{copy.notebook.alt}</p>
              {(second ? [second] : others).map((x) => (
                <Choice
                  key={x}
                  plain
                  onClick={() => {
                    onChoose(x)
                    setVerdict('yes')
                  }}
                >
                  <span className="block font-semibold">{copy.types[x].title}</span>
                  {second && <span className="block font-hand text-[18px]">«{quoteOf(x)}»</span>}
                  <span className="block text-sm text-muted-foreground">{copy.types[x].mechanism}</span>
                </Choice>
              ))}
              <button type="button" className="h-11 text-[15px] text-muted-foreground" onClick={() => setVerdict('yes')}>
                {fill(copy.notebook.keep, { type: t.title })}
              </button>
            </div>
          )}
        </section>
      )}

      {/* (б) отрывной листок ВОЗ — отдельно от записей кота: балл живёт только в браузере */}
      {band && score !== null && (
        <section className="flex flex-col gap-2 rounded-2xl border border-t-2 border-dashed border-border bg-card p-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{copy.sheet.title}</p>
          <h2 className="text-[24px] font-bold leading-tight">{copy.bands[band].title}</h2>
          <p className="font-mono text-sm text-muted-foreground">{fill(copy.bands.score, { n: String(score) })}</p>
          <p className="text-[15px] leading-relaxed">{copy.bands[band].text.replace('N из 24', `${score} из 24`)}</p>
          <p className="text-sm font-semibold">{copy.bands.common}</p>
          <p className="text-sm text-muted-foreground">{copy.sheet.private}</p>
          <Link href="/sdvg-test/metod#vrach" className="text-sm text-primary underline">
            {copy.cta.doctor}
          </Link>
        </section>
      )}

      {/* (в) первый шаг и кнопка */}
      <section className="flex flex-col gap-2 rounded-2xl border border-primary/40 p-4">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{copy.types.yourStep}</p>
        <p className="text-[19px] font-semibold leading-snug">{t.steps[sphere]}</p>
        <p className="text-sm text-muted-foreground">{copy.types.evidence}</p>
      </section>

      <div className="flex flex-col gap-2">
        <Primary onClick={onStart}>{copy.cta.button}</Primary>
        <p className="text-center text-sm text-muted-foreground">{copy.cta.under}</p>
        {!band && (
          <Link href="/sdvg-test/metod#vrach" className="text-center text-sm text-muted-foreground underline">
            {copy.cta.doctor}
          </Link>
        )}
        <button type="button" className="h-11 text-[15px] font-semibold text-primary" onClick={onShare}>
          {copy.cta.share}
        </button>
        {copied && (
          <p className="text-center text-sm text-muted-foreground" role="status">
            {copy.cta.copied}
          </p>
        )}
      </div>
    </div>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col gap-4">{children}</div>
}

function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-chunky mt-2 block w-full select-none rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="btn-face flex min-h-[52px] items-center justify-center rounded-[16px] bg-primary px-6 py-3 text-center text-[17px] font-bold text-primary-foreground">
        {children}
      </span>
    </button>
  )
}

function Choice({
  children,
  onClick,
  checked,
  shaded,
  plain,
}: {
  children: ReactNode
  onClick: () => void
  checked?: boolean
  shaded?: boolean
  /** Обычная кнопка (не вариант ответа) — без роли radio */
  plain?: boolean
}) {
  return (
    <button
      type="button"
      role={plain ? undefined : 'radio'}
      aria-checked={plain ? undefined : !!checked}
      onClick={onClick}
      className={`min-h-[52px] w-full rounded-xl border px-4 py-3 text-left text-[17px] transition-colors ${
        checked ? 'border-primary bg-primary/15' : 'border-border bg-card'
      } ${shaded ? 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,oklch(1_0_0/0.04)_6px_12px)]' : ''}`}
    >
      {children}
    </button>
  )
}
