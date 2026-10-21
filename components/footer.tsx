import Link from "next/link";
import { MascotDoll as MascotSvg } from "@/components/mascot-doll";
import { Button } from "@/components/ui/button";

/**
 * Футер как пик по закону Peak-End Rule.
 * Последнее что видит человек — это его воспоминание о продукте.
 * Не дисклеймер, а живое существо, которое ждёт и зовёт.
 */
export function Footer() {
  return (
    <footer className="grain relative overflow-hidden border-t border-border bg-background">
      {/* Рассветное свечение снизу */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[oklch(0.22_0.06_70/0.18)] to-transparent"
      />
      {/* Звёздочки */}
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute size-0.5 rounded-full bg-foreground/20"
          style={{
            top: `${10 + ((i * 13) % 55)}%`,
            left: `${8 + ((i * 23) % 84)}%`,
            opacity: 0.15 + (i % 4) * 0.08,
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center gap-6 px-6 py-16 text-center">
        {/* Маскот: смотрит на посетителя */}
        <MascotSvg
          expression="happy"
          size={120}
          label="Напарник ждёт"
          className="drop-shadow-[0_0_24px_oklch(0.72_0.17_55/0.3)]"
        />

        <div className="flex flex-col gap-2">
          <h2 className="text-balance text-2xl font-bold leading-tight md:text-3xl">
            Одно крошечное дело. Прямо сейчас.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Не план. Не система. Просто начни — я уже здесь.
          </p>
        </div>

        <Button
          render={<Link href="/app" data-cta="" />}
          nativeButton={false}
          size="lg"
          className="press font-semibold"
        >
          Пойдём
        </Button>

        {/* Полоса доверия: снимает последние возражения одной строкой,
            включая прямое называние СДВГ-аудитории */}
        <p className="max-w-sm font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground/70">
          работает в браузере · данные остаются у тебя · без стыда и стриков ·
          подходит при СДВГ и без
        </p>

        <div className="mt-4 flex flex-col items-center gap-3 border-t border-border/40 pt-6 w-full">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">
            напарник
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground/50">
            Не медицинский сервис. Если фокус — это боль каждый день, поговори
            со специалистом.
          </p>
        </div>
      </div>
    </footer>
  );
}
