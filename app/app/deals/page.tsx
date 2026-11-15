import type { Metadata } from "next";
import { DealsScreen } from "@/components/deals-screen";

export const metadata: Metadata = { title: "Дела — Напарник" };

export default function DealsPage() {
  return <DealsScreen />;
}
