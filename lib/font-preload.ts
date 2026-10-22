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
