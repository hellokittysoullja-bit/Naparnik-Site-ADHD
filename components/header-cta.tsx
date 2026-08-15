"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Инвариант: в кадре всегда ровно одно primary-действие.
 * Шапочный «Начать» виден тогда и только тогда, когда CTA героя (#hero-cta)
 * не виден. Прежняя логика (scrollY > 0.6·vh) оставляла ПЕРВЫЙ кадр на
 * мобильном вообще без действия: hero-CTA за сгибом, шапочный ещё скрыт —
 * подтверждено скриншотом с реального iPhone.
 *
 * Защита от регрессии: если #hero-cta не найден (страница без hero),
 * CTA показывается сразу — кнопка никогда не исчезает навсегда.
 */
export function HeaderCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("hero-cta");
    if (!target) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      // rootMargin -56px сверху: зона за sticky-шапкой не считается «видимой»
      { threshold: 0.4, rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <Button
      render={
        <Link
          href="/app"
          tabIndex={visible ? undefined : -1}
          aria-hidden={!visible}
        />
      }
      nativeButton={false}
      size="sm"
      // .press-fade, не .press: transition — shorthand-свойство, .press
      // (transform 120ms) и отдельный transition-opacity на одном элементе
      // не складываются — побеждает только один, кнопка либо не «жмётся»,
      // либо не проявляется плавно.
      // relative + before:-inset-2: size="sm" (h-7=28px) — тач-зона до 44px
      // (WCAG 2.5.8), без изменения видимого размера. Тот же приём, что и
      // в site-header.tsx на соседних nav-ссылках.
      className={`press-fade relative font-semibold before:absolute before:-inset-2 before:content-[''] ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      Начать
    </Button>
  );
}
