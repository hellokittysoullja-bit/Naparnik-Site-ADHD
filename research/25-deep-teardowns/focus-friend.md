# Focus Friend (by Hank Green) — глубокий разбор (15.11.2026)

**Как собирал.** Приложение только для телефона (iOS/Android), и без аккаунта и устройства вживую его не пройти. Поэтому разбор собран из:
- страниц App Store и Google Play (открывал сам через Playwright, 15.11.2026);
- официального FAQ сайта;
- 150 последних отзывов App Store (RSS);
- прессы и разборов (ссылки у каждого факта);
- шести скриншотов из App Store, которые я рассмотрел сам. Они лежат в `research/25-deep-teardowns/img/focusfriend-appstore-1…6.jpg`, склейка — `focusfriend-appstore-strip.jpg`.

Пометки:
- **(видел)** — видно на этих скриншотах или страницах магазинов;
- **(из описания)** — из источника по ссылке;
- **(не проверено)** — один источник, противоречия или нет подтверждения.

Короткая строка о Focus Friend уже есть в `research/24-product-teardown/A-adhd-apps-features.md` §16. Здесь — полный разбор.

---

## 1. Что это, для кого, платформы, история, авторы, масштаб

- **Что.** «A cozy, gamified focus timer» — уютный игровой таймер фокуса ([Google Play](https://play.google.com/store/apps/details?id=com.underthing.focus.friend), [сайт](https://www.yourfocusfriend.com/)). Подзаголовок в App Store — «ADHD-friendly Focus Timer» (видел, [App Store](https://apps.apple.com/us/app/focus-friend-by-hank-green/id6742278016)).
- **Механика одной фразой.** Пока ты фокусируешься, твой Боб (Bean) вяжет носки. Прервал — он «really really sad». Связанное идёт в валюту, на неё покупаешь декор для его комнаты.
- **Для кого.** «Perfect for anyone who struggles with long sessions of concentration. Focus Friend is for students and beyond.» (описание в магазинах).
- **Авторы:**
  - идея и лицо — Хэнк Грин (YouTube-канал Vlogbrothers, SciShow, Crash Course);
  - разработка — Honey B Games (издатель в Google Play; студия делала Boba Story). Продавец в App Store — B-Tech Consulting Group LLC, копирайт «© Underthing LLC» (видел, App Store);
  - по официальному FAQ, приложение сделал **один штатный разработчик — Bria** (Bria Sullivan в заголовке [Fast Company](https://www.fastcompany.com/91388304/focus-friend-app-store-hank-green-bria-sullivan); саму статью открыть не удалось), «with no outside funding» ([FAQ](https://www.yourfocusfriend.com/faq)).
- **Платформы:**
  - iOS и iPad: iOS 15+, 399,6 МБ, только английский, 9+ (видел, App Store);
  - Android 7+ (FAQ).
  - Версий для компьютера нет. По Headway, Windows и Mac «в разработке», синхронизации между устройствами нет ([Headway](https://makeheadway.com/blog/focus-friend-app-review/), не проверено).
- **История:**
  - тихий запуск в iOS в июле 2025 (дата выхода в App Store — 23.07.2025, iTunes Lookup);
  - в августе 2025 №1 среди бесплатных в App Store США после постов Хэнка и Джона Гринов ([TechCrunch 18.08.2025](https://techcrunch.com/2025/08/18/hank-greens-focus-friend-app-is-climbing-the-app-store-charts-and-its-extremely-cute); в тот день №4 среди всех бесплатных и №2 в «Продуктивности»; про №1 и «500K+ установок» по данным Appfigures — [HackerNoon](https://hackernoon.com/wtf-is-focus-friend-app-what-42-real-internet-people-think));
  - 18.11.2025 — **Google Play Best App 2025** и победа в «Best for Personal Growth» ([TechCrunch](https://techcrunch.com/2025/11/18/hank-greens-focus-friend-is-google-plays-app-of-the-year), [Android Central](https://www.androidcentral.com/apps-software/google-play-store/google-play-celebrates-its-best-of-2025-winners-for-apps-and-games));
  - текущая версия iOS — 1.28.3 (05.11.2026).
  - Награду App Store «Cultural Impact» из прошлого разбора подтвердить не удалось. В App Store у приложения есть значок **Editors' Choice** (видел) и подборки «Apps We Love», «Manage ADHD With These Helpful Apps».
- **Масштаб (подтверждённое):**
  - Google Play: **1M+ загрузок, 4,9★, 13,3K отзывов** (видел, 15.11.2026);
  - App Store US: **4,8★, ~10,4K оценок** (видел; iTunes Lookup — 10 406).
  - Разбор Deconstructor of Fun (23.02.2026): «crossed 2 million lifetime installs». Там же «early third-party reports suggest D30 retention exceeds 30 percent» — **(не проверено)**, источник не назван ([DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention)).
  - Оценки выручки (~$100K в месяц у Foundry, $150–350K у ScreensDesign) противоречат друг другу. **Не использовать.**

## 2. Знакомство (экран за экраном)

Своими глазами онбординг не видел. Известно из источников:
- **15 шагов знакомства** с повествованием: фокус подаётся как помощь Бобу. На ~0:54 показано, что телефон в руках сбивает Боба, и он роняет петли ([ScreensDesign](https://screensdesign.com/showcase/focus-friend-by-hank-green), видео по шагам; тексты не опубликованы).
- **Боба называешь сам** ([TechCrunch](https://techcrunch.com/2025/08/18/hank-greens-focus-friend-app-is-climbing-the-app-store-charts-and-its-extremely-cute)). Имена из отзывов: Philbert, Walnut, Billie Bean King; у Хэнка — кото-боб Gummybean ([Good Good Good](https://www.goodgoodgood.co/articles/hank-green-focus-friend)).
- **Пейвол в знакомстве «мягкий»**, без пробного периода: месяц, год, навсегда; выгоды — «3x socks», шарфы, премиум-декор ([ScreensDesign](https://screensdesign.com/showcase/focus-friend-by-hank-green)).
- **Аккаунт не нужен** ([Scary Mommy](https://www.scarymommy.com/lifestyle/hank-green-focus-friend-best-productivity-app)). Google Play: «No data collected», «No data shared» (видел).
- **Первая сессия** в видео ScreensDesign — 5 минут. По умолчанию стоит 15 минут фокуса и 5 минут перерыва ([Т—Ж](https://t-j.ru/focus-friend/), [ScreensDesign](https://screensdesign.com/showcase/focus-friend-by-hank-green)).

## 3. Навигация и структура

С главного экрана (видел, скриншот 5 — кухня с кото-бобом):
- **Сцена** — изометрическая комната Боба на голубом фоне с облаками. Камера смотрит сверху под углом.
- **Сверху счётчики** валют: носки (1792) и шарфы (577). Справа — значок звука.
- **Облачко-подсказка** с именем: «MARCELINE NEEDS HELP FOCUSING».
- **Внизу по центру** — деревянная табличка-кнопка **«FOCUS!»** с ростками сверху.
- **По углам** — иконки-предметы (видел на скриншотах 2 и 5). Слева: прилавок-магазин и что-то вроде статистики. Справа: стопка предметов (вероятно, инвентарь или редактор комнаты), горшок-боб с карандашом и шестерёнка. Точное назначение каждой иконки по скриншоту не установить **(не проверено)**. FAQ подтверждает кнопку «Edit Bean (looks like a Bean with a pencil)» и раздел Settings.
- **Разделы, известные из источников:**
  - **Настройка таймера:** ретро-циферблат «25 | 00 MINUTES» в виде голубого радиоприёмника (видел, скриншот 1) или ползунок ([ScreensDesign](https://screensdesign.com/showcase/focus-friend-by-hank-green));
  - **Экран фокуса** (см. §7);
  - **Перерыв:** «break: 00:05:12» поверх комнаты (видел, скриншот 4);
  - **Магазин декора;**
  - **Edit Bean** — выбор скина;
  - **Комнаты:** переключение между ними;
  - **Статистика фокуса** — «первая версия» вышла к январю 2026 (ответ разработчика в Google Play от 19.01.2026);
  - **Settings:** Restore Purchases, звук («Play Music When App is Closed»), Deep Focus и список разрешённых приложений.

## 4. Все функции — полный список

| Функция | Что делает | Где | Какую боль закрывает | Источник |
|---|---|---|---|---|
| Таймер фокуса (обратный) | 5–120 мин; по умолчанию 15 | Главная → FOCUS! | «Не могу начать / удержаться» | [Headway](https://makeheadway.com/blog/focus-friend-app-review/), [Т—Ж](https://t-j.ru/focus-friend/) |
| Таймер «на счёт вверх» (секундомер) | Для дел неизвестной длины; потолок 120 мин; по истечении сессия кончается сама — люди теряли носки за «лишнее» время | Настройка таймера | «Не знаю, сколько займёт» | Ответ разработчика в App Store («a stopwatch focus timer now»); отзывы Play 16.02.2026 и 16.09.2026; App Store 14.10.2026 («count up» за 2 часа выкидывал из приложения) |
| Перерывы (помодоро) | Отдельный таймер перерыва, длина настраивается, можно ставить длинный перерыв после 4 кругов; «Decorate on your breaks» | После фокуса | Отдых без ухода в ленту — тратишь его на декор | Описание в магазинах, [Т—Ж](https://t-j.ru/focus-friend/), отзыв App Store 09.11.2026 |
| Боб вяжет | Анимация вязания во время фокуса; «Don't interrupt me!» | Экран фокуса | Присутствие «кого-то рядом» и ответственность перед ним | Скриншот 6 (видел) |
| Прерывание | Остановил таймер раньше — вязание «распускается», Боб грустит, награды за сессию нет | Кнопка «STOP FOCUSING» | Мягкая цена отвлечения | [Т—Ж](https://t-j.ru/focus-friend/), [Headway](https://makeheadway.com/blog/focus-friend-app-review/), [DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention) |
| Окно 10 секунд | Включил по ошибке — 10 с выйти без последствий | Начало сессии | Нет наказания за случайный тап | [Т—Ж](https://t-j.ru/focus-friend/) (не проверено вторым источником) |
| Deep Focus Mode | Блокирует выбранные приложения через Screen Time (iOS) или аналог на Android; при включении доступны звонки, SMS, часы, настройки | Настройки / перед сессией | Рука сама открывает TikTok | Магазины, [TechCrunch](https://techcrunch.com/2025/08/18/hank-greens-focus-friend-app-is-climbing-the-app-store-charts-and-its-extremely-cute), [Т—Ж](https://t-j.ru/focus-friend/) |
| Список разрешённых приложений | В Pro — до 50 исключений; без Pro менять нельзя | Настройки Deep Focus | Нужна музыка или приложение учёбы | [Т—Ж](https://t-j.ru/focus-friend/), отзыв App Store 24.10.2026 |
| Режим без блокировки | Таймер можно запускать без Deep Focus — тогда телефон доступен | — | Аутичным людям и тем, кому нужен телефон для дела | Отзыв App Store 23.10.2026 |
| Live Activity | Прогресс таймера на экране блокировки (iOS) | Экран блокировки | Видно, сколько осталось, не открывая телефон | Магазины |
| Валюта «носки» | Даётся за завершённую сессию, больше за длинную; ~24–26 носков за 25 мин | После сессии | Конкретная плата за усилие | [Т—Ж](https://t-j.ru/focus-friend/) |
| Валюта «шарфы» | Только Pro: Боб вяжет и шарфы, за них премиум-декор | После сессии | — | [FAQ](https://www.yourfocusfriend.com/faq) |
| Магазин декора | «Hundreds of decorations», темы; ранний декор стоит сотни носков, поздний — тысячи (краска для стен на кухне — 2000) | Иконка магазина | Видимый прогресс | Магазины, [DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention), отзыв 29.10.2026 |
| Комнаты | Сначала спальня или офис, потом гостиная, кухня; разработчик пишет о «five rooms» | Переключение комнат | Новая цель, когда первая комната готова | [DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention), ответ разработчика в App Store |
| Живой декор | Купленная мебель анимирована по смыслу (диван, раковина) | Комната | Пространство «живёт» | [DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention) |
| Скины Боба | Coffee, Edamame, Pinto, Kitty (Kitt-ney) Bean, Hank Bean, John Bean, Jelly-наборы | Edit Bean | Самовыражение | Магазины, [App Pricing Lab](https://apppricinglab.com/app/apple/6742278016) |
| Музыка | Спокойный саундтрек от независимых музыкантов; можно оставить играть при закрытом приложении | Настройки → Sound | Фон для фокуса | [FAQ](https://www.yourfocusfriend.com/faq), отзыв Play |
| Статистика | «A first version of focus statistics» (январь 2026) | — | Видно, сколько наработал | Ответ разработчика в Google Play 19.01.2026 |
| Виджеты | В одной региональной записи об обновлении упомянута поддержка виджетов; в отзывах от 12.11.2026 просят виджет с таймером | — | — | **Не проверено**, противоречиво |
| Список дел | **Нет.** Просят: «I would REALLY… love if we could add a to-do list… earn socks for completing tasks» (04.11.2026) | — | — | RSS App Store |

## 5. Подкрепление и геймификация (подробно)

1. **Персонаж-заложник поведения.** Твой телефон в руке = Боб не может вязать. Описание: «If you interrupt your Bean by turning off the timer, they'll be really really sad.» По отзывам, работает именно вина-забота: «I REFUSE to make bean sad» (30.10.2026), «I'm not trying to break this little guys heart» (07.11.2026). Есть и обратное: «Not sad enough when you stop» (24.10.2026, 4★).
2. **Наказание мягкое.** Грусть и потеря награды за эту сессию. Накопленное не отнимается, Боб не умирает, комнату не разрушают. Слова «серия», «streak» в описаниях нет. Обзоры подчёркивают: «sad, never angry… a fresh start next time» (пересказ поисковой выдачи; первоисточник не открыт — не проверено). Отзыв Play: «It doesn't try to shame you if you do stop the timer — the little bean's life doesn't depend on it» (16.09.2026).
3. **Валюта, а не готовые призы** ([DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention), «Mechanic #1»):
   - человек сам выбирает, на что тратить;
   - награду легко масштабировать по длине сессии;
   - у разработчика есть рычаг экономики: дёшево в начале, дорого потом.
4. **«Вложи и вырази себя»** (DoF #2): комната становится твоим вкусом. Уйти из приложения = бросить мир, который ты обустроил (неприятие потери).
5. **Расширения** (DoF #3): новые комнаты дороже прежних. Это вехи на месяцы. Подтверждено отзывом: «Stopped using the app for awhile as I finished the one room, but so happy it expanded to more rooms!» (09.11.2026).
6. **Подписка ускоряет, а не обходит** (DoF #4): Pro даёт носки ×3 (по ScreensDesign и Т—Ж — «продуктивность втрое»), шарфы и премиум-декор.
7. **Живые реакции** (DoF #5): вяжет, отдыхает, грустит; декор анимирован.
8. **Магазин как «вторая игра».** Человек листает магазин вместо дела: «I also find myself scrolling endlessly through the things I can't afford… when I should be study[ing]» (11.11.2026); «I want to set timers just to set timers» (там же).
9. **Где ломается** (из отзывов):
   - **Ранний потолок контента:** «Philbert's room is fully decorated. So what now?» (App Store, 15.09.2025). Разработчик ответил, что добавляет гостиную.
   - **Поздняя дороговизна:** «it costs thousands of socks to get one item… very un motivating» (01.11.2026, 2★); «HOURS for PAINT… 2000 socks!! For PAINT!!!» (29.10.2026, 5★, с юмором).
   - **Новизна проходит:** «tried it once... and never launched it again» (Reddit, по [HackerNoon](https://hackernoon.com/wtf-is-focus-friend-app-what-42-real-internet-people-think)); Т—Ж: некоторые люди с СДВГ «запустили один раз и больше не открывали».
   - **Награда мимо дела:** «I use it instead as a reward for tasks that I usually avoid» (03.11.2026) — для кого-то это плюс.
10. **Что при выходе из фокуса** (сведено):
    - нажал «STOP FOCUSING» — сессия прервана, носков за неё нет, Боб грустит;
    - открыл заблокированное приложение — iOS его не пустит (Screen Time);
    - без Deep Focus — свернуть можно, по отзывам Android таймер продолжает идти в фоне ([HackerNoon](https://hackernoon.com/wtf-is-focus-friend-app-what-42-real-internet-people-think)).

    Есть 10-секундное окно на отмену ([Т—Ж](https://t-j.ru/focus-friend/)). Короткий звонок «обычно прощается» ([Headway](https://makeheadway.com/blog/focus-friend-app-review/)). Сколько именно секунд вне приложения допускается — **(не проверено)**.
11. **Лимиты:** таймер до 120 мин, обратный и вверх; список исключений до 50 приложений в Pro.

## 6. ИИ-функции

**Нет.** Ни в одном описании, обзоре и отзыве нет ИИ-функций. Фраза описания «Focus Friend will even help you with getting started on your tasks» относится к самому таймеру и персонажу, а не к дроблению дел. Хэнк Грин говорит о приложении как о возвращении людям контроля над вниманием: «It's about letting people be in control of their attention» (цитата по [Foundry](https://www.builtbyfoundry.io/blog/hank-green-focus-friend-app)).

## 7. Таймер и фокус — как устроено

- **До.** Нажал «FOCUS!» → выбираешь длину (циферблат «25:00 MINUTES» или ползунок), обратный отсчёт или вверх, по желанию Deep Focus. По умолчанию 15/5.
- **Во время** (видел, скриншот 6):
  - экран **затемняется в серый**: комната уходит в тень, остаётся только Боб в центре с вязальными спицами и клубком;
  - сверху мелкими капителями «DON'T INTERRUPT ME!»;
  - под Бобом крупный белый таймер «19:45»;
  - внизу красная кнопка «STOP FOCUSING»;
  - значок звука; играет спокойная музыка;
  - на iOS — Live Activity на экране блокировки.
- **После:** носки (и шарфы в Pro) → перерыв «break: 00:05:12» поверх светлой комнаты (скриншот 4). В перерыве предлагается декорировать. Как выглядит экран итогов — **(не проверено)**: ScreensDesign его не описал.
- **Счёт времени:** по отзывам, люди используют приложение и как учёт: «a straightforward way to track how long I'm spending on tasks, split my tasks into manageable portions» (07.11.2026).

## 8. Оформление

**Видел сам (скриншоты App Store):**
- **Стиль** — уютный изометрический «cozy game», как у Animal Crossing или Unpacked. Мягкие контуры, тёплая палитра: персиково-розовые фоны, голубое небо с облаками, светлое дерево, зелень растений, клетчатый коврик.
- **Персонаж.** Коричневая фасолина с росточком из двух листиков на макушке. Тело-капсула, короткие ножки и ручки. Лицо — две точки-глаза и улыбка. Обводка тёмно-коричневая, плоская заливка с лёгкой текстурой. На экране фокуса держит две спицы и клубок шерсти.
- **Скины** — кошачьи варианты: трёхцветная кошка у кухонной раковины (скриншот 5), рыже-белая за столом (скриншот 4).
- **Шрифт** — жирный, с засечками и рукописным налётом, тёмно-бордовый на маркетинговых экранах («Stay Focused», «Earn Decorations»). В интерфейсе — капители на белых пилюлях («MARCELINE NEEDS HELP FOCUSING»).
- **Кнопки-предметы** вместо обычных иконок: табличка «FOCUS!», прилавок, горшок. Таймер в виде радиоприёмника.
- **Экран фокуса** — монохромный серый, минимализм. Нет ни одного лишнего элемента.

**Из описаний:**
- «calm visuals with no flashing or aggressive alerts» ([Foundry](https://www.builtbyfoundry.io/blog/hank-green-focus-friend-app));
- все песни, иллюстрации и анимации сделаны независимыми художниками за честную оплату ([FAQ](https://www.yourfocusfriend.com/faq));
- анимации: вязание, отдых, грусть, анимированный декор ([DoF](https://www.deconstructoroffun.com/blog/hay-day-with-a-to-do-list-how-focus-friend-cracked-productivity-retention)).

**Не проверено:** звуки наград, хаптика, выражения лица при грусти. Ни один источник их не описывает.

**Мнение одного человека о вкусе:** «a little too corny and millennial twee for my personal tastes… bean puns and the hank green references don't do it for me» (27.10.2026, 4★).

## 9. Тексты и тон (примеры)

- **Магазины:**
  - «When you Focus, your Bean Friend will Focus.»
  - «If you interrupt your Bean by turning off the timer, they'll be really really sad.»
  - «Stay Focused, Have Fun, Drink Water, and Don't Forget to be Awesome~» — отсылка к прощанию Vlogbrothers «Don't forget to be awesome».
- **В интерфейсе** (видел): «DON'T INTERRUPT ME!», «MARCELINE NEEDS HELP FOCUSING», «STOP FOCUSING», «FOCUS!», «break:».
- **Маркетинг:** «Stay Focused — With Your New Bean Friend», «Earn Decorations — The more you focus, the more you can decorate», «Block Apps — Limit Distractions», «Focus & Break Timers».
- **Каламбуры:** Hank Bean, John Bean, Kitt-ney Bean, Jelly Bean.
- **Хэнк о продукте** ([Good Good Good](https://www.goodgoodgood.co/articles/hank-green-focus-friend)):
  - «It's an app that installs a bean on your phone. And the bean really wants to spend more time knitting.»
  - «The app is about giving people their time back.»
  - «What would we need your data for?!»
- **Ответы разработчика** тёплые, со смайликом «:)».

## 10. Уведомления, виджеты

- **Live Activity** — есть (iOS).
- **Пуш-уведомления.** В последнем обновлении 1.28.3 «Bug fixes for notifications and timers» (видел, App Store). Значит, уведомления есть, но о чём они — **(не проверено)**. Возможно, об окончании таймера или перерыва.
- **Виджеты** — противоречиво: одна запись об обновлении упоминает поддержку, отзыв от 12.11.2026 просит виджет с таймером на домашнем экране **(не проверено)**.
- **Напоминаний «вернись к Бобу»** в источниках нет **(не проверено)**.

## 11. Монетизация

- **Бесплатно, без рекламы.** Хэнк: «very much trying to be an ad-free experience because the mobile ad ecosystem kinda blows» ([TechCrunch](https://techcrunch.com/2025/08/18/hank-greens-focus-friend-app-is-climbing-the-app-store-charts-and-its-extremely-cute)). Разработчица предлагала рекламу — Хэнк отказался ([Good Good Good](https://www.goodgoodgood.co/articles/hank-green-focus-friend)). «That doesn't break the app. It's not like it closes down if you don't pay for it.»
- **Цены (App Store US, срез 17.07.2026, [App Pricing Lab](https://apppricinglab.com/app/apple/6742278016)):**
  - Focus Friend Pro Monthly — $3,99;
  - Yearly — $19,99;
  - Lifetime — $39,99;
  - Welcome Offer — $29,99;
  - скины: Kitt-ney, Pointed Kittney, Tabby Kittney — по $4,99; Blue Jello Bean — $2,99; Base Bean Pack — $3,99; Jelly Bean Pack — $5,99.

  На запуске цены были ниже: $1,99 в месяц, $14,99 в год, $29,99 навсегда ([Foundry](https://www.builtbyfoundry.io/blog/hank-green-focus-friend-app); Her Campus — по пересказу выдачи). В России — от 199 ₽ в месяц, скины от 249 ₽ ([Т—Ж](https://t-j.ru/focus-friend/)).
- **Что даёт Pro:** носки ×3, шарфы, премиум-декор, свой список разрешённых приложений (до 50).
- **Зачем подписка, со слов FAQ:** «Ad-free; Privacy-first; Artist-supported; Sustainable: …one full-time developer (Bria), with no outside funding».
- **Трения:**
  - «Pro is haunting me… every other pop-up is about it» (22.10.2026, 3★);
  - «Deceptive Sale»: в ролике Хэнка lifetime стоил $30, а в приложении $40. Цену поправили за 2 часа (21.10.2026);
  - «There shouldn't be a subscription» (12.11.2026, 1★);
  - пропадают купленные скины (01.11.2026) — для этого в FAQ есть пункт «Restore Purchases».

## 12. Отзывы — что хвалят и что ругают

**Распределение** 150 последних отзывов App Store US (RSS, до 15.11.2026): 123 — 5★, 16 — 4★, 6 — 3★, 1 — 2★, 5 — 1★.

**Хвалят:**
- **Работает при СДВГ:**
  - «I have ADHD and this has been helping so much» ([HackerNoon](https://hackernoon.com/wtf-is-focus-friend-app-what-42-real-internet-people-think));
  - «I tried the Pomodoro method before, and it didn't quite work for me. It didn't feel rewarding… With the Focus Friend… there are very cute little rewards» (30.10.2026);
  - «This game literally uses my addiction against me» (06.11.2026).
- **Без стыда:**
  - «It's not something I use every day but it doesn't make you feel guilty for that» (08.11.2026);
  - «It doesn't try to shame you if you do stop the timer» (Play, 16.09.2026, 118 человек отметили полезным).
- **Без рекламы и слежки:** «You are not the product, the app is.» (07.11.2026).
- **Блокировка:** «Once I turned focus mode on, I finally felt compelled to not just randomly click through each of the apps on my phone for quick stims» (30.10.2026).
- **Пресса:**
  - The Verge: «Focus Friend swapped my screen time for bean time» (заголовок, [копия](https://pipedot.org/6ZFAX));
  - Editors' Choice App Store: «Your focusing Bean can help you reclaim your days, one knitted sock at a time» (видел);
  - Google: «helpful and cute app» ([TechCrunch](https://techcrunch.com/2025/11/18/hank-greens-focus-friend-is-google-plays-app-of-the-year)).

**Ругают:**
- **Экономика:** долго копить, дорогой поздний декор (см. §5.9).
- **Мало контента** на старте и «что дальше, когда всё обставил».
- **Подписка и всплывающие окна Pro**, путаница с ценой.
- **Без Pro нельзя настроить исключения.** Без Deep Focus «толку мало» ([Т—Ж](https://t-j.ru/focus-friend/)). «I wish it would actually restrict apps» (08.11.2026).
- **Технические сбои:**
  - Deep Focus не блокирует, если раньше нажал «Ignore for Today» в лимитах iOS; конфликт с Opal и Forest; Safari не блокировался ([FAQ](https://www.yourfocusfriend.com/faq));
  - «count up» после 2 часов выкидывал из приложения (14.10.2026);
  - потеря носков — исправлено в последнем обновлении Play: «Bug Fix for some focus sessions losing socks».
- **Просьбы:**
  - список дел с наградой за задачи;
  - виджет;
  - подробная статистика по предметам и неделям (Play, 09.10.2025, 519 «полезно»);
  - больше выражений лица и одежды Бобу.
- **Не для всех:** только английский; «twee»; «cute idea, I guess» (Reddit, по HackerNoon).

## 13. Что взять Напарнику и что не брать

Сверено с красными линиями `CLAUDE.md`: без стыда, без сгорающих серий, без тёмных паттернов, без toast-уведомлений, кот — единственный персонаж.

**Брать (функция → экран):**

| # | Что | Куда у нас | Как сделать по-своему |
|---|---|---|---|
| 1 | **Экран фокуса гаснет до одного персонажа и цифр.** Комната уходит в серое, остаются Боб, таймер и одна кнопка. | Фокус (`components/focus-session.tsx`), фаза `running` | Сцена /app притухает, остаётся кот у кольца. Кот не вяжет, а «сидит рядом» (наша метафора присутствия, не труда). Проверить коридор светлоты фона (§3 CLAUDE.md). |
| 2 | **Валюта вместо готового приза** — свобода выбора и рычаг экономики. | Мир (`components/island.tsx`): то, что даёт старт, человек сам кладёт на остров (выбирает ориентир или постройку) | Валюта — «искры» или «угольки» костра, не носки. Цены растут медленно. Главное — **первые покупки сразу**: у них ругают «тысячи носков за предмет». |
| 3 | **Расширения как новые горизонты** (новые комнаты стали поводом вернуться). | Мир: новые участки острова или новый берег открываются по суммарному числу стартов | Открытие — «пик» (Peak-End, `reveal-island.tsx`). Заранее видна дымка следующего участка (Зейгарник). |
| 4 | **Отдых тратится на «украсить мир»**, а не на ленту. | Финал сессии и перерыв: «Пока отдыхаешь — посадим что-нибудь?» | Только по желанию, одна кнопка, без таймера давления. |
| 5 | **Таймер «на счёт вверх»** для дел неизвестной длины. Самая частая просьба их пользователей. | Фокус: длительность «Сколько получится» | Без потолка-обрыва: у них сессия обрывалась на 120 мин, и люди теряли награду. У нас — мягкий вопрос кота на 90-й минуте: «Ещё сидим?» |
| 6 | **Окно отмены 10 секунд** без последствий. | Фокус, фаза `starting` или первые секунды `running` | «Передумал? Ничего не считается.» Хорошо ложится на «прощающий» тон. |
| 7 | **Прерывание без потери накопленного.** Нет серий, нет смерти, только эта сессия. | Фокус: «Закончить раньше» | У нас ещё мягче: **недосиженное засчитывается как старт** (философия «старт = победа»). Кот не грустит, а говорит «Начал — уже считается». Грусть не берём (см. «не брать»). |
| 8 | **Скины персонажа как платный слой.** Цена $2,99–5,99, отдельно от подписки. | Будущий магазин | **Кот один** (правило эталонов): никаких других котов. Платить можно за предметы рядом с котом (шарф, плед, фонарь у костра) или за вид острова — после согласования с владельцем. |
| 9 | **Музыка фокуса**, которую можно оставить играть при свёрнутом сайте. | Фокус, `lib/ambient.ts` (звук костра) | Звук костра есть. Добавить выбор «костёр / дождь / тишина», состояние в памяти. |
| 10 | **Честная записка «почему мы берём деньги».** Их FAQ «один разработчик, без инвесторов, художникам платим» гасит злость на подписку. | Будущий пейвол и `/terms` | Своим голосом, коротко; одна модель цены, без «скидки, которая не совпала с роликом». |
| 11 | **Статистика с разбивкой по сферам** — просили 519 человек. | Мир или отдельная карточка | У нас уже есть сферы (Учёба / Работа / Дом). Показывать «часы у костра по сферам за неделю» без сравнения «хуже прошлой недели». |
| 12 | **Связать награду с делом, а не только со временем** — то, чего у них нет и что просят. | Это наше преимущество: дробление → шаг → сессия → остров | Подчеркнуть в маркетинге: «Кот не просто ждёт, пока ты не в телефоне, — он помогает начать». |

**Не брать — и почему:**
- **Грусть персонажа как рычаг** («they'll be really really sad», «I REFUSE to make bean sad»). Это мягкая, но всё же вина. Работает на части людей, но нарушает принцип «без стыда и вины». У людей с СДВГ и тревожностью подкрепляет самобичевание. Кот Напарника при раннем выходе тёплый, не печальный.
- **Награда только за полное досиживание** («session's rewards are gone»). У нас награда за старт.
- **Блокировка приложений** (Deep Focus). Мы веб-сайт, Screen Time API нам недоступен. Обещать нечего, и в отзывах это главный источник багов.
- **Растущая до тысяч цена предметов и ускорение ×3 за подписку.** «Pay to progress faster» прямо создаёт ощущение «бесплатно — медленно», а отзывы ругают затянутость. Если платный слой — то косметика, не скорость.
- **Частые всплывающие предложения Pro** («every other pop-up is about it»). Пейвол — в одном месте и в голосе кота, если вообще.
- **Каламбуры и отсылки к автору** (Hank Bean) — у нас нет медийного лица, и этот тон часть людей отталкивает.
- **Изометрическая «комната с мебелью» как прямая копия.** У нас остров, который растёт, — своя метафора. Комнату не копировать.
- **Отсутствие списка дел** — не повторять их пробел. Наш кот сам помогает раздробить дело.
- **Только английский и 400 МБ приложения.** Наше преимущество — русский язык и мгновенный веб без установки.

---

**Источники, которые не открылись:**
- Fast Company — 403;
- The Verge — недоступен инструменту, использована копия на pipedot;
- полная история версий в App Store;
- точные тексты онбординга (у ScreensDesign они только в платном видео).
