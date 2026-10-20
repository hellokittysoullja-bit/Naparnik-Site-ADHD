import { Hero } from "@/components/landing/hero";
import { LandingBackdrop } from "@/components/landing/landing-backdrop";

// Лендинг собирается в статический HTML на этапе билда: первый кадр приходит
// с CDN в первом же байте, без промежуточного состояния загрузки.
export const dynamic = "force-static";

/**
 * Лендинг — ровно один экран без скролла: заголовок, диалог и кнопка в кадре.
 * Секции Problem / HowItWorks / WorldSection / Presence / Pricing и Footer
 * остаются в components/landing, но на страницу не выводятся. Чтобы вернуть
 * длинную страницу, снять `html,body{overflow:hidden}` ниже и вернуть секции.
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
