import type { Metadata } from "next";
import { FirstRun } from "@/components/onboarding/first-run";
import { preloadCatPoster, preloadFonts } from "@/lib/font-preload";
import { ReturningRedirect } from "@/components/returning-redirect";

export const metadata: Metadata = {
  title: "Знакомство — Напарник",
  description: "Два вопроса — и первое дело на 2 минуты рядом с напарником.",
};

export default function StartPage() {
  preloadFonts("manrope-700-cyr", "caveat-500-cyr"); // жирный заголовок и рукописный вопрос на первом экране
  preloadCatPoster(); // кот стоит на первом экране
  // preloadDoll() здесь нет намеренно: экран знакомства рисуется только после кода, и слои кота отнимали у него сеть —
  // главный текст на 3G появлялся на 0,6 с позже (3,4 → 4,1 с, 14.11)
  // у кого уже есть старты, знакомство не нужно: домой до первой отрисовки, а не кадр вопроса и потом переход
  return (
    <>
      <ReturningRedirect />
      <FirstRun />
    </>
  );
}
