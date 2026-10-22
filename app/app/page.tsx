import type { Metadata } from "next";
import { HomeScreen } from "@/components/home-screen";
import { preloadFonts } from "@/lib/font-preload";

export const metadata: Metadata = {
  title: "Дом — Напарник",
  description: "Напарник пишет первым: план, первый шаг, старт.",
};

// h-dvh + overflow-hidden, не min-h-dvh: без реальной верхней границы
// высота каскадом "auto" уходит до самого html-элемента — chatBox внутри
// (flex-1 overflow-y-auto) никогда не получает настоящий overflow
// (проверено: scrollHeight===clientHeight при 20 сообщениях), скроллится
// вся страница целиком, а sticky-композер держится не за свой скролл-
// контейнер, а за html — и повисает поверх контента, который в этот
// момент просто оказался в его зоне. Только этот page.tsx — world/session
// держат свой main отдельно, других экранов это не касается.
export default function AppHomePage() {
  preloadFonts("caveat-400-cyr"); // рукопись в чате на первом экране
  return (
    <main className="app-page-enter flex h-dvh flex-col overflow-hidden pb-20">
      <HomeScreen />
    </main>
  );
}
