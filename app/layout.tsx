import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";

// Шрифты первого экрана: display "block" вместо "swap" — текст ждёт свой шрифт (до 3 с), а не рисуется
// запасным Arial с последующей подменой и сдвигом строк (CLS ≈ 0,04 на slow 3G). На 4G шрифты успевают
// до первой отрисовки, на 3G приходят на ~0,4 с позже неё — внутри входной анимации героя (hero-rise 0,55 с
// с задержками), так что ожидание не видно. (Перечислять статические начертания бесполезно: Manrope
// у Google переменный, на любой набор весов приходит тот же файл.)
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "block",
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  // моноширинный нужен ниже первого экрана (как это работает, тарифы): без preload — два файла на
  // 149 КБ не стоят на критическом пути первой отрисовки, подгружаются, когда дошло до текста
  preload: false,
});

const caveat = Caveat({
  subsets: ["latin", "cyrillic"],
  display: "block",
  // запасной шрифт описан вручную в globals.css ("Caveat Fallback"): size-adjust подобран по реальным
  // строкам первого экрана (pwfont.mjs), а не по средней ширине символа — переносы совпадают точнее
  adjustFontFallback: false,
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-rc-one.vercel.app"),
  title: "Напарник — сдвинем твоё дело за 2 минуты",
  description:
    "Напарник сидит рядом, пока ты начинаешь, и растит остров из твоих стартов. Бесплатно, без регистрации, без стриков и стыда.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Напарник",
  },
  openGraph: {
    title: "Напарник — сдвинем твоё дело за 2 минуты",
    description:
      "Сидит рядом, пока ты начинаешь, и растит остров из твоих стартов. Бесплатно, без карты и регистрации.",
    type: "website",
    locale: "ru_RU",
    siteName: "Напарник",
  },
  twitter: {
    card: "summary_large_image",
    title: "Напарник — сдвинем твоё дело за 2 минуты",
    description:
      "Сидит рядом, пока ты начинаешь, и растит остров из твоих стартов.",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#1a1d17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      // Плавный скролл к якорям («Как это работает») задан через CSS
      // (app/globals.css, под prefers-reduced-motion). Next.js предупреждает,
      // что без явного opt-in его роутер может конфликтовать с CSS-плавностью
      // при переходах между страницами — data-атрибут снимает конфликт, сам
      // scroll-behavior по-прежнему приходит из CSS и уважает reduced-motion.
      data-scroll-behavior="smooth"
      className={`bg-background ${manrope.variable} ${jetbrainsMono.variable} ${caveat.variable}`}
    >
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
