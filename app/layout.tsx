import { SiteAnalytics } from "@/components/analytics";
import { VisitBeacon } from "@/components/visit-beacon";
import { CookieNotice } from "@/components/cookie-notice";
import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/site";
import { tgBootScript } from "@/lib/tg-webapp-boot";
import { TgWebApp } from "@/components/tg-webapp";
import "./globals.css";

// Все шрифты — свои (public/fonts, app/fonts.css, генератор design/fonts/build.py): Manrope и Caveat — статические
// начертания по весам и алфавитам плюс вшитые в CSS подмножества под символы первого экрана; JetBrains Mono — файлы
// Google Fonts (до 14.11 шёл через next/font) с цифрами и знаками в отдельном маленьком файле. Без preload: нужен ниже
// первого экрана лендинга, на /app подгружается, когда дошло до текста.

export const metadata: Metadata = {
  // адрес сайта для абсолютных ссылок превью (og:image); прежний ai-rc-one — старый домен
  // (CANONICAL_HOST в Vercel переводит его на свой домен — lib/site.ts)
  metadataBase: new URL(SITE_URL),
  // Подтверждение прав в Яндекс Вебмастере и Google Search Console: код из их кабинета — в переменные Vercel
  // YANDEX_VERIFICATION и GOOGLE_SITE_VERIFICATION, затем Redeploy. Пусто — строки нет.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.YANDEX_VERIFICATION ? { yandex: process.env.YANDEX_VERIFICATION } : {}),
  },
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
  // только тип карточки: заголовок и описание задаёт каждая публичная страница (lib/seo.ts), иначе превью в X у теста
  // и «Помогает» показывало заголовок лендинга; без своих X берёт og:title
  twitter: { card: "summary_large_image" },
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
      className="bg-background"
    >
      <head>
        {/* мини-апп в Telegram (lib/tg-webapp-boot.ts): самым первым, до любой отрисовки; вне Telegram — ничего */}
        <script dangerouslySetInnerHTML={{ __html: tgBootScript() }} />
        {/* Первый кадр — только целиком разобранной страницей (16.11, покадровый аудит): HTML приходит и разбирается
            порциями, и браузер рисовал кадр, когда разобрана только часть — пустой фон, фон без экрана, половина
            карточек. Эта строка просит не рисовать, пока не разобрана метка #first-frame в самом конце содержимого (до
            служебных скриптов). Дольше разбора страницы ожидание не длится: когда разбор закончен, запрет снят. Chrome и
            Edge это понимают; Safari и Firefox пропускают строку и ведут себя как раньше (Safari и так не рисует
            «почти пустую» страницу). */}
        <link rel="expect" href="#first-frame" {...{ blocking: "render" }} />
      </head>
      <body className="antialiased font-sans">
        {children}
        <span id="first-frame" hidden />
        <VisitBeacon />
        {/* плашка есть в HTML с первого кадра; кому не нужна — прячет встроенный скрипт до отрисовки (cookie-notice.tsx) */}
        <CookieNotice />
        <TgWebApp />
        {process.env.NODE_ENV === "production" && <SiteAnalytics />}
      </body>
    </html>
  );
}
