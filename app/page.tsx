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
      <SectionNav />
      {/* relative — якорь для общего ночного фона под всеми секциями */}
      <main className="relative flex-1">
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
