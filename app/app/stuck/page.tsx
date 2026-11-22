import type { Metadata } from "next";
import { Suspense } from "react";
import { StuckWizard } from "@/components/stuck-wizard";

export const metadata: Metadata = { title: "Не могу начать — Напарник" };

export default function StuckPage() {
  return (
    <Suspense>
      <StuckWizard />
    </Suspense>
  );
}
