import { AppBackdrop } from "@/components/app-backdrop";
import { AppNav } from "@/components/app-nav";
import { preload } from "react-dom";

/**
 * /app layout — bare pass-through + общий фон и общая нижняя навигация.
 *
 * Почему нет app-header:
 * — Header с «← назад» убивает native feel (это сайт, не компаньон).
 * — Постоянный exit affordance на уровне глаз конкурирует с основным
 *   действием экрана каждый кадр — не измеряли на своих данных, поэтому не
 *   ссылаемся на конкретную цифру чужого исследования.
 * — iOS/Android back gesture решает навигацию системно.
 * — В Genshin Impact нет кнопки «← Back to website». Причина та же.
 *
 * Если в будущем нужны настройки — выносим в отдельный /app/settings экран,
 * доступный через иконку в AppNav, а не в шапке над компаньоном.
 *
 * AppBackdrop и AppNav — fixed и вне потока, оба здесь, а не внутри
 * page.tsx каждого экрана: не задевают вёрстку вложенных экранов, не
 * перемонтируются при переходах между табами (без AppBackdrop здесь был
 * обрыв между ночной сценой лендинга и плоским чёрным /app).
 *
 * AppNav переехал сюда из трёх отдельных page.tsx не для красоты кода —
 * там он был потомком <main className="app-page-enter">, а у entry-анимации
 * `animation: app-page-in ... both` конечный кадр `transform: translateY(0)`
 * технически НЕ `none` — по спецификации это создаёт новый containing
 * block для position:fixed потомков. AppNav висел не у настоящего низа
 * вьюпорта, а у низа <main>, которое на «холодных» экранах короче экрана —
 * снизу оставалась настоящая пустота, которую нечем было прикрыть.
 * Здесь AppNav — сосед {children}, не потомок transform'нутого <main>,
 * поэтому фиксируется по-настоящему.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  // шрифты экранов /app заранее — ровно те, что видны на первом экране Дома/Фокуса/Мира (замер pwglyphs:
  // Manrope 400/500/600/700, рукопись 400; Caveat 500 на /app не встречается). Кириллические файлы, 4 × 12 + 54 КБ.
  // На лендинге preload нет — его первый экран вшит в CSS.
  for (const w of [400, 500, 600, 700]) preload(`/fonts/manrope-${w}-cyr.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  preload("/fonts/caveat-400-cyr.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <>
      <AppBackdrop />
      {children}
      <AppNav />
    </>
  );
}
