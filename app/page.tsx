import { Hero } from "@/components/landing/hero";
import { LandingBackdrop } from "@/components/landing/landing-backdrop";
// вшитые подмножества шрифтов первого экрана — только здесь, /app их не грузит (design/fonts/build.py)
import "./hero-fonts.css";

// Лендинг собирается в статический HTML на этапе билда: первый кадр приходит
// с CDN в первом же байте, без промежуточного состояния загрузки.
export const dynamic = "force-static";

/**
 * Лендинг — ровно один экран без скролла: заголовок, диалог и кнопка в кадре.
 * Секции длинной страницы (Problem / HowItWorks / WorldSection / Presence / Pricing,
 * SectionNav, Footer) не выводились и удалены 22.10 как мёртвый код. Вернуть: взять
 * их из git (`git show 72de752:components/landing/<файл>`), снять `html,body{overflow:hidden}`.
 */
export default function LandingPage() {
  return (
    <>
      {/* Деградация без JS: элементы с моушн-скрытием становятся видимыми */}
      <noscript>
        <style>{`[style*="opacity:0"], [style*="opacity: 0"] { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      {/* Стиль живёт только пока смонтирована эта страница: /app скроллится как раньше */}
      <style>{`@media (min-height:521px){html,body{height:100%;overflow:hidden;overscroll-behavior:none}}`}</style>
      <main className="relative min-h-dvh">
        <LandingBackdrop />
        <Hero />
      </main>
    </>
  );
}
