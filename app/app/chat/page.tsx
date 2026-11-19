import type { Metadata } from "next";
import { FocusScene } from "@/components/focus-scene";
import { HomeScreen } from "@/components/home-screen";

export const metadata: Metadata = {
  title: "Разговор с котом — Напарник",
  description: "Напарник пишет первым: план, первый шаг, старт.",
};

// Чат переехал с Дома сюда 13.11 (решение владельца: Дом — шаг и одна кнопка, разговор — за запиской «Поговорить
// с котом»). Вёрстка та же, что была у Дома: h-dvh + overflow-hidden — без верхней границы лента не получает
// своего скролла и прокручивается вся страница (см. историю в git для app/app/page.tsx).
export default function ChatPage() {
  return (
    <main className="app-page-enter relative flex h-dvh flex-col overflow-hidden pb-20">
      {/* фон — ночная сцена Дома и лендинга (владелец 19.11); общий фон /app с грядой здесь не рисуется */}
      <FocusScene />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <HomeScreen />
      </div>
    </main>
  );
}
