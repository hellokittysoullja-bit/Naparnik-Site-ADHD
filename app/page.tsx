import { SiteHeader } from "@/components/site-header";
import { SectionNav } from "@/components/landing/section-nav";
import { Hero } from "@/components/landing/hero";
import { LandingBackdrop } from "@/components/landing/landing-backdrop";
import { Problem } from "@/components/landing/problem";
import { HowItWorks } from "@/components/landing/how-it-works";
import { WorldSection } from "@/components/landing/world-section";
import { Presence } from "@/components/landing/presence";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/footer";

// Лендинг собирается в статический HTML на этапе билда: первый кадр приходит
// с CDN в первом же байте, без промежуточного состояния загрузки.
export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Деградация без JS: секции с моушн-скрытием становятся видимыми */}
      <noscript>
        <style>{`[style*="opacity:0"], [style*="opacity: 0"] { opacity: 1 !important; transform: none !important; }`}</style>
      </noscript>
      {/* Первый фокусируемый элемент страницы: невидим, пока не получит
          клавиатурный фокус — даёт пропустить шапку и добраться до контента
          без прохода по nav (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Перейти к содержимому
      </a>
      <SiteHeader />
      <SectionNav />
      {/* relative — якорь для общего ночного фона под всеми секциями */}
      <main id="main-content" className="relative flex-1">
        <LandingBackdrop />
        <Hero />
        <Problem />
        <HowItWorks />
        <WorldSection />
        <Presence />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}
