import type { Metadata } from "next";
import { FirstRun } from "@/components/onboarding/first-run";
import { preloadFonts } from "@/lib/font-preload";

export const metadata: Metadata = {
  title: "Знакомство — Напарник",
  description: "Два вопроса — и первое дело на 2 минуты рядом с напарником.",
};

export default function StartPage() {
  preloadFonts("manrope-700-cyr", "caveat-500-cyr"); // жирный заголовок и рукописный вопрос на первом экране
  return <FirstRun />;
}
