import { Landing } from "@/components/landing/landing";
// вшитые подмножества шрифтов первого экрана — только здесь, /app их не грузит (design/fonts/build.py)
import "./hero-fonts.css";
import "./hero-poster.css";

// Лендинг собирается в статический HTML на этапе билда: первый кадр приходит
// с CDN в первом же байте, без промежуточного состояния загрузки.
export const dynamic = "force-static";

export default function LandingPage() {
  return <Landing />;
}
