import { preload } from "react-dom";
import { asset } from "@/lib/asset-versions";

/**
 * Предзагрузка своих шрифтов (public/fonts, app/fonts.css) из серверного компонента: ссылки попадают в <head> при SSR.
 * Вызывать там, где шрифт точно нужен на первом экране, — иначе файл качается впустую. Какие начертания видны на каком
 * экране, меряет сканер символов (CLAUDE.md, раздел про шрифты).
 */
export function preloadFonts(...files: string[]) {
  // адрес с версией — тот же, что в url() app/fonts.css, иначе браузер не узнает в предзагрузке нужный файл
  for (const f of files) preload(asset(`/fonts/${f}.woff2`), { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}

/**
 * Постер кота (public/mascot/poster) — в <head> страницы, где кот стоит на первом экране. Без этого браузер узнаёт о
 * картинке поздно: на Фокусе экран рисуется только после загрузки кода (страница под Suspense), и постер начинал
 * качаться на ~3 с, а приходил на 5,3 с (CPU ×4 + 3G, замер 11.11) — он и был самым поздним крупным элементом (LCP).
 * Адрес тот же, что у <img> в components/mascot-doll.tsx, — иначе файл скачался бы дважды.
 */
export function preloadCatPoster() {
  preload(asset("/mascot/poster/neutral.webp"), { as: "image", fetchPriority: "high" });
}
