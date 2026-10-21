"use client";

import { motion, useReducedMotion } from "motion/react";
import { MascotSvg } from "@/components/mascot-svg";
import { SPRING_REVEAL, SPRING_ITEM } from "@/lib/motion";

// 3 пункта вместо 4: три удара читаются, четыре — уже список жалоб
const failedTools = [
  "Ты собрал в Notion идеальную систему — и не открыл её 9 дней",
  "Todoist с 47 просроченными задачами",
  "Pomodoro-таймер, который ты забываешь включить",
];

export function Problem() {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-label="Проблема" className="relative overflow-hidden">
      {/* Гребень холма на стыке с hero: земля сцены продолжается, а не обрывается.
          Холм чуть светлее ночного фона + тёплая лунная кромка по горизонту —
          переход виден глазу, а не читается чёрным провалом. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-12 w-full md:h-16"
        viewBox="0 0 800 56"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="problem-crest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.215 0.02 135)" />
            <stop offset="100%" stopColor="oklch(0.17 0.014 135)" />
          </linearGradient>
        </defs>
        <path
          d="M0 0 L800 0 L800 20 Q640 40 460 30 Q240 20 0 38 Z"
          fill="url(#problem-crest)"
        />
        <path
          d="M800 20 Q640 40 460 30 Q240 20 0 38"
          fill="none"
          stroke="oklch(0.72 0.17 55 / 0.22)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Холодный подсвет слева — не тёплый. Это самая холодная точка
          страницы: тебе говорят правду про силу воли, напарника в этом
          аргументе нет. Тёплая кромка гребня выше — последний отблеск
          hero, гаснущий на входе в холод; ниже — синева дна ночи.
          Контраст готовит возврат тепла в следующих секциях (пик сильнее
          после впадины). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,oklch(0.5_0.09_240/0.1)_0%,transparent_65%)] blur-3xl"
      />

      <div className="relative mx-auto max-w-2xl px-6 py-16 md:py-24">
        <motion.div
          className="flex flex-col gap-8 md:gap-10"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={SPRING_REVEAL}
        >
          {/* Огромный заголовок */}
          <h2 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl">
            Обычные инструменты ждут твоей дисциплины. Я — тебя.
          </h2>

          {/* Зачёркнутый список: тонкая приглушённая линия — констатация, не крик */}
          <ul className="flex flex-col gap-5">
            {failedTools.map((tool, i) => (
              <motion.li
                key={tool}
                className="flex items-baseline gap-3 text-xl leading-relaxed md:text-2xl"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  ...SPRING_ITEM,
                  delay: reduceMotion ? 0 : i * 0.15,
                }}
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-destructive/80"
                >
                  ✗
                </span>
                {/* /62 вместо /45: зачёркнутое ДОЛЖНО читаться — это аргумент
                    «ты это уже пробовал», а не декорация. На OLED с автояркостью
                    /45 сливалось в серую кашу (скриншот IMG_1844) */}
                <span className="text-foreground/62 line-through decoration-destructive/55 decoration-[1.5px]">
                  {tool}
                </span>
              </motion.li>
            ))}
          </ul>

          {/* Финальный текст — крупнее и контрастнее */}
          <motion.p
            className="text-pretty text-xl leading-relaxed md:text-2xl"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              ...SPRING_ITEM,
              delay: reduceMotion ? 0 : 0.65,
            }}
          >
            Все они требуют одного: чтобы ты сам их открыл. То есть той самой
            силы воли, которой нет в момент прокрастинации. Тебе нужен не
            инструмент —
            {/* Рукописная строка вынесена отдельным блоком: инлайн-вставка другим
                шрифтом и кеглем рвала ритм чтения абзаца */}
            <span className="mt-3 block font-hand text-3xl leading-snug text-primary md:text-4xl">
              кто-то, кто сам придёт и скажет «начинай».
            </span>
          </motion.p>

          {/* Контраст-карточка (по референсу): развязка конфликта не только
              сказана, но и показана: после зачёркнутых инструментов —
              единственная живая карточка с существом. Единственный лаймовый
              акцент секции после рукописной строки — они работают в паре */}
          <motion.div
            className="glass-highlight flex items-center gap-4 self-start rounded-2xl px-5 py-4"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              ...SPRING_ITEM,
              delay: reduceMotion ? 0 : 0.85,
            }}
          >
            <MascotSvg expression="happy" size={48} label="Напарник" />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary/70">
                напарник · остаётся рядом
              </span>
              <p className="text-lg font-medium text-foreground md:text-xl">
                Я сижу рядом, пока ты работаешь.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
