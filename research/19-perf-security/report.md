# 19. Скорость, плавность и безопасность: путь «лендинг → знакомство → первая сессия» (11.11.2026)

Отчёт агента-эксперта (сеанс 11.11), перенесён из переписки без изменений по существу. Код по нему ещё не менялся,
кроме того, что уже исправлено 11.11 (зависание «Поехали», стекло без размытия над видео, таймер под фоном, кольцо).

**Уверенность:** ●●● — замерено или прямо в первоисточнике; ●● — первоисточник есть, перенос на нас логичен, но не замерен;
● — практики и форумы; ○ — оценка, нужна проверка.
**Чего не измерить в песочнице:** WebKit, настоящий GPU (там программный swiftshader), сеть из РФ (песочница в США).
Всё про iPhone GPU и операторов РФ — по источникам, не по замеру.

## Главные 10 рекомендаций
1. **Свой домен — не включать `CANONICAL_HOST`, пока новый домен не проверен с МТС/Билайн/МегаФон/T2/Yota.** На форуме Vercel (сен–ноя 2026) свои домены из российских сетей отдают 200 без тела, а `vercel.app` работает. Риск «белого экрана» для всех — ●.
2. **Полевые замеры с iPhone** (Safari 26.2+ отдаёт LCP/INP; только числа) — без этого ни одна iPhone-оптимизация не доказуема — ●●●.
3. **Убрать `proxy.ts` с первого визита** (сейчас функция на каждом новом посетителе: +15 мс медиана, выбросы до +270 мс, замер из США) → статические rewrites для `?src`, `nid`/метка — через `POST /api/visit` — ●●.
4. **Потолок расходов Gemini**: месячный лимит в AI Studio + ключ «только Gemini API» + оповещения бюджета Cloud (не ограничивают) — 15 минут в панелях — ●●●.
5. **Правило Rate Limit на `/api/*` в Vercel Firewall** (есть на Hobby) — вместо лимита «в памяти одного экземпляра» — ●●●.
6. **React Compiler**: длинные кадры знакомства на CPU ×4 — почти целиком рендер React (276 мс за проход); Meta: взаимодействия до 2,5× быстрее; картинка та же — ●● (Meta) / ○ (у нас).
7. **AI-функции из `iad1` в `fra1`** — минус межконтинентальный круг на каждую реплику кота — ○.
8. **Слои кота параллельно с `rig.json`, сетки бинарно** — сейчас слои ждут 350 КБ JSON; оценка: кот оживает на 0,2–0,4 с раньше на 3G — ○.
9. **`antialias: false` у WebGL-кота** — замер: разница кадра 0,001/255, 0,31 % пикселей и все ≤ 2; −2,5 МБ видеопамяти — ●● картинка / ○ выигрыш на iPhone.
10. **CI и зависимости**: `permissions: contents: read`, Actions по SHA, Dependabot, pnpm `minimumReleaseAge` — ●●.

## 0. Что уже хорошо, не трогать
- Все страницы пути статические и отдаются из кэша CDN (HIT). HTML лендинга — 39 КБ br, экранов /app — 6,5–7,6 КБ br (замер живого сайта 11.11).
- Своя статика: версия в адресе, `immutable` на год (`next.config.mjs:85–90`).
- Заголовки: CSP без чужих доменов, HSTS с preload на vercel.app, XFO DENY, COOP, nosniff, Permissions-Policy (`curl -I` 11.11).
- AI-маршруты: потолок тела, zod, вырезаны file-части (защита от SSRF), `maxOutputTokens`, `abortSignal`, проверка Sec-Fetch-Site (`lib/api-guard.ts`). Пробел только в глобальном потолке (§3).

## 1. Находки по видимому эффекту на пути

### 1.1. Свой домен на Vercel может не открываться в России (самый большой риск)
- **Источники.** Форум Vercel: [06.11.2026](https://community.vercel.com/t/custom-domain-stalls-after-http-200-on-russian-mobile-devices-no-http2-data-frames/1000000096) — на iPhone и Android приходят 103 и 200, тело страницы не приходит, белый экран. [20.09.2026](https://community.vercel.com/t/custom-domains-inaccessible-on-russian-mobile-networks-but-vercel-app-works/49469) — Yota, позже домашний Wi-Fi; `vercel.app` работает; в реестре РКН найдена запись об ограничении IP Vercel 216.198.79.1. Ещё [одна тема](https://community.vercel.com/t/custom-domain-response-bodies-stall-in-russia-while-vercel-app-works-on-the-same-ips/49387). Похожий механизм — обрыв соединений к Cloudflare после ~16 КБ с июня 2025 ([zona.media](https://en.zona.media/article/2025/06/27/cloud_confirmed), [heise](https://heise.de/-10465087)). Ответа Vercel в темах нет.
- **У нас.** `next.config.mjs:30–46`: одна переменная `CANONICAL_HOST` включает 308 со старого адреса. Если новый домен не открывается, 308 уведёт и вернувшихся с рабочего `vercel.app`.
- **Что сделать.**
  1. Подключить домен, но переезд не включать.
  2. Открыть его с телефонов на МТС, Билайн, МегаФон, T2, Yota и на 2–3 домашних провайдерах. Лендинг весит 39 КБ (> 16 КБ), обрыв будет виден сразу.
  3. Если где-то белый экран — не переезжать напрямую. Варианты: A-запись на другой IP Vercel (у одного автора 76.76.21.21, результат неизвестен) или российский прокси/CDN перед Vercel.
  4. Постоянный мониторинг доступности с российских узлов.
- **Выигрыш.** Не потерять сайт для части аудитории; масштаб неизвестен — ●.
- **Компромисс.** Сама проверка — без компромиссов. Прокси в РФ — второй поставщик и узел на пути, зато решает и хранение данных в РФ (§3.5).
- **Проверка.** `curl -w "%{size_download}"` с российского VPS на оба адреса: размер должен совпасть с полным.

### 1.2. Нет полевых замеров с iPhone
- **Источники.** С Safari 26.2 (12.12.2025) iPhone отдаёт LCP и INP ([web.dev](https://web.dev/blog/lcp-and-inp-are-now-baseline-newly-available)). INP в Safari иногда завышен ([DebugBear](https://www.debugbear.com/blog/2025-in-web-performance)).
- **У нас.** Только `@vercel/analytics`.
- **Что сделать.** Speed Insights (бесплатно — только общий балл RES; метрики и страны — платный Plus, [документация](https://vercel.com/docs/speed-insights)) или библиотека `web-vitals` (~2 КБ) с отправкой только чисел и пути без параметров через `lib/events.ts`, плюс события «кот ожил через N мс» и «длительность перехода между экранами».
- **Эффект.** Косвенный, но без этого ни одну iPhone-оптимизацию не доказать — ●●●. **Риск.** ~2 КБ кода, визуально ничего.

### 1.3. `proxy.ts` стоит на первом визите каждого нового посетителя
- **Источники.** Vercel: статические правила выполняются прямо на CDN ([Routing Middleware](https://vercel.com/docs/routing-middleware)). Next.js 16 советует избегать proxy при другом способе; Edge-рантайм в proxy недоступен ([proxy.ts](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). Middleware раскатывается по регионам, на Hobby — по меньшему числу ([регионы](https://vercel.com/docs/functions/configuring-functions/region)).
- **У нас.** `proxy.ts:107–118`: срабатывает на любой странице без cookie `nid` — ровно на первом визите из рекламы.
- **Замер (24 запроса из США, время сервера = TTFB − TLS).** Без cookie медиана ≈ 72 мс, с cookie ≈ 57 мс; без cookie 3 из 24 — выбросы 139–334 мс, с cookie один, 117 мс.
- **Что сделать.** (1) `?src` → статические rewrites с `has: query`, генерируемые при сборке из `content/entry-variants.ts`. (2) `nid` и источник ставит `POST /api/visit` после первой отрисовки (паттерн `app/api/home`: серверная httpOnly-cookie). (3) `_nid`/`_home` (переезд домена) оставить в proxy с matcher только на них.
- **Выигрыш.** Первый HTML — прямой HIT: −15 мс медианы и хвост холодных стартов (замер из США, из РФ проверить) — ●●.
- **Компромисс.** `nid` появится ~через 1 с, а не в первом ответе; сейчас его на сервере никто не читает. Визуально ничего.
- **Проверка.** Ответ без cookie: HIT и нет `set-cookie`; TTFB p75 первого визита в RUM; e2e `school1-foundation`.

### 1.4. React Compiler
- **Источники.** Meta: загрузки и переходы быстрее до 12 %, отдельные взаимодействия в 2,5× и больше ([React Compiler 1.0](https://react.dev/blog/2025/10/07/react-compiler-1)). В Next 16 стабилен как `reactCompiler: true` ([Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)).
- **У нас.** Не включён. `first-run.tsx` 1102 строки, `hero.tsx` 729, `focus-session.tsx` 1249. LoAF на CPU ×4 + 3G: почти всё — рендер react-dom: знакомство 276 мс, старт сессии 326 мс, лендинг 131 мс.
- **Что сделать.** `babel-plugin-react-compiler` + `reactCompiler: true`; сначала eslint `react-hooks` preset `recommended` и починить найденное. Осторожно — `compilationMode: 'annotation'` и `'use memo'` в трёх файлах.
- **Риск.** Сборка дольше; код, нарушающий правила React, может вести себя иначе (ловят линтер и e2e). Визуально ничего — ●● (Meta) / ○ (у нас).
- **Проверка.** `perfwalk.mjs` 3 прогона до/после: сумма blocking LoAF и число кадров > 33 мс.

### 1.5. AI-функции в `iad1`
- **У нас.** `x-vercel-id: iad1::iad1` у `/api/companion` и `/api/breakdown`; на пути — `/api/session-voice` при старте сессии (`focus-session.tsx:99`).
- **Что сделать.** Settings → Functions → Function Regions → `fra1` или `arn1` (или `"regions":["fra1"]` в `vercel.json`); на Hobby один регион. Не ставить в страну без Gemini API ([список](https://ai.google.dev/gemini-api/docs/available-regions)).
- **Выигрыш.** Минус межконтинентальный круг на каждый AI-запрос — ○. **Риск.** Нет.

### 1.6. Загрузка кота идёт цепочкой
- **У нас.** `mascot-doll.tsx:40–41`: сначала `fetch(rig.json)`, потом 13 слоёв. `rig.json` — 350 КБ (53 КБ br), из них 215 КБ — `body.verts` текстом и 111 КБ — `body.idx`.
- **Что сделать.** Слои запрашивать параллельно (имена фиксированы) или preload тела (84 КБ) и хвоста (30 КБ); сетки — бинарно (Float32/Uint16 из `doll_build.py`).
- **Выигрыш.** Кот оживает на ~0,2–0,4 с раньше на 3G (сейчас 3,3 с); постер и так виден — ○ ([web.dev](https://web.dev/learn/performance/optimize-resource-loading)). **Риск.** Нет; нужен тест «вершины совпадают до бита».

### 1.7. MSAA у WebGL-кота ничего не даёт
- **У нас.** `lib/rig/renderer.ts:155`: `antialias: true`.
- **Замер** (подмена чанка на лету): лендинг, reduced-motion, холст 394²; SAMPLES 4 → 0. Разница кадра: средняя 0,001/255, максимум 2, отличаются 0,31 % пикселей — края сетки в прозрачных полях текстур.
- **Выигрыш.** −2,5 МБ видеопамяти и разрешение MSAA каждый кадр; на тайловых GPU Apple, вероятно, мало, на слабых Android больше — ○.
- **Риск.** На какой-то позе может проявиться лесенка; проверка — 10–20 поз попиксельно и Safari Web Inspector → Timeline.

### 1.8. Во время первой сессии может качаться чат Дома
- **Замер.** При прямом заходе на `/app/session` префетч меню тянет `/app?_rsc` и чанк 417 КБ (115 КБ br): zod и AI SDK; на 3G ≈ 0,6 с канала.
- **Проверить.** В пути из знакомства меню скрыто — возможно, префетча нет (`perfwalk` с логом запросов).
- **Если подтвердится.** `prefetch={false}` на время сессии, префетч на экране финала — ○.

### 1.9. Чат Дома на «думающей» модели (не путь знакомства)
- `companion/route.ts:83` — `gemini-2.5-flash`, рассуждение включено по умолчанию ([Gemini thinking](https://aistudio.google.com/docs/thinking)). Понизить — первый токен раньше и дешевле; качество сравнить на наборе реплик — ○.

## 2. Отклонено

| Приём | Почему нет |
|---|---|
| CSP с nonce через middleware и самозапрос ([Vercel KB](https://vercel.com/kb/guide/csp-nonces-with-cdn-cache)) | Vercel сам пишет: растёт TTFB, middleware дважды, ответ не прямой HIT |
| `experimental.inlineCss` ([Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/inlineCss)) | Экспериментальный, на весь сайт, стили дублируются в HTML и RSC; у нас 33 КБ вшитых шрифтов в CSS. Без замера через `h2proxy2.mjs` не включать |
| LazyMotion + m | На лендинге `layoutId` (`hero.tsx:612`) → нужен `domMax` (+38 КБ), экономия ≈ 0 ([motion.dev](https://motion.dev/docs/react-reduce-bundle-size)) |
| Speculation Rules / prerender | Только Chromium; переходы мягкие, с View Transitions — prerender их не ускоряет |
| Service Worker с предзагрузкой | Первому визиту ничего; Safari стирает данные через 7 дней; риск застрявшей версии |
| Edge-рантайм для proxy | В Next 16 недоступен |
| Понизить DPR, 30 fps в покое, урезанные текстуры, статика вместо видео | Видимая потеря качества |
| `font-display: swap` / `optional` | Видно, как текст перетекает |
| `next/image` | Картинки уже webp с версией в адресе; лишние вызовы функций |
| PPR / Cache Components | Страницы и так полностью статические |
| AVIF для постера кота (проверено главным сеансом 11.11) | −39 КБ, но preload не умеет выбирать формат: старые Safari качали бы оба файла |

## 3. Безопасность

### 3.1. Модель угроз
- **Деньги и квота Gemini.** Угроза — бесплатный прокси к модели. Сейчас лимиты в памяти экземпляра и Sec-Fetch-Site (curl его не шлёт, `api-guard.ts:58–61`). Пробел — нет глобального лимита и потолка расходов, OWASP [LLM10:2025](https://genai.owasp.org/llmrisk/llm102025-unbounded-consumption/).
- **Ключ.** Только в env; проверить ограничение «только Gemini» и потолок расходов.
- **XSS.** Пользовательского HTML нет; свои inline-скрипты — константы (`returning-redirect.tsx:11`, `hero-gate.tsx`). `'unsafe-inline'` ослабляет вторую линию; риск низкий.
- **localStorage.** Память валидируется zod'ом на сервере (`companion/route.ts:22–43`); подделка влияет только на собственный промпт человека.
- **`x-nid`.** `proxy.ts` не запускается при наличии cookie `nid` — присланный клиентом заголовок `x-nid` пройдёт как есть. Сейчас его никто не читает. Правило: идентичность — только из cookie.
- **Цепочка поставок.** Нет Dependabot, Actions на тегах `@v4`, в `ci.yml` нет `permissions:`.

### 3.2. Шаги для владельца (настройки, без кода)
1. **Потолок расходов Gemini** ([документация](https://aistudio.google.com/docs/billing)): AI Studio → Spend → Monthly spend cap → Edit spend cap. Экспериментально, учёт отстаёт до ~10 мин. Потолок Tier 1 — $250/мес на платёжный аккаунт; при достижении API стоит до 1-го числа.
2. **Ключ** ([API keys](https://aistudio.google.com/docs/api-key)): «Restrict to Gemini API only»; в Vercel пометить переменную как Sensitive.
3. **Оповещения бюджета Google Cloud** ([Budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)): Billing → Budgets & alerts → Create budget, пороги 50/90/100 %. Расходы не режет, только письмо.
4. **Rate Limit в Vercel Firewall** ([документация](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting); на Hobby одно правило): проект → Firewall → Configure → + New Rule; путь начинается с `/api/`, метод POST; Rate Limit, Fixed Window, 60 с, ~30 запросов, ключ IP + JA4; ответ 429 → Save → Review Changes → Publish. Можно сначала сутки держать действие Log. Счётчики по регионам.
5. **Защита превью-деплоев:** Settings → Deployment Protection — превью закрыты.

### 3.3. В коде (по решению владельца)
6. **BotID Basic** — бесплатно ([BotID](https://vercel.com/docs/botid), [гайд для AI](https://vercel.com/kb/guide/protect-ai-endpoints-with-vercel-botid)): `checkBotId()` в трёх AI-маршрутах; вес клиентского скрипта не мерен.
7. **Распределённый лимит** по `nid` и IP — когда появится база.
8. **CI:** `permissions: contents: read`, Actions по SHA, Dependabot, `minimumReleaseAge: 1440` в pnpm (10.28 у нас, функция с 10.16; [pnpm](https://pnpm.io/supply-chain-security)).
9. **Next на свежем патче** (пример цены — [CVE-2025-29927](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass)).
10. **Позже:** строгая CSP по хэшам ([CSP-гайд Next](https://nextjs.org/docs/app/guides/content-security-policy)); не срочно, сборка станет хрупкой.

### 3.4. Будущий бот и база
- Вебхук с `secret_token`, проверка `X-Telegram-Bot-Api-Secret-Token` ([Bot API](https://core.telegram.org/bots/api#setwebhook)); у Mini App — подпись `initData`.
- В базе — RLS, доступ только с сервера. Идентичность — из cookie. Лимиты на бота — как на AI-маршруты.

### 3.5. Свой домен и данные
- На своём домене HSTS ставить явно: `max-age=63072000; includeSubDomains`; preload — когда все поддомены на HTTPS.
- Персональные данные на сервере — по 152-ФЗ ст. 18 ч. 5 хранить в РФ ([КонсультантПлюс](https://consultant.ru/document/cons_doc_LAW_61801/), [legalacts](https://legalacts.ru/doc/152_FZ-o-personalnyh-dannyh/glava-4/statja-18/)); текст нормы видел только в пересказах — проверить у юриста.

## 4. Риски iPhone Safari в нашем коде
- **WebGL-холст пропадает на кадр во время View Transition** (перелёт `nap-cat`, `lib/view-transition.ts`, `globals.css:1474–1490`). [WebKit 291537](https://bugs.webkit.org/show_bug.cgi?id=291537): iOS 18.3.2, исправлен 27.05.2025. На iOS 18.x может мигать — нужна запись экрана; если мигает, держать постер под холстом на время перехода.
- **Устаревший transform в снимке перехода** — возможен рывок назад, если CSS-анимация transform идёт в момент нажатия ([WebKit 310181](https://bugs.webkit.org/show_bug.cgi?id=310181), исправлен 26.03.2026).
- **Переход прерывает инерцию прокрутки** ([WebKit 288795](https://bugs.webkit.org/show_bug.cgi?id=288795)); у нас переходы только по кнопке — ок.
- **Энергосбережение: rAF до 30 кадр/с** ([WebKit 215745](https://bugs.webkit.org/show_bug.cgi?id=215745)) — проверить, что пружины ушей и хвоста считаются по `dt`, а не по кадрам (`mascot-doll.tsx:238`).
- **Энергосбережение: автозапуск видео запрещён** (●) — `night-scene.tsx:109–122` уже обработан: `play().catch`, видео прозрачно до `onPlaying`, остаётся заставка.
- **Лимит WebGL-контекстов 16** ([WebKit 132833](https://bugs.webkit.org/show_bug.cgi?id=132833)), в одном отчёте с видео-текстурами — 8; у нас `MAX_LIVE = 12`, на пути знакомства кот один — ок.
- **backdrop-filter** — сборка добавляет `-webkit-` (12 из 25 правил); над видео выключено 11.11; цену на /app в песочнице не измерить — смотреть по RUM.
- **dvh** обновляется с задержкой при показе/скрытии панели Safari ([web.dev](https://web.dev/blog/viewport-units)); не ставить `dvh` на крупные анимируемые блоки.
- **font-display: block** — текст невидим до 3 с без шрифта; лендинг закрыт вшитыми шрифтами, `/app/start` обычно из кэша.
- **Заморозка экрана во время перехода** — потолок 0,6 с; React Compiler сократит монтирование нового экрана.

## Скрипты замеров (scratchpad сеанса 11.11, стираются)
`resweight.mjs` (вес ресурсов по маршрутам), `aa/aa.mjs` + `aa/cat-true.png`/`cat-false.png` (MSAA до/после), `pm-main-1.json` (LoAF пути на CPU ×4 + 3G), `perfwalk.mjs`, `gpucost.mjs`, `blurdiff.mjs`.
