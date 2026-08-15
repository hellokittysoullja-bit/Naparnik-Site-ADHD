import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderCta } from "@/components/header-cta";
import { MascotStatic } from "@/components/hero-scene";

export function SiteHeader() {
  return (
    <header className="glass-nav sticky top-0 z-50 border-b border-white/10">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1.5">
          {/* Живой микро-кот вместо лаймового квадрата с «Н»: лицо бренда в
              шапке (дышит и моргает на SMIL), а лайм в кадре остаётся за
              смыслом — глазами, «первым» и CTA */}
          <MascotStatic size={30} className="-mt-0.5" />
          <span className="text-sm font-bold tracking-tight">напарник</span>
        </Link>
        <nav className="flex items-center gap-2">
          {/* size="sm" = h-7 (28px) — компактный вид шапки часть бренда, менять
              визуально не хотим. before:-inset-2 расширяет именно тач-зону до
              44px (WCAG 2.5.8 / Fitts), не трогая размер кнопки — тот же приём,
              что уже применён в section-nav.tsx (там -inset-4 на 12px точке). */}
          <Button
            render={<Link href="#how" />}
            nativeButton={false}
            size="sm"
            variant="ghost"
            className="relative text-muted-foreground before:absolute before:-inset-2 before:content-['']"
          >
            Как это работает
          </Button>
          <Button
            render={<Link href="#world" />}
            nativeButton={false}
            size="sm"
            variant="ghost"
            className="relative hidden text-muted-foreground before:absolute before:-inset-2 before:content-[''] sm:inline-flex"
          >
            Мир
          </Button>
          <HeaderCta />
        </nav>
      </div>
    </header>
  );
}
