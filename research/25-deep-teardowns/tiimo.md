# Tiimo — полный разбор (15.11.2026)

Исследователь: агент-исследователь, сеанс 15.11. Источники открыты в этот день. Скриншоты — `img/tiimo-appstore-1…7.jpg`
(рекламные кадры App Store) и `img/tiimo-appstore-page.png` (страница App Store).
Как читать: «видел сам» — описываю то, что видел на скриншотах; «по описанию» — пересказ текстов компании;
«(не проверено)» — подтверждения не нашёл. Аккаунт не создавал, внутрь приложения не заходил. Сайт tiimoapp.com
в headless-браузере закрыт окном согласия на cookie — снимки сайта не годились и удалены, тексты страниц сняты.
Reddit закрыт для автоматических запросов (403) — прямых цитат с r/ADHD нет.

Короткий вывод для Напарника — в разделе 15.

---

## 1. Что это, для кого, платформы, история, компания, масштаб

- **Что это.** Визуальный планер дня: день как цветная лента карточек с иконками, список дел, фокус-таймер, ИИ-помощник
  «Co-Planner», трекер настроения. Позиционирование 2026 г.: «A visual AI planner built for real life»
  ([главная](https://www.tiimoapp.com/)), «Your AI planning partner that simplifies executive function»
  ([App Store](https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328)).
- **Для кого.** Люди с СДВГ и аутизмом и «anyone who needs flexible structure»; «Do I have to be neurodivergent? Nope!»
  ([главная](https://www.tiimoapp.com/)). Есть сценарий семьи: до 5 профилей, родители следят за детьми (App Store,
  отзыв «able to be monitored by my parents», 11.2026).
- **Платформы.** iOS, iPadOS, watchOS, Android, Mac, веб ([FAQ](https://www.tiimoapp.com/faq)). Веб-планер — только в
  платной версии. Android перезапущен в 2026 г. («Tiimo for Android is back!», главная).
- **Компания.** Tiimo A/S, Фредериксберг (Копенгаген), Дания ([подвал сайта](https://www.tiimoapp.com/)). Основательницы —
  Helene Lassen Nørlem и Melissa Würtz Azari (у Azari — СДВГ); год основания в источниках расходится: 2015 или 2016
  ([tech.eu](https://tech.eu/2024/08/28/neurodivergent-focused-app-tiimo-secures-16m-in-funding-round/),
  [sifted](https://sifted.eu/articles/tiimo-planning-app-for-neurodivergent-people)). В App Store — с октября 2019 г.
  ([iTunes API](https://itunes.apple.com/lookup?id=1480220328&country=us)).
- **Деньги.** Посевной раунд ~€3 млн (2022), раунд $1,6 млн в августе 2024 г. (Crowberry Capital, People Ventures, Inner
  Foundations); всего ~$4,8 млн до раунда A ([tech.eu](https://tech.eu/2024/08/28/neurodivergent-focused-app-tiimo-secures-16m-in-funding-round/),
  [tiimoapp.com](https://tiimoapp.com/resource-hub/tiimo-raises-4-8m-neurodivergent-planner)).
- **Масштаб (заявленные цифры, разные даты).**
  - Август 2024: 50 000 платящих подписчиков (больше ¾ — нейроотличные) и 500 000 бесплатных пользователей
    ([tech.eu](https://tech.eu/2024/08/28/neurodivergent-focused-app-tiimo-secures-16m-in-funding-round/)).
  - Ноябрь 2026, App Store: «4+ Million downloads», «Join 1+ million users»; на сайте одновременно «Over half a million
    people use Tiimo» — сайт не обновлён, цифры противоречат друг другу ([App Store](https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328),
    [главная](https://www.tiimoapp.com/)).
  - Оценка в американском App Store **4,6 из 5 по ~21 600 оценкам**; «Editors' Choice»
    ([iTunes API](https://itunes.apple.com/lookup?id=1480220328&country=us)).
  - Награды: **iPhone App of the Year 2025** (App Store Awards), финалист Apple Design Awards 2024, «Best Assistive
    Technology 2022» (Neurodiversity Awards) — по описанию в App Store.

## 2. Знакомство (onboarding)

Полного публичного прохода экран-за-экраном я не нашёл (и в прошлых сеансах — `research/03-onboarding-conversion-mobbin-growthdesign.md`
§3.9 и `research/09-ideal-onboarding/` пишут то же: у Tiimo публичны лишь отдельные экраны). Что известно:

- После регистрации — карточка **«Get started — 3 QUICK STEPS»**: «New to planning? Getting started with a new planner
  doesn't have to feel overwhelming. Let's start with these simple steps» — пункты «Plan a daily check-in», «Enable
  reminders» (экраны Mobbin, пересказ в `research/03-…` стр. ~498).
- **Готовые задачи-примеры**: отзыв 11.2026 «First I had to get rid of the stupid reminders to wake up, brush my teeth and
  take a shower» — то есть новый профиль приходит с шаблонной рутиной (App Store RSS, раздел 13).
- **Просьба об оценке слишком рано**: «During onboarding this app asks for a review, before I've gotten any value out of it
  at all» (10.2026); «literally… four minutes and then asked twice to review it» (11.2026); «Zero stars for continuing to
  ask me how I like an app, in the first hour» (10.2026).
- **Пейвол в конце знакомства с пробой**: 7 дней бесплатно только на годовом плане; месячный — списание сразу
  ([FAQ](https://www.tiimoapp.com/faq)); отзыв: «you force me into a week trial… that will charge me over $50 bucks if I
  forget, or I'd have to pay $14 for one month with no free trial» (10.2026). Экран пейвола (по Mobbin, `research/03`):
  «Change how you plan, change how you live», Monthly / Yearly «MOST POPULAR», «7 day free trial», отзыв «Life-changing…»,
  «No commitment. Cancel anytime.».
- В `research/15-product-science/traffic-attachment.md` записано «у Tiimo 14 шагов» без ссылки — **(не проверено)**.
- Что спрашивают на шагах (цели, диагноз, время подъёма и т. п.) — **(не проверено)**.

## 3. Навигация и структура

По FAQ ([tiimoapp.com/faq](https://www.tiimoapp.com/faq)) и рекламным кадрам (видел сам):

- Нижняя панель из 5 значков (кадр 3): чек-бокс (To-do), календарь «31» (расписание/Schedule), круг (таймер/фокус —
  моё предположение), столбики (статистика/Insights), круглый аватар-сфера справа (вызов Co-Planner — предположение,
  не проверено). FAQ подтверждает: «Schedule tab (the 2nd tab)» на Android и «Me tab (the 4th tab)» на iOS — значит,
  порядок вкладок на платформах различается.
- **Расписание (Today)**: заголовок дня «Tuesday», полоса недели, дальше группы **ANYTIME / MORNING / DAY / EVENING** со
  счётчиками; в каждой карточки задач: круглая иконка-картинка, название, время «8.00 → 8.30», кружок-отметка справа
  (видел сам, кадры 1 и 3). Отзыв 11.2026: в бесплатной версии группы «утро/день/вечер» заменили на одно «ANYTIME» —
  человек недоволен.
- **To-do** — список «brain dump» с приоритетами руками или ИИ, перетаскивание в день ([главная](https://www.tiimoapp.com/)).
- **Me / Settings** — профили (несколько на один аккаунт), подписка, язык, шрифты, звуки.
- **Веб-планер** — неделя/день, чат с Co-Planner сбоку ([AI-страница](https://www.tiimoapp.com/product/ai-planning)).
- Дополнительно: курсы («Neuroinclusive Courses»), «Community Hub», статистика («Personal insights») — по описанию App Store.

## 4. Все функции

| Функция | Что делает | Где | Для какой боли | Источник |
|---|---|---|---|---|
| Визуальное расписание | День лентой цветных карточек с иконками, перетаскивание; группы по частям дня | Вкладка расписания | «Время скользит», нужна видимая структура | App Store, кадры 1,3 |
| Co-Planner (ИИ) | Голосом/текстом «что в голове» → задачи, шаги, длительности, раскладка дня; правки разговором («опаздываю», «мало сил») | Чат-экран (тёмный), веб | Паралич старта, перегруз решений | [AI-страница](https://www.tiimoapp.com/product/ai-planning) |
| To-do | Свалка дел, «AI priority grouping», перетаскивание в день | Вкладка To-do | «Всё в голове» | App Store |
| Фокус-таймер | Обратный отсчёт с кругом, музыка, «+5», пауза; Live Activity | Из задачи | Слепота ко времени, переходы | Кадры 4, 6 |
| Чек-листы шагов | Шаги внутри задачи («AI checklists») | Карточка задачи / таймер | Дробление | Подвал сайта, research/24 |
| Иконки и цвета | «3,000+ colors and custom icons»; ИИ сам подбирает эмодзи | Создание задачи | Личная визуальная система | [features](https://www.tiimoapp.com/features); отзыв 11.2026 |
| Настроение и рефлексия | Отметка настроения, обзор дня, «Morning check-in — How am I feeling? What are today's plans?» | Чек-ин | Энергия, закономерности | Главная; research/03 |
| Напоминания | До / в начале / на половине / по окончании активности; «persistent alarms» | Настройки задачи | Забывание, переходы | Кадр 4; research/03 |
| Виджеты, Live Activities, Dynamic Island, Apple Watch | Текущее и следующее дело без открытия приложения; таймер на экране блокировки | Система | «Не открывать приложение лишний раз» | [features](https://www.tiimoapp.com/features), кадр 4 |
| Синхронизация календарей | Apple Calendar и Reminders, Google, Outlook | Настройки | Всё в одном месте | App Store, FAQ |
| Профили | До 5 профилей семьи; новый профиль = «начать заново» | Me → Settings | Семья, перезапуск | FAQ |
| Награды за прогресс | Коллекция цветных шаров-«сфер» (кадр 6: «while getting rewarded for your progress»); конфетти/фейерверк при отметке (см. раздел 5) | После выполнения | Подкрепление | Кадр 6; отзывы |
| Музыка «Tiimo Town» / «Lo-fi beats» / «tune-in» | Плейлисты для фокуса | Таймер | Звуковой фон | Кадр 6; отзывы 10–11.2026 |
| Шрифт для дислексии | Переключается в настройках | Customization | Доступность | Отзыв 10.2026 |
| Курсы, сообщество, статистика | «Neuroinclusive Courses», «Community Hub», «Personal insights» | Отдельные разделы | Психообразование | App Store |
| Tiimo for work / for coaches | Партнёрские программы | Сайт | B2B | Подвал сайта |

Чего больше нет: **рутины** как отдельная функция — отзыв 11.2026: «stopped using when they removed routines… found a big
part of the app is now an AI chatbot» (при этом AI-страница обещает «assistant for routines» — противоречие, не проверено).

## 5. Подкрепление и геймификация

- **Конфетти/фейерверк и хаптика при отметке**: «provides encouragement by way of haptics and confetti!» (10.2026); «Liked
  the fireworks !!» (10.2026); при этом другой отзыв 10.2026: **«What happened to the confetti???… Now it's gone»** — эффект
  убрали или он сломался, и это разозлило человека («an acknowledgment of effort and helped me stay motivated»). Третий
  отзыв называет то же «childish cheering when I do something» (11.2026). Вывод: одно и то же празднование одних
  радует, других раздражает.
- **Сферы-награды**: рекламный кадр 6 «Stay organized & focused — While getting rewarded for your progress» — ряд
  переливающихся шаров с разными фактурами (мрамор, градиенты, полосы). Как именно они выдаются (за число задач, за дни) —
  (не проверено).
- **Серии (streaks) с трофеями** — указаны на старой странице функций (`research/24-product-teardown/A-adhd-apps-features.md` §1,
  ссылка [tiimoapp.com/features](https://tiimoapp.com/features)); на текущей странице функций слова «streak» нет —
  возможно, переименовано в сферы (не проверено).
- **Статистика**: «I completed 94 tasks» — отзыв в описании App Store; «Personal insights: Stats that support your growth».
- **Персонажа-питомца нет.** Есть «голос» ИИ в чате с эмодзи («Hi Lily! 💛», «Alright, here you go 👐»).
- **Пропуск.** По сторонним обзорам — без наказания: «Tiimo does not punish unfinished tasks» (по выдаче поиска, обзоры
  [anygen](https://www.anygen.io/showcase/tiimo-review/index.html) — не открыт, не проверено); «zero shame mechanics
  anywhere» ([Selfpause](https://www.selfpause.com/resources/tiimo), конкурент, не проверено). На экранах Mobbin у каждой
  задачи чип **«Reschedule →»** — перенос в одно касание (`research/03`).

## 6. ИИ-функции (Co-Planner)

По [AI-странице](https://www.tiimoapp.com/product/ai-planning) и рекламным кадрам 2 и 5:
- «Empty your brain, Tiimo sorts it out» — свободный текст/голос → задачи с временем.
- «Plans changed? Just tell Tiimo… Running late or low on energy? Your co-planner reshuffles the day for you».
- «Decision-making on autopilot» — подсказывает, что делать сейчас.
- «Never guess time again» — оценка длительности каждого шага.
- «Break big tasks into doable steps — From packing for a trip to writing a paper».
- Пример диалога (кадр 5, видел сам): ИИ: «Hi Lily! 💛 I've got today's steps ready. First, how's your energy right now?
  Then, we'll choose our first simple task.» Человек: «Thanks. I need to call my mom, eat breakfast, bike to work and pick
  up my kids in the afternoon.» ИИ: «Alright, here you go 👐» → карточки «Call mom — Anytime • 25 min», «Breakfast 07:00 →
  07:30», «Bike to work 08:00 → 08:20», «Pick up kids 03:00 → 03:30».
- **Ограничения**: бесплатно — «limited AI chats»; Pro — «Unlimited AI planning» (App Store, баннер на сайте). Модель/
  поставщик не раскрыты (не проверено).
- **Жалобы на ИИ** (App Store, 10–11.2026): «The AI is incapable of this and is a bit buggy… unable to update task
  durations given sub-task durations. I've had more success & less friction with Claude»; «I spent 30 mins trying to get a
  reasonable morning plan. I had to keep having them do it over and over» (терапевт с СДВГ); «argued with AI to fix its
  mistakes»; «having AI choose the emojis for me — some of them just didn't make sense».

## 7. Дробление задач и планирование

- Дробление делает ИИ (Co-Planner) или человек — шаги-чек-лист внутри задачи; каждый шаг с оценкой времени. Отдельной
  кнопки «ещё мельче» на шаге не нашёл (не проверено).
- Планирование: задачи с временем («07:00 → 07:30») или «Anytime» с длительностью без времени. Длительность без времени
  появилась после просьб пользователей ещё в 2021 г. — ответ разработчика в App Store: «introducing the option to give an
  activity a duration only. You can start the activity when it fits you, pause it and resume» (видел на странице App Store).
- Перепланирование разговором («сдвинь всё на 10 минут») и чипом «Reschedule →».
- «Why flexible planning works: Planning systems don't fail because you're lazy, they fail because life changes… You don't
  need a perfect routine, just one you can return to» ([features](https://www.tiimoapp.com/features)).

## 8. Таймер и фокус

- **Как выглядит (кадр 6, видел сам)**: светлый экран, сверху «Lo-fi beats» и значок; заголовок задачи «Laundry» с
  временем «09.00 → 09.30»; в центре большой круг с объёмной иллюстрацией (корзина с бельём), вокруг — сиреневая дуга
  убывающего времени с искорками на конце; под кругом крупно «04:50»; ниже «+5» (добавить 5 минут) и чёрная пилюля
  паузы. Кадр 7 (часы): тот же круг на Apple Watch.
- **Live Activity / экран блокировки (кадр 4)**: плашка «Focus time 14.56» с круглой иконкой и кнопкой паузы.
- **Режим «15 min activity — 14:53 Paused»** — мягкий большой круг (Mobbin, `research/03`).
- Длительности: от 5 до 120 минут; можно записать посторонную мысль, не останавливая таймер (по выдаче поиска,
  [educationalappstore](https://www.educationalappstore.com/app/tiimo) и др. — не открыты, не проверено).
- **После**: напоминание «по окончании» (настраивается); отзыв жалуется, что «alarms ringing after a task is cleared is
  really annoying» и отметка «сделано» иногда сама снимается (10.2026). Что показывается после сессии — (не проверено).
- Сайт: «Watch time pass with a countdown that keeps you anchored. Whether you need help starting, switching tasks, or
  staying in the zone» ([главная](https://www.tiimoapp.com/)).

## 9. Оформление

По рекламным кадрам App Store (видел сам, `img/tiimo-appstore-*.jpg`):
- **Цвет**: сиренево-лавандовые градиенты фона, белые и тёмно-фиолетовые (почти чёрные) поверхности, сиреневый акцент
  (дуга таймера, кнопки). Карточки задач на тёмном — со светлым текстом. Тёмная тема есть («Dark Interface» в
  специальных возможностях App Store; Android 2026 — «dark and light modes»).
- **Шрифт**: в рекламе — крупный тонкий антиквенный (с засечками) заголовок; внутри приложения — гротеск. Названия
  шрифтов не знаю (не проверено). Есть шрифт для дислексии (отзыв).
- **Иконки**: каждая задача — круглый «аватар» с объёмной картинкой-эмодзи (тарелка, велосипед, корзина, телефон, растение);
  выбор из тысяч иконок; ИИ подбирает сам.
- **Иллюстрации**: 3D-предметы, переливающиеся сферы-награды, искорки.
- **Плотность**: в расписании плотно (много мелких карточек); отзыв: «The UI is too busy and inconsistent across tabs; brain
  feels overwhelmed» (10.2026).
- **Моушн**: конфетти/фейерверк при выполнении (по отзывам), «progress visibly draining» на ленте (по выдаче поиска),
  искорки у дуги таймера (статичный кадр).
- **Звуки**: звуки уведомлений, «persistent alarms», музыка Tiimo Town/lo-fi.
- **Хаптика**: «encouragement by way of haptics and confetti» (отзыв 10.2026).
- Цитата редакции App Store: «Turning the chaos of your calendar into a timeline with soothing colors, Tiimo does the
  unthinkable: It makes tackling your to-dos a calming (and even fun) activity.»

## 10. Тексты и тон

Спокойный, «без давления», с языком нейроразнообразия:
- «Stay focused, not frozen.» (главная)
- «Planning systems don't fail because you're lazy, they fail because life changes.» (features)
- «No need to remember it all. Let's plan it out.» (AI-страница)
- «Messy list, racing thoughts, half-ideas… Tiimo turns them into actionable tasks» (AI-страница)
- «New to planning? Getting started with a new planner doesn't have to feel overwhelming.» (знакомство, Mobbin)
- «Rise and shine! How am I feeling? What are today's plans?» (утренний чек-ин, Mobbin)
- «Set reminders that help without creating alert fatigue» (FAQ)
- «No clutter, no pressure, just science-backed support» (главная)
- ИИ: «Hi Lily! 💛 I've got today's steps ready. First, how's your energy right now?»

## 11. Уведомления, виджеты, Live Activities

- Напоминания по моментам: до активности / при старте / на половине / по окончании; для рутин аналогично (Mobbin, `research/03`).
- Кадр 4: «Schedule reminders — Never forget anything. Reminders, Live Activities, Notifications, Complications, Sounds
  and persistent alarms.»
- Виджеты домашнего экрана и экрана блокировки «now and next»; в версии 3.71 (11.2026) — «Brand new Widgets!»; отзыв
  10.2026 огорчён, что маленький виджет «дневной обзор» поменяли, а ради него человек и платил.
- Apple Watch: события Google Calendar на часах, вход через Google (3.71).
- Давняя просьба пользователей — более настойчивый будильник, чем «ding»: ответ разработчика 2021 г. обещал настройку;
  сейчас в рекламе — «persistent alarms» (страница App Store).

## 12. Монетизация

- **Бесплатно**: «Basic planner, limited AI chats, 1 profile» (App Store); по FAQ — бесплатная версия только в приложениях
  iOS/Android, веб не входит ([FAQ](https://www.tiimoapp.com/faq)). Главная: бесплатно — «planning tools, to-do lists, and the
  focus timer»; в Pro — «AI task breakdown, custom widgets, and advanced scheduling options».
- **Tiimo Pro**: месяц или год. Точные цены на сайте не указаны («Your local price will be shown… at checkout»). Сторонние
  данные: ~$54,99/год ([Selfpause](https://www.selfpause.com/resources/tiimo)); экран пейвола (Mobbin, `research/03`):
  месяц $13, год «$5/mo MOST POPULAR»; отзыв 10.2026: «over $50» за год и «$14 for one month». Есть **пожизненная** подписка
  (отзыв 10.2026 «I got the lifetime subscription»), цена — (не проверено).
- **Проба**: 7 дней, только на годовом; месячный — списание сразу.
- **Скидки-баннеры на сайте**: «Limited time offer: 30% off your Tiimo subscription» на страницах features и AI
  (видел текст 15.11.2026).
- **Возвраты**: через Apple; «Tiimo does not offer refunds for partially used periods» (FAQ).
- **Проблемы**: волна отзывов 11.2026 «Crooks!», «no way to cancel», «charged for a full year for something I never used»,
  «Predatory» — люди не находят отмену внутри приложения (она в настройках Apple). Это не доказывает тёмный паттерн, но
  показывает: годовой автоплатёж после 7 дней пробы порождает злость и 1★.

## 13. Отзывы

Источник — последние ~50 отзывов американского App Store
([RSS](https://itunes.apple.com/us/rss/customerreviews/id=1480220328/sortBy=mostRecent/json)), страница App Store
([apps.apple.com](https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328)), прошлые разборы. Reddit — недоступен.

**Хвалят**
- Видимость времени: «The reminders and visual timers help me see time passing, so I don't get lost» (10.2026).
- Единственное, что «прижилось»: «This is the only app I've been able to be consistent with» (11.2026); «Must have for adhd».
- Чувство контроля: «Really makes you feel in deep control» (11.2026).
- «No pressure and it's a dopamine- builder» (10.2026).
- Празднование: «Liked the fireworks!!»; «encouragement by way of haptics and confetti!».
- Брейн-дамп, таймеры, плейлисты Tiimo Town, шрифт для дислексии.

**Ругают**
- **Деньги и отмена** (самый частый мотив 1★ в 11.2026): «Crooks!», «no way to cancel», «Shady», «Predatory».
- **Просьбы об оценке в первые минуты** (3 отзыва за месяц).
- **ИИ ошибается и требует споров** (раздел 6), **ИИ вместо рутин**: «big part of the app is now an AI chatbot :/».
- **Перенос функций в платное**: «some of the free features are behind a paywall»; бесплатное «утро/день/вечер» → «ANYTIME».
- **Убрали конфетти** — «What happened to the confetti???».
- **«Детское» празднование и шаблонные задачи**: «childish cheering», «stupid reminders to wake up, brush my teeth».
- **Перегруженный интерфейс**: «too busy and inconsistent across tabs».
- **Баги**: отметка снимается сама, будильник звонит после выполнения, вылет с часов (2021).
- **Поминутный план не подходит части людей с СДВГ**: «the whole minute to minute planning doesn't always work since I end
  up falling behind» (2021, на странице App Store).

## 14. Научная база

- Компания заявляет: «Co-designed with ADHD/Autism experts», «rooted in executive functioning research», «science-backed
  support» ([App Store](https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328), [главная](https://www.tiimoapp.com/)).
- **Опубликованных исследований эффективности самого Tiimo я не нашёл** (в этом сеансе поиск по научным базам не делал —
  бюджет запросов; в прошлом сеансе `research/24-product-teardown/A-adhd-apps-features.md` тоже не нашёл исследований
  ни одного из этих приложений, кроме юзабилити Inflow).
- Опора — общие идеи: визуальные расписания (широко применяются в поддержке аутичных детей), внешние подсказки времени
  при «слепоте ко времени» у СДВГ. Степень доказательности для взрослых с СДВГ — не проверял здесь; брать из
  `knowledge/library/`, если есть запись.
- Цифра «200 million people globally living with ADHD and Autism» на AI-странице — без ссылки.

## 15. Что взять Напарнику и что не брать

Сверено с красными линиями (без стыда, без сгорающих стриков, без тёмных паттернов, кот — присутствие). Перед
внедрением — чек-лист `knowledge/INDEX.md` и `research/15-product-science/product-science.md`.

**Взять**

1. **ИИ начинает со «как у тебя с силами сейчас?», потом — «выберем первый простой шаг»** (кадр 5) → **Дом**, кнопка
   «Разломать на шаг» / **чат с котом**: перед дроблением кот спрашивает про силы одним касанием (много / так себе / мало),
   и от ответа зависит размер первого шага. Это ровно «один вопрос за визит».
2. **«+5» на таймере** → **Фокус**: одна кнопка «ещё 5 минут» в конце/во время сессии, без пересчёта и упрёка.
3. **Большой круг с убывающей дугой и предметом в центре** → **Фокус**: у Напарника в центре кот — схема та же; проверить,
   что дуга убывает (как Time Timer), а не растёт.
4. **Перепланирование одним касанием без вины** («Reschedule →», «Plans changed? Just tell Tiimo») → **Дом**: если шаг не
   пошёл — «Перенести на завтра» рядом с «Повторить», голосом кота: «перенесли — и ладно».
5. **Утренний чек-ин «Как я? Что сегодня?»** → **Telegram-бот** (утреннее сообщение) — короткий вопрос, ответ кнопками,
   без отчётности.
6. **Таймер на экране блокировки / вне приложения** (Live Activity) → вебу недоступно; аналог — сообщение бота в конце
   сессии и заголовок вкладки с остатком времени (проверить, не конфликтует ли со «спрятать цифры»).
7. **Шрифт для дислексии / крупный текст** как настройка доступности → **Мир/настройки** (низкий приоритет; Fast-Font уже
   лежит в `fonts-library/bionic-reading/`).
8. **Длительность без привязки к часам** («Anytime, 25 min») → **Фокус**: так уже устроено (шаг + длительность, без
   расписания) — подтверждение правильности, менять не нужно.

**Не брать**

- **Поминутное расписание дня как центр продукта** — часть людей с СДВГ «отстают и бросают» (отзыв); у Напарника центр —
  один шаг сейчас.
- **ИИ, который раскладывает весь день и с которым надо спорить** — самые злые отзывы 2026 г. Напарник дробит один шаг и
  даёт человеку поправить, а не план на день.
- **ИИ сам выбирает иконку/эмодзи за человека** — раздражает, когда не угадал.
- **Просьба об оценке в первые минуты** — прямой путь к 1★. Просить только после пика (финал первой удачной сессии на
  `/app/start/after`), и не больше одного раза.
- **Годовой автоплатёж после 7-дневной пробы без напоминания** — источник обвинений «crooks»; если будет проба — честное
  напоминание за день до списания (решение владельца).
- **Перенос бесплатного в платное и удаление любимых функций (рутины, конфетти)** — потеря награды бьёт сильнее, чем её
  отсутствие (см. строку «Отнять привычную награду» в `research/24-product-teardown/B-dopamine-gamification.md`).
  Правило: что дали — не отнимать.
- **Серии с трофеями** — запрещены решением владельца.
- **Шаблонные задачи «почисти зубы» в новом профиле** — воспринимаются как детское; у Напарника первое дело — из слов
  человека.
- **Громкое «детское» празднование** — половине нравится, половину бесит; у Напарника празднование диегетично (кот, остров),
  не конфетти поверх интерфейса.

## Источники (открыты 15.11.2026)

- https://www.tiimoapp.com/ , https://www.tiimoapp.com/features , https://www.tiimoapp.com/product/ai-planning ,
  https://www.tiimoapp.com/faq (адрес /pricing ведёт на FAQ)
- App Store: https://apps.apple.com/us/app/tiimo-to-do-list-planner/id1480220328 ; https://itunes.apple.com/lookup?id=1480220328&country=us ;
  отзывы https://itunes.apple.com/us/rss/customerreviews/id=1480220328/sortBy=mostRecent/json
- Финансирование: https://tech.eu/2024/08/28/neurodivergent-focused-app-tiimo-secures-16m-in-funding-round/ ,
  https://sifted.eu/articles/tiimo-planning-app-for-neurodivergent-people ,
  https://tiimoapp.com/resource-hub/tiimo-raises-4-8m-neurodivergent-planner (по выдаче поиска)
- Обзор конкурента: https://www.selfpause.com/resources/tiimo
- Прошлые сеансы: `research/24-product-teardown/A-adhd-apps-features.md` §1, `research/03-onboarding-conversion-mobbin-growthdesign.md` (экраны Mobbin)
