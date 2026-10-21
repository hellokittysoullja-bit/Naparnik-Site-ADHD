"use client";

import { motion, useReducedMotion } from "motion/react";
import { MascotSvg } from "@/components/mascot-svg";
import { SPRING_REVEAL, SPRING_ITEM } from "@/lib/motion";

/**
 * Манифест перед договором: эмоциональная вершина страницы одной мыслью.
 * Не фичи и не механика — три строки анафоры о присутствии. Без своей
 * CTA-кнопки: кнопка есть в договоре сразу ниже, соседняя конкурировала бы.
 * Внизу существо выглядывает из-за кромки секции — единственная визуальная
 * шутка страницы, и она принадлежит нашему SVG-персонажу.
 */

const lines = [
  ["Когда ты теряешь фокус —", "он возвращает."],
  ["Когда ты срываешься —", "он не исчезает."],
  ["Когда ты двигаешься —", "он рядом."],
] as const;

export function Presence() {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="presence"
      aria-label="Присутствие"
      className="relative scroll-mt-20 overflow-hidden"
    >
      {/* Единственное место на лендинге, где холодная ночь и тёплый огонёк
          свечи смешиваются в одном свечении — остальные секции используют
          только один акцент за раз. Текст называет это вершиной ("не
          мотивация — присутствие"), фон обязан её показать, а не просто
          сообщить. Больше вертикального пространства, чем у соседей —
          тишина вокруг немногих слов тоже часть веса. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_70%_60%_at_50%_35%,oklch(0.86_0.22_130/0.10)_0%,oklch(0.72_0.17_55/0.07)_45%,transparent_80%)] blur-3xl"
      />
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-10 px-6 pt-28 text-center md:pt-40">
        <motion.h2
          className="text-balance text-4xl font-bold leading-[1.1] tracking-tight md:text-6xl"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={SPRING_REVEAL}
        >
          Не мотивация. <span className="text-primary">Присутствие.</span>
        </motion.h2>

        <div className="flex flex-col gap-3">
          {lines.map(([when, act], i) => (
            <motion.p
              key={when}
              className="text-pretty text-xl leading-relaxed text-foreground/50 md:text-2xl"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                ...SPRING_ITEM,
                delay: reduceMotion ? 0 : 0.2 + i * 0.18,
              }}
            >
              {when} <span className="font-medium text-foreground">{act}</span>
            </motion.p>
          ))}
        </div>

        {/* Существо выглядывает из-за нижней кромки: видны только уши и
            глаза, контейнер с overflow-hidden режет остальное */}
        <div
          aria-hidden="true"
          className="relative mt-2 flex h-16 w-44 justify-center overflow-hidden border-b border-white/10"
        >
          <motion.div
            initial={reduceMotion ? false : { y: 64 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{
              ...SPRING_ITEM,
              delay: reduceMotion ? 0 : 0.45,
            }}
          >
            <MascotSvg expression="happy" size={150} label="" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
