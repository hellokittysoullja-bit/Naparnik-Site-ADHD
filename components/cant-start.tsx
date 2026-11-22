"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Pause, Play } from "lucide-react";
import { useFirstFrameReady } from "@/lib/first-frame";
import { FocusScene } from "@/components/focus-scene";
import { MascotDoll, type MascotAction, type MascotExpression } from "@/components/mascot-doll";
import { Campfire } from "@/components/campfire";
import { celebrate } from "@/components/break-reveal/confetti";
import { hapticReward, hapticStart, hapticThreshold } from "@/lib/haptics";
import { recordStart } from "@/lib/memory";
import { trackEvent } from "@/lib/events";
import { useReducedMotion } from "@/lib/reduced-motion";

/**
 * «Не могу начать» — ядро (владелец 22.11, функция 1). Шесть шагов, от открытия до шага меньше минуты:
 *  1. ситуация одним тапом (четыре крупные карточки);
 *  2. что именно — необязательно: строка, микрофон, подсказки-чипсы, «Пропустить»;
 *  3. кот думает 1,5 с («Ищу самый маленький шаг…») — иллюзия труда, а не ожидание сервера;
 *  4. один шаг крупно + время; «Поехали» · «Слишком сложно» (2 мин → 30 с → «Просто открой… Всё.») · «Другой шаг»;
 *  5. работаем вместе: кот в кольце таймера, таймер можно скрыть, пауза, «Я тут», возврат во вкладку без обиды;
 *  6. победа: огонь вверх, искры, кот прыгает; «Ещё 5 минут с котом» и «На сегодня хватит» — обе празднуются.
 */
type Situation = "study" | "work" | "home" | "other";
type Level = 0 | 1 | 2;
type Phase = "situation" | "what" | "thinking" | "step" | "together" | "win";

const SITUATIONS: { key: Situation; emoji: string; label: string; hue: number }[] = [
  { key: "study", emoji: "📚", label: "Учёба", hue: 250 },
  { key: "work", emoji: "💻", label: "Работа", hue: 200 },
  { key: "home", emoji: "🧺", label: "Дом", hue: 145 },
  { key: "other", emoji: "✍️", label: "Другое", hue: 35 },
];

const CHIPS: Record<Situation, string[]> = {
  study: ["диплом", "курсовая", "домашка", "к экзамену"],
  work: ["отчёт", "письмо", "презентация", "позвонить"],
  home: ["уборка", "посуда", "стирка", "позвонить"],
  other: ["позвонить", "записаться к врачу", "ответить на сообщение", "оплатить"],
};

const BUBBLE: Record<Phase, string> = {
  situation: "Бывает. Где застрял?",
  what: "Что откладываешь? Можно голосом.",
  thinking: "Ищу самый маленький шаг…",
  step: "Вот один шаг. Только он.",
  together: "Я тут.",
  win: "",
};

/** «2 минуты», «30 секунд» */
function timeLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} ${plural(seconds, "секунда", "секунды", "секунд")}`;
  const m = Math.round(seconds / 60);
  return `${m} ${plural(m, "минута", "минуты", "минут")}`;
}
function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** шаг с сервера; без сети — свои ступени (те же тексты, что у сервера без дела) */
const OFFLINE: Record<Situation, [string, string, string]> = {
  study: ["Открой конспект и прочитай первый абзац.", "Положи тетрадь перед собой.", "Просто открой тетрадь. Всё."],
  work: ["Открой файл и напиши первую строчку, как получится.", "Открой нужный файл.", "Просто открой файл. Всё."],
  home: ["Возьми пакет и собери в него мусор с одного стола.", "Встань и подойди к месту, где беспорядок.", "Просто встань с места. Всё."],
  other: ["Возьми телефон и открой то, что откладываешь.", "Положи телефон экраном вниз.", "Просто открой то, что нужно. Всё."],
};
const LEVEL_SECONDS = [120, 30, 10] as const;

async function fetchStep(body: { situation: Situation; task?: string; level: Level; avoid: string[] }): Promise<{ step: string; seconds: number }> {
  try {
    const r = await fetch("/api/step", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as { step?: string; seconds?: number };
    if (j.step) return { step: j.step, seconds: j.seconds ?? LEVEL_SECONDS[body.level] };
  } catch {
    /* без сети — своя ступень */
  }
  const own = OFFLINE[body.situation][body.level];
  return { step: own, seconds: LEVEL_SECONDS[body.level] };
}

type SpeechCtor = new () => { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CantStart() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("situation");
  const [situation, setSituation] = useState<Situation | null>(null);
  const [task, setTask] = useState("");
  const [level, setLevel] = useState<Level>(0);
  const [step, setStep] = useState<{ step: string; seconds: number } | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  useFirstFrameReady(true);

  useEffect(() => setCanSpeak(!!speechCtor()), []);

  /** шаг 3 → 4: кот думает не меньше 1,5 с, шаг приходит параллельно */
  const think = useCallback(
    async (lvl: Level, avoid: string[]) => {
      if (!situation) return;
      setPhase("thinking");
      const [next] = await Promise.all([
        fetchStep({ situation, task: task.trim() || undefined, level: lvl, avoid }),
        new Promise((r) => window.setTimeout(r, reduce ? 400 : 1500)),
      ]);
      setStep(next);
      setShown([...avoid, next.step]);
      setLevel(lvl);
      setPhase("step");
      trackEvent("step_shown");
    },
    [situation, task, reduce],
  );

  const back = () => {
    if (phase === "situation") return router.push("/app");
    if (phase === "what") return setPhase("situation");
    if (phase === "step") return setPhase("what");
    if (phase === "together" || phase === "win") return router.push("/app");
  };

  // кот и реплика по шагу
  const mood: { expression: MascotExpression; action: MascotAction } =
    phase === "thinking" ? { expression: "focused", action: "think" } : phase === "win" ? { expression: "excited", action: "celebrate" } : phase === "step" ? { expression: "happy", action: "idle" } : { expression: "calm", action: "idle" };

  return (
    <main className="relative flex min-h-dvh flex-col pb-[calc(4.75rem+var(--sab))]">
      <FocusScene />
      <h1 className="sr-only">Не могу начать</h1>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-[max(0.75rem,var(--sat))]">
        {phase !== "together" && phase !== "win" && (
          <button type="button" onClick={back} aria-label="Назад" className="press grid size-11 place-items-center rounded-full border border-white/10 bg-[oklch(0.27_0.016_130/0.85)] text-foreground">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
        )}

        {phase === "together" && step ? (
          <Together step={step} onDone={() => setPhase("win")} />
        ) : phase === "win" ? (
          <Win
            catRef={catRef}
            reduce={!!reduce}
            onMore={() => {
              hapticReward();
              setStep({ step: "Продолжаем с того же места.", seconds: 300 });
              setPhase("together");
            }}
            onEnough={() => {
              hapticReward();
              router.push("/app");
            }}
          />
        ) : (
          <>
            {/* кот слева, реплика справа — как в знакомстве; у костра — тёплый свет, на «думаю» огонь вспыхивает */}
            <div className="mt-3 flex items-center gap-3">
              <div ref={catRef} className="relative shrink-0">
                <div className="absolute -bottom-1 -left-5 z-[2] h-[46%] w-[40%]">
                  {/* позиция — на обёртке, вспышка — на самом костре: transform анимации не стирает сдвиг (CLAUDE.md §5.1) */}
                  <Campfire key={phase} className={`block size-full ${phase === "thinking" ? "cs-flare" : ""}`} />
                </div>
                <MascotDoll expression={mood.expression} action={mood.action} size={128} label="Напарник" className="size-[clamp(96px,22dvh,128px)]" />
              </div>
              <p aria-live="polite" className="glass-hearthside min-h-[56px] flex-1 rounded-2xl px-4 py-3 text-[17px] font-semibold leading-snug text-foreground">
                {BUBBLE[phase]}
              </p>
            </div>

            {phase === "situation" && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {SITUATIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      hapticThreshold();
                      setSituation(s.key);
                      setPhase("what");
                    }}
                    onTouchStart={() => {}}
                    style={{ ["--h" as string]: s.hue }}
                    className="cs-card press flex aspect-[1.05] flex-col items-start justify-between rounded-[24px] p-4 text-left"
                  >
                    <span aria-hidden="true" className="cs-card-emoji grid size-14 place-items-center rounded-[18px] text-[32px]">
                      {s.emoji}
                    </span>
                    <span className="text-[20px] font-extrabold leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            )}

            {phase === "what" && situation && (
              <div className="mt-6 flex flex-1 flex-col">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void think(0, []);
                  }}
                >
                  <label className="sr-only" htmlFor="cs-task">
                    Что откладываешь?
                  </label>
                  <input
                    id="cs-task"
                    value={task}
                    onChange={(e) => setTask(e.target.value.slice(0, 120))}
                    placeholder="Что откладываешь?"
                    enterKeyHint="go"
                    autoComplete="off"
                    autoCapitalize="sentences"
                    className="field min-w-0 flex-1"
                  />
                  {canSpeak && (
                    <button
                      type="button"
                      aria-label={listening ? "Слушаю" : "Сказать голосом"}
                      aria-pressed={listening}
                      onClick={() => {
                        const Ctor = speechCtor();
                        if (!Ctor || listening) return;
                        const rec = new Ctor();
                        rec.lang = "ru-RU";
                        rec.interimResults = true;
                        rec.onresult = (e) => setTask(Array.from(e.results).map((r) => r[0].transcript).join(" ").slice(0, 120));
                        rec.onend = () => setListening(false);
                        setListening(true);
                        hapticThreshold();
                        rec.start();
                      }}
                      className={`btn-chunky shrink-0 rounded-full ${listening ? "cs-listening" : ""}`}
                    >
                      <span className="btn-face grid size-[56px] place-items-center rounded-full bg-primary text-primary-foreground">
                        <Mic className="size-6" aria-hidden="true" />
                      </span>
                    </button>
                  )}
                </form>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CHIPS[situation].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        hapticThreshold();
                        setTask(c);
                      }}
                      className="press min-h-11 rounded-full border border-white/10 bg-[oklch(0.24_0.014_130/0.9)] px-4 text-[15px] font-semibold text-foreground"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mt-auto flex flex-col items-center gap-1 pt-6">
                  <button type="button" disabled={!task.trim()} onClick={() => void think(0, [])} onTouchStart={() => {}} className="btn-chunky btn-wake block w-full rounded-[18px] disabled:opacity-50">
                    <span className="btn-face flex h-[60px] items-center justify-center rounded-[18px] bg-primary text-[19px] font-bold text-primary-foreground">Найди шаг</span>
                  </button>
                  <button type="button" onClick={() => { setTask(""); void think(0, []); }} className="press min-h-11 px-4 text-[15px] font-semibold text-muted-foreground">
                    Пропустить
                  </button>
                </div>
              </div>
            )}

            {phase === "thinking" && <div className="flex-1" aria-busy="true" />}

            {phase === "step" && step && (
              <div className="mt-6 flex flex-1 flex-col">
                <div className="note-card relative mx-1 px-5 pb-5 pt-5">
                  <p className="text-pretty text-[24px] font-extrabold leading-[1.25] text-[#1d140d]">{step.step}</p>
                  <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#1d140d]/8 px-3 py-1 text-[15px] font-bold text-[#5a4630]">
                    <span aria-hidden="true">⏱</span> {timeLabel(step.seconds)}
                  </p>
                </div>
                <div className="mt-auto flex flex-col gap-2.5 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      hapticStart();
                      trackEvent("step_started");
                      void recordStart({ label: task.trim() ? `${task.trim()}: ${step.step}` : step.step, minutes: 0, planned: Math.max(1, Math.round(step.seconds / 60)) });
                      setPhase("together");
                    }}
                    onTouchStart={() => {}}
                    className="btn-chunky block w-full rounded-[18px]"
                  >
                    <span className="btn-face btn-sheen flex h-[64px] items-center justify-center rounded-[18px] bg-primary text-[20px] font-extrabold text-primary-foreground">Поехали</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    {level < 2 ? (
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent("step_shrunk");
                          void think((level + 1) as Level, shown);
                        }}
                        onTouchStart={() => {}}
                        className="btn-chunky btn-chunky-dark block rounded-[16px]"
                      >
                        <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-bold">Слишком сложно</span>
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" onClick={() => void think(level, shown)} onTouchStart={() => {}} className="btn-chunky btn-chunky-dark block rounded-[16px]">
                      <span className="btn-face flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-bold">Другой шаг</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** Шаг 5: кот в кольце таймера. Таймер можно скрыть, пауза есть, ушёл со вкладки — при возврате «Продолжаем?» */
function Together({ step, onDone }: { step: { step: string; seconds: number }; onDone: () => void }) {
  const total = Math.max(10, step.seconds);
  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [back, setBack] = useState(false);
  const [here, setHere] = useState(false);
  const away = useRef<number | null>(null);

  useEffect(() => {
    if (paused || back) return;
    const t = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [paused, back]);
  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);
  // «Я тут» всплывает изредка: раз в ~40 с на 3 с
  useEffect(() => {
    const t = window.setInterval(() => {
      setHere(true);
      window.setTimeout(() => setHere(false), 3000);
    }, 40000);
    return () => window.clearInterval(t);
  }, []);
  // ушёл со вкладки — кот не обижается; вернулся через 5+ с — «О, ты вернулся. Продолжаем?»
  useEffect(() => {
    const on = () => {
      if (document.hidden) away.current = Date.now();
      else if (away.current && Date.now() - away.current > 5000) setBack(true);
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const frac = left / total;
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex flex-1 flex-col items-center pt-6 text-center">
      <p className="max-w-[30ch] text-pretty text-[16px] font-semibold leading-snug text-foreground/70">{step.step}</p>
      <div className="relative mt-8 grid size-[min(78vw,300px)] place-items-center">
        {!hidden && (
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={R} fill="none" stroke="oklch(1 0 0 / 0.1)" strokeWidth="3" />
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
        )}
        <MascotDoll expression="focused" size={200} label="Напарник рядом" className="size-[64%]" />
        <p aria-live="polite" className={`glass-hearthside absolute -top-3 right-0 rounded-2xl px-3 py-1.5 text-[15px] font-semibold transition-opacity duration-500 ${here || back ? "opacity-100" : "opacity-0"}`}>
          {back ? "О, ты вернулся. Продолжаем?" : "Я тут"}
        </p>
      </div>
      {!hidden && <p className="mt-4 font-mono text-[28px] font-bold tabular-nums text-foreground">{clock(left)}</p>}
      <div className="mt-auto flex w-full flex-col gap-2.5 pt-6">
        {back ? (
          <button type="button" onClick={() => setBack(false)} onTouchStart={() => {}} className="btn-chunky block w-full rounded-[18px]">
            <span className="btn-face flex h-[60px] items-center justify-center rounded-[18px] bg-primary text-[19px] font-bold text-primary-foreground">Продолжаем</span>
          </button>
        ) : (
          <button type="button" onClick={onDone} onTouchStart={() => {}} className="btn-chunky block w-full rounded-[18px]">
            <span className="btn-face flex h-[60px] items-center justify-center rounded-[18px] bg-primary text-[19px] font-bold text-primary-foreground">Сделал</span>
          </button>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => setPaused((p) => !p)} className="btn-chunky btn-chunky-dark block rounded-[16px]">
            <span className="btn-face flex h-[50px] items-center justify-center gap-1.5 rounded-[16px] text-[15px] font-bold">
              {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
              {paused ? "Дальше" : "Пауза"}
            </span>
          </button>
          <button type="button" onClick={() => setHidden((h) => !h)} className="btn-chunky btn-chunky-dark block rounded-[16px]">
            <span className="btn-face flex h-[50px] items-center justify-center rounded-[16px] text-[15px] font-bold">{hidden ? "Показать таймер" : "Скрыть таймер"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Шаг 6: победа. Огонь вверх, искры, кот прыгает; две равные кнопки — обе празднуются */
function Win({ catRef, reduce, onMore, onEnough }: { catRef: React.RefObject<HTMLDivElement | null>; reduce: boolean; onMore: () => void; onEnough: () => void }) {
  const here = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    trackEvent("step_completed");
    hapticReward();
    if (reduce) return;
    const r = (here.current ?? catRef.current)?.getBoundingClientRect();
    const stop = celebrate({ x: r ? r.left + r.width / 2 : window.innerWidth / 2, y: r ? r.top + r.height / 3 : window.innerHeight / 3 });
    return stop;
  }, [catRef, reduce]);
  return (
    <div className="flex flex-1 flex-col items-center pt-10 text-center">
      <div ref={here} className="relative">
        <div className="absolute -bottom-2 -left-[22%] z-[2] h-[55%] w-[46%]">
          <Campfire className="cs-flare-up block size-full" />
        </div>
        <MascotDoll expression="excited" action="celebrate" size={220} label="Напарник радуется" className="size-[clamp(150px,30dvh,220px)]" />
      </div>
      <h2 className="mt-6 text-[30px] font-extrabold leading-tight text-foreground">
        Хвост подожжён <span aria-hidden="true">🔥</span>
      </h2>
      <p className="mt-2 max-w-[28ch] text-[18px] font-semibold leading-snug text-foreground/80">Ты начал. Это было самое сложное.</p>
      <div className="mt-auto grid w-full grid-cols-2 gap-2.5 pt-6">
        <button type="button" onClick={onMore} onTouchStart={() => {}} className="btn-chunky block rounded-[18px]">
          <span className="btn-face flex h-[64px] items-center justify-center rounded-[18px] bg-primary px-2 text-[16px] font-extrabold leading-tight text-primary-foreground">Ещё 5 минут с котом</span>
        </button>
        <button type="button" onClick={onEnough} onTouchStart={() => {}} className="btn-chunky block rounded-[18px]">
          <span className="btn-face flex h-[64px] items-center justify-center rounded-[18px] bg-primary px-2 text-[16px] font-extrabold leading-tight text-primary-foreground">На сегодня хватит</span>
        </button>
      </div>
    </div>
  );
}
