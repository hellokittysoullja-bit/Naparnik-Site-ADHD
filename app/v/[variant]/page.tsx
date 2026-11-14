import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Landing } from "@/components/landing/landing";
import { ENTRY_VARIANTS } from "@/content/entry-variants";
import "../../hero-fonts.css";
import "../../hero-poster.css";

/**
 * Лендинг с заголовком под ролик. Человек сюда не ходит напрямую: rewrite из next.config.ts подставляет эту страницу по `/?src=<ключ>`,
 * адрес в браузере остаётся `/?src=…`. Каждый вариант — свой статический HTML со сборки (как и `/`).
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ENTRY_VARIANTS).map((variant) => ({ variant }));
}

// В поиске — только `/`: вариант — тот же лендинг с другим заголовком
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
};

export default async function VariantLanding({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  const headline = Object.hasOwn(ENTRY_VARIANTS, variant) ? ENTRY_VARIANTS[variant] : null;
  if (!headline) notFound();
  return <Landing headline={headline} />;
}
