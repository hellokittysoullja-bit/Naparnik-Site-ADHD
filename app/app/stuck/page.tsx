import type { Metadata } from "next";
import { CantStart } from "@/components/cant-start";

export const metadata: Metadata = { title: "Не могу начать — Напарник" };

export default function StuckPage() {
  return <CantStart />;
}
