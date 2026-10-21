import type { Metadata } from "next";
import { MascotLab } from "@/components/mascot-lab";

// Лаборатория куклы-кота: слайдеры всех параметров движка на живом коте (замена редактора Rive).
export const metadata: Metadata = { title: "Кукла: лаборатория", robots: { index: false, follow: false } };

export default function Page() {
  return <MascotLab />;
}
