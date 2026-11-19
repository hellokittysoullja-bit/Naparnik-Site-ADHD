"use client";

import { useEffect, useMemo, useState } from "react";
import { useFirstFrameReady } from "@/lib/first-frame";
import { useClientMount } from "@/hooks/use-client-mount";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { BookmarkPlus, Check, ChevronDown, Clock, Clock3, Eraser, Hammer, Trash2, LayoutList, Moon, Play, Plus, SlidersHorizontal, Sparkles, Sun, Sunrise, X } from "lucide-react";
import { MascotDoll } from "@/components/mascot-doll";
import { DealIcon } from "@/components/deal-icon";
import { StepCheck } from "@/components/step-check";
import { TemplatesSheet } from "@/components/templates-sheet";
import { BreakdownPrefs, readFineness, type Fineness } from "@/components/breakdown-prefs";
import {
  DAY_PARTS,
  dealIcon,
  dealsCount,
  dealTotalMinutes,
  formatDuration,
  saveMyReady,
  clearDealEstimate,
  setDealEstimate,
  getCards,
  getDeals,
  getThoughts,
  nextStepOf,
  removeDeal,
  removeThought,
  setDealWhen,
  splitDump,
  toggleStep,
  upsertDeal,
  type DayPart,
  type Deal,
  type Thought,
  type WinCard,
} from "@/lib/deals";
import { peekStarts, todayKey } from "@/lib/memory";

/**
 * «Дела» — лента дня.
 * Образец — расписание Tiimo (research/25-deep-teardowns/img/tiimo-appstore-3.jpg): сверху день и полоса недели, ниже
 * разделы ANYTIME / MORNING / DAY / EVENING, в каждом карточки «значок в цветной плитке — название — время — кружок».
 * Что взято: полоса недели, четыре части дня, карточка со значком, отметка кружком, «длительность без часов»
 * («Anytime · 25 min»). Что не взято и почему: точное время начала и конца у каждого дела — у Tiimo это главная жалоба
 * («отстаю от плана и бросаю»), поэтому у нас только часть дня и минуты; «просрочено» не существует вовсе.
 * Сверху — поле «вывали всё» (их «Brain dump… with AI»: одно сообщение превращается в стопку карточек): несколько дел
 * одной строкой раскладываются карточками по очереди.
 */
const sessionHref = (step: string, brk = false) => `/app/session?step=${encodeURIComponent(step.slice(0, 120))}${brk ? "&break=1" : ""}`;

const PART_ICON: Record<DayPart, typeof Sun> = { any: Clock3, morning: Sunrise, day: Sun, evening: Moon };
const nowPart = (h: number): DayPart => (h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "day" : "evening");
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const EASE = [0.05, 0.7, 0.1, 1] as const;

/** Полоса недели: сегодня выделено, в дни со стартом горит огонёк. Пустые дни просто тихие: «сломанного» не бывает (GM23) */
function WeekStrip({ lit }: { lit: Set<string> }) {
  const days = useMemo(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { key: todayKey(d), dow: DAYS[d.getDay()], num: d.getDate(), today: todayKey(d) === todayKey(today), future: d > today };
    });
  }, []);
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Эта неделя">
      {days.map((d) => (
        <li
          key={d.key}
          aria-current={d.today ? "date" : undefined}
          className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 ${d.today ? "bg-white/10" : ""} ${d.future ? "opacity-45" : ""}`}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{d.dow}</span>
          <span className={`text-[17px] font-bold tabular-nums ${d.today ? "text-foreground" : "text-foreground/75"}`}>{d.num}</span>
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${lit.has(d.key) ? "bg-reward shadow-[0_0_8px_oklch(0.8_0.16_85/0.9)]" : "bg-transparent"}`}
          />
          {lit.has(d.key) && <span className="sr-only">был старт</span>}
        </li>
      ))}
    </ol>
  );
}

/** Тропинка из лапок под названием (предложение 18.11, ждёт согласования): шаг — отпечаток лапы нашего кота, сделанный
 *  загорается. Больше двенадцати шагов — двенадцать лапок и «+N» */
function PawTrail({ steps }: { steps: { done?: boolean }[] }) {
  const shown = steps.slice(0, 12);
  return (
    <span className="mt-1.5 flex items-center gap-[3px]" aria-hidden="true">
      {shown.map((st, k) => (
        <span key={`${k}-${st.done ? 1 : 0}`} className={`paw-dot ${st.done ? "paw-dot-on" : ""}`} style={{ rotate: `${k % 2 ? 8 : -8}deg` }} />
      ))}
      {steps.length > 12 && <span className="ml-0.5 font-mono text-[10px] text-muted-foreground">+{steps.length - 12}</span>}
    </span>
  );
}

/** Время дела после «Оценить» — плашка, как у goblin.tools, только по-русски */
function TimePill({ minutes, big = false }: { minutes: number; big?: boolean }) {
  return (
    <span className={`time-pill inline-flex items-center gap-1 rounded-full font-semibold tabular-nums ${big ? "h-7 px-2.5 text-[12.5px]" : "h-6 px-2 text-[11.5px]"}`}>
      <Clock className={big ? "size-3.5" : "size-3"} aria-hidden="true" />
      {formatDuration(minutes)}
    </span>
  );
}

function DealCard({ deal, i, current }: { deal: Deal; i: number; current: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  // «Инструменты» под значком (как молоток у goblin.tools): «Сохранить как готовое дело» и «Оценить»
  const [tools, setTools] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const next = nextStepOf(deal);
  const done = deal.steps.filter((s) => s.done).length;
  const all = deal.steps.length > 0 && done === deal.steps.length;
  const total = dealTotalMinutes(deal);

  const runEstimate = async () => {
    if (!deal.steps.length) return setToolNote("Сначала разломай дело на шаги, потом оценю.");
    setBusy(true);
    setToolNote(null);
    // «считаю» всегда 1–1,5 с (владелец 18.11): мгновенный ответ не читается как работа, а время — как оценка
    const hold = new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
    try {
      let minutes: number[] = [];
      if (deal.steps.some((st) => !st.minutes)) {
        const r = await fetch("/api/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: deal.title.slice(0, 200), steps: deal.steps.slice(0, 24).map((st) => st.text.slice(0, 200)) }),
        });
        const data = (await r.json().catch(() => null)) as { minutes?: number[] | null } | null;
        if (!r.ok || !data?.minutes) throw new Error("no estimate");
        minutes = data.minutes;
      }
      await hold;
      setDealEstimate(deal.id, minutes);
      setTools(false);
    } catch {
      await hold;
      setToolNote("Не вышло оценить. Нажми ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    // карточки встают по очереди, по 50 мс (не дольше восьми), 260 мс: так и «вываленные» дела раскладываются стопкой
    <motion.li
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={{ duration: reduce ? 0.1 : 0.26, delay: reduce ? 0 : Math.min(i, 7) * 0.05, ease: EASE }}
      className={`deal-card rounded-[20px] ${current ? "deal-card-now" : ""}`}
    >
      {/* название выше (владелец 18.11): строка не по центру карточки, а от верха — под значком теперь «инструменты» */}
      <div className="flex items-start gap-3 p-3">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <DealIcon name={dealIcon(deal.title)} size={40} done={all} />
          {/* под значком пусто: молоток переехал под зелёную кнопку (владелец 19.11) */}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`block truncate text-[16px] font-bold leading-snug ${all ? "text-muted-foreground line-through decoration-reward/70" : ""}`}>{deal.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            {deal.steps.length === 0 ? "ещё не разломано" : all ? "все шаги сделаны" : `${done} из ${deal.steps.length}`}
            <ChevronDown className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
          {deal.estimated && total > 0 && (
            <span className="mt-1.5 block">
              <TimePill minutes={total} big />
            </span>
          )}
          {deal.steps.length > 1 && <PawTrail steps={deal.steps} />}
        </button>
        <div className="flex shrink-0 flex-col items-center gap-2">
          {next ? (
            <Link
              href={sessionHref(next.text)}
              aria-label={`Начать шаг: ${next.text}`}
              className="btn-press grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Play className="size-[18px] translate-x-[1px] fill-current" aria-hidden="true" />
            </Link>
          ) : deal.steps.length === 0 ? (
            <Link
              href={sessionHref(deal.title, true)}
              aria-label={`Разломать на шаги: ${deal.title}`}
              className="press grid size-11 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="size-[18px]" aria-hidden="true" />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setTools((v) => !v);
              setToolNote(null);
            }}
            aria-expanded={tools}
            aria-label={`Инструменты: ${deal.title}`}
            className={`press inline-flex h-7 w-11 items-center justify-center gap-0.5 rounded-full border text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tools ? "border-primary/60 bg-primary/12 text-primary" : "border-white/12"
            }`}
          >
            <Hammer className="size-3.5" aria-hidden="true" />
            <ChevronDown className={`size-3 transition-transform duration-200 ${tools ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {tools && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            {/* список инструментов, как меню goblin.tools, в наших цветах (владелец 19.11): кнопки-строки во всю ширину,
                удаление отдельно и красным */}
            <div className="tool-menu mx-3 mb-3 flex flex-col gap-2 rounded-2xl p-2.5" role="group" aria-label="Инструменты">
              <button type="button" disabled={busy} onClick={() => void runEstimate()} className="tool-btn">
                <Clock className={`size-4 ${busy ? "animate-spin [animation-duration:1.6s]" : ""}`} aria-hidden="true" />
                {busy ? "Считаю время…" : "Оценить время"}
              </button>
              {deal.estimated && (
                <button
                  type="button"
                  onClick={() => {
                    clearDealEstimate(deal.id);
                    setTools(false);
                  }}
                  className="tool-btn tool-btn-muted"
                >
                  <Eraser className="size-4" aria-hidden="true" />
                  Очистить оценку
                </button>
              )}
              <button
                type="button"
                disabled={!deal.steps.length}
                onClick={() => {
                  if (saveMyReady(deal)) setSaved(true);
                }}
                className="tool-btn"
              >
                {saved ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : <BookmarkPlus className="size-4" aria-hidden="true" />}
                {saved ? "Лежит в «Готовых»" : "Сохранить как готовое дело"}
              </button>
              <span aria-hidden="true" className="my-0.5 h-px bg-white/8" />
              <button type="button" onClick={() => removeDeal(deal.id)} className="tool-btn tool-btn-danger">
                <Trash2 className="size-4" aria-hidden="true" />
                Удалить дело
              </button>
              {toolNote && <p className="px-1 text-[13px] text-muted-foreground">{toolNote}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.1 : 0.24, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1 border-t border-white/8 px-3 pb-3 pt-2.5">
              {deal.steps.map((s, k) => (
                <StepCheck key={`${k}-${s.text}`} text={s.text} done={Boolean(s.done)} minutes={deal.estimated ? s.minutes : undefined} onToggle={() => toggleStep(deal.id, k)} />
              ))}
              {/* часть дня — без часов: «когда угодно» ничего не просрочивает */}
              <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label="Когда">
                {DAY_PARTS.map((p) => {
                  const on = (deal.when ?? "any") === p.key;
                  const Icon = PART_ICON[p.key];
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={on}
                      aria-label={p.label}
                      onClick={() => setDealWhen(deal.id, p.key)}
                      className={`press inline-flex h-11 items-center justify-center gap-1.5 rounded-full border text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        on ? "border-primary/60 bg-primary/12 text-primary" : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {p.short}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => removeDeal(deal.id)}
                className="press -mb-1 inline-flex min-h-11 items-center gap-1.5 self-end px-1 text-[13px] font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden="true" />
                Убрать дело
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

const CARD_HUE = [88, 205, 320];

/** Убранство записки «вывали всё» — как у карточки первого шага в Фокусе: петельки по углам, печать-звезда «×N» (сколько
 *  дел найдено в строке; пока ни одного — четвёртая петелька), красные лапки и звёздочки справа от кнопок */
function DumpDeco({ count }: { count: number }) {
  const loop = (
    <svg viewBox="0 0 26 26" className="size-full overflow-visible">
      <path d="M5 5 C12 7 20 13 20 18 C20 22.5 15 23.5 12.5 20.5 C10 17.5 9.5 11 5 5 Z" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="4.6" fill="currentColor" />
    </svg>
  );
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="note-loop -left-[7px] -top-[7px]">{loop}</span>
      <span className="note-loop -bottom-[7px] -left-[7px] -scale-y-100">{loop}</span>
      <span className="note-loop -bottom-[7px] -right-[7px] -scale-100">{loop}</span>
      {count > 0 ? (
        <span className="note-seal -right-[18px] -top-[20px]">
          <span className="note-seal-star" />
          <span className="relative">×{count}</span>
        </span>
      ) : (
        <span className="note-loop -right-[7px] -top-[7px] -scale-x-100">{loop}</span>
      )}
      <span className="note-paw bottom-[30px] right-[18px] rotate-[14deg]" />
      <span className="note-paw bottom-[16px] right-[44px] rotate-[4deg] scale-75 opacity-80" />
      <span className="note-star bottom-[44px] right-[52px] size-[9px] [animation-delay:.6s]" />
    </span>
  );
}

export function DealsScreen() {
  // переход по меню — дела из памяти в первом же кадре (hooks/use-client-mount.ts); раньше список появлялся кадром позже экрана
  const clientMount = useClientMount();
  const [deals, setDeals] = useState<Deal[] | null>(() => (clientMount ? getDeals() : null));
  // при обновлении страница видна сразу с делами (lib/first-frame.ts)
  useFirstFrameReady(deals !== null);
  const [thoughts, setThoughts] = useState<Thought[]>(() => (clientMount ? getThoughts() : []));
  const [cards, setCards] = useState<WinCard[]>(() => (clientMount ? getCards() : []));
  const [lit, setLit] = useState<Set<string>>(() => (clientMount ? new Set(peekStarts().map((s) => s.date)) : new Set()));
  const [dump, setDump] = useState("");
  const [templates, setTemplates] = useState(false);
  const [prefs, setPrefs] = useState(false);
  const [fineness, setFineness] = useState<Fineness>("normal");
  const [now, setNow] = useState<DayPart>("any");
  useEffect(() => {
    const load = () => {
      setDeals(getDeals());
      setThoughts(getThoughts());
      setCards(getCards());
      setLit(new Set(peekStarts().map((s) => s.date)));
    };
    load();
    setFineness(readFineness());
    setNow(nowPart(new Date().getHours()));
    window.addEventListener("naparnik:memory", load);
    return () => window.removeEventListener("naparnik:memory", load);
  }, []);

  const found = splitDump(dump);
  const addDump = () => {
    // новые дела встают сверху своей части дня; порядок ввода сохраняется
    for (const t of [...found].reverse()) upsertDeal(t);
    setDump("");
  };
  const today = new Date();
  const empty = deals && deals.length === 0 && thoughts.length === 0;

  return (
    <main className="app-page-enter relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em]">{today.toLocaleDateString("ru-RU", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase())}</h1>
          {/* дата — тем же шрифтом, что «Какое дело сейчас висит?» на Доме (владелец 18.11) */}
          <p className="mt-1.5 text-[16px] font-extrabold leading-[22px] text-[oklch(0.93_0.04_90)]">{today.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</p>
        </div>
        <button
          type="button"
          onClick={() => setPrefs(true)}
          aria-label="Как дробить: размер шагов и просьбы"
          className="press grid size-11 place-items-center rounded-full border border-white/10 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-[18px]" aria-hidden="true" />
        </button>
      </header>
      <WeekStrip lit={lit} />

      {/* «Вывали всё»: одна строка — несколько дел. Сколько дел найдено, видно до нажатия. Подпись — как «Какое дело сейчас
          висит?» на Доме (владелец 18.11): над запиской, на тёмном фоне. Записка — та же, что карточка первого шага в Фокусе;
          поле — общее `.field`; кнопки — как «Раздробить» и «Готовые шаги» Фокуса (вид 1:1, подпись «Готовые» — две в ряд на узком телефоне) */}
      <div className="flex flex-col gap-3">
        <label htmlFor="dump" className="text-[16px] font-extrabold leading-[22px] text-[oklch(0.93_0.04_90)]">
          Вывали всё, что в голове
        </label>
        <form
          className="note-card relative flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (found.length) addDump();
          }}
        >
          <DumpDeco count={found.length} />
          <textarea
            id="dump"
            value={dump}
            onChange={(e) => setDump(e.target.value.slice(0, 400))}
            rows={2}
            placeholder="отчёт, записаться к врачу, ещё посуда со вчера"
            className="field"
            enterKeyHint="enter"
            autoCapitalize="sentences"
          />
          <div className="flex flex-nowrap gap-2">
            <button type="submit" disabled={!found.length} className="note-btn note-btn-go flex-1 justify-center whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring !px-4 !text-sm">
              <span className="inline-flex items-center gap-2 py-2">
                <Plus className="size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                {found.length > 1 ? `Положить ${dealsCount(found.length)}` : "Положить в Дела"}
              </span>
            </button>
            <button type="button" onClick={() => setTemplates(true)} className="note-btn whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring !px-4 !text-sm">
              <span className="inline-flex items-center gap-2 py-2">
                <LayoutList className="size-4 shrink-0" aria-hidden="true" />
                Готовые
              </span>
            </button>
          </div>
        </form>
      </div>

      {empty && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MascotDoll expression="calm" size={120} label="Напарник" />
          <p className="max-w-64 text-[15px] text-muted-foreground">Пока пусто, и это ноль, а не минус. Вывали дела сюда или возьми готовое.</p>
        </div>
      )}

      {/* Одна лента: «N дел» вместо разделов по части дня (владелец 18.11, подпись — как «Какое дело сейчас висит?»).
          Порядок прежний — «любое», утро, день, вечер; дела текущей части дня подсвечены рамкой */}
      {deals && deals.length > 0 && (
        <section aria-label="Дела" className="flex flex-col gap-2">
          <h2 className="text-[16px] font-extrabold leading-[22px] text-[oklch(0.93_0.04_90)]">{dealsCount(deals.length)}</h2>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {DAY_PARTS.flatMap((p) => deals.filter((d) => (d.when ?? "any") === p.key)).map((d, i) => (
                <DealCard key={d.id} deal={d} i={i} current={(d.when ?? "any") === now && now !== "any"} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {thoughts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary/90">мысли на потом</h2>
          {thoughts.map((t) => (
            <div key={t.id} className="deal-card flex items-center gap-2 rounded-2xl px-3 py-1.5">
              <span className="min-w-0 flex-1 text-[14.5px]">{t.text}</span>
              <button
                type="button"
                onClick={() => {
                  upsertDeal(t.text);
                  removeThought(t.id);
                }}
                className="press inline-flex h-11 shrink-0 items-center rounded-full border border-white/10 px-3 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                В дела
              </button>
              <button type="button" onClick={() => removeThought(t.id)} aria-label="Убрать мысль" className="press grid size-11 shrink-0 place-items-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Копилка итогов сессий (у Shimmer — лента карточек «ни одно озарение не теряется») */}
      {cards.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[16px] font-extrabold leading-[22px] text-primary/90">Что получилось</h2>
          <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cards.slice(0, 8).map((c, i) => (
              <li
                key={c.id}
                className="win-card flex min-h-[104px] w-[150px] shrink-0 snap-start flex-col gap-1.5 rounded-2xl p-3"
                style={{ ["--tilt" as string]: `${i % 2 ? 1.5 : -1.5}deg`, ["--hue" as string]: CARD_HUE[i % 3], ["--d" as string]: `${Math.min(i, 5) * 60}ms` }}
              >
                <p className="line-clamp-3 text-[13px] font-bold leading-[1.25] [overflow-wrap:anywhere]">{c.win}</p>
                <p className="mt-auto font-mono text-[10px] font-semibold uppercase tracking-wider opacity-75">
                  {new Date(c.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  {c.minutes ? ` · ${c.minutes} мин` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TemplatesSheet
        open={templates}
        onClose={() => setTemplates(false)}
        onPick={(t) => {
          upsertDeal(t.title, t.steps.map((s) => ({ text: s.text, minutes: s.minutes })));
          setTemplates(false);
        }}
      />
      <BreakdownPrefs open={prefs} onClose={() => setPrefs(false)} fineness={fineness} onFineness={setFineness} />
    </main>
  );
}
