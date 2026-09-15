"use client";

import { motion, useReducedMotion } from "motion/react";
import { SPRING_REVEAL, SPRING_ITEM, SPRING_SNAPPY } from "@/lib/motion";

const day: Array<{
  time: string;
  title: string;
  text: string;
  quote: string;
  reply?: string;
}> = [
  {
    time: "накануне · 21:40",
    title: "Вечером: 3 минуты",
    text: "Напарник разбирает с тобой завтра и превращает «поработать над проектом» в одно физическое действие.",
    quote:
      "Значит, завтра просто открываешь файл диплома. Всё, больше ничего не планируем.",
    reply: "Договорились",
  },
  {
    time: "09:12",
    title: "Утром он пишет первым",
    text: "Не пуш «пора работать», а сообщение от живого существа. Начать легче, чем отказать.",
    quote: "Я тут. Помнишь? Просто открыть файл. Я рядом.",
    reply: "Открыл",
  },
  {
    time: "09:31",
    title: "Сессия вдвоём",
    text: "Ты работаешь, он рядом. Body doubling без второго человека. Отвлёкся? Мягко вернёт.",
    quote: "Полёт нормальный. Я никуда не ухожу.",
    reply: "Пишу дальше",
  },
  {
    time: "10:04",
    title: "Его мир растёт",
    text: "Каждый старт растит новый кусочек острова. Провалил день? Ничего не сгорает. Ноль, не минус.",
    quote: "Смотри, у нас вырос первый росток. Это твой.",
  },
];

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how" className="grain relative scroll-mt-20 overflow-hidden">
      {/* Большое amber-свечение слева */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 h-[700px] w-[500px] -translate-x-1/3 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.72_0.17_55/0.10)_0%,transparent_65%)] blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-20 md:py-28">
        <motion.div
          className="mb-10 flex flex-col gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={SPRING_REVEAL}
        >
          {/* Без text-primary на «с напарником»: тот же приём уже стоит в
              presence.tsx на «Присутствие» — единственном законном месте
              (эмоциональный пик страницы). Повторить его здесь и в
              world-section значило бы превратить акцент в тик шаблона —
              ровно то, против чего предупреждает frontend-design (anthropics)
              как про самый частый AI-tell. */}
          <h2 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Один день с напарником
          </h2>
          <p className="text-lg text-foreground/60 md:text-xl">
            Ты просто отвечаешь. Остальное делаю я.
          </p>
        </motion.div>

        {/* Вертикальная лента: более толстая нить, lime-цвет */}
        <div className="relative flex flex-col gap-12 border-l-4 border-primary/40 pl-8 md:pl-14">
          {day.map((step, i) => (
            <motion.article
              key={step.time}
              className="relative flex flex-col gap-4"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                ...SPRING_ITEM,
                delay: reduceMotion ? 0 : i * 0.12,
              }}
            >
              {/* Узел на нити — больше и заметнее */}
              <span
                aria-hidden="true"
                className="absolute -left-8 top-2 size-4 -translate-x-1/2 rounded-full border-2 border-primary bg-primary/30 ring-4 ring-primary/10 md:-left-14"
              />
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs tracking-widest text-primary">
                  {step.time}
                </span>
              </div>
              <h3 className="text-2xl font-bold md:text-3xl">{step.title}</h3>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {step.text}
              </p>
              {/* Цитата крупнее. Было: плоский border+bg-primary/10 без
                  объёма — заметно беднее настоящих пузырей чата в
                  приложении. .glass-highlight (globals.css) — готовый
                  третий материальный ярус с той же формулой глубины
                  (inset-блик + внешнее свечение), уже предназначенный
                  именно для одного акцентного элемента на секцию. */}
              <div className="glass-highlight rounded-xl px-5 py-4">
                <p
                  className={`font-hand text-xl leading-snug text-primary md:text-2xl ${
                    i % 2 === 0 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]"
                  }`}
                >
                  «{step.quote}»
                </p>
              </div>
              {/* Ответ-чип: показывает цену входа — два слова, не эссе.
                  Стиль повторяет реплику посетителя из чата в hero */}
              {step.reply && (
                <p className="self-end rounded-2xl rounded-br-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_oklch(0.86_0.22_130/0.5)]">
                  {step.reply}
                </p>
              )}
            </motion.article>
          ))}

          {/* Якорь награды: день закрывается зафиксированной победой, а не
              просто последним шагом — replay дофаминовой петли до регистрации */}
          <motion.div
            className="relative flex items-center gap-2.5 self-start rounded-full border border-primary/45 bg-primary/15 px-5 py-2.5"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={SPRING_SNAPPY}
          >
            <span
              aria-hidden="true"
              className="absolute -left-8 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary ring-4 ring-primary/15 md:-left-14"
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 8.5 L6.5 12 L13 4.5"
                stroke="var(--color-primary)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-mono text-sm tracking-wide text-primary">
              победа записана в остров
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
