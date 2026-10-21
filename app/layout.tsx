import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Manrope и Caveat — свои (public/fonts, app/fonts.css, генератор design/fonts/build.py): статические начертания
// по весам и алфавитам плюс вшитые в CSS подмножества под символы первого экрана — текст героя рисуется
// своим шрифтом с первой отрисовки на любой сети. Здесь из next/font остался только моноширинный.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  // моноширинный нужен ниже первого экрана (как это работает, тарифы): без preload — два файла на
  // 149 КБ не стоят на критическом пути первой отрисовки, подгружаются, когда дошло до текста
  preload: false,
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
  // preload шрифтов здесь нет намеренно: первый экран лендинга рисуется вшитыми в CSS подмножествами, а четыре
  // файла Manrope в preload (48 КБ) отнимали полосу у самого CSS на slow 3G (первая отрисовка 3,2 → 6,2 с).
  // Остальной текст лендинга ниже сгиба подтянет файлы по мере надобности; экраны /app предзагружают
  // своё в app/app/layout.tsx.
  return (
    <html
      lang="ru"
      // Плавный скролл к якорям («Как это работает») задан через CSS
      // (app/globals.css, под prefers-reduced-motion). Next.js предупреждает,
      // что без явного opt-in его роутер может конфликтовать с CSS-плавностью
      // при переходах между страницами — data-атрибут снимает конфликт, сам
      // scroll-behavior по-прежнему приходит из CSS и уважает reduced-motion.
      data-scroll-behavior="smooth"
      className={`bg-background ${jetbrainsMono.variable}`}
    >
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
