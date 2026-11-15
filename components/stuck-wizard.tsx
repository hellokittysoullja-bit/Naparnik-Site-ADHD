"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BatteryLow, CloudFog, Mountain, RotateCcw, ShieldAlert, Wind, type LucideIcon } from "lucide-react";
import { MascotDoll, type MascotExpression } from "@/components/mascot-doll";
import { EmphasisText } from "@/components/emphasis-text";
import { hapticThreshold } from "@/lib/haptics";

/**
 * «Не могу начать» — мастер старта.
 * Образец — Procrastination Wizard у Amazing Marvin, их самая хвалимая функция (справка
 * help.amazingmarvin.com/amazing-marvin/procrastination-wizard; research/25-deep-teardowns/amazing-marvin.md §7):
 *  - сверху дело, человек отвечает кнопками;
 *  - на некоторых шагах нужно что-то написать или запустить короткий таймер;
 *  - есть «назад» и «сначала»;
 *  - в конце кнопка «я готов начать», после неё сразу идёт учёт времени;
 *  - каждый раз мастер начинает с другого вопроса («worth opening again if the first round didn't help»).
 * Сами вопросы Marvin не публикует — вопросы и ответы здесь свои. Основа ответа кота — три такта: отразить, назвать
 * причину в ситуации (не в человеке), дать одно действие (Q20). Вопрос «что происходит», а не «что мешает» (Q13).
 * Голос кота без тире (правило владельца 12.11).
 */
type Kind = "fear" | "unclear" | "tired" | "bored" | "big";

const KINDS: { kind: Kind; icon: LucideIcon; hue: number }[] = [
  { kind: "fear", icon: ShieldAlert, hue: 25 },
  { kind: "unclear", icon: CloudFog, hue: 205 },
  { kind: "tired", icon: BatteryLow, hue: 265 },
  { kind: "bored", icon: Wind, hue: 150 },
  { kind: "big", icon: Mountain, hue: 330 },
];

/** Три входа в один и тот же разговор: мастер каждый раз начинает с другого вопроса */
const OPENERS: { ask: string; labels: Record<Kind, string> }[] = [
  {
    ask: "Бывает. Что сейчас *происходит* с делом?",
    labels: { fear: "Страшно, что выйдет плохо", unclear: "Непонятно, с чего начать", tired: "Нет сил", bored: "Скучно", big: "Оно слишком большое" },
  },
  {
    ask: "Что ты *чувствуешь*, когда думаешь о нём?",
    labels: { fear: "Тревогу", unclear: "Туман в голове", tired: "Усталость", bored: "Скуку", big: "Тяжесть, как от горы" },
  },
  {
    ask: "Чего сейчас *не хватает*, чтобы начать?",
    labels: { fear: "Права на ошибку", unclear: "Ясности", tired: "Сил", bored: "Интереса", big: "Чтобы дело было меньше" },
  },
];

type Probe =
  | { type: "write"; ask: string; placeholder: string; echo: (w: string) => string }
  | { type: "timer"; ask: string; seconds: number; after: string }
  | { type: "pick"; ask: string; options: { key: string; label: string }[]; echo: (k: string) => string };

const PROBE: Record<Kind, Probe> = {
  fear: {
    type: "write",
    ask: "Что *самое страшное* тут? Одним словом, только для тебя.",
    placeholder: "например, «осудят»",
    echo: (w) => `«${w}». Записал и отложил. На черновик это не действует: его *никто не увидит*.`,
  },
  unclear: {
    type: "write",
    ask: "Что ты про это дело *уже знаешь*? Хоть одну вещь.",
    placeholder: "например, «сдать до пятницы»",
    echo: (w) => `Уже не туман: «${w}». От этого и *оттолкнёмся*.`,
  },
  tired: {
    type: "timer",
    ask: "Сначала *полминуты* ничего. Просто подыши, я посчитаю.",
    seconds: 30,
    after: "Вот. Теперь шаг *такого же размера*, не больше.",
  },
  bored: {
    type: "pick",
    ask: "Что добавим, чтобы было *не так пусто*?",
    options: [
      { key: "fire", label: "Треск костра" },
      { key: "rain", label: "Дождь" },
      { key: "off", label: "Ничего, тишина" },
    ],
    echo: (k) => (k === "off" ? "Тишина так тишина. Тогда берём *коротко*, чтобы не успело надоесть." : "Включу, как только начнём. И берём *коротко*."),
  },
  big: {
    type: "write",
    ask: "Какой кусок *самый первый*? Скажи как получится, можно криво.",
    placeholder: "например, «открыть файл»",
    echo: (w) => `«${w}». С этого и начнём, остальное *подождёт*.`,
  },
};

const ANSWER: Record<Kind, { reflect: string; reason: string; step: (t: string, w: string) => string; minutes: number; breakIt?: boolean; face: MascotExpression }> = {
  fear: {
    reflect: "Страшно, потому что тебе *не всё равно*.",
    reason: "Когда ждёшь оценку, мозг тянет время. Черновик снимает оценку.",
    step: (t) => `${t}: 5 минут нарочно криво`,
    minutes: 5,
    face: "listening",
  },
  unclear: {
    reflect: "Непонятно, потому что дело видно *только целиком*.",
    reason: "Это про размер дела, а не про тебя. Разломаем, и первый шаг покажется.",
    step: (t) => t,
    minutes: 15,
    breakIt: true,
    face: "calm",
  },
  tired: {
    reflect: "Сил мало, значит и шаг нужен *совсем маленький*.",
    reason: "Усталая голова отказывается от большого. На маленькое соглашается.",
    step: (t) => `${t}: просто открыть и посмотреть`,
    minutes: 5,
    face: "sleepy",
  },
  bored: {
    reflect: "Скучно, потому что отдача *далеко*.",
    reason: "Поставим её ближе: короткий отрезок, а в конце находка на острове.",
    step: (t) => `${t}: 15 минут и стоп`,
    minutes: 15,
    face: "happy",
  },
  big: {
    reflect: "Большое дело *нельзя начать*. Начать можно только кусок.",
    reason: "Гора не уменьшится, зато первый камень поднимается легко.",
    step: (t, w) => (w ? w : t),
    minutes: 5,
    face: "calm",
  },
};

const OPENER_KEY = "naparnik:stuckOpener";
const EASE = [0.05, 0.7, 0.1, 1] as const;

export function StuckWizard() {
  const params = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [task, setTask] = useState((params.get("task") ?? "").slice(0, 100));
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [word, setWord] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [opener, setOpener] = useState(0);
  // каждый заход — со следующего вопроса; счётчик живёт на устройстве
  useEffect(() => {
    try {
      const n = (Number(window.localStorage.getItem(OPENER_KEY) ?? "-1") + 1) % OPENERS.length;
      window.localStorage.setItem(OPENER_KEY, String(n));
      setOpener(n);
    } catch {
      /* приватный режим: всегда первый вопрос */
    }
  }, []);

  const probe = kind ? PROBE[kind] : null;
  const a = kind ? ANSWER[kind] : null;
  const label = task.trim() || "Дело";

  // короткий таймер «подышим» идёт от настоящих часов; по нулю мастер сам переходит дальше
  const endRef = useRef(0);
  useEffect(() => {
    if (stage !== 1 || probe?.type !== "timer") return;
    endRef.current = Date.now() + probe.seconds * 1000;
    setLeft(probe.seconds);
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        window.clearInterval(id);
        setStage(2);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [stage, probe]);

  const choose = (k: Kind) => {
    hapticThreshold();
    setKind(k);
    setWord("");
    setPicked(null);
    setStage(1);
  };
  const restart = () => {
    setKind(null);
    setWord("");
    setPicked(null);
    setStage(0);
    setOpener((n) => (n + 1) % OPENERS.length);
  };
  const back = () => {
    if (stage === 2) setStage(1);
    else if (stage === 1) setStage(0);
    else router.push("/app");
  };

  const stepText = a ? a.step(label, kind === "big" ? word.trim() : "").slice(0, 120) : "";
  const start = () => {
    if (!a || !kind) return;
    if (kind === "bored" && picked) {
      try {
        window.localStorage.setItem("naparnik:sound", picked);
        window.localStorage.setItem("naparnik:ambient", picked === "off" ? "0" : "1");
      } catch {
        /* приватный режим */
      }
    }
    if (a.breakIt) {
      router.push(`/app/session?step=${encodeURIComponent(stepText)}&break=1`);
      return;
    }
    // «Готов начать» — это и есть старт: человек нажал сам, второго «точно?» на экране Фокуса не будет
    // (тот же одноразовый пропуск, что ставит знакомство; components/focus-session.tsx, AUTO_START_KEY)
    try {
      window.sessionStorage.setItem("naparnik:autoStart", stepText);
    } catch {
      /* без пропуска Фокус покажет шаг и кнопку старта */
    }
    router.push(`/app/session?step=${encodeURIComponent(stepText)}&d=${a.minutes}&auto=1`);
  };

  let line = OPENERS[opener].ask;
  let face: MascotExpression = "listening";
  if (stage === 1 && probe) {
    line = probe.ask;
    face = kind === "tired" ? "sleepy" : "listening";
  } else if (stage === 2 && a && probe) {
    const echo = probe.type === "write" && word.trim() ? probe.echo(word.trim()) : probe.type === "pick" && picked ? probe.echo(picked) : probe.type === "timer" ? probe.after : a.reflect;
    line = echo;
    face = a.face === "sleepy" ? "calm" : "happy";
  }

  return (
    <main className="app-page-enter relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-2">
        <button type="button" onClick={back} aria-label="Назад" className="press -ml-2 grid size-11 place-items-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowLeft className="size-5" />
        </button>
        {/* три шага мастера: где я и сколько осталось */}
        <ol className="flex flex-1 items-center gap-1.5" aria-label={`Шаг ${stage + 1} из 3`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= stage ? "bg-primary" : "bg-white/12"}`} />
          ))}
        </ol>
        {stage > 0 ? (
          <button type="button" onClick={restart} aria-label="Сначала" className="press -mr-2 grid size-11 place-items-center rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <RotateCcw className="size-[18px]" />
          </button>
        ) : (
          <span className="size-9" />
        )}
      </div>

      {/* дело — сверху, как у источника: мастер всё время говорит про него */}
      <label className="field-shell mt-1">
        <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/90">дело</span>
        <input
          value={task}
          maxLength={100}
          onChange={(e) => setTask(e.target.value)}
          placeholder="например, курсовая"
          className="field-inner"
          enterKeyHint="done"
          autoCapitalize="sentences"
        />
      </label>

      <div className="mt-4 flex items-end gap-3">
        <MascotDoll expression={face} action={stage === 2 ? "wave" : stage === 1 && kind === "unclear" ? "think" : "idle"} size={104} label="Напарник" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${stage}-${kind}-${line}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: reduce ? 0.1 : 0.26, ease: EASE }}
            className="glass mb-3 min-w-0 flex-1 origin-bottom-left text-pretty rounded-[20px] rounded-bl-md px-4 py-3 text-[1.02rem] leading-snug"
          >
            <EmphasisText text={line} />
          </motion.p>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stage}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24, transition: { duration: 0.14 } }}
          transition={{ duration: reduce ? 0.1 : 0.26, ease: EASE }}
          className="mt-4 flex flex-1 flex-col"
        >
          {stage === 0 && (
            <div className="flex flex-col gap-2" role="group" aria-label="Что происходит">
              {KINDS.map((o, i) => (
                <motion.button
                  key={o.kind}
                  type="button"
                  onClick={() => choose(o.kind)}
                  onTouchStart={() => {}}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: reduce ? 0 : 0.04 * i, ease: EASE }}
                  className="option-card flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left"
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[11px]" style={{ background: `oklch(0.74 0.12 ${o.hue} / 0.18)`, color: `oklch(0.88 0.13 ${o.hue})` }}>
                    <o.icon className="size-[19px]" strokeWidth={2.2} />
                  </span>
                  <span className="text-[16px] font-semibold">{OPENERS[opener].labels[o.kind]}</span>
                </motion.button>
              ))}
            </div>
          )}

          {stage === 1 && probe?.type === "write" && (
            <form
              className="flex flex-1 flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setStage(2);
              }}
            >
              <input
                autoFocus
                value={word}
                maxLength={60}
                onChange={(e) => setWord(e.target.value)}
                placeholder={probe.placeholder}
                aria-label="Ответ"
                className="field"
                enterKeyHint="next"
                autoCapitalize="sentences"
              />
              <p className="text-[13px] text-muted-foreground">Это никуда не уходит и не сохраняется.</p>
              <WizardButton label="Дальше" className="mt-auto" />
              <button type="button" onClick={() => { setWord(""); setStage(2); }} className="press h-11 text-[14.5px] font-medium text-muted-foreground">
                Пропустить
              </button>
            </form>
          )}

          {stage === 1 && probe?.type === "timer" && (
            <div className="flex flex-1 flex-col items-center gap-4">
              <div className="relative grid size-40 place-items-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="oklch(1 0 0 / 0.12)" strokeWidth="5" />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    style={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - left / probe.seconds), transition: reduce ? "none" : "stroke-dashoffset 0.3s linear" }}
                  />
                </svg>
                <span role="timer" className="text-5xl font-bold tabular-nums">{left}</span>
              </div>
              <p className="font-hand text-[22px] text-foreground/85">вдох, и медленно выдох</p>
              <button type="button" onClick={() => setStage(2)} className="press mt-auto h-11 text-[14.5px] font-medium text-muted-foreground">
                Уже можно дальше
              </button>
            </div>
          )}

          {stage === 1 && probe?.type === "pick" && (
            <div className="flex flex-col gap-2" role="group" aria-label="Что добавить">
              {probe.options.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => {
                    hapticThreshold();
                    setPicked(o.key);
                    setStage(2);
                  }}
                  onTouchStart={() => {}}
                  className="option-card flex min-h-14 w-full items-center rounded-2xl px-4 text-left text-[16px] font-semibold"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {stage === 2 && a && (
            <div className="flex flex-1 flex-col gap-3">
              <p className="text-[15px] leading-snug text-foreground/85">
                <EmphasisText text={a.reflect} /> {a.reason}
              </p>
              <div className="deal-card rounded-[20px] p-4">
                <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.2em] text-primary/90">
                  {a.breakIt ? "сначала разломаем" : `один шаг · ${a.minutes} мин`}
                </p>
                <p className="mt-1.5 text-pretty text-[1.15rem] font-bold leading-snug [overflow-wrap:anywhere]">{stepText}</p>
              </div>
              <div className="mt-auto flex flex-col gap-1">
                <button
                  type="button"
                  onClick={start}
                  disabled={!task.trim()}
                  onTouchStart={() => {}}
                  className="btn-chunky block w-full select-none rounded-[16px] outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="btn-face flex h-[56px] items-center justify-center rounded-[16px] bg-primary px-6 text-[18px] font-bold tracking-[-0.01em] text-primary-foreground">
                    {a.breakIt ? "Разломать на шаги" : "Готов начать"}
                  </span>
                </button>
                {!task.trim() && <p className="text-center text-[13px] text-muted-foreground">Впиши дело наверху, и поедем.</p>}
                <button type="button" onClick={restart} className="press h-11 text-[14.5px] font-medium text-muted-foreground">
                  Не то, спроси по-другому
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function WizardButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button type="submit" onTouchStart={() => {}} className={`btn-chunky block w-full select-none rounded-[16px] outline-none ${className}`}>
      <span className="btn-face flex h-[56px] items-center justify-center rounded-[16px] bg-primary px-6 text-[18px] font-bold tracking-[-0.01em] text-primary-foreground">{label}</span>
    </button>
  );
}
