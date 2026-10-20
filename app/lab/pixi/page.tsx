import type { Metadata } from "next";
import { MascotPixi } from "@/components/mascot-pixi";

// Прототип сравнения SVG-кота и кота на PixiJS + GSAP со скиннингом сеткой.
export const metadata: Metadata = { title: "Кот на PixiJS", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#202220" }}>
      <MascotPixi size={420} />
    </main>
  );
}
