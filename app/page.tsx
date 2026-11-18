import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";
import { JsonLd } from "@/components/json-ld";
import { landingLd } from "@/lib/structured-data";
import { pageMetadata } from "@/lib/seo";
// вшитые подмножества шрифтов первого экрана — только здесь, /app их не грузит (design/fonts/build.py)
import "./hero-fonts.css";
import "./hero-poster.css";

// Лендинг собирается в статический HTML на этапе билда: первый кадр приходит
// с CDN в первом же байте, без промежуточного состояния загрузки.
export const dynamic = "force-static";

// Один адрес главной в выдаче: `/?src=…`, `/?intro=1`, utm и копии сайта на других адресах Vercel склеиваются сюда
export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Напарник — сдвинем твоё дело за 2 минуты",
  description:
    "Напарник сидит рядом, пока ты начинаешь, и растит остров из твоих стартов. Бесплатно, без регистрации, без стриков и стыда.",
  shareDescription: "Сидит рядом, пока ты начинаешь, и растит остров из твоих стартов. Бесплатно, без карты и регистрации.",
});

export default function LandingPage() {
  return (
    <>
      <Landing />
      <JsonLd data={landingLd} />
    </>
  );
}
