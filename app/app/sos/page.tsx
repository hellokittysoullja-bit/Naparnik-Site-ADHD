import type { Metadata } from "next";
import Link from "next/link";
import { FocusScene } from "@/components/focus-scene";
import { MascotDoll } from "@/components/mascot-doll";

export const metadata: Metadata = { title: "Горит дедлайн — Напарник" };

/** «Горит дедлайн» (функция 5) — следующий этап; пока честная заглушка, чтобы ссылка с Дома не вела в 404 */
export default function SosPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-[calc(4.75rem+var(--sab))] text-center">
      <FocusScene />
      <div className="relative z-10 flex flex-col items-center">
        <MascotDoll expression="calm" size={160} label="Напарник" className="size-40" />
        <h1 className="mt-5 text-[24px] font-extrabold">Горит дедлайн</h1>
        <p className="mt-2 max-w-[30ch] text-[16px] text-foreground/80">Этот экран я ещё собираю. Пока можно начать с одного шага.</p>
        <Link href="/app/stuck" className="btn-chunky mt-6 block w-64 rounded-[18px]">
          <span className="btn-face flex h-[56px] items-center justify-center rounded-[18px] bg-primary text-[18px] font-bold text-primary-foreground">Не могу начать 🔥</span>
        </Link>
      </div>
    </main>
  );
}
