# A. Исследование трёх дизайн-скиллов: taste-skill, ui-ux-pro-max, motion-design-agent

Дата: 2026-11-02. Только изучение источников. По решению владельца сравнения с Напарником в отчёте нет: нет раздела «Применимо к Напарнику» и нет привязки к нашим файлам.

Клоны (только чтение, ничего из них не запускалось, скиллами не устанавливались):
`repos/{taste-skill,ui-ux-pro-max-skill,motion-design-agent}`
Скриншоты, монтажи и рабочие заметки лежат там же: `.../research/img/`, `.../research/site/out/`, `.../research/notes/`.

---

## 0. Методика и честный охват

| Источник | Файлов | Что прочитано целиком | Что сведено скриптом или просмотрено выборочно | Что не делалось |
|---|---|---|---|---|
| taste-skill (Leonxlnx) | 72 | README ×2, SKILL.md (543 строки), все 11 references (tells, copy, type, colour, critique, layout, scenes, research, motion 981 стр., imagery 51 КБ, app-screens 1199 стр.), CHANGELOG, CREDITS, evals.json, base.css/base.js, stage.css, шапки stage.js/charts.js/app.css, правила lint.mjs, манифесты, install.sh, тесты (шапки) | library/*.json разобраны скриптом: 20 directions (идея, моушен, подводные камни), 18 motions (полностью), 56 палитр, 44 шрифтовые системы, 58 героев и 185 секций (имя и blueprint), 202 изученных сайта (score, идея, «steal» по выборке), 19 фотосетов, app.json (7 стилей, 5 оболочек, 25 паттернов). В inspect.mjs, draw.mjs, assets.mjs, probe.mjs, rules.mjs прочитаны только id правил и пороги. | Ни один скрипт не запускался. |
| tasteskill.dev | 5 страниц | Весь текст `/`, `/docs`, `/guide` (короткая и полная версия, `?view=full`), `/changelog`, `/blog` (4 встроенных треда X); все вкладки What's new (Structure, Rules, Bans, Motion, Stack). | Скриншоты на 1440 и 390 (первый экран и вся страница) для каждой страницы. Замерены computed-стили героя. | — |
| ui-ux-pro-max (nextlevelbuilder) | 700 (≈291 уникальный текст; `src/`, `cli/assets/` и `.claude/skills/` — зеркала, сверено по md5) | README.md (остальные 5 README — переводы того же текста), CLAUDE.md, SKILL.md, quick-reference.md, pro-rules.md, все 119 строк ux-guidelines.csv, все 32 строки app-interface.csv, все 17 motion.csv, все 34 landing.csv, все 88 styles.csv, все 74 typography.csv, все 25 charts.csv, все 44 react-performance.csv, stacks nextjs/react/html-tailwind/shadcn построчно, stack/ (CLAUDE.md, агент design-review, команды, docs, отчёт juniper), docs/journals ×4, INSTALL, заметка на китайском | products/colors/ui-reasoning (192×3): полный список типов продуктов плюс полные строки для 12 типов. Остальные 18 стеков — категории и число строк. google-fonts.csv (1934) — статистика, включая кириллицу. Иконки — состав. Шесть вспомогательных скиллов claudekit (brand, design, design-system, ui-styling, banner-design, slides) — SKILL.md и заголовки всех references. CSV логотипов, CIP и слайдов — только шапки и число строк. | Python и Node не запускались. Три демо-страницы `projects/*` грузят Tailwind CDN, а рендер с JS классификатор прав запретил («Code from External»). Поэтому они отрисованы без JS (вышли без стилей) и описаны по исходнику. |
| motion-design-agent (soilmass) | 244 | README, SKILL.md, CLAUDE.md, все 4 references; 25 SKILL.md прочитаны целиком без блоков кода (accessibility, motion-principles, easing, duration, intent, emotion-mapping, emotional-journey, microstate, ui-micro, character, loading-states, empty-states, notifications, onboarding, attention, motion-audit, looping, consequence, choice-resolution, narrative-arc, dramaturgy, attention-choreography, secondary-action, follow-through, anticipation) | Остальные 61 SKILL.md — все таблицы и ключевые списки (до 14 строк на скилл). 63 файла токенов: значения 9 ключевых (spring, motion-levels, scrim, state-layer, focus-indicator, entrance-intensity, cross-fade, character, emotion/journey по структуре). docs/spec.md и EXPANSION-PLAN — заголовки. CHANGELOG — v3.3.0. Presets и templates — оглавления, у двух CSS-шаблонов комментарии. Проверены битые перекрёстные ссылки. | 51 файл `skills/*/references/*.md` построчно не читался (2 из них прочитаны). |

Изображения: открыты все растровые картинки taste-skill (4 примера v2, 2 баннера TasteCode, 2 вордмарка, 4 спонсорских лого). В ui-ux-pro-max открыты все 7 PNG (website.png и 6 скринов juniper, длинные — монтажом колонок) плюс отрисованное превью xiaomaomi-app. В motion-design-agent картинок нет (`assets/lottie/.gitkeep`). SVG-лого спонсоров (Vercel, React Bits, IMG.LY, бейдж OSS) не растеризовались. Это логотипы, значимого содержания в них нет.

---

## 1. taste-skill (Leonxlnx/taste-skill, v2.1.5, MIT) и tasteskill.dev

### 1.1 Что это
Скилл `design-taste-frontend` («tasteskill v2, the anti-slop frontend skill»). По словам авторов, он построен на исследовании 247 сайтов: One Page Love и Awwwards Sites of the Day, октябрь 2026. Позже добавились второе исследование 100 последних SOTD (движение, кадр, картинки) и исследование 23 реальных экранов продуктов для дашбордов. Оценки давала «панель» из моделей, а не люди. Это сказано прямо: «model judgements from screenshots, not Awwwards scores».

Механика работы:
1. Инвентаризация.
2. «Аргумент» страницы.
3. Скрипт `draw.mjs` выдаёт 3 из 20 направлений.
4. Идея плюс одна «живая вещь».
5. Тексты.
6. Сборка без анимации.
7. Гейт `lint.mjs` и `inspect.mjs` в реальном Chrome на 1440/768/390.
8. Критика по своим скриншотам, не больше 3 раундов.
9. Слой движения.
10. Отчёт.

Сборка занимает «30–45 minutes and a few hundred thousand tokens».

### 1.2 Структура
```
SKILL.md · references/{app-screens,colour,copy,critique,imagery,layout,motion,research,scenes,tells,type}.md
scripts/{draw,assets,inspect,lint,scenes}.mjs + lib/{cdp,probe,rules,app-draw,inspection-files}.mjs
library/{directions,heroes,sections,type,palettes,photos,sites,motions,app}.json
assets/{base.css,base.js,app.css,charts.js,scenes/stage.{css,js}}
evals/evals.json · examples/v2/*.webp + CREDITS.md · tests/*.mjs · .github/workflows/check-skills.yml
```
Найденные дыры:
- `references/scenes.md` и `motion.md` ссылаются на `library/scenes.json` и `assets/scenes/demo/<id>.html`. В репо их нет: «Until library/scenes.json ships the draw deals none».
- В `motion.md` после «Receding hero» стоят пустые строки, похоже, на месте вырезанного рецепта.

### 1.3 Правила

**A. Процесс (SKILL.md, «The run»)**
- Решить, страница это или экран приложения. Экран приложения идёт отдельным маршрутом (`app-screens.md`).
- Инвентаризация: «eight to twelve things that belong to this client and to no competitor»: имя и его смысл, адрес, числа, ограничение, материалы, ритуалы, печатные вещи этого мира.
- Аргумент: каждая секция — это утверждение и его доказательство. «A section with no claim is filler; delete it.»
- Предложение-идея: «On this page, [something that belongs to the subject] becomes [the device the direction calls for].» Плюс **тест конкурента**: если фраза подходит ближайшему конкуренту, идея категорийная.
- **One live thing**: «one thing the visitor can do, or that is different for each visit». Это реальный контент, работает пальцем, есть фолбэк без скрипта, не мешает читать. «In blind tests every winning page had one».
- Сначала тексты целиком, потом вёрстка. Сначала статика: «a page that needs animation to look finished is not finished».
- Порядок картинок: свои → сгенерированные → реальные из открытых архивов с кредитом → нарисованные кодом «из самого предмета» → дежурные фото → только типографика и цвет. Минимум «four real pictures… usually six to twelve». SVG в этот минимум не засчитывается.
- Гейт: 0 FAIL на 1440/768/390. Каждый WARN считается ошибкой, пока его нельзя защитить «одной фразой перед дизайнером». Проверять прод-сборку, не dev-сервер.
- Критика: только по скриншотам. «If a problem is visible in a screenshot, it is real, whatever the code says.»

**B. Обязательные правила (таблица в SKILL.md, проверяет инспектор)**

| Правило | Вместо этого |
|---|---|
| Заголовки ≤2 строк на любой ширине | Сокращать слова, потом расширять меру, кегль — в последнюю очередь |
| Ясный `h1` на первом экране, заголовок у каждой секции | Название + что это делает |
| Равные внешние поля, ни одна секция не прижата к одному краю | Закрыть пустоту картинкой, второй колонкой, списком |
| Нет пустот выше ~½ экрана | Один осознанный «отдых» на страницу |
| «Statements» ≤36px на десктопе, 24px на телефоне, ~25 слов | Иначе это заголовок, и действует правило 2 строк |
| Нет eyebrow (мелкой плашки над заголовком, «New ·» и т.п.) | Перенести смысл в заголовок |
| Нет моноширинного шрифта вне кода | Табличные цифры |
| Нет нумерации 01/02/03 | Порядок задают позиция, масштаб, `<ol>` |
| Нет тонких линеек (1px-разделителей, контурных боксов, сеток) | Пространство, шаг тона, заливка |
| Нет градиентов | Плоский цвет; исключение — нейтральный скрим под текстом на фото |
| Нет теней у покоящихся элементов, нет glow | Шаг тона; тень только у того, что парит (меню, диалог) |
| Нет «ассистентской» палитры: кремовый + терракота, фиолетовый/индиго | Выданная палитра |
| Нет мелких капсом с разрядкой | Sentence case |
| Нет карточек с иконкой сверху и рядов одинаковых карточек | Blueprint секции |
| Нет стекла, blur-панелей, плавающей пилюли-навигации | Простая полоса |
| Нет эмодзи, градиентных клякс, декоративных фигур, фейковых дашбордов из серых полос | Реальная картинка, реальный фрагмент интерфейса или ничего |
| Нет выделенного акцентного слова в заголовке | Один шрифт, один цвет |
| ≤2 гарнитур, обычно одна | Выданная типосистема |

Обоснование из данных (топ ≥7.5 против слабых <6.5): карточки с иконкой 1% против 28%, пилюли 14/34, мелкий капс 16/57, градиенты 22/52, тени 24/48, эмодзи 10/26. Авторы честно оговаривают, что моно, нумерация и тонкие линейки **чаще встречаются у сильных** сайтов (44/24, 38/21, 61/52) и запрещены «by the owner's decision… they are the devices generators copy first».

**C. Законы ремесла (короткая форма)**
- *Типографика:* видимую работу делают 2–3 размера; потолок — 5 размеров. Медиана заголовок/текст = 4.3 (у топа 4.7). Самый крупный текст в топе — медиана 8.4vw, у слабых 5.0vw. Display: трекинг −0.02…−0.05em, интерлиньяж 0.85–1.05. Текст 16–20px, интерлиньяж 1.45–1.6, 45–75 знаков. Трекинг подбирается под каждый шаг кегля. Оптическое выравнивание крупных букв: `margin-left: -0.05em`. На тёмном фоне светлый текст кажется тяжелее: снизить вес на шаг. Вес на hover не менять, иначе текст перетекает. Вторичный текст — тот же шрифт мягче по цвету, не меньше 13px. `text-wrap: balance` для заголовков, `pretty` для абзацев. Пространство над заголовком минимум вдвое больше, чем под ним.
- *Пространство:* одна сетка, тесные поля 16–32px. У текстовых блоков на всей странице 2–3 левых края. Между секциями 120–240px на десктопе и 72–112px на телефоне. Асимметрия только внутри сетки. Пустота допустима, только если её что-то «закрывает»; иначе это «дыра». Типичные источники дыр: раздутый отступ между секциями; половина ширины пуста; поздний reveal; короткий блок растянут на экран; pin, который держит пустоту.
- *Цвет:* роли bg/surface/ink/muted/accent/accent-ink. Фон 70–90%, акцент меньше 5% экрана, «на действии и максимум одной другой вещи». Поверхности отделяются шагом тона в 2–6 пунктов светлоты, не линией и не тенью. Тёмные страницы: `color-scheme: dark`, глубокий тонированный фон, мягкий светлый ink, а не `#fff` на `#000`; глубина через более светлую поверхность, «never from glows». Прозрачность текста не снижать без проверки контраста. Контраст: текст 4.5:1, крупное 3:1.
- *Картинки:* одна доминирующая лучше шести мелких. Одни пропорции, одна обработка, квадратные углы (73% сайтов). Ничто не лежит поверх заголовка.
- *Компоненты:* кнопки плоские, либо квадратные, либо полностью круглые. «9–16px soft radius is the weak-site default». Навигация — вордмарк, 3–5 ссылок, одно действие. Контрол объясняет себя формой; ограничения поля видны и связаны через `aria-describedby`.

**D. Тексты (copy.md)**
- Арифметика заголовка: знаков в строке ≈ ширина / (кегль × k), k≈0.5. «About 32 characters or fewer» живёт везде.
- Удачные формы: имя / что это / утверждение / инструкция / место. Плохие: мэд-либ «The AI-powered platform for modern teams», трикolon «Fast. Simple. Secure.», коррекция «not just X, it's Y», «reimagined», вопрос, которого никто не задавал, заголовок с двоеточием.
- Поддерживающая строка ≤~22 слов. Кнопки 1–3 слова и называют действие. Одна первичная кнопка на экран, стрелка максимум на одной.
- Доказательства не выдумывать никогда. Образцы деталей (меню, номера) можно, но их нужно перечислить в отчёте.
- Стоп-слова lint: unlock, unleash, supercharge, seamless, elevate, empower, revolutionize, game-changer, cutting-edge, next-gen, world-class, all-in-one, effortless, blazing-fast, delve, tapestry, leverage, synergy, streamline, robust, holistic, «take your … to the next level», «say goodbye to», «in today's», «the future of», «not just … it's». Больше 4 em-dash — это WARN. Подписи кнопок «Learn more / Get started / Click here / Submit» — тоже WARN.
- Микротипографика: кавычки-«лапки», `&nbsp;` между числом и единицей, `tabular-nums`. Капс не длиннее трёх слов. Ничего мельче 13px. Центрировать абзацы не длиннее трёх строк. Без выключки по ширине.

**E. Движение (motion.md, исследование 99 SOTD)**
- Токены: `--ease-out: cubic-bezier(0.22,1,0.36,1)` для UI до 600ms; `--ease-expo: (0.16,1,0.3,1)` для reveal от 800ms; `--ease-in-out: (0.76,0,0.24,1)` для вайпов и перемещений; `--ease-soft: (0.33,1,0.68,1)` для медленного дрейфа фото; `--ease-exit: (0.55,0.055,0.675,0.19)` только для ухода насовсем. Тайминги: press 140, hover 180, ui 240, reveal 800, open 1200ms; stagger строк 90ms, элементов 70ms.
- Четыре вопроса перед любой анимацией. **Как часто это видят?** Раз за визит — можно не спешить. Много раз — быстро и мало. «Hundreds of times (keyboard actions, typing): no animation.» Зачем это? «"It looks nice" is only valid for the signature moment.» Какое easing? Какая длительность? Уход примерно в 70% от прихода. `ease-in` для интерфейса не использовать.
- Что измерено: реально выполнялись expo- и quint-out. Медиана всех длительностей 420ms. Overshoot есть в 19 таблицах стилей, а запускался на 2 сайтах. 60 из 99 сайтов открываются лоадером, треть нечитаема через 4.5 с, «only usability fell». Reduced motion есть у 35 из 99.
- 14 правил движения (дословно по смыслу):
  1. Первый кадр: заголовок, фраза и картинка в HTML; загрузочная последовательность завершена к 1.2 с, не больше 4 элементов.
  2. Никаких прелоадеров, счётчиков, гейтов, кастомного курсора и перехвата колеса.
  3. Кривые как выше, без overshoot.
  4. Длительности как выше.
  5. Stagger: строки 80–110ms, элементы 50–90ms, символы 20–40ms и только в заголовке из 1–3 слов; в одной последовательности не больше 4 шагов.
  6. Reveal один раз, когда верх элемента на 85–90% высоты вьюпорта; подъём 12–32px; «nothing in view stays hidden for more than 900ms»; ничего выше сгиба не ждёт скролла.
  7. Смелость живёт в scroll-сценах.
  8. Вне сцен параллакс меньше 8%, масштаб 0.94–1.15.
  9. Одна фирменная анимация, одна движущаяся картинка, максимум одна бегущая строка.
  10. Текст читаем: заливка от 45% ink, затемнение не ниже 40%, blur не больше 8px.
  11. Смена цвета по главам — жёсткими стыками.
  12. Горизонталь — нативный drag-row.
  13. View transitions не дольше 480ms.
  14. Reduced motion = «fewer and gentler, not none»: оставить opacity и цвет, убрать перемещение; циклы останавливаются вне экрана и в скрытой вкладке.
- Минимум: инспектор валит страницу, если двигается меньше 8 элементов (WARN до 16). Нужны фирменная анимация, вход для частей каждой секции, отклик на каждом контроле, одна движущаяся картинка.
- Признаки сгенерированного движения: одинаковый fade-up на каждом блоке; дюжина входов в герое; hover-подъём на каждой карточке; bounce/elastic; «infinite loops that mean nothing: pulsing dots, floating shapes, shimmering text»; reveal, который не сработал. Плюс scramble/typewriter-текст.
- Рецепты с кодом: загрузка за 1.2 с, маскированный подъём строк, reveal по IntersectionObserver один раз (с сетью безопасности через 2.5 с в base.js), шторка-картинка, press/hover за `(hover:hover)`, scroll-timeline внутри `@supports`, pinned story, индекс с превью, «lines that rise», opening window, удерживаемая картинка с проходящими подписями, sideways gallery, receding hero, view transitions между страницами, ink fill, rolling figures, аккордеон через `grid-template-rows 0fr→1fr`, меню из точки триггера («Nothing enters from `scale(0)`; start at 0.95–0.98»).
- Важная тонкость: `overflow: hidden` создаёт скролл-контейнер и ломает `animation-timeline: view()`. Нужен `overflow: clip`.

**F. Scroll-сцены (scenes.md):** липкая сцена плюс GSAP-скраб. 2–3 сцены на страницу, каждая держит 1–4 экрана, тихая секция между ними, только нативный скролл. Готовая композиция показывается при reduced motion, без JS и при упавшем CDN.

**G. Картинки (imagery.md §12, 91 сайт)**
- Картинка либо ведёт свой экран (≥60%), либо остаётся мелкой (<10%). 42% экранов вообще без картинок. 3–5 типов размещения на страницу. На двух пропорциях держится 76% картинок. 94% углов квадратные.
- Рейтинг размещений по средней оценке. Выше: вырезанный объект на плоском поле (7.57), картинка у высказывания (7.56), held picture и растущее окно (7.52). Ниже среднего — 3D-галерея (7.30, юзабилити 5.9).
- Видео: 5–15 с, muted, loop, с постером (постер был лишь у 31% сайтов, пустые боксы panel засчитывала как баг), пауза вне экрана, при reduced motion не играет.
- Текст на картинке — только display плюс одна строка плюс действие. Контраст проверяется по всему циклу видео.

**H. Критика (critique.md)**
- 14 проходов:
  1. 1 с и 5 с.
  2. Прищуриться.
  3. Закрыть логотип.
  4. Края.
  5. Пространство и кадр.
  6. Типографика.
  7. Цвет.
  8. Картинки.
  9. Одинаковость.
  10. Телефон.
  11. Наполненность.
  12. Содержательность.
  13. Наложения.
  14. Конкурент и живая вещь.
- Веса Awwwards: design 40, usability 30, creativity 20, content 10. Калибровка: «real Sites of the Day land around 7.5–8.0… If your first score for your own work is 9, score it again».
- Потолки, например: любой FAIL → максимум 6.0; eyebrow, моно, 01/02, градиент или тень → 6.5; меньше 4 настоящих картинок → design ≤6.5; нет живой вещи → creativity ≤7.5; нет кнопки на первом экране → usability ≤7; не сработавший reveal → usability ≤5.
- Порядок исправлений: идея → иерархия → композиция → типографика → картинки → цвет → детали → движение.

**I. Экраны приложений (app-screens.md, 23 экрана)**

Восемь наблюдений:
1. Цвет на данных, а не в хроме (~3% цветных пикселей).
2. KPI — это типографика, а не плитки (0/23 с иконкой в кружке, 0/23 со спарклайном).
3. Плоские поверхности (17/23 без теней).
4. Нет hero-шапки (заголовок медиана 24px).
5. Графики почти без хрома.
6. Навигация отступает на второй план.
7. Таблицы — это линейки и выравнивание (0 зебры).
8. Честные состояния данных: ноль печатается нулём, пропуск — серым тире.

Ключевые правила:
- Один вопрос экрана и одна находка.
- Самое частое действие — в один клик.
- Данные складываются: «a fact shown twice is one variable».
- Цвет дельты означает хорошо или плохо, а не вверх или вниз.
- Ноль серый; от нуля писать «+4 (new)».
- Плотность — это три настройки вместе: шаг ряда, паддинги и кегль.
- Пустые, нулевые, загрузочные и ошибочные состояния:
  - загрузка — финальная раскладка с серыми барами реального размера, «no shimmer gradient»;
  - ошибка — внутри упавшего блока, одной фразой с временем последних хороших данных и Retry;
  - пустая секция сохраняет рамку и заголовок.
- Телефон: навигация складывается, KPI в 2 колонки, таблицы превращаются в двухстрочные строки.
- «Give the product a face»: одно лицо из брифа, один собственный элемент продукта.
- Движение на экранах приложений — только отклик: «Nothing on the screen performs an entrance».

**J. Реестр признаков (tells.md), датированный**
- Волна 1, 2023–24: фиолетовые градиенты, glass, glow-кнопки, три карточки с иконкой, эмодзи.
- Волна 2, 2025: eyebrow, пилюля над героем, курсивное слово, bento, неон на чёрном, плавающая пилюля-навигация, фейковый дашборд, пульсирующая точка «Available».
- Волна 3, 2025–26, «the "fix" that became the look»: кремовый плюс терракота, засечки для «премиальности», газетный косплей с линейками, перформативные подписи «Field notes».
- Отдельный признак — «avoidance aesthetic»: страница, вычищенная от признаков и ничем не заполненная.

### 1.4 Данные библиотеки
- **20 направлений:** name-as-monument, sentence-as-layout, pinned-poster, colour-chapters, place-carries-it, page-is-the-object, one-motif, product-performs, quiet-instrument, hero-object, specimen-catalogue, borrowed-category, contact-sheet, editorial-report, loud-flat-poster, split-stage, dense-tiles, uneven-photographs, dark-room, type-only-statement. У каждого есть идея, моушен из 18 и подводные камни, например для quiet-instrument: «Quiet is n[ot empty]…».
- **18 моушенов:** masked-headline, shutter-image, scaling-wordmark, pinned-story, index-preview, curtain-footer, slow-crossfade, edge-marquee, drag-row, colour-on-scroll, **stillness** («No showpiece… Motion is limited to exact feedback: a 140ms press… Do not add a load animation or scroll reveals to this direction»), opening-window, ink-fill, sheet-over, sideways-gallery, pushed-line, rolling-figures, carried-picture.
- **56 палитр** с тегами light-neutral, dark-neutral, earth, mono-accent, two-tone, single-field, flat-loud, pastel-fields, photographic-neutral. Ни одной фиолетовой, ни одной «кремовый + терракота».
- **44 типосистемы.** Fontshare и Google: Switzer, General Sans, Cabinet Grotesk, Clash, Gambarino, Boska и др. Ориентированы на латиницу; о кириллице не говорится нигде.
- **58 героев** (type-poster 8, split 8, object-centre 8, mosaic 5…). **185 секций** (features 22, showcase 21, work 15, how-it-works 14…). Есть blueprint для десктопа и телефона, например FAQ «Tabbed index cards», pricing «The itemised receipt», how-it-works «Order is carried by size».
- **202 изученных сайта:** score 6.7–8.6, медиана 7.4. Поле «steal» — что взять. Примеры с персонажем или маскотом: Zara Webb 8.0 (кролик-маскот, вырезы-цветы); L.I.S.A. 7.4 («Demote earlier lines of a conversation by fading and blurring them in place»); Atlas by WorkOS 7.1 (робот-маскот, «cropped by the top edge of the product demo»); Uncle Rudy 7.0; Léo Parpeix 7.6 (глиняный 3D-мир, «a bee you can feed»).
- **app.json:** 7 стилей — achromatic-ledger, framed-sheet, accent-ladder, editorial-greeting, pastel-consumer, true-black-flat, data-terminal.

### 1.5 Изображения
- `examples/v2/coffee-storefront.webp`: витрина кофейни нарисована SVG в тёмно-серой гамме. Узкий капс «TWENTY SEATS AND A ROASTER». Справа навигация в виде колонки цветных плашек: Menu, Beans (лайм), Roast day, Address, Hours. Слева внизу «живая вещь» — «Closed now. Open tomorrow from 8:00.» и лаймовая кнопка «Get directions».
- `night-dates.webp`: архивное фото машзала электростанции, циан-дуотон, нарезано плиточной сеткой. Чёрные плитки с датами «7 NOV 2026 / On sale now». Простые ссылки и чёрная кнопка «Tickets, 18 €».
- `coffee-roast.webp`: «Monday is roast day». Четыре фото растущего размера: Raw → First crack → Dropped → Cooled. Порядок показан размером, без цифр.
- `coffee-questions.webp`: FAQ «Asked at the counter» в виде картотеки с вкладками (мятный, розовый, белый).
- Баннер TasteCode (тёмный, «TasteCode is here.», пилюля Download), вордмарк (знак «дерево/стрелка» плюс геометрический гротеск), лого спонсоров.

### 1.6 Сайт tasteskill.dev
- **Страницы:** `/` (8662px на 1440), `/docs`, `/guide` (+`?view=full`), `/changelog`, `/blog` (4 эмбеда X от @LexnLin: 24.03, 22.04, 27.04, 1.05.2026, все — ссылки на X-articles).
- **Дизайн по замеру:** Geist 600. h1 «Taste Skill» 88px / трекинг −0.055em, на 390 — 56px. Фон `rgb(245,244,242)`, ink `#0a0a0a`. Огромный h2 «Escape the generic AI slop.» до 129.6px, «AI slop.» серым с оранжевым зачёркиванием. Справа в герое колода из 5 скриншотов страниц (Aurora, Northstar, Verdant Room, тёмное AI-агентство, Aven) и фото камня с растением. Секции: Sponsored by, Works with every agent (8 плиток агентов), каталог «13 skills», What's new in v2 (вкладки), тёмный блок TasteCode «How Design Mode works» (Brief/Direction/Build/Review), Built with (Floria, Collective OS), Support, стена из 23 спонсоров, Kimi/Vercel, футер с колонками ссылок.
- **Главное наблюдение: сайт устарел относительно репо.** Он описывает **v2 experimental** (до октября 2026): три «дайала» DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY, Brief inference, карту дизайн-систем, полный запрет em-dash, три «lock» (одно акцентное, одна система радиусов, одна тема), hero discipline («Headline max 2 lines… Subtext 20 words… CTA visible without scroll… Navigation ≤80px»), «Bento: N items equals N cells», «Italic clearance: line-height ≥1.1», «at least four layout families across eight sections», GSAP-скелеты, Tailwind v4, Motion, иконки Phosphor/HugeIcons/Radix/Tabler, «Lucide discouraged, hand-rolled SVG icons banned», «Inter as the body font on dashboards (banned)», «Pure black (#000) backgrounds». Каталог в 13 скиллов ссылается на папки, которые в репо уже перенесены.
- **Противоречия сайта и текущего SKILL.md:** сайт запрещает «hand-rolled decorative SVG illustrations», а v2.1 **требует** рисовать предмет кодом, когда нет честной картинки. Сам сайт нарушает правила v2.1: пилюля «New» над h1, моно-плашки установки, нумерованные шаги 1–4 с тонкими линейками, второй цвет (серый) в заголовках, карточки с тенью, нумерация «01–08» в TL;DR гайда, колонки ссылок в футере.
- **Полезное в `/guide?view=full`:**
  - Обязательная строка «Treat this skill file as the single source of truth… If anything… conflicts with your defaults, the skill wins.»
  - Бриф из 7 полей: page kind, product, audience, vibe words 3–5, reference signals 2–4, avoid 2–4, out of scope.
  - Формат **DESIGN READ**: brief, direction, type system, color system, spacing/density, motion plan с MOTION_INTENSITY 0–5, список 6–10 секций, anti-slop notes, risks.
  - 6 гейтов: em-dash, pre-flight, повтор раскладок, стратегия картинок, hero discipline на 1280×800, тема.
  - 5 проходов итерации. Пример: «Pass 4: motion and interaction. Only after the static layout passes the audit.»
  - Поправки одной строкой: «Re-run the pre-flight check. For each box, quote the exact line of code or copy that justifies the pass.»
- На 1440 при снимке всей страницы под каталогом скиллов вышла пустая полоса. Это артефакт stagger-reveal: при прокрутке вживую карточки на месте (`img/A-skillgrid_1440.jpg`).

### 1.7 Оценка качества
- **Сильное:**
  - Правила сформулированы как измеримые проверки, и инспектор их действительно меряет.
  - Числа из исследования с явными ограничениями: модельная панель, одна дата съёмки, «fashion as much as quality».
  - Честность про собственные запреты: «the owner's taste, not a finding».
  - Мысль «avoidance aesthetic» и запрет заполнять пустоту новым украшением.
  - motion.md — лучший документ из трёх источников: реальные выполнявшиеся кривые, пороги «hidden ≤900ms», «dims ≥40%», «fills from 45%», ловушка `overflow:hidden` против `view()`, честная цена прелоадеров.
  - Блок про состояния в app-screens (ноль, тире, загрузка без shimmer, ошибка в блоке).
  - Тесты вслепую опубликованы вместе с проигрышами: раунды 1–2 скилл проиграл бейзлайну (6.6 против 7.7, 7.1 против 8.0); итог 7.7 против 7.8.
- **Слабое и спорное:**
  - Правила откалиброваны под галерейный маркетинг (Awwwards).
  - «Movement floor ≥8 moving elements» и «≥4 real photos» — правила вкуса, а не пользы.
  - Запреты на моно и нумерацию идут против данных самого исследования.
  - Всё судейство модельное, примерно ±0.5 балла шума.
  - Сайт противоречит репо.
  - Отсутствующие scenes.json и demo.
  - Сборка стоит сотни тысяч токенов.

---

## 2. ui-ux-pro-max (nextlevelbuilder/ui-ux-pro-max-skill, MIT; есть платная версия на uupm.cc)

### 2.1 Что это
Набор CSV-баз и локальный поиск BM25 + regex (Python stdlib). Есть генератор «дизайн-системы»: продукт → паттерн лендинга, стиль, палитра, пара шрифтов, эффекты, анти-паттерны, чеклист. Скилл ставится CLI `uipro init --ai <25 агентов>`. Вместе с ним идут 6 скиллов от claudekit (brand, design с генерацией логотипов и CIP через Gemini/Atlas/MuAPI, design-system, ui-styling, banner-design, slides) и папка `stack/` — «Claude Website Design Stack».

### 2.2 Структура и инвентарь (catalog-summary.json, проверено 2026-11-01)
- Стили: 88, из них 79 ищутся (50 active, 29 supplemental), 9 deprecated.
- Продукты, палитры и профили рассуждения: по 192, связаны один к одному.
- 74 пары шрифтов, 1934 Google Fonts (из них 320 с кириллицей).
- 105 курированных иконок (Phosphor) и манифест на 1512 иконок.
- 119 UX-правил, 32 правила для нативных экранов, 17 GSAP-пресетов, 25 типов графиков, 34 паттерна лендинга.
- 22 стека с 1278 правилами, 44 правила React-производительности.

### 2.3 Правила

**Приоритеты (SKILL.md):**
1. Accessibility — CRITICAL.
2. Touch & Interaction — CRITICAL.
3. Performance — HIGH.
4. Style Selection — HIGH.
5. Layout & Responsive — HIGH.
6. Typography & Color — MEDIUM.
7. Animation — MEDIUM.
8. Forms & Feedback — MEDIUM.
9. Navigation — HIGH.
10. Charts — LOW.

**Контракт запроса:** «one dominant intent, 2–5 meaningful terms». Повтор только один раз. «Never present a 0-result search as if it returned data». Стек определяется по проекту: «Never assume a stack». `--force` для MASTER.md — только с разрешения пользователя.

**quick-reference.md** — около 200 id-правил по 10 категориям. Самые содержательные:
- *Accessibility:* контраст 4.5:1 (крупное 3:1); видимый фокус 2–4px; `icon-context` (декоративная иконка рядом с текстом скрыта от AT, значимой нужна альтернатива, у иконки-контрола — имя и состояние); `focus-not-obscured` (WCAG 2.2: липкий UI не перекрывает фокус); `dragging-alternative`; веб-цель **24×24 CSS px** (WCAG 2.2 AA) отдельно от 44pt/48dp; `accessible-authentication` (разрешить вставку и менеджеры паролей); `auto-rotation-controls`; `contextual-live-badge-updates` («3 items in cart», а не голое число).
- *Touch:* 44×44pt / 48×48dp, зазор 8px, `touch-action: manipulation`, «haptic… avoid overuse», порог перед началом drag, не перекрывать системные жесты.
- *Performance:* резерв места против CLS < 0.1, `font-display: swap/optional`, предзагружать только критичные шрифты, отклик на тап ≤100ms, input latency ≤100ms, кадр ≤16ms, виртуализация от 50 элементов, offline/slow-network режимы.
- *Layout:* `min-h-dvh` вместо `100vh`, не отключать зум, мобайл 16px и 35–60 знаков, шкала z-index, fixed-элементы резервируют отступ, `compact-label-overflow`, `chip-collection-reflow` (обёртка или управляемое раскрытие «+n»).
- *Type/Color:* интерлиньяж 1.5–1.75, 65–75 знаков, семантические токены вместо raw hex; тёмная тема — «desaturated / lighter tonal variants, not inverted»; `heading-line-balance` («progressive, user-agent-controlled… never force final words together with blanket nonbreaking spaces»); `long-token-wrapping` (`overflow-wrap:anywhere`, без `break-all` для прозы); табличные цифры для таймеров.
- *Animation:* «Animate 1–2 key elements per view max»; «motion-meaning — every animation must express a cause-effect relationship»; `spring-physics` («Prefer spring/physics-based curves»); выход ≈60–70% от входа; stagger 30–50ms на элемент; прерываемость; не блокировать ввод; `opacity-threshold` («should not linger below opacity 0.2»); scale-feedback 0.95–1.05; модалки — из источника; `cancellable-state-transitions` («never depend on an animation-end event for correctness»).
- *Forms/Feedback:* видимые подписи; ошибка под полем через `aria-describedby`; валидация on blur; error summary с фокусом после неудачной отправки; `toast-dismiss 3–5s`; `toast-accessibility` (не красть фокус, `aria-live=polite`); undo для деструктивных действий; автосохранение черновиков; подтверждение закрытия sheet с несохранёнными данными.
- *Navigation:* bottom nav не больше 5 пунктов, с иконкой и подписью; предсказуемый back; сохранять скролл и состояние; deep links; фокус на main после смены маршрута; не смешивать tab + sidebar + bottom nav на одном уровне.

**ux-guidelines.csv (119 строк).** Критичные:
- #112 «Text Reflow and Spacing» — не обрезать текст фиксированными боксами.
- #113 «Essential Text Truncation» — не обрезать смысл ради одинаковых карточек.
- #117 «Compact Control Semantics» — кнопка, а не кликабельный div, с pressed/selected.
- #107 Accessible Authentication.

Примечательные:
- #12 «Continuous Animation — Use for loading indicators only… Don't use for decorative elements».
- #26 «Pull to Refresh — Disable where not needed».
- #27 «Haptic — Don't overuse».
- #88 «Onboarding — Provide Skip and Back».
- #92/#93/#98 про AI: маркировать AI-контент, стримить по токенам, кнопки «👍/👎 / Regenerate».
- #96 «Auto-Play Video — Prefer click-to-play…».

**motion.csv (17 GSAP-пресетов, ярусы Subtle/Standard/Complex):**
- hover 150–200ms с ходом меньше 2px;
- «магнитный» hover `elastic.out(1,0.4)`, максимум на 1–2 элементах;
- scroll reveal 300–400ms со смещением 8–16px;
- «Don't stagger more than ~8 children»;
- stagger `back.out(1.4)` (но не на плотных таблицах);
- переход между страницами с выходом не дольше ~250ms;
- параллакс yPercent 5–15, без параллакса основного текста;
- скелетон shimmer 1200–1600ms «gradient background-position sweep», «Don't use elaborate loaders for sub-300ms waits»;
- карусель только с паузой.

**pro-rules.md (только для нативных и мобильных экранов):**
- одна иконочная семья, одна толщина штриха, «filled vs outline discipline»;
- нажатие не меняет layout bounds;
- отклик на тап через 80–150ms;
- скрим проверяется по реальному фону.
- Канонический Pre-Delivery Checklist: 375px и ландшафт; reduced motion и Dynamic Type; тёмная тема проверяется отдельно; цели ≥44pt; safe areas; error summary и т.д.

**Стили (styles.csv):** 88 стилей с оценками a11y-риска (low/conditional/high) и стоимости производительности. Высокий риск: Neumorphism, 3D/Hyperrealism, Retro-Futurism, Kinetic Typography, Parallax Storytelling, HUD, Interactive Cursor, Gen Z Chaos, Vaporwave, Chromatic Aberration, Dimensional Layering. Стили-лендинги (Hero-Centric, Conversion-Optimized и др.) переведены в deprecated и заменены паттернами landing.csv.

**Лендинги (34 паттерна).** Почти везде в conversion-заметках есть оговорки честности: «Show a waitlist count only when it is current, verified», «without fabricated scarcity», «Label telemetry as live only when backed by a current source».

**Типографика (74 пары).** Отдельных категорий для кириллицы и русского нет; есть VN/JP/KR/TC/SC/Arabic/Thai/Hebrew. По Google-данным у 49 шрифтов из пар нет кириллицы: Poppins, DM Sans, Space Grotesk, Outfit, Lexend, Atkinson Hyperlegible, Figtree, Quicksand, Work Sans и др. Кириллица есть, например, у Inter, Manrope, Caveat, Nunito, Montserrat, Raleway, Lora, Playfair, Jost, Rubik, Plus Jakarta Sans, Source Sans/Serif, IBM Plex Sans, EB Garamond.

**Продукты и рассуждения (пример строк):**
- *Timer & Pomodoro:* Minimalism + Neumorphism; «Large centered countdown digits. Circular progress ring… Sound + haptic alerts»; палитра «Focus red on dark (#DC2626 на #0F172A) + break green».
- *Habit Tracker:* Claymorphism + Vibrant; «Streak calendar heatmap… Gamification (badges/levels/fire)»; эффекты «Spring bounce»; анти-паттерн «Muted colors + Low energy».
- *Meditation:* Neumorphism + Soft UI; «Breathing circle animation… Slow easing transitions only»; палитра `#7C3AED` (фиолетовая).
- *Mental Health:* «Privacy-first. Crisis resources… Accessibility mandatory»; анти «Bright neon + Motion overload»; палитра `#8B5CF6`.
- *Mood Tracker:* фиолетовая палитра.
- *Notes:* «Distraction-free zen mode… No shadows».

Палитры — это в основном дефолтные цвета Tailwind: `#2563EB`, `#7C3AED`, `#059669`, `#475569`, `#F8FAFC`.

**Стеки (2026):**
- `nextjs` (16.2): App Router; «Handle loading states — loading.tsx alongside page.tsx»; `proxy.ts` вместо `middleware.ts`; cacheComponents / `use cache` / `cacheLife` / `updateTag`; next/font; CSP; zod на route handlers.
- `react` (19.2): React Compiler first; `useEffectEvent`; ref как prop (forwardRef deprecated); `useActionState`/`useFormStatus`; «Require React 19.2.1+ for RSC code paths» (Critical).
- `html-tailwind` (4.3): `text-balance`, `wrap-anywhere`, `bg-linear-to-*`, `motion-reduce:animate-none`, `min-h-11 min-w-11` для целей, в карточках `rounded-lg shadow-md` и `hover:shadow-lg`.
- `shadcn` (CLI 4): Sonner для тостов, Skeleton по размеру контента, `--dry-run` перед add.

**stack/ (дизайн-цикл):**
- PLAN (ui-ux-pro-max) → COMMIT (Anthropic `frontend-design`: «purpose, tone, constraints, differentiation… Avoid the three AI-slop defaults (cream + serif + terracotta; near-black + acid accent; hairline broadsheet)… Spend boldness in one signature element») → BUILD (shadcn MCP) → SEE IT (Playwright MCP: «a change you have not looked at is not finished») → REVIEW (подагент design-review).
- Design-review в 7 фаз: setup 1440; flows и состояния; responsive 375/768/1024/1440/1920; polish; WCAG 2.1 AA; robustness (длинные строки, пустые данные, медленная сеть); console/health. Вердикт Ship / Ship with fixes / Needs work.

### 2.4 Изображения
- `screenshots/website.png`: тёмно-синий герой с градиентным (синий → оранжевый) вордмарком «UI UX Pro Max / Design Intelligence», пилюли «Works with», стеклянная навигация-пилюля, ряд из 6 карточек со значком сверху и цифрами 57/95/56/8/24/29. Цифры устарели против текущих 88/192/74/22/25/34. По классификации taste-skill это почти полный набор признаков волн 1–2.
- `stack/examples/juniper-audit/screenshots/*`: сайт финансовой фирмы (засечки, «We are influential business owners.», гравюра дерева, синие полосы со статистикой 10+/20+/50+/100+). **79–90% высоты каждого полностраничного скрина — пустые полосы**, потому что reveal не сработал. README это признаёт. Сам аудит этот дефект не отметил, нашёл только фокус, цели касания и контраст.
- `preview/xiaomaomi-app.html` (без JS, рендер точный): китайское приложение ухода за котом. Fredoka/Nunito, оранжево-кремовые тона, карточки с иконками в тонированных квадратах. Нижний таб-бар перекрывает последнюю карточку ленты.
- `projects/*` (без стилей; описано по исходнику):
  - saas-landing: «Streamline Your Workflow Like Never Before», плавающая blur-пилюля навигации, три фичи, отзывы, три тарифа, градиентная CTA-полоса.
  - portfolio-dark: 17 градиентов, 5 backdrop-blur, 16 элементов rounded-2xl.
  - healthcare-dashboard: Fira Code/Sans, Chart.js.

### 2.5 Оценка качества
- **Сильное:**
  - База правил доступности и устойчивости текста — самая полная из трёх, на уровне WCAG 2.2: target size 24px в вебе отдельно от нативных 44/48, focus-not-obscured, accessible authentication, live-region для бейджей, отменяемые переходы, chip/label overflow.
  - Явный контракт поиска («не выдавать 0 результатов за данные»).
  - Свежие правила стеков с датами проверки и статусами deprecated.
  - Дневники разработки откровенны: «Passing tests concealed a router where 37 of 122 non-product keywords return zero hits»; пойманная выдуманная версия Astro.
- **Слабое:**
  - Эстетический слой — шаблонная «таксономия стилей» из трендов (glassmorphism, claymorphism, neumorphism как основные рекомендации).
  - Палитры — дефолты Tailwind, включая фиолетовые для медитации, ментального здоровья и настроения, хотя сам скилл называет «AI purple/pink gradients» анти-паттерном.
  - Тосты, тени карточек, spring/bounce, shimmer-скелетоны.
  - Внутренние нестыковки: quick-reference советует Heroicons/Lucide, а база иконок на Phosphor; stack ссылается на домен `web-vitals`, которого нет в SKILL; маркетинговый скрин со старыми цифрами.
  - Собственные демо — ровно тот «шаблон», против которого направлен taste-skill.
  - Пример аудита пропустил страницу, пустую на 80–90%.
  - Кириллице внимания не уделено.
  - Вспомогательные скиллы (логотипы, CIP, баннеры) к UI отношения почти не имеют и требуют внешних image-API.

---

## 3. motion-design-agent (soilmass/motion-design-agent, package 3.3.0, MIT)

### 3.1 Что это
Библиотека скиллов по моушен-дизайну: 86 папок скиллов и 63 файла токенов в формате W3C DTCG. В основе — Material Design 3 с перекрёстными ссылками на Fluent 2, Carbon и Apple HIG. Плюс Lottie-спека, WCAG 2.1, пресеты GSAP / Framer Motion / Remotion, шаблоны CSS, Lottie и Remotion. Версия 3.0 добавила «Narrative Intentionality Layer»: arc, intent, emotional journey, consequence, dramaturgy, attention path, microstate.

### 3.2 Структура и согласованность
- Версии расходятся: README говорит «v3.0.0 — 73 skills, 59 token files», SKILL.md — «44 token files», история версий в SKILL.md заканчивается на v2.1.0, package.json — 3.3.0. Фактически 86 скиллов и 63 файла токенов.
- **Битые ссылки:** нет 8 из 59 упомянутых reference-файлов (attention-patterns, film-techniques, blend-modes, gesture-implementations, optimistic-patterns, scrollytelling-patterns, kinetic-typography, micro-patterns). Упомянуты несуществующие скиллы `state-layer/`, `spring/`, `parallax/`, `shake/` и токен `figma-motion.tokens.json`.
- Платформенные множители противоречат друг другу: в `choice-resolution` Mobile 1.1× и Web 1.0×, в `motion-levels.tokens` mobile 1.0 и desktop 0.7.

### 3.3 Правила

**Базис M3 (корректные значения):**
- Easing: standard (0.2,0,0,1); emphasized-decelerate (0.05,0.7,0.1,1) — вход; emphasized-accelerate (0.3,0,0.8,0.15) — выход; linear — циклы.
- Длительности: short-1…4 = 50/100/150/200; medium-1…4 = 250/300/350/400; long-1/2 = 450/500ms.
- Пружины M3 Expressive: spatial (damping 0.9 — позиция, масштаб, поворот) со stiffness fast/default/slow = 1400/700/300; effects (damping 1.0, без overshoot — opacity, цвет, фильтр) = 3800/1600/800.
- Правило свойств: «DO NOT apply the same easing to all properties»; для opacity и цвета допустим linear.
- Выход примерно на 30% быстрее входа.
- Потолок UI-длительности: «Overly long durations (>600ms for UI)» — анти-паттерн; clamp 50–600ms для веба.
- Таблица соответствия M3 / Fluent / Carbon (кривые и длительности).

**Доступность (accessibility/, корневой SKILL.md):**
- Учитывать `prefers-reduced-motion`. Не мигать чаще 3 Гц. Pause/stop для автопроигрывания.
- «~35% of adults 40+ have vestibular dysfunction». Триггеры: параллакс, зум, вращение, подпрыгивание.
- Стратегия Remove / Reduce / Replace / Retain.
- Таблица фолбэков:

| Тип анимации | Reduced-вариант |
|---|---|
| Вход | Мгновенная opacity |
| Выход | Мгновенная opacity 0 |
| Hover/press | Opacity 0.9 |
| Загрузка | Статичное состояние |
| Ошибка (shake) | Рамка или цвет |
| Празднование | Простое затухание |
| Переход страниц | Cut или cross-fade |

- Длительности при reduce — 100ms.
- Всегда безопасны: opacity, цвет, рамка, длительность меньше 100ms, анимации по действию пользователя.

**Смысловой слой:**
- *Intent:* clarify / guide / confirm / warn / celebrate / reveal с множителями скорости и интенсивностью 0.4…1.0. «Never rely on motion alone for warnings». Связки guide→confirm, reveal→clarify, warn→guide, confirm→celebrate. Модификаторы: первый раз +15%, повторное действие −20% интенсивности и −15% длительности, фоновая задача −50%.
- *Emotion mapping* (модель Рассела): 13 эмоций с множителями. Calming 1.4× длительности, пружина damping 30 / stiffness 80; Celebratory 1.2× и 1.6× exaggeration; Focused — минимум. Контекст: «Repeat user −10%», «Reduced motion −50%», «Low power −20%».
- *Emotional journey:* состояния neutral / curious / engaged / focused / confused / frustrated / accomplished / delighted / anticipating и допустимые переходы, например engaged→focused («deep-work-entered → indicate») и frustrated→engaged («recovery-offered → guide»). Архетип «Deep Work Journey — minimal distraction».
- *Consequence:* direct 0ms; ripple 30ms на шаг, −15% на шаг; cascade 50ms; echo 200ms при 30%; branch; convergent. Конец цепочки: максимум 5 шагов, остановка ниже 0.1 интенсивности, у границы контейнера.
- *Narrative arc:* фазы Фрейтага с весами 15/25/15/25/20%. Пресеты micro 300ms (incident → climax → resolution), short 600, medium 1200, extended 3000. Типы концовок complete / open / cliffhanger / cyclical.
- *Dramaturgy:* сцены establishing 800 / development 1200 / confrontation 600 / resolution 500 / transition 300ms. Темпы measured / accelerating / decelerating / staccato / legato / rubato. Ансамбли unison / canon / call-response / wave.
- *Attention choreography:* F, Z, center-out (stagger 50ms), Гутенберг. Веса фокуса 1.0 / 0.6 / 0.3 / 0.1.
- *Microstate:* idle; hover +2% scale с 8% state layer, 100ms; focus 50ms; active −2%, 50ms; disabled 38%; loading 70% с циклом 1200ms; success — пружина 300ms; error — shake 400ms. Приоритеты: error прерывает; loading→success встаёт в очередь; hover и focus смешиваются.
- *Choice resolution:* recipe → emotion (×) → brand (ограничение: elegant и professional запрещают squash, частицы, bounce) → platform → clamp → accessibility (перекрывает всё). Порядок важности: «Accessibility > Everything; Brand > Emotion».

**Принципы Disney:**
- *Anticipation:* 15–25% длительности, движение в противоположную сторону. Уровни: micro 50ms / 0.98 / −2px, small 80 / 0.95, medium 120 / 0.90, dramatic 200, extreme 300. «Overuse — not every action needs anticipation».
- *Follow-through:* tight (30ms, overshoot 1.02) … elastic (1.25). «Keep under 1.2x for UI».
- *Secondary action:* вторичное — 30–50% первичного, третичное — 10–20%; не перебивать фокус.
- *Squash-stretch:* subtle 0.95/1.05 … expressive 0.70/1.30. Сохранять объём, тянуть вдоль движения.
- *Exaggeration:* subtle 1.1× … cartoon 2.5×. Микро-интеракции — subtle, празднования — dramatic.
- *Arc-motion:* дуги для физических объектов, броска, гравитации, «organic/character animation — limbs, eyes».

**Персонаж (character/):**

| Параметр | Значение |
|---|---|
| Моргание | 150ms, интервал 2–6 с, hold 50ms |
| Смена выражения | 200 / 400 / 800ms |
| Интенсивность выражения | 0.3 / 0.6 / 1.0 |
| Дыхание в покое | период 4 с, амплитуда 0.02 |
| Покачивание | период 3 с, 2 |
| Жесты | wave 600, nod 400, shake 500, point 300ms |
| Lip-sync | 50ms переход, удержание 80–200ms |

Reduced motion: моргание отключено или очень редкое, дыхание статичное или очень слабое, жесты мгновенные или отключены.

**Компонентные паттерны:**
- *Loading:* «Show something within 100ms»; меньше 100ms — ничего; 100–300ms — лёгкая opacity; 300ms–1 с — скелетон или спиннер; 1–10 с — прогресс; больше 10 с — прогресс и оценка времени. «Skeleton… reduces perceived load time by 30–40%» (без источника).
- *Empty states:* типы first-time / no results / cleared / error / offline. Иллюстрация 400–500ms, текст 200–300ms, цикл 2–3 с.
- *Notifications:* toast 3–5 с, вход 200–250ms, выход 150–200ms, ARIA.
- *Onboarding:* карусель 300–400ms, spotlight 400ms, тултип 200ms, обязательный skip.
- *Attention:* циклы subtle 2 с / moderate 1 с / urgent 0.5 с; «Don't auto-play indefinitely pulsing animations… Provide dismiss… Limit frequency».
- *Looping:* fast 1 с … ambient 8 с … cinemagraph 30 с; «Idle animation — motion that starts after inactivity».
- *UI micro:* press 100ms; toggle — пружина 200ms; tooltip 150ms; форма с ошибкой — «300ms bounce».
- *Component-animations:* card hover translateY(−4px) и тень; press scale 0.98; dragging scale 1.02 с поворотом 2°.
- *Entrance:* stagger 3–5 элементов по 50ms, 6–10 по 40ms, больше 10 по 30ms; весь список не дольше ~800ms.
- *Data-viz:* «Data Integrity… Object Constancy».
- *Scroll:* безопасно — fade, прогресс, липкие заголовки; небезопасно — параллакс, горизонтальный hijack, зум, 3D.
- *State-layer M3 (токены):* hover 0.08, focus/press 0.12, drag 0.16, disabled 0.38; ripple 450ms.
- *Focus-ring (токены):* 3px, offset 2px, контраст ≥3.
- *Скрим:* 0.32, вход 150ms, выход 100ms.
- *Motion-levels L1–L4:* выбор по пользователю, a11y, батарее (меньше 20% → simplified), GPU и частоте экрана (120 Гц → enhanced).

**Аудит (motion-audit/):**
- Чеклист по Disney, включая «Slow In/Out — proper easing (no linear)».
- A11y: вспышки не чаще 3 в секунду, пауза.
- Производительность: 60fps; transform и opacity; `will-change` экономно.
- Бренд: только токены.
- Уровни серьёзности Critical / Major / Minor / Enhancement. Частота: каждый PR, конец спринта, квартал.

### 3.4 Изображения
Нет. Есть Lottie-шаблоны (fade-in, loading-spinner, slide-up, success-checkmark) в JSON и Remotion-компоненты (FadeThrough, SharedAxis, StaggeredList, TitleCard, LowerThird).

### 3.5 Оценка качества
- **Сильное:**
  - Точные значения M3: кривые, длительности, пружины Expressive spatial/effects.
  - Правило «разные easing для разных свойств».
  - Таблицы reduced-motion по типам анимации.
  - Конкретные числа для персонажа (моргание, дыхание, выражения).
  - Слой «зачем движется» (intent) и порядок приоритетов, где доступность выше всего.
  - Пределы для follow-through и anticipation в UI.
- **Слабое:**
  - Это объём ради охвата (86 скиллов — от звука до Remotion и CIP-баннеров) с битыми ссылками и рассогласованными версиями.
  - Много числовых шкал, придуманных без источника: «эмоция → множитель», Фрейтаг в процентах для кнопки, «30–40%» для скелетона, «Rubato ±40%».
  - CSS-«аппроксимация пружин» через cubic-bezier грубая: «gentle spring» равен стандартной кривой M3, `linear()` не используется. При этом «spring bouncy» с overshoot 1.56 рекомендуется для успеха.
  - Ряд рецептов противоречит другим источникам и местами самому скиллу: hover-подъём карточек с тенью, «form error 300ms bounce», shimmer, тосты как основной канал обратной связи, «Slow In/Out — no linear» рядом с разрешением linear для opacity.
  - Нет данных о реальных сайтах — только пересказ дизайн-систем.

---

## 4. Сквозной синтез (только сами источники)

| Тема | taste-skill | ui-ux-pro-max | motion-design-agent |
|---|---|---|---|
| Overshoot / bounce | Запрещено на UI («19 stylesheets, ran on 2») | Spring предпочтителен; `back.out(1.4)`, `elastic.out` для магнитного hover | Spring bouncy для успеха; overshoot в UI до 1.2× |
| Кривые входа | expo- и quint-out (0.16,1,0.3,1 / 0.22,1,0.36,1) | Замедление на входе, ускорение на выходе | M3 emphasized-decelerate (0.05,0.7,0.1,1) |
| Выход против входа | ~70% | 60–70% | ~70% (на 30% быстрее) |
| Сколько двигается | Минимум 8 элементов на маркетинговой странице; в app-экранах только отклик | «Animate 1–2 key elements per view» | Каждое движение с intent; secondary 30–50% |
| Бесконечные циклы | «Infinite loops that mean nothing» — признак генерации | Только для загрузки | Attention-циклы с ограничениями, idle-анимации разрешены |
| Скелетоны | Без shimmer; серые бары реального размера | Shimmer sweep 1.2–1.6 с | Скелетон с shimmer |
| Тосты | Нет (ошибка в блоке, «Saved»-штамп) | 3–5 с, Sonner, `aria-live=polite` | 3–5 с, ARIA |
| Тени и glass | Запрещены (кроме того, что парит) | Glassmorphism и тени карточек — норма | Тени по уровням, glow-токены |
| Палитра | Без фиолетового и «кремовый + терракота» | Много `#7C3AED` | — |
| Прелоадер, гейт | Запрещены; первый кадр читаем, загрузка ≤1.2 с | Скелетон дольше 1 с | Индикатор с первых 100ms |
| Reduced motion | Готовая композиция; оставить opacity и цвет | Учитывать, финальное состояние читаемо | Remove/Reduce/Replace/Retain, 100ms |
| Цели касания | ≥44px на телефоне | 44pt / 48dp нативно, 24px веб (WCAG 2.2) | — |
| Проверка | Инспектор плюс критика скриншотов, ≤3 раунда | design-review в 7 фаз, Playwright | motion-audit, тесты Playwright и axe |

Во всех трёх совпадает: анимировать только transform и opacity; выход быстрее входа; движение должно нести смысл (причину и следствие); учитывать reduced motion; не перекрывать текст и фокус; проверять в реальном браузере на нескольких ширинах.

Расходятся главным образом в эстетике. taste-skill — это вкус галерейного маркетинга с жёсткими запретами. ui-ux-pro-max — это «каталог трендов» плюс сильная база доступности. motion-design-agent — переложение M3 с богатой, но во многом недоказанной надстройкой.

Насколько можно опираться на числа:
- Цифры taste-skill измерены на реальных сайтах, но оценивала их модель.
- Числа M3 в motion-design-agent корректны; его собственные «эмоциональные» коэффициенты не обоснованы.
- Правила ui-ux-pro-max по WCAG 2.2 и стекам датированы и проверяемы; эстетические рекомендации — нет.
