import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderCta } from "@/components/header-cta";
import { MascotStatic } from "@/components/hero-scene";

export function SiteHeader() {
  return (
    <header className="glass-nav sticky top-0 z-50 border-b border-white/10">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* min-h-11: зона нажатия 44px (Apple HIG / WCAG 2.5.5). Замер до
            правки давал 28px по высоте у всех целей шапки — формально это
            проходит обязательный минимум WCAG 2.5.8 (24px), но промахи
            пальцем начинаются заметно раньше. Текст и вёрстка не двигаются:
            растёт только область нажатия внутри той же шапки h-14. */}
        <Link href="/" className="flex min-h-11 items-center gap-1.5">
          {/* Живой микро-кот вместо лаймового квадрата с «Н»: лицо бренда в
              шапке (дышит и моргает на SMIL), а лайм в кадре остаётся за
              смыслом — глазами, «первым» и CTA */}
          <MascotStatic size={30} className="-mt-0.5" />
          <span className="text-sm font-bold tracking-tight">напарник</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            render={<Link href="#how" />}
            nativeButton={false}
            size="sm"
            variant="ghost"
            // hidden ниже 360px: замер показал горизонтальный скролл на 280px
            // (scrollWidth 318 при clientWidth 280) — шапка не помещалась.
            // На узких экранах остаются лого и главное действие.
            className="hidden min-h-11 text-muted-foreground min-[360px]:inline-flex"
          >
            Как это работает
          </Button>
          <Button
            render={<Link href="#world" />}
            nativeButton={false}
            size="sm"
            variant="ghost"
            className="hidden min-h-11 text-muted-foreground sm:inline-flex"
          >
            Мир
          </Button>
          <HeaderCta />
        </nav>
      </div>
    </header>
  );
}
