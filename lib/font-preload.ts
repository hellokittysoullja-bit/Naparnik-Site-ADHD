import { preload } from "react-dom";
import { asset } from "@/lib/asset-versions";
import { DOLL_LAYERS } from "@/lib/rig/doll-layers";

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
 * Без `fetchPriority: "high"`: с ним постер спорил со стилями и шрифтами, и первая отрисовка Фокуса уходила с
 * 1,02–1,05 на 1,04–1,10 с, а LCP был хуже (3,50–3,70 с против 3,29–3,43 с обычным приоритетом; 5 + 5 прогонов).
 */
export function preloadCatPoster(main = false) {
  // main — кот главный элемент первого экрана (Дом): постер раньше остальных картинок, иначе на 3G он шёл после
  // фона и приходил к 2,9 с (13.11)
  preload(asset("/mascot/poster/neutral.webp"), main ? { as: "image", fetchPriority: "high" } : { as: "image" });
}

/**
 * Кукла кота (public/mascot/doll: rig.json и слои) — в <head> страницы, где кот на первом экране. Без этого загрузка
 * начиналась только из кода куклы, после разбора всего JS: на 3G слои шли с ~3 с и кот оживал к ~5 с, хотя сеть до
 * этого простаивала по картинкам (14.11). Низкий приоритет — не спорят со стилями, шрифтами и постером.
 * Только Дом: замер 3G, CPU ×4 — кот оживает на ~1 с раньше, код не позже. На лендинге код (кнопка «Давай») оживал на
 * 0,35 с позже, в знакомстве главный текст появлялся на 0,6 с позже — там не вызывать.
 * Адреса те же, что у загрузчика (components/mascot-doll.tsx, lib/rig/renderer.ts): rig.json — fetch() с режимом cors,
 * поэтому crossOrigin "anonymous"; слои — new Image() без crossOrigin, поэтому без него. Иначе файл скачался бы дважды.
 */
export function preloadDoll() {
  preload(asset("/mascot/doll/rig.json"), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" });
  for (const l of DOLL_LAYERS) preload(asset(`/mascot/doll/${l}`), { as: "image", fetchPriority: "low" });
}
