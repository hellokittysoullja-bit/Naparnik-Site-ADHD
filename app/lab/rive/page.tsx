import type { Metadata } from "next";
import { RiveLab } from "@/components/rive-lab";

// Лаборатория Rive-кота: все входы state machine руками (для проверки и записи видео).
export const metadata: Metadata = { title: "Кот на Rive", robots: { index: false, follow: false } };

export default function Page() {
  return <RiveLab />;
}
