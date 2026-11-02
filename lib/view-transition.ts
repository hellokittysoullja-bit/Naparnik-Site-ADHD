/**
 * Переход между экранами одним кадром-фильмом (View Transitions API, same-document).
 *
 * Браузер снимает старый экран, мы меняем маршрут, он снимает новый и анимирует разницу:
 * фон (root) перетекает, кот (`nap-cat`) перелетает на новое место, старый интерфейс уходит,
 * новый проявляется (правила — app/globals.css, «Переходы между экранами»).
 *
 * - Только по нажатию нашей кнопки. Системный «назад» (свайп на iPhone, кнопка браузера) не трогаем:
 *   у Safari своя анимация жеста, наша поверх неё дала бы двойную (WebKit bug 271684).
 * - Без API (Safari < 18, Firefox < 144) и при reduced-motion — обычный переход.
 * - Пока колбэк не завершился, страница заморожена и rAF не идёт: готовность нового экрана ловим
 *   MutationObserver'ом по метке `data-vt-arrived`, с потолком ожидания (иначе Chrome сам бросит через 4 с).
 */
type VTDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

export function canViewTransition() {
  return (
    typeof document !== "undefined" &&
    !!(document as VTDocument).startViewTransition &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function navigateWithTransition(push: () => void, arrived: string, timeoutMs = 600) {
  const doc = document as VTDocument;
  if (!canViewTransition() || !doc.startViewTransition) {
    push();
    return;
  }
  // Новый экран готов, когда стоит его метка и кот на нём нарисован (иначе снимок поймал бы пустое место).
  // Кота ждём не дольше CAT_GRACE после появления экрана: постер может ещё идти по сети, а страница всё это
  // время заморожена. Весь переход ждёт не дольше timeoutMs: на медленной сети лучше обычная смена экрана
  // с «Иду…» (кнопка показывает её через 1 с), чем застывший кадр без отклика.
  const CAT_GRACE = 200;
  let shownAt = 0;
  const ready = () => {
    const screen = document.querySelector(`[data-vt-arrived="${arrived}"]`);
    if (!screen) return false;
    if (!shownAt) shownAt = performance.now();
    return !!screen.querySelector("[data-cat-ready]") || performance.now() - shownAt >= CAT_GRACE;
  };
  // пока идёт переход, собственные въезды страниц выключены — иначе новый экран проявлялся бы дважды
  document.documentElement.classList.add("vt-run");
  const vt = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        let done = false;
        const timers: number[] = [];
        const finish = () => {
          if (done) return;
          done = true;
          observer.disconnect();
          timers.forEach((t) => window.clearTimeout(t));
          resolve();
        };
        const check = () => {
          if (!ready()) return;
          finish();
        };
        const observer = new MutationObserver(() => {
          check();
          // экран уже есть, кот ещё нет: перепроверить, когда истечёт ожидание кота
          if (!done && shownAt) timers.push(window.setTimeout(check, CAT_GRACE));
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["data-vt-arrived", "data-cat-ready"],
        });
        timers.push(window.setTimeout(finish, timeoutMs));
        push();
        check();
      }),
  );
  vt.finished.finally(() => {
    // въезд страницы уже «сыгран» переходом: гасим его насовсем у этого экрана — иначе снятие vt-run
    // перезапустило бы CSS-анимацию с нуля и экран мигнул бы
    document.querySelectorAll<HTMLElement>(".app-page-enter").forEach((el) => (el.style.animation = "none"));
    document.documentElement.classList.remove("vt-run");
  });
}
