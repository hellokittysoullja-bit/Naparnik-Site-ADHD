## Живые воронки онбординга (2026-11-03), отчёт для владельца

Пройдено 8 живых воронок: Liven, Headway, Noom, Inflow, Fabulous Focus, BetterMe, Simple и Numo. Calm и Headspace пройти не удалось, причины в таблице ниже. Ещё сняты экраны из галерей для Finch, основного Fabulous и пейволов. Живых снимков 286, из галерей 25. Собрано 62 листа: по каждой воронке, по каждой галерее и один «лучшее по механизмам».

Почту, имя и телефон я нигде не вводил. Галочки согласия не ставил: на такой галочке остановились BetterMe и Simple. Стену «я не бот» у Calm не обходил.

Файла `research/06-onboarding-psychology.md` в репозитории нет, поэтому опирался только на живые экраны. Репозиторий не трогал.

Всё лежит в `/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/funnels/`:
- `shots/` — снимки;
- `sheets/` — листы;
- `index.json` — у каждого файла полный видимый текст, адрес и время;
- `shots/*/log.txt` — сырой текст каждого экрана.

### Оговорки честности
- **Ответы не везде «наши».** Часть ответов выбирал скрипт, и они местами не совпадают с персоной: в Inflow на экранах 35 и 37–39 стоит «Never», на 17 — «No»; в Fabulous выбраны возраст «Under 20», «диагноз есть», «эксперт порекомендовал» и пол «Female». На порядок экранов это почти не влияет.
- **Удалены дубли.** Убраны снимки с одинаковым текстом, то есть «тот же вопрос, только с выбранным ответом». Из-за этого в Headway пропали 4 из 5 карточек книг: у них одинаковый текст при разных картинках.
- **Inflow 57.** На снимке ошибка «введите почту»: скрипт нажал «Continue» на пустом поле. Ничего отправлено не было.

---

## A. Десять главных выводов

1. **Первый тап — без раздумий.** Пол, возраст или «где болит» — карточками, без текстовых полей. Так делают Liven 1–2, Headway 2, Inflow 2, Simple 1 и BetterMe 1. У Liven вход прямо через боль: «Tasks piling up?», «Running on empty lately?».
2. **Один вопрос на экран, и прогресс всегда виден.**
   - Liven показывает «N / 29».
   - У Inflow полоска из 5 сегментов.
   - У Headway разделы PROFILE → PERSONALITY → PATTERNS, у Noom — DEMOGRAPHIC PROFILE → HEALTH GOALS.
   - Тап по ответу сразу переводит дальше. Кнопка «Continue» есть только там, где можно выбрать несколько ответов.
3. **Самые сильные вопросы — фразы от первого лица о той самой боли.**
   - Liven 6: «I know what I need to do but I can't make myself do it».
   - Fabulous 9: «Getting started is hard»; Fabulous 12: «I feel like I should be able to do things, but I just...can't».
   - Liven 16: «I often wait for the perfect moment to start».

   Человек отвечает «да, это я» — и уже чувствует, что его поняли.
4. **Эхо: ответ сразу возвращается человеку.**
   - Headway даёт реакцию почти на каждый ответ — 15 эхо-экранов из 57. Пример, Headway 14: «It's okay to doubt your skills if you make a mistake».
   - Inflow показывает карточку прямо под ответом, с аватаром маскота (экраны 16, 26, 32, 36).
   - У Liven и Noom эха нет вообще, и они ощущаются как анкета.
5. **Ритм «3–6 вопросов → вставка».**
   - Inflow: «сторис»-вставки 13–14, 23, 34, 53.
   - Fabulous: экран «влияния» после каждых ~5 утверждений (13, 19, 25).
   - Headway: «план готов на 72% / 94%» (20, 33).

   Длинная анкета не утомляет, потому что её постоянно разбивают награды.
6. **СДВГ-воронки снимают стыд и переводят «лень» в «устройство мозга».**
   - Inflow 36: «Why is ADHD procrastination different? …this stems from executive dysfunction».
   - Inflow 46: «Hope, doubt, frustration it wasn't caught earlier».
   - Fabulous 27–30: «зеркальная черта» — сильная сторона как обратная сторона трудности.
   - Liven 27 прямо спрашивает: «Growing up, were you told you were lazy?»
7. **Блок доверия стоит в конце, перед воротами.**
   - Liven 31 (логотипы вузов), 35 (психолог), 36 (2,5 млн человек).
   - Noom 11, 12, 16, 20.
   - Headway 46, 48.
   - Inflow 49 (свой клинический директор).
8. **«Труд машины» перед воротами.** Это загрузка «собираем план» по шагам, а внутри неё всплывают вопросы: Headway 52–56, Fabulous 36–38, Noom 23–24. У Headway полоса стоит на 49%, пока человек не ответит.
9. **Обещание маленького ежедневного усилия.** Headway 50 — «Easy 5 min/day», Simple 15 — «Just 5 minutes a day», BetterMe 11 — «10–20 min». Это ровно наш «2 минуты».
10. **Ворота — почта в обмен на обещанный личный результат.** Liven 37: «to see your personal Profile Summary»; Noom 25: «to see when Noom can help you reach 170 lb» (повторяет цель человека). Сам результат за воротами.
    - Честный противовес — Numo 9: результат сразу, без почты, с оговоркой «not a formal diagnosis».
    - Длинные квизы (36–57 экранов) оправдывают цену подписки через чувство «уже столько вложено». Бесплатному ядру такая длина не нужна.
    - Маскот-проводник есть только у Inflow (Квинн, экраны 7, 16, 26). В Finch весь онбординг построен вокруг питомца (галерея).

---

## B. Таблицы по воронкам

**Как читать:** В — вопрос, И — вставка, Э — эхо, З — загрузка, Г — ворота. Номер — номер файла в папке. Похожие подряд экраны сгруппированы.

### 1. Liven — главный аналог (процрастинация и СДВГ)
- **Вход:** theliven.com → «Tasks piling up?». Квиз: `quiz.theliven.com/en/611_r64bs/quiz?...utm_campaign=neuro`.
- **Объём:** 36 экранов от старта до ворот (плюс лендинг).
- **Время:** 4:30 в моём темпе, обычным темпом ~2,5–3 мин. Обещают «3-minute quiz».

| № | Тип | Текст (оригинал) | Варианты | Механизм | Честность |
|---|---|---|---|---|---|
| 1 | Лендинг | «Liven up your life… Pick where to start: Tasks piling up? / Running on empty lately? / Others' needs come first? / Little things setting you off?» | 4 карточки боли | вход через боль | 🟢 |
| 2 | В | «3-minute quiz / Execution Plan for neurodivergent brains / Discover what's keeping you stuck and finally break the cycle» | Male / Female; мелко: «By clicking… you agree with Terms… Subscription Policy» | микро-да, согласие одним кликом | 🟡 |
| 3 | В | «What's your age? Your answers will help us create your profile summary and personalized subscription plan» | 6 диапазонов | честно говорят про подписку | 🟢 |
| 4 | И | «We're glad you are here… Liven is not intended to replace professional diagnosis, treatment, or therapy» | Continue | дисклеймер | 🟢 |
| 5–12 | В 1–8/29 | focus; «I know what I need to do but I can't make myself do it» (5 смайлов-шкала); put things off; mind wandering; endless scrolling; «tired even after rest»; «good intentions… where the time went»; «more energy when a deadline is close» | Often / Sometimes / Rarely или шкала из 5 | зеркало боли | 🟢 |
| 13–26 | В 9–22/29 | «brain running in ten directions»; «struggle to finish»; «lose hours when interested»; «wait for the perfect moment»; «an hour on a ten-minute task»; «saying no is harder»; «wasting my potential»; «gap between who I am and who I could be»; «People less capable than me have achieved more»; «my own harshest critic»; «not reaching my full potential»; «time moving too fast»; «look like everything is okay»; «constantly stressed» | шкала из 5 | зеркало боли, давит на чувство вины («потенциал») | 🟡 |
| 27 | В 23/29 | «Growing up, were you told you were lazy or just not trying hard enough?» | Yes / Sometimes / No | идентичность, история | 🟢 |
| 28–30 | В 24–26/29 | тяготы (финансы… выгорание); симптомы (Chronic procrastination… Stress); что улучшить | несколько ответов + Continue | контекст | 🟢 |
| 31 | И | «Liven is built on evidence-based psychological practices» + Harvard / Oxford / Cambridge, мелко «not affiliated» | Continue | чужой авторитет | 🟡 |
| 32 | В 27/29 | «What do you want to feel like during your journey?» Capable / Focused / Calm / Motivated / Proud of myself / In control / Supported | несколько ответов | желаемое будущее | 🟢 |
| 33–34 | В 28–29/29 | что знаешь о КПТ; «Did you hear about Liven from a therapist?» | один ответ | атрибуция | 🟢 |
| 35 | И | «Reviewed by an expert — Tara Passaretti, Licensed Mental Health Counselor» | Continue | авторитет | 🟢 |
| 36 | И | «Join over 2,500,000 people» + лента отзывов-чипов | Continue | соцдоказательство; на лендинге «5M downloads» | 🟡 |
| 37 | Г | «Enter your email to see your personal Profile Summary» | поле почты | результат заперт за почтой | 🟡 |

**Дуга:** боль на входе → согласие → дисклеймер → 29 вопросов (боль → потенциал и вина → детство → контекст → желаемые чувства) → авторитет → эксперт → соцдоказательство → почта.
- Пики: экраны 19–21 («wasting potential», «less capable people achieved more») и 27 («lazy»).
- Эхо: ни одного. Первое «ага» до ворот: нет (0 из 36).

### 2. Headway
- **Вход:** `makeheadway.com/onboarding/self-growth/landing` (с главной).
- **Объём:** 57 экранов (после удаления дублей). Обещают «3-MINUTE QUIZ», реально ~4–5 мин; у меня 7:16.

| № | Тип | Текст | Варианты | Механизм | Честность |
|---|---|---|---|---|---|
| 2 | В | «Become the most interesting person in the room / 3-MINUTE QUIZ» | 4 карточки возраста; мелко: согласие, включая Meta Pixel | микро-да, согласие кликом | 🟡 |
| 3 | И | «55+ million people have downloaded the Headway app» | Continue | соцдоказательство | 🟡 |
| 4–5 | В/И | пол → «Yay, glad you are here! …let's dive into your personality» | — | тепло, знакомство | 🟢 |
| 6–8 | В/И | «Choose areas you'd like to elevate / The choice won't limit your experience»; «big ideas in 15 minutes»; кумиры (Jobs… Brené Brown) | — | снятие страха выбора, ценность, идентичность | 🟢 |
| 9–19 | В+Э | «big-picture or detail?» → Э «Big-picture thinking helps…»; «Do you always know what you want?» → Э под шкалой «Figuring out your wishes may be hard»; «I doubt myself after a mistake» → Э «It's okay to doubt…» и т.д. | шкала 👎…👍 | эхо почти после каждого ответа | 🟢 |
| 20 | И | «Your personal growth plan is 72% ready!» (маскот-мозг) | Continue | цель близко, но процент условный | 🟡 |
| 21–32 | В+Э | интроверт → «Yay for the introvert team!»; workouts → «same wavelength»; «friendly push»; time management → «We love your ambition!»; границы; секс-жизнь (2 вопроса без эха) | шкала из 5 | эхо, идентичность | 🟢 |
| 33 | И | «…now 94% ready! Look how far you've come already» | — | цель близко, «уже столько вложено» | 🟡 |
| 34–44 | В+Э | победы, работа, баланс, «capable of more», деньги, «worry you're not good enough» → «It's very common…» | — | эхо, нормализация | 🟢 |
| 45–46 | В/И | «from a coach or mentor?» → «built on expert ideas from top bestsellers» | — | атрибуция, авторитет | 🟢 |
| 47 | В | «Does this book seem interesting to you?» — 5 карточек подряд | No / Yes | персонализация свайпом | 🟢 |
| 48 | И | «Join over 55M people» | — | соцдоказательство | 🟡 |
| 49–51 | В | причина роста; «Choose your daily self-growth goal: Easy 5 min/day / Common 10 / Serious 15 / Intensive 20+»; формат обучения | — | маленькое обязательство | 🟢 |
| 52–55 | З | «We are crafting your learning experience…» Setting goals → Adapting growth areas → Picking content → Prioritizing challenges + попапы «To move forward, specify»: «Do you self-reflect?», «Do you want to give up when things get hard?», «Do you like to learn by listening?», «Are you inclined to finish what you start?» | Yes / No | «труд машины», наводящий вопрос; полоса стоит на 49% | 🟡 |
| 56 | И | «Your learning experience is up and running!» | — | завершённость | 🟢 |
| 57 | Г | «Achieve your goals with Headway / Enter your email to create a personal account» | почта | ворота | 🟢 (честно: «аккаунт») |

**Дуга:** возраст → соцдоказательство → знакомство → сферы → (вопрос → эхо) ×15 с отметками 72% и 94% → книги → соцдоказательство → цель 5 мин → загрузка с попапами → почта.
- Первое «ага»: экран 10, после 4 вопросов. Эхо — на экранах 10–44 почти через один.
- Пики: 14, 44, 20, 33.

### 3. Noom
- **Вход:** noom.com → «Start your trial» → `noom.com/survey/weightLossGoal?route=_direct`.
- **Объём:** 25 экранов. Время: 3:01 у меня, ~2 мин обычным темпом.

| № | Тип | Текст | Механизм | Честность |
|---|---|---|---|---|
| 1–10 | В | цель (Lose 1–20 lbs for good…); «Hormones impact…» пол; гендер; возраст; рост; вес «We don't mean to pry»; образ жизни; диагноз РПП; состояния; диабет | демография, мягкие пояснения «зачем спрашиваем»; фильтр РПП — забота | 🟢 |
| 11 | И | «You're in trusted hands — we've helped 3,627,436 people lose weight!*» (*данные на октябрь 2021, «потеряли ≥2%») | соцдоказательство с честной, но мелкой сноской | 🟡 |
| 12 | И | «trusted by popular brands… insurance plans» | авторитет | 🟢 |
| 13 | В | страховая («можешь получить бесплатно») | — | 🟢 |
| 14 | В | целевой вес + «Recommended weight range 140–174 lb» + «results are not guaranteed… 1–2 lb per week» | честное ожидание | 🟢 |
| 15–16 | В/И | максимальный вес → «Scientific Reports — 78% lost weight» | наука | 🟡 |
| 17–19 | В | фокус; событие впереди; «knowing you, as only you can, which pace would you prefer?» | обязательство, автономия | 🟢 |
| 20 | И | отзыв Майка | соцдоказательство | 🟢 |
| 21–22 | В | лекарства, GLP-1 | — | 🟢 |
| 23–24 | З | «Lose twice as much weight with Noom vs. trying on your own» — столбики 2x; «CALCULATING WEIGHT LOSS PACE… PREPARING RESULTS» | «труд машины» + общий, не личный график | 🟡 |
| 25 | Г | «Enter your email to see when Noom can help you reach 170 lb» | ворота повторяют цель человека | 🟡 |

**Дуга:** кто ты → цифры тела → доверие → цель → темп → отзыв → загрузка → почта за прогнозом.
- Эха до ворот нет. Первое личное «ага» — экран 14 (рекомендованный диапазон веса), после 13 экранов.

### 4. Inflow — СДВГ-аналог, единственный с маскотом
- **Вход:** getinflow.io → `join.getinflow.io/get-started/` → `/inflow-quiz/fuba-v2/...`.
- **Объём:** 56 экранов до ворот (2–57). Обещают «3 min quiz»; обычным темпом ~4 мин, у меня 6:20 вместе с возвратом.

| № | Тип | Текст | Механизм | Честность |
|---|---|---|---|---|
| 2 | В | «Uncover the truth about your ADHD / 3 min quiz» — пол | интрига, микро-да | 🟡 (подача «правда о твоём СДВГ») |
| 3–4 | В/И | возраст → сторис «Join 250k+ people managing their ADHD» | соцдоказательство | 🟡 |
| 5 | В | «Have you ever been diagnosed with ADHD? …everyone is welcome, diagnosis or not» | безопасность | 🟢 |
| 6–7 | И | «This quiz will help you… discover if Inflow is the right fit» → «Hey, I'm Quinn! I'll show up here and there to help…» | маскот-проводник | 🟢 |
| 8–12 | В | put off until last minute; attention; «5 things at once»; unwind; «start the day determined… end the day feeling defeated» | All the time … Never; зеркало боли | 🟢 |
| 13–14 | И | «ADHD symptoms can be exhausting.» → «It sounds like you're facing a handful of these challenges, but you're on the right path.» | эмпатия, эхо | 🟢 |
| 15–22 | В+Э | juggle → Э «💪 Setting boundaries is challenging but necessary…»; imposter; lose track of time; re-read; distracted; шкала 1–5 «careless mistakes», «talk too much» | смена форматов, эхо | 🟢 |
| 23 | И | «Exploring the deeper emotional aspects of ADHD can be challenging and personal.» | подготовка к трудному | 🟢 |
| 24–32 | В+Э | people pleaser; harshest critic → Э с маскотом «❤️‍🩹 It's normal to feel this way…»; смены настроения; сила эмоций; соцтревога; страх провала; «Have you heard of Rejection Sensitive Dysphoria? It's a little known condition affecting nearly everyone with ADHD» → Э | эмоции, обучение | 🟢 / 🟡 («nearly everyone» — перебор) |
| 33 | В | «Which of these traits do you consider your greatest strengths?» (hyperfocus, creativity…) | сила | 🟢 |
| 34 | И | «Where many ADHDers fall short is organizing… executive function» | обучение | 🟢 |
| 35–39 | В+Э | шкала 👎…👍: процрастинация счетов → Э «Why is ADHD procrastination different? …you can want to do something so badly and still be unable to do it… executive dysfunction, as opposed to typical procrastination» | переворот «лень → мозг» | 🟢 |
| 40–49 | В+Э | «Thank you for sharing!»; знание СДВГ → Э «No worries, we'll guide you»; когда заподозрил → Э «Many Inflow members don't have a formal diagnosis… 5 minutes a day»; почему заподозрил; Э «Hope, doubt, frustration it wasn't caught earlier. We've been there.»; сопутствующие; лечение тревоги → Э эксперт «Dr. George Sachs, PsyD» | эхо, нормализация, авторитет | 🟢 |
| 50–53 | В/И | «others not taking my struggles seriously»; «called lazy, unreliable»; «misunderstood» → сторис «We are here to break the stigma» | идентичность, миссия | 🟢 |
| 54–55 | В | рекомендовал ли врач; откуда узнал | атрибуция | 🟢 |
| 56 | Г | «What's the best email address for you? You'll use this to log back in later» | ворота (аккаунт) | 🟢 |

**Дуга:** интрига → безопасность → маскот → боль → эмпатия → эмоции → сильные стороны → обучение «это не лень» → твоя история с СДВГ → стигма → почта.
- Первое «ага»: 13–14, после 5 вопросов.
- Эхо: 14, 16, 26, 32, 36, 42, 44, 46, 49.
- Пики: 14, 26, 36, 46.

### 5. Fabulous Focus (внутри называется «Clarify»)
- **Вход:** thefabulous.co → «Focus Planner» → `time.thefabulous.co/onboarding/time-initial`.
- **Объём:** 38 экранов до ворот «имя». Обычным темпом ~3 мин.

| № | Тип | Текст | Механизм | Честность |
|---|---|---|---|---|
| 1 | И | «Thriving with adult ADHD in a world of distractions…» | обещание | 🟢 |
| 2–4 | В/Э/И | диагноз? → «Don't worry — Having a brain that works differently can feel like having too many programs running» → «Without thinking about it too much, decide…» | метафора, снятие напряжения | 🟢 |
| 5–24 | В | 15 утверждений Yes / No: «easily distracted», «Organization is a challenge», «deadline», «Getting started is hard», «I should be able to do things, but I just...can't», «misunderstood», «rejected and hurt», «impulsive», «forgetful»… На экране 7 вставлен «Oops, we forgot to ask: what is your age?» | зеркало боли; возраст в середине ломает стену анкеты | 🟢 |
| 10 | И | «The Science of a Better You» | наука | 🟢 |
| 13, 19, 25 | И | «ADHD impact on Your Productivity 93%» / Relationships 89% / Mental Health 90% | точные проценты из ответов да/нет | 🔴 |
| 26 | Р | «Your ADHD Impact Scores Summary» | квази-диагноз | 🔴 |
| 27–30 | И | «Mirror Traits — Dr. Ned Hallowell…» → «Reveal my mirror trait» → «Can you guess?» → «Your mirror trait is Adaptability! Your answers show that you feel disorganized…» | сильная сторона, раскрытие как подарок | 🟢 |
| 31 | В | «What would make the biggest difference…? Stop being late / Not forget things / Finally finish what I start…» | цель | 🟢 |
| 32–34 | В | рекомендовал эксперт?; пол | — | 🟢 |
| 35 | Р | «Summary of your ADHD Profile — Composite ADHD score: High… Main difficulty / Goal / Trigger / Mirror trait» | карточка профиля; «высокий счёт» звучит как диагноз | 🔴 / 🟡 |
| 36–38 | З | «Creating your Plan: Analyzing barriers / Selecting strategies / Saving parameters» + попапы «Do you feel bored when trying to complete chores?», «Have you ever tried ADHD coaching?» | «труд машины» | 🟡 |
| 39 | Г | «One last thing, what do your friends call you?» — без имени кнопка не активна | ворота «имя» | 🟢 |

**Дуга:** обещание → эмпатия → 15 «да/нет» с промежуточными «счетами» → сводка → сильная сторона → цель → профиль → загрузка → имя.
- Первое «ага»: экран 3, после 1 вопроса.

### 6. Numo ADHD — честный короткий тест
- **Вход:** numo.ai → `numo.ai/adhd-test-for-adults-online`. Всего 9 экранов, меньше минуты.
- Лендинг: «You know what matters. Starting is the hard part.» Наше позиционирование почти слово в слово.
- Тест ASRS v1.1 (опросник ВОЗ), 6 вопросов «1/6…6/6», варианты Never…Always.
- Результат сразу: «6/6 You might have ADHD! This is not a formal diagnosis but a short predictive screener.» Дальше «Get started» ведёт в App Store. Ворот нет. Всё 🟢.

### 7. BetterMe (Pilates) — остановлено на галочке согласия
- **Вход:** betterme.world → `betterme-pilates.com/first-page-generated?flow=2117`. Пройдено 37 экранов, ~3 мин.
- **Дуга:** возраст → «Over 150,000 women in their 30s» (подставляет твой возраст, 🟡) → опыт → продукт → цель → эхо → тело («dream body», 🟡) → вставка «10–20 min a day» (🟢) → активность → зоны → эхо «flatter belly» → ограничения → аксессуары → тизер «Unlock a special discount» (23, 🟡) → «Everyone is talking about our accessories» (24) → быт: график, энергия, вода, сон → питание ×6 → эксперт (35) → события жизни → рост.
- **Остановка:** экран 37 — галочку «I consent to BetterMe processing my health onboarding data» я не ставил.
- Мелкий шрифт «accessories are not included and must be purchased separately» — 🟡.

### 8. Simple (фастинг) — остановлено на галочке согласия
- **Вход:** `simple.life/survey/main`. Пройдено 18 экранов, ~1,5 мин.
- **Дуга:** возраст → пол → «слышал ли о фастинге?» → обучение «simpler than it sounds» → цель → питание («No judgment», 🟢) → диета → «You don't need a special diet» (снятие страха, 🟢) → «belly type» (выдуманные категории, 🟡) → ограничения, сон, вода, образ жизни, свободное время → «Just 5 minutes a day… You've got this!» (🟢) → приоритеты → отзыв с фото «до/после», −50 фунтов (🟡) → рост.
- **Остановка:** экран 19 — галочку согласия на данные о здоровье не ставил, без неё «Next» не активна.

### Не пройдены
- **Calm:** calm.com показывает стену «Press & Hold to confirm you are a human». Не обходил (`shots/calm/01-*`).
- **Headspace:** на сайте нет квиза. Все кнопки ведут сразу на оплату `checkout.headspace.com?voucherCode=B2C14DANNUAL2022`, страница оплаты в моём браузере не загрузилась (крутилась загрузка).
- **Mindvalley:** квиз есть только внутри аккаунта — не стал.
- **Fabulous, основная воронка:** пройдена её СДВГ-ветка Focus; основную смотрел по галерее.
- **Liven ADHD-test:** `theliven.com/tests/adhd-test` теперь перенаправляет на главную.

### Галерея — не живые экраны
- **Finch (питомец, screensdesign: «36 onboarding steps»).** Путь: «Choose your Finch Egg!» → «You hatched a birb! Your bird's pronouns» → «Have you used Finch before?» → «Generating your self-care goals with Piper…» → «Biggest deal ever! One-time 43% OFF» → дом с питомцем и целями «Get out of bed / Brush teeth» → «Woohoo! Piper munched… energized for Day 1».
  - Пейвол: честная шкала триала «Today / Day 5 remind / Day 7 charged», рядом «Offer expires when you exit this screen!» (🔴).
- **Fabulous основной (screensdesign: «42 onboarding steps»):**
  - Шаги: приветствие; «How much sleep…»; «Why are you embarking…»; «Julia's Contract» с подписью пальцем; письмо «from Future you» с триалом; дом «Your Plan for Today»; первая привычка «Drink Water».
  - Пейвол: «Build a Routine based on your goals», переключатель «Not sure yet? Enable a free trial».
- **Пейволы в приложениях (Adapty):**
  - Headway: «Try 7 days for free, then $7.49/mo billed yearly $89.99» (🟢); «44% OFF discount for you», зачёркнутая цена (🟡/🔴).
  - BetterMe: «How does trial work? Today / Day 5 / Day 7» (🟢).
  - Calm: «Your plan is ready. Unlock Calm for free».
  - Simple: «Enjoy everyday progress» и «Choose your plan» с отзывом.

---

## C. Общий скелет сильнейших воронок

| Акт | Экранов | Что делают | Механизмы | Примеры |
|---|---|---|---|---|
| 0. Вход | 1–2 | первый тап без мысли (пол, возраст или «где болит») + обещание «3 мин» | микро-да, вход через боль | Liven 1–2, Inflow 2, Headway 2 |
| 1. Безопасность и знакомство | 1–3 | «рады тебе», дисклеймер, «диагноз не нужен», маскот | доверие, снятие страха | Liven 4, Inflow 5–7, Fabulous 3–4, Headway 5 |
| 2. Зеркало боли | 8–25 | фразы от первого лица, частота, шкалы; один вопрос на экран | зеркало боли, прогресс | Liven 5–26, Inflow 8–39, Fabulous 5–24 |
| 3. Эхо и обучение | вплетено: каждые 1–5 вопросов | реакция на ответ, «это нормально», «вот почему так» | эхо, нормализация, обучение | Headway 10–44, Inflow 14, 26, 36, 46 |
| 4. Идентичность и сила | 2–5 | «называли ленивым?», сильные стороны, «зеркальная черта» | переворот «лень → особенность», гордость | Liven 27, Inflow 33, Fabulous 27–30 |
| 5. Будущее и малый шаг | 2–4 | какие чувства хочешь, цель, «5 мин в день», темп | обязательство, автономия | Liven 32, Headway 50, Simple 15, Noom 19, Fabulous 31 |
| 6. Доверие | 2–4 | эксперт, наука, число пользователей, отзыв | авторитет, соцдоказательство | Liven 31/35/36, Noom 11/12/16/20, Inflow 49 |
| 7. «Труд машины» | 1–5 | загрузка по шагам + вопросы-попапы + «готово» | эффект проделанной работы | Headway 52–56, Fabulous 36–38, Noom 23–24 |
| 8. Ворота | 1 | почта или имя ради «твоего профиля / плана / даты цели» | любопытство, «уже вложено» | Liven 37, Noom 25, Inflow 56, Fabulous 39 |
| 9. План → договор → пейвол (галерея) | 2–4 | карточка плана, подписанный договор, шкала триала | обязательство, честный триал или фальш-срочность | Fabulous 4 (галерея), BetterMe и Finch (галерея) |

---

## D. Листы для владельца
- **Главный лист** — `sheets/00-best-of-mechanisms.png`: 18 механизмов, у каждого цветная полоска честности.
  1. Зеркало боли — Liven 6.
  2. Эхо с маскотом — Inflow 26.
  3. Маскот — Inflow 7.
  4. «72% готово» — Headway 20.
  5. Отзывы — Liven 36.
  6. Свой эксперт — Inflow 49.
  7. «Это не лень» — Inflow 36.
  8. Сильная сторона — Fabulous 30.
  9. «5 мин в день» — Headway 50.
  10. Загрузка с попапом — Headway 53.
  11. Общий график — Noom 23.
  12. Квази-диагноз 🔴 — Fabulous 35.
  13. Ворота с эхом цели — Noom 25.
  14. Результат без почты — Numo 9.
  15. Договор — Fabulous, галерея.
  16. Яйцо питомца — Finch, галерея.
  17. Честный триал — BetterMe, галерея.
  18. Фальш-срочность 🔴 — Finch, галерея.
- **По воронкам:** `sheets/<воронка>-NN.png`, по 6 экранов по порядку. На каждой плитке: продукт, номер, тип и подпись.
  - liven 01–07, headway 01–10, noom 01–05, inflow 01–10, fabulous-focus 01–07;
  - betterme 01–07, simple 01–04, numo 01–02, calm 01, headspace 01.
- **Из галерей (помечены «ИЗ ГАЛЕРЕИ, НЕ ЖИВОЕ»):** finch-gallery 01–02, fabulous-gallery 01–02, headway-gallery 01, betterme-gallery 01, simple-gallery 01, calm-gallery 01.

---

## E. Лучший шаблон для нас и почему

**Почему не 30–57 экранов.** У них длина нужна, чтобы оправдать цену подписки («уже столько вложил»). У нас бесплатное ядро, и главное «ага» — сама 2-минутная сессия с котом и выросший кусок острова. Поэтому берём скелет Inflow (тон, эхо, маскот, «это не лень»), прогресс и малый шаг Headway, сильную сторону Fabulous и честность Numo. Сжимаем до **8–10 экранов до старта**. Сейчас у нас: приветствие → что висит → что мешает → шаг → «собираю» → договор → удержание.

| Акт | У них | У нас сейчас | Что сделать |
|---|---|---|---|
| 0. Вход | Liven 1 (карточки боли), Inflow 2 | лендинг «Давай» | оставить один тап; обещание «2 минуты», как у Numo: «Начать — самое трудное» |
| 1. Знакомство | Inflow 7 (Квинн знакомится), Liven 4 (дисклеймер) | кот здоровается | добавить одну строку голосом кота: «Я не врач и диагнозов не ставлю — я просто посижу рядом» (без тоста) |
| 2. Зеркало боли | Liven 6, Fabulous 9/12 | вопрос «что мешает начать» (4 чипа) | 2–3 фразы от первого лица, тап «про меня / не про меня»: «Знаю, что делать, но не могу себя заставить», «Жду идеального момента», «Включаюсь только под дедлайн» |
| 3. Эхо и обучение | Headway 14, Inflow 26/36 | кот реагирует позой и репликой (SPHERE_REACTION) | эхо после каждого ответа уже есть; после «что мешает» — короткое обучение в стиле Inflow 36: «Это не лень: скучное мозгу трудно начать. Поэтому начинаем с 2 минут» |
| 4. Сильная сторона | Fabulous 27–30 | нет | один экран: кот называет силу из конкретного ответа («Ты разгоняешься под дедлайн — значит, умеешь включаться. Используем») — без процентов |
| 5. Малый шаг | Headway 50, Simple 15 | выбор первого шага | выбор «2 / 5 / 10 мин» с меткой «рекомендую» на 2 (эффект умолчания, как наши 25 мин) |
| 6. Доверие | Inflow 49, Noom 12 | нет | только правда: одна строка про «посидеть рядом с кем-то» (body doubling) как известный приём; без логотипов и чужих чисел |
| 7. «Труд машины» | Headway 52–56, Fabulous 35 | «собираю» 1,5 с, ответы отмечаются | оставить; итог как карточка Fabulous 35, но честная: «Что висит / Что мешает / Первый шаг / Твоя сила» |
| 8. Ворота | Liven 37, Noom 25 | нет | ворот не делать; вместо них договор + удержание (у нас уже есть, как договор Fabulous из галереи) |
| 9. Пейвол | Finch / BetterMe (галерея) | нет | вместо пейвола — пик в конце: сессия → остров растёт → кот радуется (как Finch: «питомец получил энергию»); если когда-нибудь будет пейвол — только честная шкала «сегодня / напомним на 5-й день / 7-й день» |

**Честные замены для 🔴 и спорных 🟡:**
- **Проценты «влияния СДВГ 93%» и «высокий счёт» (Fabulous 13, 19, 25, 35).** Вместо них — пересказ своими словами того, что человек сам отметил: «Ты отметил 3 из 4 про старт — значит, мешает именно начало». Без цифр, похожих на диагноз.
- **Загрузка, которая стоит на 49% до ответа, и наводящий «Do you want to give up…?» (Headway 52–55).** Наше «собираю» из 1,5 с, где видно, как ответы используются; без наводящих вопросов.
- **«Разовая скидка, исчезнет, если уйдёшь» (Finch, галерея).** Не делать; срочности нет.
- **Согласие с условиями по первому тапу (Liven 2, Headway 2).** Не нужно: мы ничего не собираем.
- **Результат только за почту (Liven 37, Noom 25).** Отдавать результат сразу, как Numo 9: наш результат — первая сессия.
- **Чужие логотипы «не связаны с нами» (Liven 31) и непроверяемые миллионы (Liven 36, Headway 48).** Только наши реальные цифры, когда они будут.
- **Давление «потенциалом» и «люди хуже тебя добились большего» (Liven 19–21).** Противоречит нашему «без стыда». Не брать; оставить только боль про старт.

---

## F. Пути ко всем снимкам

Корень: `/tmp/claude-0/-home-user-Naparnik-Site-ADHD/df603098-ec8f-56bd-b920-75ef60b14f8a/scratchpad/funnels/`. Имена файлов — `NN-<слаг заголовка>.png`; полный список с текстом каждого экрана и адресом — в `index.json` там же.

**Живые снимки (03.11.2026):**
- `.../shots/liven/` — 01–37
- `.../shots/headway/` — 01–57
- `.../shots/noom/` — 01–25
- `.../shots/inflow/` — 01–57
- `.../shots/fabulous-focus/` — 01–39
- `.../shots/betterme/` — 01–37 (37 — экран с галочкой согласия)
- `.../shots/simple/` — 01–19 (19 — экран с галочкой согласия)
- `.../shots/numo/` — 01–09
- `.../shots/calm/01-*.png` — стена «не бот»
- `.../shots/headspace/01-*.png`, `02-*.png`

**Из галереи, не живые:**
- `.../shots/finch-gallery/`:
  - `01-choose-egg.png`, `02-hatched-bird-pronouns.png`, `03-used-finch-before.png`;
  - `04-generating-goals-loader.png`, `05-one-time-43-off-offer.png`, `06-home-pet-and-goals.png`;
  - `07-pet-energized-reward.png`, `08-paywall-trial-timeline.png`, `09-paywall-trial-timeline-b.png`.
- `.../shots/fabulous-gallery/`:
  - `01-welcome-habit-building.png`, `02-sleep-question.png`, `03-why-question.png`, `04-signed-contract.png`;
  - `05-letter-from-future-paywall.png`, `06-home-plan-for-today.png`, `07-first-habit-drink-water.png`, `08-paywall-routine-trial.png`.
- `.../shots/headway-gallery/01-paywall-trial.png`, `02-paywall-44-off.png`
- `.../shots/betterme-gallery/01-paywall-how-trial-works.png`, `02-paywall-how-trial-works-b.png`
- `.../shots/simple-gallery/01-paywall-premium.png`, `02-paywall-choose-plan.png`
- `.../shots/calm-gallery/01-paywall-plan-ready.png`, `02-paywall-plan-ready-b.png`

Листы — в `.../sheets/` (62 файла, раздел D).

**Источники:**
- [Liven](https://theliven.com/), [Headway](https://makeheadway.com/), [Noom](https://www.noom.com/), [Inflow](https://www.getinflow.io/), [Fabulous](https://www.thefabulous.co/), [Numo ADHD test](https://numo.ai/adhd-test-for-adults-online), [BetterMe](https://betterme.world/), [Simple](https://simple.life/);
- [Adapty Paywall Library](https://adapty.io/paywall-library/), [screensdesign: Finch](https://screensdesign.com/showcase/finch-self-care-pet), [screensdesign: Fabulous](https://screensdesign.com/showcase/fabulous-daily-habit-tracker), [Reteno: Fabulous web screens](https://gallery.reteno.com/flows/web-screens-fabulous) — у Reteno закрыто регистрацией, не использовал.
