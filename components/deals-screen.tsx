"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ChevronDown, Clock3, LayoutList, Moon, Play, Plus, SlidersHorizontal, Sparkles, Sun, Sunrise, X } from "lucide-react";
import { MascotDoll } from "@/components/mascot-doll";
import { DealIcon } from "@/components/deal-icon";
import { StepCheck } from "@/components/step-check";
import { TemplatesSheet } from "@/components/templates-sheet";
import { BreakdownPrefs, readFineness, type Fineness } from "@/components/breakdown-prefs";
import {
  DAY_PARTS,
  dealIcon,
  dealMinutes,
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

function DealCard({ deal, i, current }: { deal: Deal; i: number; current: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const next = nextStepOf(deal);
  const done = deal.steps.filter((s) => s.done).length;
  const left = dealMinutes(deal);
  const all = deal.steps.length > 0 && done === deal.steps.length;
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
      <div className="flex items-center gap-3 p-3">
        <DealIcon name={dealIcon(deal.title)} size={44} dim={all} />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`block truncate text-[16px] font-bold leading-snug ${all ? "text-muted-foreground line-through decoration-reward/70" : ""}`}>{deal.title}</span>
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            {deal.steps.length === 0 ? "ещё не разломано" : all ? "все шаги сделаны" : `${done} из ${deal.steps.length}${left ? ` · ≈ ${left} мин` : ""}`}
            <ChevronDown className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </span>
        </button>
        {next ? (
          <Link
            href={sessionHref(next.text)}
            aria-label={`Начать шаг: ${next.text}`}
            className="press grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_3px_0_oklch(0.5_0.14_130)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
      </div>
      {next && !open && (
        <p className="-mt-1 truncate px-3 pb-3 pl-[68px] text-[13.5px] text-foreground/80">
          <span className="text-muted-foreground">дальше:</span> {next.text}
          {next.minutes ? <span className="text-muted-foreground"> · {next.minutes} мин</span> : null}
        </p>
      )}
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
                <StepCheck key={`${k}-${s.text}`} text={s.text} done={Boolean(s.done)} minutes={s.minutes} onToggle={() => toggleStep(deal.id, k)} />
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

export function DealsScreen() {
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [cards, setCards] = useState<WinCard[]>([]);
  const [lit, setLit] = useState<Set<string>>(new Set());
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
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{today.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</p>
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

      {/* «Вывали всё»: одна строка — несколько дел. Сколько дел найдено, видно до нажатия */}
      <form
        className="deal-card flex flex-col gap-2 rounded-[20px] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (found.length) addDump();
        }}
      >
        <label htmlFor="dump" className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary/90">
          вывали всё, что в голове
        </label>
        <textarea
          id="dump"
          value={dump}
          onChange={(e) => setDump(e.target.value.slice(0, 400))}
          rows={2}
          placeholder="отчёт, записаться к врачу, ещё посуда со вчера"
          className="min-h-[56px] w-full resize-none rounded-[14px] border border-white/12 bg-[oklch(0.2_0.012_130/0.9)] px-3.5 py-2.5 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!found.length}
            className="press inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[14.5px] font-bold text-primary-foreground disabled:opacity-45"
          >
            <Plus className="size-4" strokeWidth={3} aria-hidden="true" />
            {found.length > 1 ? `Разложить на ${found.length} ${found.length < 5 ? "дела" : "дел"}` : "Положить в Дела"}
          </button>
          <button
            type="button"
            onClick={() => setTemplates(true)}
            className="press inline-flex h-11 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LayoutList className="size-4 text-primary" aria-hidden="true" />
            Готовые
          </button>
        </div>
      </form>

      {empty && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <MascotDoll expression="calm" size={120} label="Напарник" />
          <p className="max-w-64 text-[15px] text-muted-foreground">Пока пусто, и это ноль, а не минус. Вывали дела сюда или возьми готовое.</p>
        </div>
      )}

      {deals &&
        DAY_PARTS.map((p) => {
          const list = deals.filter((d) => (d.when ?? "any") === p.key);
          if (!list.length) return null;
          const Icon = PART_ICON[p.key];
          const current = p.key === now;
          return (
            <section key={p.key} aria-label={p.label} className="flex flex-col gap-2">
              <h2
                className={`inline-flex h-8 items-center gap-1.5 self-start rounded-full px-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] ${
                  current ? "bg-reward/15 text-reward" : "bg-white/6 text-muted-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {p.label} · {list.length}
                {current && <span className="normal-case tracking-normal">сейчас</span>}
              </h2>
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {list.map((d, i) => (
                    <DealCard key={d.id} deal={d} i={i} current={current} />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          );
        })}

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
          <h2 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary/90">что получилось</h2>
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
