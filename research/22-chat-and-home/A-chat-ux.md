# A. Чат Дома: UX лучших мессенджеров и AI-чатов, мобильный веб, направления дизайна

Исследование для «Напарника», 13.11.2026. Задача владельца: чат на `/app` — «супер-удобный мессенджер уровня 2026»:
удобно печатать, удобное поле ввода, правильное поведение с экранной клавиатурой, читаемые реплики, красивый дизайн.
Кода не писал. Бюджет: 37 поисков/загрузок из 40. Всё, что не подтверждено источником, помечено «не проверено».
Важно: многие источники ниже — сторонние разборы и блоги, а не документация самих компаний; где так, сказано.

Короткая сверка с текущим кодом (`components/companion-chat.tsx`, `components/chat-bubble.tsx`, прочитано 13.11), чтобы
не предлагать уже сделанное. Уже есть: композер-капсула внизу колонки (`h-dvh` у `<main>`), `textarea` 16 px
(`text-base`) с ростом до `max-h-[7.5rem]`, цитата отвечаемой реплики над полем с крестиком, кнопка «К свежим
сообщениям», когда лента уведена вверх (порог 24 px), до 3 чипов-подсказок, индикатор «Напарник печатает»,
скрытая `aria-live="polite"`-область, `useReducedMotion`, пузыри 82 % (человек) / 88 % (кот), карточки
«Готов к старту» и плана внутри ленты. Нет: `enterkeyhint`, учёта `visualViewport`, различия Enter на телефоне и
компьютере (сейчас Enter отправляет везде), `interactive-widget`, `field-sizing`.

---

## 1. Лучшие продукты: что именно делает разговор удобным

Формат: продукт → конкретные приёмы → источник. Где я опираюсь на общее знание интерфейса, а не на найденный
источник, стоит «не проверено».

### 1.1 Мессенджеры

**iMessage (Apple Messages)**
- Ответ на конкретную реплику — свайп вправо по любому пузырю (с iOS 17); раньше — долгое нажатие → «Ответить».
  Источник: Apple, «iOS 17 All New Features» (PDF) — https://www.apple.com/mideast/ios/ios-17/a/pdf/iOS_All_New_Features.pdf ;
  Tom's Guide — https://www.tomsguide.com/how-to/how-to-quick-reply-in-ios-messages
- «Догнать» — стрелка к первому непрочитанному в группе (объявлена в iOS 17, пришла не в первой версии).
  Источник: тот же PDF; MacRumors — https://www.macrumors.com/guide/ios-17-messages/
- Долгое нажатие на пузырь → реакции (Tapback) + меню действий. Не проверено (документа Apple не нашёл).
- Пузыри: отправленные синие справа, полученные серые слева; группировка подряд идущих реплик одного автора,
  «хвостик» только у последней в группе; время — скрыто, вытаскивается жестом влево. Не проверено (общее знание).

**Telegram**
- Кнопка «вниз» появляется при прокрутке вверх, возвращает к концу одним касанием и показывает счётчик
  непрочитанных; позиция прокрутки запоминается при переходе между чатами. Источник: Telegram blog (2016) —
  https://telegram.org/blog/edit
- Черновики: недописанное сообщение видно в списке чатов, синхронизируется между устройствами.
  Источник: https://telegram.org/blog/drafts
- Долгое касание по полосе цитаты над полем ввода прокручивает к сообщению, на которое отвечаешь.
  Источник: баг-трекер Telegram — https://bugs.telegram.org/c/14245/12
- Сообщение помечается прочитанным только когда его реально прокрутили. Источник: issue tdesktop —
  https://www.github.com/telegramdesktop/tdesktop/issues/7002
- Свайп влево по пузырю → ответ; время внутри пузыря в правом нижнем углу; плотная вёрстка. Не проверено.

**WhatsApp**
- Свайп по пузырю → ответ (Tom's Guide прямо называет это «фичей, которая была у WhatsApp годами»):
  https://www.tomsguide.com/how-to/how-to-quick-reply-in-ios-messages
- Кнопка микрофона на месте «Отправить», пока поле пустое; при вводе текста превращается в «Отправить»
  (один слот — две роли). Не проверено (статья UX Planet о дизайне WhatsApp отдала 403:
  https://uxplanet.org/3-design-choices-that-make-whatsapp-the-best-instant-messenger-edaa433d92de).

**Signal, Messenger** — отдельных источников по деталям интерфейса в бюджете не нашёл; по паттернам они
повторяют iMessage/WhatsApp (свайп-ответ, реакции долгим нажатием). Не проверено.

**Discord / Slack (мобильные)**
- Discord: полоса «новые сообщения» возвращает в живой чат; Slack: индикаторы новых сообщений и кнопка
  перехода. Источник (каталог паттернов, вторичный): https://ai-design-patterns.pages.dev/pattern/scroll-bottom

**Общее для мессенджеров:** реакции есть «почти во всех чат-приложениях в той или иной форме».
Источник: PubNub — https://www.pubnub.com/blog/the-common-features-of-chat-apps

### 1.2 AI-чаты

**ChatGPT**
- Кнопка «к последнему» появляется во время потоковой генерации, если человек прокрутил вверх.
  Источник (вторичный): https://ai-design-patterns.pages.dev/pattern/scroll-bottom
- Разбор мобильного приложения: чистый минималистичный фон; гибкому полю ввода «нужна ориентация» (задачи,
  подсказки возможностей, недавний контекст); композер должен показывать режимы (голос, камера, файлы), «не
  тесня главную кнопку отправки»; ожидание, поток, работа инструмента и завершение — разные состояния;
  генерацию можно прервать. Источник: https://screensdesign.com/articles/chatgpt-mobile-app-design/
- Обновлённый композер — проще и чище; выбранный инструмент показывается синим текстом рядом с кнопкой
  «Инструменты». Источник: BGR — https://bgr.com/tech/chatgpt-got-a-makeover-but-all-of-your-ai-tools-are-still-there
- Незрячие пользователи жалуются, что кнопку отправки трудно найти. Источник: AppleVis —
  https://www.applevis.com/comment/172339
- Тело ответа не помечено `aria-live`; отдельная скрытая `role="status"` объявляет «думает»/«готово».
  Источник: разбор azukiazusa — https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui

**Claude**
- Реплика человека — небольшой пузырь справа; ответ ассистента — текст на всю ширину без пузыря и без
  аватара, спокойный интерлиньяж, без теней. Источник: реконструкция assistant-ui (не Anthropic) —
  https://www.assistant-ui.com/examples/claude ; разбор Pratt — https://ixd.prattsi.org/2026/02/design-critique-claude-mobile-app/
- Известные баги мобильной версии: поле ввода наезжает на текст ответа. Источник:
  https://claudeissues.com/issue/28940-bug-input-text-box-sitting-on-top-of-response-text-in-mobile —
  это ровно тот класс проблем, который надо закрыть у нас (см. §2).
- Статус генерации — отдельная live-область, как у ChatGPT. Источник: azukiazusa (выше).

**Gemini, Perplexity** — в бюджет не вошли. Не проверено.

**Pi (Inflection)**
- ustwo (агентство первой iOS-версии, апрель 2023): «убрали привычные UI-конвенции ради намеренного,
  эмоционального потока»; цель — интерфейс «спокойный, любопытный и человечный», «безопасное место для
  размышлений»; раздел Discover «мягко направляет» к первой реплике; Call Pi — голос. Конкретных решений
  по типографике/пузырям страница не раскрывает. Источник: https://ustwo.com/work/inflection-ai/
- Стартовые темы на главном экране: «Просто выговориться», «Помочь с решением», «Мозговой штурм».
  Источник (вторичный обзор): https://tooliverse.ai/tools/pi

**Character.ai**
- Свайп по ответу → другая версия ответа (регенерация). Источник: форум OpenAI —
  https://community.openai.com/t/swipe-through-different-versions-of-a-response-like-character-ai-does/1289957
- Тест «Suggested Reply»: подсказки ответов по трём последним сообщениям, отзывы смешанные. Источник:
  https://testingcatalog.com/character-ai-tests-new-suggested-reply-feature-amid-mixed-feedback

**Replika** — в центре 3D-аватар в «комнате», чат — главный компонент. Источник (вторичный):
https://www.eesel.ai/blog/replika-ai-alternatives . Детали подсказок не нашёл.

**Woebot / Wysa (ментальное здоровье)**
- Woebot смешивает свободный ввод и кнопки; в большинстве сценариев 1–3 кнопки для продвижения диалога;
  автор обзора считает это удобным на телефоне, где свободный ввод неуклюж. Источник:
  https://medium.com/the-social-robot/state-of-the-chatbot-woebot-b7baa285da74
- Кнопки-ответы ещё и показывают, что это не человек (в живом разговоре вариантов ответа не бывает).
  Источник: https://uxwritinghub.com/woebot-case-study-in-conversation-design-for-mental-health-products/
- Дневниковое исследование 26 пользователей Woebot и Wysa: важнее не «лучший стиль», а совпадение стиля
  взаимодействия с предпочтениями человека. Источник: JMIR 2025 — https://mental.jmir.org/2025/1/e76642
  (номер статьи из выдачи поиска; полный текст не читал — не проверено, что это именно та статья).
- Wysa — «простой чат», в отличие от «занятого» Finch. Источник: YourStory —
  https://yourstory.com/2022/06/app-review-self-care-pet-finch-gamifies-mental-wellbeing

**Finch (питомец-компаньон)**
- Питомец задаёт вопросы в онбординге, ответы — стопкой кнопок под репликой; после «приключения» питомец
  начинает разговор-рефлексию. Источники: https://screensdesign.com/articles/finch-app-onboarding-design/ ;
  YourStory (выше).
- Критика (студенческие разборы Pratt): онбординг перегружен, нарушает постепенное раскрытие; плюс — квесты
  по одному, что снижает когнитивную нагрузку. Источники: https://ixd.prattsi.org/2024/09/design-critique-finch-ios-app ;
  https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/
- Напоминания звучат как «забота о питомце», а не требование к себе. Источник:
  https://gallery.reteno.com/flows/push-notifications-finch

**Duolingo Max / Lily**
- Lily «помогает, если ты застрял» (это прописано в её инструкциях), есть расшифровка звонка и разбор после.
  Кнопки «помоги ответить» источник не подтверждает. Источники: https://blog.duolingo.com/ai-and-video-call ;
  https://newsletter.duoplanet.com/posts/duolingo-video-call-lily
- Персонаж с характером («сдержанная, но умная») — тон важнее количества функций. Источник: TechRadar —
  https://www.techradar.com/computing/artificial-intelligence/you-can-now-chat-and-play-games-with-duolingos-ai-characters-to-learn-spanish-or-french

**Headspace Ebb (AI-компаньон)**
- Ebb не раздаёт советы, пока человек не попросит; после того как человек выговорился — предлагает
  подходящие упражнения из библиотеки; можно закончить или удалить чувствительный разговор в любой момент;
  визуально — «мягко, с надеждой, сострадательно»; тестировали, чтобы люди понимали, что говорят с ИИ.
  Источник: Figma blog — https://www.figma.com/blog/headspace-ebb-ai-companion/ ;
  https://futurelondonacademy.co.uk/en/articles/headspace-released-ebb-ai-companion
- Декабрь 2025: голосовой режим и «направляющие начала разговора». Источник: Business Wire —
  https://www.businesswire.com/news/home/20251208896917/en/Headspace-Rolls-out-Voice-Feature-for-Empathetic-AI-Companion-Ebb

**Intercom Messenger / Fin**
- Убрали кнопки быстрых ответов у Fin, «чтобы Fin отвечал свободнее»; кнопки остались в сценариях (workflows);
  после ответа — «Помогло» / «Позвать человека»; карточки ответов расширили, чтобы не скроллить.
  Источники: https://www.intercom.com/changes/en/94618-fin-is-more-conversational ;
  https://www.intercom.com/help/en/articles/11433030-conversational-fin-experience ;
  https://www.intercom.com/changes/en/80878-new-ui-for-fin-answers-and-handover-to-teammates-in-the-messenger
- Вывод для нас: кнопки-ответы хороши в сценарии (онбординг, «готов к старту»), но в свободном разговоре
  их меньше и они не должны вытеснять поле ввода.

**Crisp** — в бюджет не вошёл. Не проверено.

### 1.3 Сводная таблица приёмов (кто делает → что берём)

| Приём | Кто | Есть у нас? |
|---|---|---|
| Свайп по пузырю = ответ | iMessage, WhatsApp, Telegram | частично (drag-to-reply в `chat-bubble.tsx`) |
| Кнопка «вниз» + счётчик новых | Telegram, ChatGPT, Discord | кнопка есть, счётчика нет |
| Не автоскроллить к концу длинного ответа | NN/g | не проверено у нас |
| Один слот справа: микрофон ↔ отправить | WhatsApp, ChatGPT | один слот есть |
| Кнопки-ответы в сценарии, свободный ввод в разговоре | Woebot, Finch, Intercom | чипы есть |
| Ответ ассистента без пузыря, на всю ширину | Claude, ChatGPT | нет (кот в пузыре) |
| Черновик не теряется | Telegram | не проверено |
| Отдельная live-область статуса, тело ответа без aria-live | ChatGPT, Claude | есть общая aria-live |
| Подсказки возможностей в пустом состоянии | NN/g, Pi, Ebb | чипы по контексту |
| Прервать генерацию | ChatGPT (screensdesign) | не проверено |

---

## 2. Мобильный веб: клавиатура iOS Safari и всё вокруг (главное)

### 2.1 Как ведёт себя клавиатура — модель
- Есть две области: layout viewport (по ней считаются `vh`, `position: fixed`) и visual viewport (что реально
  видно). Safari на iOS/iPadOS при открытии клавиатуры уменьшает ТОЛЬКО visual viewport; Chrome на Android
  с версии 108 тоже (раньше уменьшал обе). Элементы `position: fixed` «остаются на месте и могут быть закрыты
  клавиатурой». Единицы относительно viewport от клавиатуры не меняются.
  Источник: Chrome for Developers, «Prepare for viewport resize behavior changes» —
  https://developer.chrome.com/blog/viewport-resize-behavior
- Отсюда: `dvh` клавиатуру НЕ учитывает — он реагирует на панели браузера, а не на клавиатуру.
  Источники: https://dev.to/rl0425/why-css-dvh-ignores-the-mobile-keyboard-and-how-to-fix-it-31ao ;
  web.dev о единицах `svh/lvh/dvh` — https://web.dev/blog/viewport-units
- `dvh` — значение между `svh` и `lvh`, меняется при выезде панели; элемент в `dvh` перекладывается во время
  прокрутки, поэтому для больших постоянных областей советуют `svh`. Источник (вторичный, со ссылкой на
  спецификацию): https://specification.website/spec/performance/dynamic-viewport-units.md
  → У нас `<main>` в `h-dvh`: это верно для панелей Safari, но не решает клавиатуру. Не проверено, даёт ли
  `dvh` у нас перекладку при прокрутке (лента скроллится внутри, страница — нет, значит, вероятно, не даёт).

### 2.2 `interactive-widget` (мета viewport)
- Значения: `resizes-visual` (по умолчанию), `resizes-content` (сжимаются обе области — страница
  «укорачивается» над клавиатурой, как в нативном мессенджере), `overlays-content` (клавиатура поверх).
  Chrome на Android с 108. Источник: https://developer.chrome.com/blog/viewport-resize-behavior
- WebKit: баг 259770 «Implement the interactive-widget property» закрыт как FIXED; по комментарию
  разработчика WebKit поддержка в iOS 27.3 beta; 06.11.2026 тестер сообщает, что `overlays-content` и
  `resizes-visual` работают, а `resizes-content` «работает не так, как ожидалось» — страница чуть
  подпрыгивает, поле остаётся под клавиатурой; до 27.3 beta свойство игнорировалось.
  Источник: https://bugs.webkit.org/show_bug.cgi?id=259770
- Вывод: добавить `interactive-widget=resizes-content` в `viewport` (Next: `export const viewport`) стоит —
  на Android это сразу даёт нативное поведение, на iOS ≤ 27.2 игнорируется. Но опираться на него на iPhone
  нельзя ещё минимум один релиз; нужен JS-путь через `visualViewport`. Поведение в 27.3 — не проверено.

### 2.3 `visualViewport` — рабочий путь для iPhone
- Высота клавиатуры ≈ `window.innerHeight − visualViewport.height`. На iOS visual viewport ещё и
  прокручивается вверх (`visualViewport.offsetTop` растёт); события `resize` и `scroll` приходят на
  `visualViewport`, а `window.resize` — нет. На Android наоборот: `innerHeight` уменьшается, `offsetTop` = 0.
  Обрабатывать только один случай — сломать другой. Источник:
  https://dev.to/rl0425/why-css-dvh-ignores-the-mobile-keyboard-and-how-to-fix-it-31ao
- В Safari visual viewport иногда меняется только в конце анимации клавиатуры. Источник: WebKit bug 167710 —
  https://bugs.webkit.org/show_bug.cgi?id=167710 (по сводке поиска; страницу целиком не читал — не проверено).
- Практика из живых проектов: класть размеры `visualViewport` (высоту и `offsetTop`) в CSS-переменные и
  сажать «оболочку чата» над клавиатурой; не полагаться на `dvh`; заново прижимать ленту к низу при открытии
  и закрытии клавиатуры. Источники (PR в открытых репозиториях, анекдотичны):
  https://github.com/alpizesolution/queerspace-h/pull/30 ; https://github.com/vstorm-co/agenticos/issues/2066 ;
  https://github.com/block/builderbot/pull/1043
- **Баг iOS 26:** после закрытия клавиатуры `visualViewport.height` остаётся меньше `innerHeight`, элементы
  `position: fixed` (шапка, нижняя панель) смещены; воспроизводится и на apple.com; FB19889436, WebKit
  bug 297779; кто-то пишет, что в 26.1 beta исправлено, кто-то — что в 26.0.1 нет; официального обхода нет.
  Источник: https://developer.apple.com/forums/thread/800125
  → Для нас это довод держать композер НЕ `fixed`, а флекс-соседом ленты внутри колонки (как сейчас), и
  не доверять одному замеру `visualViewport` — пересчитывать на `resize`, `scroll` и `focusout`.

### 2.4 Прыжок страницы при фокусе
- Safari при фокусе прокручивает документ, чтобы поле было видно; с `fixed`-композером внизу это давно
  известная беда (шапка уезжает, композер исчезает). Обходы из старых iOS (8–12): переключать `fixed` →
  `absolute` на `touchstart`, фокусировать поле, сдвинутое трансформом за экран; `window.scrollTo(0,0)` на
  фокусе. Свежего (2025+) подтверждения, что `preventScroll` / `scrollIntoView` это лечат, не нашёл.
  Источники: https://gist.github.com/searls/d6fd21a57b7c70be12f65beb17bb6149 ;
  https://developer.apple.com/forums/thread/824765 ;
  https://meta.discourse.org/t/ipad-pro-safari-composer-disappears-off-screen-when-cursor-moves-to-different-fields/397892/1
- Вывод: самый надёжный способ не бороться с прыжком — сделать так, чтобы документ НЕ мог прокрутиться:
  `html, body` без скролла (высота = экран, `overflow: hidden` на корне колонки чата), прокручивается только
  лента. Тогда Safari прокручивает visual viewport, а не страницу, и остаётся компенсировать `offsetTop`.
  Это вывод из механики выше, на iPhone не проверено.

### 2.5 Поле ввода
- **≥ 16 px** — иначе Safari увеличивает страницу при фокусе; считается итоговый размер с учётом
  трансформаций. `maximum-scale=1` тоже убирает зум, но в Chrome на iOS и Android запрещает и ручное
  увеличение — плохо для доступности. Источники: https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing ;
  CSS-Tricks — https://css-tricks.com/?p=339455 . Официального документа WebKit нет. У нас уже 16 px.
- **`enterkeyhint`**: `enter`, `done`, `go`, `next`, `previous`, `search`, `send`; работает на `<textarea>`,
  Baseline «широко доступно» с ноября 2021. Источник: MDN —
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint
  → Выбор зависит от поведения Enter (ниже): если Enter на телефоне отправляет — `send`; если переносит
  строку — `enter`.
- **Enter на телефоне.** В живых проектах: на телефоне Enter = новая строка, отправка кнопкой; на компьютере
  Enter = отправить. Отдельно — Enter, завершающий ввод в IME (японский/китайский), нельзя считать
  отправкой. Источник: https://github.com/vstorm-co/agenticos/issues/2066 (сводка поиска).
  У нас IME уже учтён (`isComposing`, `keyCode 229`). Решение по Enter — продуктовое (см. §5, п. 4).
- **Кнопка отправки крадёт фокус** — тап по кнопке снимает фокус с поля и прячет клавиатуру; история бага
  в Safari. Источник: https://imeugenia.medium.com/debugging-is-thinking-the-story-of-virtual-keyboard-bug-in-mobile-safari-1623c878660e
  → Стандартный приём — `onPointerDown/onMouseDown preventDefault` на кнопке, чтобы фокус остался в поле
  (не проверено на нашем коде).
- **Авторост:** `field-sizing: content` для `<textarea>` — CSS без JS; Safari — по большинству источников
  26.2 (декабрь 2025), но данные расходятся (одна страница web.dev пишет «не поддерживается»). Советуют
  `@supports` + JS-запасной путь + `max-height`, чтобы большая вставка не выталкивала поле за экран.
  Источники: https://web.dev/blog/web-platform-06-2026 ; https://developer.chrome.com/docs/css-ui/css-field-sizing ;
  https://www.usecue.com/blog/auto-growing-textarea/ . Версия Safari не проверена по первоисточнику.
- Вставка большого текста в iOS Safari выталкивала панель под клавиатуру (там был `calc(50dvh − 3rem)`).
  Источник: https://github.com/get-bb/bb/issues/3950 → наш `max-h-[7.5rem]` в rem — правильно.
- `autocapitalize="sentences"`, `autocorrect="on"`, `spellcheck` — для разговорного русского текста по
  умолчанию разумны; источника, специфичного для чатов, не нашёл. Не проверено.

### 2.6 Прокрутка и «прилипание» к концу
- Прилипать к концу только когда человек уже внизу; ушёл вверх — не дёргать, показать «Новые сообщения» (или
  счётчик), а не только стрелку; кнопка над композером, с достаточной зоной касания, не конфликтует с
  клавиатурой. Источник: https://ai-design-patterns.pages.dev/pattern/scroll-bottom
- NN/g: не прокручивать к концу ответа — держать позицию на начале нового/потокового сообщения, чтобы
  читать с начала. Источник: https://nngroup.com/articles/ai-chatbots-design-guidelines
  → Это важно для СДВГ-аудитории: длинная реплика, уехавшая концом вверх, читается с середины.
- `overflow-anchor` (браузер сам держит позицию при вставке контента выше) — MDN: Baseline 2026, «новое,
  доступно с сентября 2026»; старые Safari его не поддерживали. Источник:
  https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor (версия Safari из таблицы не прочитана —
  не проверено).
- Приём `flex-direction: column-reverse`: лента сама «стоит» на конце; новые сообщения — в начало DOM;
  пустое место — распоркой `flex: 1`; минусы — выделение текста идёт снизу вверх, старые проблемы со
  скроллбаром. Источники: https://til.jakelazaroff.com/css/anchor-scroll-position-to-the-bottom/ ;
  https://www.digitalthriveai.com/en-us/resources/ui-ux/pin-scrolling-to-bottom/
  → У нас уже своя логика на `scrollTop` с повторами; переписывать на `column-reverse` ради одного этого
  не стоит — но стоит помнить как запасной вариант.
- `overscroll-behavior: contain` на ленте, чтобы прокрутка до края не тянула страницу/фон. Общее знание,
  источник в бюджете не искал — не проверено.

### 2.7 Safe-area
- Нижний отступ композера — `env(safe-area-inset-bottom)` при закрытой клавиатуре и 0, когда клавиатура
  открыта (иначе над клавиатурой висит лишняя полоса ~34 px). Это вывод; источника с цифрой не нашёл —
  не проверено. Для PWA на экране «Домой» есть отдельный баг сжатия viewport:
  https://dev.to/cederhook/fixing-the-ios-standalone-pwa-keyboard-bug-that-shrinks-your-viewport-for-good-63d

### 2.8 Что тестировать
- Реальный iPhone обязателен: Chromium — не WebKit (это прямо пишут авторы PR выше; у нас WebKit в стенде
  нет, см. CLAUDE.md). Сценарии: открыть/закрыть клавиатуру 5 раз подряд; вставить 2 000 символов;
  повернуть экран с открытой клавиатурой; «Домой»-PWA; включённое «Уменьшение движения»; крупный шрифт.

---

## 3. Доступность и читаемость

- **Длина строки:** оптимум 50–75 знаков; на телефоне в портрете проблема редко, в альбомной — бывает;
  WCAG 1.4.8 — не больше 80. Источник: Baymard — https://baymard.com/blog/line-length-readability
  → Пузырь 88 % на 390 px ≈ 340 px; при 15,2 px (`0.95rem`) Manrope это примерно 40–45 знаков (оценка, не
  замер). На компьютере колонка `max-w-md` (448 px) — тоже в коридоре.
- **Размер шрифта реплик:** у кота `0.95rem` (15,2 px). Поле — 16 px. Читаемая разница «пишу крупнее, чем
  читаю» — странна; лучше 16–17 px для реплик кота. Это рекомендация из логики, не из источника (у Apple
  body = 17 pt — не проверено, страница HIG не загрузилась).
- **Зоны касания:** WCAG 2.5.8 — минимум 24×24 CSS px (или отступ-круг 24 px); 2.5.5 (усиленный) — 44×44,
  советуют для важных элементов. Источник: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
  Apple HIG 44×44 pt — общеизвестно, страница не загрузилась — не проверено. У нас кнопки 44 (`size-11`).
- **Контраст:** держать замеренные коридоры проекта (CLAUDE.md §3: `muted-foreground` 6,63:1). Стекло
  пузырей поверх живого фона — контраст мерить по самому светлому пикселю под текстом, как на лендинге.
- **Экранный диктор:** история — `role="log"` (W3C, техника ARIA23 —
  https://raw.githack.com/waic/w3c-wcag/master/wcag21/techniques/aria/ARIA23.html); поток токенов НЕ в
  live-регион, объявлять ответ целиком по завершении; одна выделенная live-область в конце DOM, а не
  `aria-live` на каждом сообщении; если ожидание без текста — «Загрузка» через ~5 с и повтор каждые 5 с;
  фокус остаётся в поле ввода, пока приходит ответ; заголовок-невидимка у каждой реплики для навигации.
  Источник: Eric Bailey, Smashing Magazine, 05.11.2026 —
  https://smashingmagazine.com/2026/11/making-immersive-llm-chat-experiences-more-accessible/ ;
  azukiazusa — https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui
- **Уменьшение движения:** отдельный переключатель «анимации = 0», по умолчанию выключен при
  `prefers-reduced-motion`, но человек может включить обратно. Источник: Smashing (выше).
  У нас `useReducedMotion` есть; переключателя в приложении нет.
- **Увеличенный текст:** тестировать с крупным шрифтом браузера — обрезка и горизонтальный скролл; чаты
  часто используют мелкий текст. Источник: Smashing (выше).
- **Голосовой ввод** — альтернатива печати, помогает и людям с моторными нарушениями. Источник: NN/g
  (п. 10) — https://nngroup.com/articles/ai-chatbots-design-guidelines . (Системная диктовка iOS работает в
  любом `textarea` и так — кнопка микрофона в нашем поле не обязательна.)

---

## 4. Пять направлений дизайна для чата «Напарника»

Общее для всех: один кот, без тостов, без стыда, светлота фона в коридоре /app, карточки — в голосе кота.

### Направление 1. «iMessage-чистый»
- **Как выглядит:** классические пузыри с двух сторон; подряд идущие реплики кота склеены в группу, хвостик
  и аватар — только у последней; время скрыто (показ — жестом влево по ленте или долгим нажатием); свайп
  вправо = ответ; долгое нажатие = реакции + «скопировать/ответить». Композер — капсула «поле + одна кнопка».
- **Копирует:** iMessage, WhatsApp, Signal.
- **Плюсы для СДВГ:** привычно с первой секунды (ноль обучения), мало элементов, понятно «кто говорит».
- **Минусы:** «ещё один мессенджер» — нет отличия, нет места для дофамина; длинные реплики кота в пузыре
  читаются хуже; карточки действия теряются среди пузырей.
- **Что менять у нас:** группировка + один аватар на группу (заодно меньше WebGL-котов, см. лимит 12);
  жест «влево — время»; реплики кота 16 px.

### Направление 2. «Telegram-плотный»
- **Как выглядит:** компактные пузыри, время внутри пузыря справа внизу, плотные отступы; кнопка «вниз» со
  счётчиком новых реплик; черновик сохраняется; цитата над полем с переходом к оригиналу по касанию;
  кнопки-ответы под репликой бота (как inline-клавиатура Telegram-ботов).
- **Копирует:** Telegram (+ наш будущий Telegram-бот выглядел бы родственно).
- **Плюсы:** максимум информации на экране, мощные привычные инструменты, хорош для активных пользователей.
- **Минусы для СДВГ:** плотность = шум; время у каждой реплики создаёт ощущение «журнала», где видно, сколько
  тебя не было — риск стыда, против тона. Не подходит как основа для «тёплого» продукта.
- **Что взять даже без направления:** счётчик на кнопке «вниз», сохранение черновика, тап по цитате → к
  оригиналу.

### Направление 3. «AI-документ» (ChatGPT / Claude)
- **Как выглядит:** реплика человека — небольшой пузырь справа; ответ кота — НЕ пузырь, а текст на всю
  ширину колонки, крупнее (17 px), с воздухом, маленький кот-аватар один раз над ответом; списки и шаги — как
  настоящие списки; под ответом — тихие действия («другой шаг», «короче»). Новый ответ открывается с начала
  (NN/g п. 7).
- **Копирует:** Claude, ChatGPT, Perplexity.
- **Плюсы:** лучшая читаемость длинных реплик (дробление задачи на шаги), строки 50–75 знаков без рамки.
- **Минусы для нас:** холодно, «инструмент», а не «напарник рядом»; кот теряет присутствие; теряется чувство
  переписки с живым существом, на котором держится продукт.
- **Что менять:** только для «длинных» ответов (план, дробление) — оформлять их как документ-карточку внутри
  ленты, а короткие реплики оставлять пузырями.

### Направление 4. «Тёплый компаньон» (Finch / Pi / Ebb)
- **Как выглядит:** живой кот крупно вверху (или в «окне» над лентой), реплики кота — мягкие пузыри с
  характером, анимация появления «как будто сказал»; под каждой репликой-вопросом — 1–3 кнопки-ответа
  стопкой, поле ввода всегда доступно, но не главное; пустое состояние — 2–4 темы («Не могу начать»,
  «Раздроби задачу», «Просто тяжело»), как у Pi и Ebb; кот не советует, пока не попросили (Ebb).
- **Копирует:** Finch, Pi, Headspace Ebb, Woebot (кнопки 1–3).
- **Плюсы для СДВГ:** меньше решений на каждом шаге (кнопки вместо чистого листа), тепло, присутствие,
  дофамин от реакции кота; Woebot прямо отмечает, что на телефоне свободный ввод неуклюж.
- **Минусы:** риск «занятости» Finch (перегрузка, критика Pratt); кнопки могут ощущаться сценарием,
  Intercom ушёл от них в свободном разговоре; при каждом ответе-кнопке человек меньше формулирует сам.
- **Что менять:** кнопки — только под вопросами кота и не больше 3; одна реплика кота = одна мысль; реакция
  кота-шапки на отправку (уже есть механика эмоций `MascotDoll`).

### Направление 5. «Гибрид: разговор + закреплённая карточка действия» (рекомендую рассмотреть первым)
- **Как выглядит:** лента — пузыри как в направлении 1/4; над композером (или под шапкой) живёт ОДНА
  закреплённая карточка текущего действия: «Готов к старту: «Открыть файл отчёта» · 25 мин · [Начать]».
  Когда кот в разговоре предлагает новый шаг, карточка обновляется (с одним мягким «перелётом» из реплики в
  карточку), а не плодит новые карточки в ленте. Длинные ответы (план) — свёрнутой карточкой-документом
  с «развернуть» (NN/g п. 6, постепенное раскрытие).
- **Копирует:** закреплённые сообщения Telegram, «следующее действие» в Linear/трекерах, Intercom
  (широкие карточки ответов), Finch (один квест за раз).
- **Плюсы для СДВГ:** главное действие («начать») всегда в зоне большого пальца и не уезжает при
  прокрутке — один ясный следующий шаг; разговор не мешает действию; меньше дубликатов карточек.
- **Минусы:** ещё один слой над клавиатурой — меньше места для ленты при открытой клавиатуре (решение:
  при фокусе на поле карточка сворачивается в тонкую полосу); сложнее в реализации; надо проверить, не
  воспринимается ли как давление (тон: «когда будешь готов», не «начни уже»).
- **Что менять:** вынести «Готов к старту» из ленты в закреплённый слот; в ленте оставить лишь след
  («кот положил шаг»), чтобы история читалась.

---

## 5. Улучшения, полезные при любом направлении (по приоритету)

1. **Композер над клавиатурой на iPhone через `visualViewport`.** Что: слушать `visualViewport`
   `resize` + `scroll` (+ `focusout`), класть высоту клавиатуры и `offsetTop` в CSS-переменные, поднимать
   колонку чата; корень страницы не прокручивается. Почему: Safari сжимает только visual viewport, `dvh`
   клавиатуру не видит, `fixed` закрывается клавиатурой; в iOS 26 ещё и баг смещения после закрытия.
   Источники: Chrome blog; dev.to rl0425; Apple Forums 800125 (§2.1–2.3).
2. **`interactive-widget=resizes-content` в мета viewport.** Почему: на Android сразу нативное поведение;
   на iOS ≥ 27.3 — когда WebKit доведёт `resizes-content` (сейчас по отзыву работает криво, проверить на
   реальном iPhone перед тем, как полагаться). Источники: Chrome blog; WebKit bug 259770.
3. **Фокус не теряется при отправке.** Что: кнопка «Отправить» не забирает фокус (`preventDefault` на
   `pointerdown`), клавиатура не прячется между репликами. Почему: иначе каждая реплика = клавиатура
   уехала-приехала, лента прыгает. Источник: Medium imeugenia (§2.5). Проверить у нас — не проверено.
4. **Enter на телефоне + `enterkeyhint`.** Что: решить продуктово. Вариант А (рекомендую для короткого
   разговорного чата с котом): Enter отправляет везде, `enterkeyhint="send"` — на клавиатуре iPhone прямо
   написано «Отправить», перенос строки не нужен в репликах по 1–2 фразы. Вариант Б (как многие AI-чаты на
   телефоне): Enter = новая строка, `enterkeyhint="enter"`. Сейчас у нас поведение А без подписи — человек
   не знает, что Enter отправит. Источники: MDN enterkeyhint; agenticos #2066.
5. **Длинный ответ открывается с начала.** Что: когда приходит реплика выше экрана, прокручивать к её
   НАЧАЛУ, а не к концу, и дальше не тянуть за потоком. Почему: NN/g п. 7; людям с СДВГ особенно важно не
   начинать с середины. Источник: NN/g.
6. **Кнопка «вниз» со смыслом.** Что: если пока человек читал историю пришли реплики — на кнопке точка
   или «Новое от напарника», а не только стрелка; кнопка над композером, не перекрывает его. Источники:
   Telegram blog 2016; ai-design-patterns.
7. **Черновик не теряется.** Что: незакрытый текст поля сохраняется (в `lib/memory.ts`) при уходе на
   Фокус/Мир и возвращается. Почему: Telegram делает это годами; человек с СДВГ часто переключается на
   полуслове — потерянная мысль = фрустрация. Источник: telegram.org/blog/drafts.
8. **Группировка реплик + один аватар на группу.** Почему: ясно, кто говорит, меньше шума, меньше живых
   WebGL-контекстов (у нас `MAX_LIVE = 12`). Источник: паттерн iMessage/Telegram (не проверено документом).
9. **Реплики кота 16–17 px, строка 40–75 знаков.** Почему: Baymard 50–75; у нас 15,2 px меньше, чем в поле
   ввода. Проверить контраст и переносы на 360×640 после смены.
10. **Подсказки: 1–3, контекстные, под вопросом кота; в пустом состоянии — что кот умеет.** Почему: NN/g
    (сказать, что умеет бот; подсказки кнопками в начале и после ответов; иначе их игнорируют); Woebot 1–3
    кнопки; Intercom убрал кнопки из свободного разговора. У нас уже до 3 чипов — сохранить лимит, следить,
    чтобы они не повторялись (NN/g: «релевантные и не повторяющиеся»).
11. **Ответ на реплику жестом + переход к оригиналу.** Что: свайп по пузырю (уже есть drag-to-reply) и
    касание по цитате над полем → прокрутка к исходной реплике с подсветкой. Источники: Apple iOS 17 PDF;
    Telegram bugs 14245.
12. **Доступность потока.** Что: тело реплики кота не в live-регионе пока «печатает»; объявлять реплику
    целиком по готовности; при долгом ожидании — «Напарник думает» через ~5 с; фокус остаётся в поле;
    история — `role="log"`. Источники: Smashing (Bailey, 11.2026); W3C ARIA23; azukiazusa. У нас уже есть
    одна `aria-live`-область — сверить с этими правилами.
13. **Авторост поля CSS-ом.** Что: `field-sizing: content` под `@supports`, текущий JS-рост как запасной,
    `max-height` оставить. Почему: меньше перекладок на каждый символ. Источник: Chrome docs; web.dev 06.2026
    (версия Safari не проверена).
14. **`overscroll-behavior: contain` на ленте, корень страницы без прокрутки.** Почему: прокрутка до края
    не тянет фон/страницу, Safari не «прыгает» документом при фокусе. Не проверено источником (вывод из §2.4).
15. **Safe-area только при закрытой клавиатуре.** Почему: иначе над клавиатурой лишняя полоса. Не проверено.
16. **Тест-план на реальном iPhone** (§2.8) до мержа любой правки клавиатуры: WebKit в стенде нет, а
    поведение меняется от версии к версии iOS (26.0 → 26.1 → 27.3).

Не рекомендую (противоречит правилам владельца или аудитории): время у каждой реплики (видно «сколько
тебя не было» — стыд), статусы «прочитано» у кота (бессмысленно у ИИ и добавляет шум), тосты об
ошибках отправки (только голосом кота в ленте), регенерацию свайпом как у Character.ai (превращает
напарника в «автомат вариантов»).

---

## Источники (все, на что опирается файл)
- Chrome for Developers — viewport resize behavior: https://developer.chrome.com/blog/viewport-resize-behavior
- WebKit bug 259770 (interactive-widget): https://bugs.webkit.org/show_bug.cgi?id=259770
- WebKit bug 167710: https://bugs.webkit.org/show_bug.cgi?id=167710
- Apple Developer Forums 800125 (iOS 26 visualViewport): https://developer.apple.com/forums/thread/800125
- Apple Developer Forums 824765: https://developer.apple.com/forums/thread/824765
- dev.to — dvh ignores keyboard: https://dev.to/rl0425/why-css-dvh-ignores-the-mobile-keyboard-and-how-to-fix-it-31ao
- web.dev — viewport units: https://web.dev/blog/viewport-units
- specification.website — dynamic viewport units: https://specification.website/spec/performance/dynamic-viewport-units.md
- MDN — enterkeyhint: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint
- MDN — overflow-anchor: https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor
- Chrome — field-sizing: https://developer.chrome.com/docs/css-ui/css-field-sizing ; web.dev 06.2026: https://web.dev/blog/web-platform-06-2026
- Rick Strahl — iOS input zoom: https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing
- Searls gist (iOS focus scroll): https://gist.github.com/searls/d6fd21a57b7c70be12f65beb17bb6149
- Medium (Safari keyboard bug): https://imeugenia.medium.com/debugging-is-thinking-the-story-of-virtual-keyboard-bug-in-mobile-safari-1623c878660e
- GitHub PR/issues: https://github.com/alpizesolution/queerspace-h/pull/30 ; https://github.com/vstorm-co/agenticos/issues/2066 ; https://github.com/block/builderbot/pull/1043 ; https://github.com/get-bb/bb/issues/3950
- Jake Lazaroff TIL: https://til.jakelazaroff.com/css/anchor-scroll-position-to-the-bottom/
- ai-design-patterns — scroll to bottom: https://ai-design-patterns.pages.dev/pattern/scroll-bottom
- NN/g — AI chatbot guidelines: https://nngroup.com/articles/ai-chatbots-design-guidelines ; prompt suggestions: https://www.nngroup.com/articles/prompt-suggestions/
- Smashing (Eric Bailey, 05.11.2026): https://smashingmagazine.com/2026/11/making-immersive-llm-chat-experiences-more-accessible/
- azukiazusa — accessible streaming chat: https://azukiazusa.dev/en/blog/accessible-streaming-chat-ui
- W3C ARIA23 role=log: https://raw.githack.com/waic/w3c-wcag/master/wcag21/techniques/aria/ARIA23.html
- W3C — Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Baymard — line length: https://baymard.com/blog/line-length-readability
- Apple iOS 17 features PDF: https://www.apple.com/mideast/ios/ios-17/a/pdf/iOS_All_New_Features.pdf
- Telegram blog: https://telegram.org/blog/edit ; https://telegram.org/blog/drafts ; bugs: https://bugs.telegram.org/c/14245/12
- screensdesign — ChatGPT mobile: https://screensdesign.com/articles/chatgpt-mobile-app-design/
- assistant-ui Claude reconstruction: https://www.assistant-ui.com/examples/claude
- ustwo — Pi: https://ustwo.com/work/inflection-ai/
- Woebot: https://medium.com/the-social-robot/state-of-the-chatbot-woebot-b7baa285da74 ; https://uxwritinghub.com/woebot-case-study-in-conversation-design-for-mental-health-products/
- Figma — Headspace Ebb: https://www.figma.com/blog/headspace-ebb-ai-companion/
- Intercom Fin: https://www.intercom.com/changes/en/94618-fin-is-more-conversational
- Finch: https://screensdesign.com/articles/finch-app-onboarding-design/ ; https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/
- Duolingo: https://blog.duolingo.com/ai-and-video-call
- Character.ai: https://testingcatalog.com/character-ai-tests-new-suggested-reply-feature-amid-mixed-feedback
