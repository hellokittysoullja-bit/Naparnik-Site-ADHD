import type { Metadata } from "next";
import { HomeCamp } from "@/components/home-camp";
import { preloadFonts } from "@/lib/font-preload";

export const metadata: Metadata = {
  title: "Дом — Напарник",
  description: "Твой шаг на сейчас и кот у костра.",
};

export default function AppHomePage() {
  preloadFonts("manrope-700-cyr"); // шаг и строка над кнопкой набраны жирным
  return <HomeCamp />;
}
