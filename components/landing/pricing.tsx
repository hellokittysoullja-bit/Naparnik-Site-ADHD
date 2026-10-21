"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { MascotDoll as MascotSvg } from "@/components/mascot-doll";
import { SPRING_ITEM } from "@/lib/motion";

/**
 * Не прайсинг-карточка с чеклистом, а договор, написанный напарником от руки.
 * Обещания — его голосом, от первого лица: доверие важнее списка фич.
 */

const promises = [
  "Я помню твой план и пишу первым — тебе не нужно себя заставлять открыть меня.",
  "Я никогда не стыжу. Пропустил день — я просто рыбачил и ждал.",
  "Остров не откатывается. Что выросло — выросло навсегда.",
  "Всё это бесплатно, без карты и регистрации. Если появится подписка — скажу прямо, первым.",
];

export function Pricing() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="pricing" className="mx-auto max-w-5xl px-4 py-20 md:py-28 scroll-mt-20">
      <motion.div
        className="relative mx-auto flex max-w-md flex-col gap-6 rounded-3xl border border-primary/40 bg-card p-8 shadow-[0_0_0_1px_oklch(0.72_0.17_55/0.10),0_8px_40px_oklch(0.72_0.17_55/0.09)]"
        initial={reduceMotion ? false : { opacity: 0, y: 28, rotate: -0.6 }}
        whileInView={{ opacity: 1, y: 0, rotate: -0.6 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={SPRING_ITEM}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-hand text-4xl leading-tight">Я обещаю:</h2>
          <MascotSvg
            expression="happy"
            size={56}
            label="Напарник"
            className="shrink-0"
          />
        </div>

        <ul className="flex flex-col gap-4">
          {promises.map((item, i) => (
            <li
              key={item}
              className={`font-hand text-xl leading-snug ${
                i % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.35deg]"
              }`}
            >
              — {item}
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between border-t border-dashed border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            подпись: напарник
          </p>
          {/* лапка вместо подписи */}
          <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden="true">
            <ellipse
              cx="22"
              cy="21"
              rx="9"
              ry="7"
              fill="var(--color-primary)"
              opacity="0.9"
            />
            <circle
              cx="10"
              cy="12"
              r="3.5"
              fill="var(--color-primary)"
              opacity="0.75"
            />
            <circle
              cx="18"
              cy="7"
              r="3.5"
              fill="var(--color-primary)"
              opacity="0.8"
            />
            <circle
              cx="27"
              cy="7"
              r="3.5"
              fill="var(--color-primary)"
              opacity="0.8"
            />
            <circle
              cx="35"
              cy="12"
              r="3.5"
              fill="var(--color-primary)"
              opacity="0.75"
            />
          </svg>
        </div>

        <Button
          render={<Link href="/app" data-cta="" />}
          nativeButton={false}
          size="lg"
          className="press w-full font-semibold"
        >
          Договорились
        </Button>
        {/* Снятие риска прямо у точки решения */}
        <p className="-mt-3 text-center font-mono text-xs text-muted-foreground/70">
          вход — просто открыть, без карты и регистрации
        </p>
      </motion.div>
    </section>
  );
}
