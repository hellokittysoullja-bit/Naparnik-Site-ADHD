import type { Metadata } from "next";
import { FirstRun } from "@/components/onboarding/first-run";

export const metadata: Metadata = {
  title: "Знакомство — Напарник",
  description: "Два вопроса — и первое дело на 2 минуты рядом с напарником.",
};

export default function StartPage() {
  return <FirstRun />;
}
