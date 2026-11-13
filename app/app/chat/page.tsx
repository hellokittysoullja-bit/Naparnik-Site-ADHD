import type { Metadata } from "next";
import { HomeScreen } from "@/components/home-screen";
import { preloadFonts } from "@/lib/font-preload";

export const metadata: Metadata = {
  title: "Разговор с котом — Напарник",
  description: "Напарник пишет первым: план, первый шаг, старт.",
};

// Чат переехал с Дома сюда 13.11 (решение владельца: Дом — шаг и одна кнопка, разговор — за запиской «Поговорить
// с котом»). Вёрстка та же, что была у Дома: h-dvh + overflow-hidden — без верхней границы лента не получает
// своего скролла и прокручивается вся страница (см. историю в git для app/app/page.tsx).
export default function ChatPage() {
  preloadFonts("caveat-400-cyr"); // рукопись в чате на первом экране
  return (
    <main className="app-page-enter relative flex h-dvh flex-col overflow-hidden pb-20">
      <HomeScreen />
    </main>
  );
}
