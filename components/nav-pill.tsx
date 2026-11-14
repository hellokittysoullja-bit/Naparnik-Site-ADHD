"use client";

import { motion } from "motion/react";
import { SPRING_GESTURE } from "@/lib/motion";
import { NAV_PILL_CLASS, NAV_PILL_STYLE } from "@/components/nav-pill-style";

/** Пилюля активного таба с пружинным перетеканием (shared layoutId). Грузится отдельно от меню — см. app-nav.tsx. */
export function NavPill() {
  return <motion.span layoutId="nav-pill" transition={SPRING_GESTURE} className={NAV_PILL_CLASS} style={NAV_PILL_STYLE} aria-hidden="true" />;
}
