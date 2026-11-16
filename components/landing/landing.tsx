import { Hero } from "@/components/landing/hero";
import { ReturningRedirect } from "@/components/returning-redirect";
import { HeroReady, HeroWait } from "@/components/landing/hero-gate";
import type { EntryHeadline } from "@/content/entry-variants";

/**
 * Лендинг — ровно один экран без скролла: заголовок, диалог и кнопка в кадре.
 * Секции длинной страницы (Problem / HowItWorks / WorldSection / Presence / Pricing,
 * SectionNav, Footer) не выводились и удалены 22.10 как мёртвый код. Вернуть: взять
 * их из git (`git show 72de752:components/landing/<файл>`), снять `html,body{overflow:hidden}`.
 *
 * Общий для `/` и заголовков под ролики (`/?src=…` → app/v/[variant], rewrite в next.config.ts): отличается только `headline`.
 * Вшитые шрифты первого экрана (app/hero-fonts.css) подключает каждая страница сама.
 */
export function Landing({ headline }: { headline?: EntryHeadline }) {
  return (
    <>
      {/* Первым в body: у вернувшегося решение «домой» принимается до отрисовки лендинга */}
      <ReturningRedirect />
      <HeroWait />
      {/* Деградация без JS: элементы с моушн-скрытием становятся видимыми */}
      <noscript>
        <style>{`[style*="opacity:0"], [style*="opacity: 0"] { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      {/* Стиль живёт только пока смонтирована эта страница: /app скроллится как раньше */}
      <style>{`@media (min-height:521px){html,body{height:100%;overflow:hidden;overscroll-behavior:none}}`}</style>
      <main className="relative min-h-dvh">
        <Hero headline={headline} />
        {/* сцена получена целиком — показываем (components/landing/hero-gate.tsx) */}
        <HeroReady />
      </main>
    </>
  );
}
