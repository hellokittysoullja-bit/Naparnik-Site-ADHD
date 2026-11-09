# Социальная психология и психология влияния/убеждения — независимый обзор

Дата: 09.11.2026. Метод: WebSearch + WebFetch; каждое число ниже взято из открытой страницы (реферат, полный текст,
учебная глава с разбором репликаций, энциклопедия) со ссылкой. Это обзор науки, без приложений и советов.

**Ограничение этого прогона (честно).**
- Общий лимит веб-поиска сессии (200 запросов на всех агентов) кончился в начале работы. Дальше можно было открывать
  только адреса, уже появившиеся в выдаче или на открытых страницах, и часть таких запросов система всё равно не
  пропустила («PROVENANCE_REQUIRED»): pubmed.ncbi.nlm.nih.gov/26315443, scispace.com (Karau & Williams 1993),
  growthlayer.app (Cialdini), atticusli.com/cognitive-dissonance, en.wikipedia.org (Elaboration likelihood model,
  Compliance, Reciprocity, Reactance, Scarcity heuristic, Replication crisis, Framing effect, Group polarization),
  simplypsychology.org/obedience, apa.org/ethics/code, artificialintelligenceact.eu, hhs.gov (Belmont Report), а также
  doi.org и pmc.ncbi.nlm.nih.gov для Tannenbaum 2015, Bohner & Schlüter 2014, Banas & Rains 2010, Dechêne 2010.
- Поэтому часть строк по убеждению опирается на ссылки, которые **раньше открывали другие исследования** (отчёты в
  `research/09-…`, `research/11-gaps/…`). Такие источники помечены **†**: ссылка настоящая, числа взяты из тех отчётов,
  в этом прогоне я их **не перепроверял**.
- **atticusli.com** — блог консультанта (сам пишет, что использует ИИ), он здесь только **навигатор**: я беру из него
  ссылки на первоисточники (DOI), а числа помечаю «по вторичному источнику».
- Русские переводы книг поиском проверить не удалось (лимит). В разделах «Что читать» стоит «перевод не проверен».

Условные обозначения статуса: ✅ подтверждён (метаанализ / массовая репликация) · ⚠ спорен или эффект меньше/уже, чем
заявлялось · ❌ не воспроизвёлся / опровергнут · ⬜ не проверено в этом прогоне.

---

# ЧАСТЬ 1. СОЦИАЛЬНАЯ ПСИХОЛОГИЯ (social psychology)

## 1.1 Что изучает, границы, названия

- **Предмет.** Как реальное, воображаемое или подразумеваемое присутствие других людей меняет мысли, чувства и
  поведение человека. Ключевые темы: восприятие людей и атрибуция, установки, социальное влияние (конформность,
  подчинение, убеждение), группы, отношения между группами, стереотипы, помощь и агрессия.
- **Подход.** Флойд Олпорт в учебнике 1924 г. определил её как *экспериментальное* изучение социального поведения; по
  Вольфгангу Штрёбе, с этого началась современная социальная психология
  ([Wikipedia, Social psychology](https://en.wikipedia.org/wiki/Social_psychology)). Главный метод до сих пор —
  эксперимент, часто с подставными участниками и обманом (см. 1.5).
- **Другие названия.** Социальная психология (social psychology); близкие направления — психология социального влияния
  (social influence), групповая динамика (group dynamics), социальное познание (social cognition), межгрупповые
  отношения (intergroup relations).
- **Отличие от соседей.**
  - От **социологии** — уровень анализа: индивид в ситуации, а не общество и институты; метод — эксперимент, а не опрос
    популяции.
  - От **психологии личности** — акцент на силе ситуации, а не устойчивых чертах. Спор «личность против ситуации» — один
    из стержней дисциплины (например, вокруг Стэнфордского тюремного эксперимента: [Le Texier 2019](https://www.Gwern.net/doc/psychology/2019-letexier.pdf)).
  - От **когнитивной психологии** — содержание познания социальное (люди, группы, нормы). Различие видно и по
    воспроизводимости: в проекте OSC 2015 повторились 25 % социальных и 50 % когнитивных исследований (1.7).
  - От **психологии убеждения** (часть 2) — убеждение здесь лишь одна из форм влияния; наука об убеждении выросла в
    отдельную область на стыке социальной психологии и коммуникативистики.

## 1.2 История: основатели и ключевые работы

| Год | Кто | Что |
|---|---|---|
| 1898 | Норман Триплетт | Велогонщики быстрее рядом с соперниками, дети быстрее мотают леску в соревновании — одно из первых опубликованных социально-психологических исследований ([Wikipedia, Social facilitation](https://en.wikipedia.org/wiki/Social_facilitation); [FORRT, гл. 8](https://forrt.org/open-social-psychology/chapter8.html)) |
| 1913 | Максимилиан Рингельман | Один человек тянет ~100 единиц силы, двое — ~180, а не 200 (будущая «социальная леность») ([FORRT, гл. 7](https://forrt.org/open-social-psychology/chapter7.html)) |
| 1922 | Уолтер Липпман | «Public Opinion»: термин «стереотип» в психологическом смысле ([Wikipedia, Stereotype](https://en.wikipedia.org/wiki/Stereotype)) |
| 1924 | Флойд Олпорт | Учебник, определивший дисциплину как экспериментальную; термин «социальная фасилитация» ([Wikipedia, Social psychology](https://en.wikipedia.org/wiki/Social_psychology); [Wikipedia, Social facilitation](https://en.wikipedia.org/wiki/Social_facilitation)) |
| 1934 | Ричард Лапьер | Разрыв установки и поведения (251 заведение, 1 отказ; >90 % письменных «не обслужим») ([Simply Psychology, Attitudes](https://www.simplypsychology.org/attitudes.html)) |
| 1935 | Музафер Шериф | Автокинетический эффект: в группе оценки сходятся к общей норме и сохраняются потом в одиночку ([Wikipedia, Social proof](https://en.wikipedia.org/wiki/Social_proof)) |
| 1945 | Курт Левин | Центр групповой динамики в MIT (после смерти Левина в 1947 г. переехал в Мичиган в 1948 г.) ([Wikipedia, Leon Festinger](https://en.wikipedia.org/wiki/Leon_Festinger)) |
| 1951–1956 | Соломон Аш | Эксперименты конформности с линиями ([FORRT, гл. 21](https://forrt.org/open-social-psychology/chapter21.html)) |
| 1954 | Гордон Олпорт | «The Nature of Prejudice» ([Wikipedia, Stereotype](https://en.wikipedia.org/wiki/Stereotype)) |
| 1954, 1957 | Леон Фестингер | Теория социального сравнения (1954), теория когнитивного диссонанса (1957); ученик Левина, 5-й по цитируемости психолог XX века по Haggbloom et al. 2002 ([Wikipedia, Leon Festinger](https://en.wikipedia.org/wiki/Leon_Festinger)) |
| 1958 | Фриц Хайдер | «Наивная психология»: начало теории атрибуции ([Simply Psychology, Attribution](https://www.simplypsychology.org/attribution-theory.html)) |
| 1961–1963 | Стэнли Милгрэм | Эксперименты подчинения (начало — август 1961, Йель; публикация 1963) ([Wikipedia, Milgram experiment](https://en.wikipedia.org/wiki/Milgram_experiment)) |
| 1965–1967 | Джонс и Дэвис; Келли; Джонс и Харрис | Теории атрибуции и «ошибка соответствия» ([Simply Psychology, Attribution](https://www.simplypsychology.org/attribution-theory.html)) |
| 1968 | Дарли и Латане | Эффект свидетеля ([Wikipedia, Bystander effect](https://en.wikipedia.org/wiki/Bystander_effect)) |
| 1970–1971 | Анри Тэшфел | Минимальная групповая парадигма ([FORRT, гл. 9](https://forrt.org/open-social-psychology/chapter9.html)) |
| 1971 | Филип Зимбардо | Стэнфордский тюремный эксперимент ([Wikipedia, SPE](https://en.wikipedia.org/wiki/Stanford_prison_experiment)) |
| 1972 | Ирвинг Дженис | «Victims of Groupthink» ([Wikipedia, Groupthink](https://en.wikipedia.org/wiki/Groupthink)) |
| 1977 | Ли Росс | Термин «фундаментальная ошибка атрибуции» ([Wikipedia, FAE](https://en.wikipedia.org/wiki/Fundamental_attribution_error)) |
| 1979 | Тэшфел и Тёрнер | Теория социальной идентичности ([Wikipedia, Social psychology](https://en.wikipedia.org/wiki/Social_psychology)) |
| 2011–2015 | — | Кризис воспроизводимости: дело Стапела (2011), OSC 2015 (1.7) |

## 1.3 Главные теории и модели

- **Нормативное и информационное влияние (Deutsch & Gerard 1955).** Конформность растёт из двух конфликтов:
  мотивационного (хочу быть принятым — нормативное влияние) и когнитивного (хочу быть правым — информационное)
  ([Wikipedia, Conformity](https://en.wikipedia.org/wiki/Conformity), DOI 10.1037/h0046408).
- **Три процесса Кельмана (1958).** Уступчивость (публично согласен, внутри нет), идентификация, интернализация (самое
  глубокое влияние) ([Wikipedia, Conformity](https://en.wikipedia.org/wiki/Conformity), DOI 10.1177/002200275800200106).
- **Влияние меньшинства / теория конверсии (Moscovici 1969, 1980).** Большинство даёт публичное согласие через
  сравнение; последовательное меньшинство запускает «проверку» и чаще меняет частное мнение
  ([Wikipedia, Minority influence](https://en.wikipedia.org/wiki/Minority_influence)).
- **Состояние агента (Milgram).** Подчиняясь, человек видит себя инструментом чужой воли и снимает с себя
  ответственность ([Wikipedia, Milgram experiment](https://en.wikipedia.org/wiki/Milgram_experiment)). **Альтернатива —
  «вовлечённое следование» (engaged followership, Haslam & Reicher):** участники действовали не по приказу, а потому что
  идентифицировались с научной целью; на прямые приказы реагировали хуже, чем на апелляции к важности науки
  ([Wikipedia, Milgram experiment](https://en.wikipedia.org/wiki/Milgram_experiment), DOI 10.1111/josi.12072).
- **Когнитивный диссонанс (Festinger 1957).** Несовместимые представления вызывают дискомфорт, который снижают
  изменением поведения, убеждений, добавлением оправданий или игнорированием информации. Конкуренты: самовосприятие
  (Bem 1967 — человек выводит установку из своего поведения), управление впечатлением (Tedeschi 1971), самосогласованность
  (Aronson 1969), «новый взгляд» (Cooper & Fazio — диссонанс от отрицательных последствий), модель, основанная на
  действии (Harmon-Jones — мысли мешают действию) ([Wikipedia, Cognitive dissonance](https://en.wikipedia.org/wiki/Cognitive_dissonance)).
- **Теория социального сравнения (Festinger 1954).** Люди оценивают свои мнения и способности, сравнивая себя с
  другими ([Wikipedia, Leon Festinger](https://en.wikipedia.org/wiki/Leon_Festinger)).
- **Атрибуция.** Хайдер (1958): люди — «наивные психологи», различают внутренние и внешние причины. Джонс и Дэвис
  (1965): соответствующий вывод о черте сильнее, если поступок намеренный, свободный и социально нежелателен. Келли
  (1967): модель ковариации — согласованность с другими, отличительность, постоянство; в проверках люди сильнее всего
  взвешивают постоянство, слабее всего — согласованность (McArthur 1972). Вайнер (1985): локус, стабильность,
  контролируемость причины определяют ожидания и эмоции
  ([Simply Psychology, Attribution](https://www.simplypsychology.org/attribution-theory.html)).
- **Установки.** Трёхкомпонентная модель (аффект — поведение — познание; Rosenberg & Hovland 1960); сила установки
  (важность, знание, доступность; модель MODE Фацио 1986); принцип соответствия Ajzen & Fishbein 1977 — установка
  предсказывает поведение, если они измерены на одном уровне общности
  ([Simply Psychology, Attitudes](https://www.simplypsychology.org/attitudes.html)). **Теория планируемого поведения
  (Ajzen 1991):** установка + субъективная норма + воспринимаемый контроль → намерение → поведение
  ([Armitage & Conner 2001](https://scilit.com/publications/c73884734a474be9066d878392f16075)).
- **Теория социальной идентичности (Tajfel & Turner 1979) и самокатегоризации.** Часть «Я» — членство в группах;
  стремление к положительной отличительности порождает фаворитизм к своей группе даже при случайном делении. Теория
  самокатегоризации объясняет групповую поляризацию: члены сдвигаются к прототипу группы, отличающему её от чужих
  ([Simply Psychology, Group polarization](https://www.simplypsychology.org/group-polarization.html)).
- **Модель содержания стереотипов (Fiske et al. 2002).** Стереотипы раскладываются по теплоте и компетентности, которые
  следуют из конкуренции и статуса групп. **Devine 1989:** стереотип активируется автоматически почти одинаково у людей
  с высоким и низким предубеждением, различие — в контроле ([Wikipedia, Stereotype](https://en.wikipedia.org/wiki/Stereotype)).
- **Гипотеза контакта (Allport 1954).** Контакт между группами при определённых условиях снижает предубеждение
  ([FORRT, гл. 12](https://forrt.org/open-social-psychology/chapter12.html)).
- **Социальная фасилитация.** Zajonc 1965: присутствие других повышает возбуждение (драйв) → помогает простым и
  заученным задачам, мешает сложным. Henchy & Glass 1968 / Cottrell 1972: дело в страхе оценки, а не в присутствии.
  Baron: теория «отвлечение — конфликт» ([Wikipedia, Social facilitation](https://en.wikipedia.org/wiki/Social_facilitation)).
- **Эффект свидетеля: пятишаговая модель (Latané & Darley 1970).** Заметить → понять как чрезвычайное → принять
  ответственность → выбрать способ → помочь. Механизмы: размывание ответственности, плюралистическое неведение
  ([Wikipedia, Bystander effect](https://en.wikipedia.org/wiki/Bystander_effect)).
- **Групповое мышление (Janis 1972/1982).** Восемь симптомов в трёх типах (переоценка группы, закрытость, давление к
  единообразию) ([Wikipedia, Groupthink](https://en.wikipedia.org/wiki/Groupthink)).
- **Групповая поляризация.** Объяснения: убеждающие аргументы (Burnstein & Vinokur 1977 — обмен аргументами поляризует
  сильнее, чем знание позиций), социальное сравнение, самокатегоризация
  ([Simply Psychology, Group polarization](https://www.simplypsychology.org/group-polarization.html)).

## 1.4 Таблица ключевых эффектов

| # | Эффект | Кто, год | Суть | Сила (размер, метаанализ, n) | Статус | Источник |
|---|---|---|---|---|---|---|
| 1 | Конформность в задаче с линиями (conformity) | Asch 1951, 1956 | Человек соглашается с явно неверным единодушным большинством | 123 студента; ошибок на критических пробах 32 %; хотя бы раз уступили 75 %; без давления точность 99 %; с одним союзником — 5 %. Мета 133 исследований из 17 стран: в США конформность снижается с 1950-х, выше в коллективистских культурах. Повтор 2023 (n = 210): 33 % ошибок; с оплатой за верный ответ 25 %; на политических утверждениях 38 % | ✅ эффект есть, слабее и культурно зависим | [FORRT, гл. 21](https://forrt.org/open-social-psychology/chapter21.html); [Bond & Smith 1996](https://www.proquest.com/docview/614318101); [Franzen & Mader 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10686423/) |
| 2 | Информационное влияние, норма в неопределённости | Sherif 1935; Baron et al. 1996 | В неясной ситуации оценки сходятся к групповой | Свидетельское опознание: при «важной» задаче уступали в 51 %, при «неважной» — в 35 % | ⬜ массовых репликаций не нашёл | [Wikipedia, Social proof](https://en.wikipedia.org/wiki/Social_proof) |
| 3 | Влияние меньшинства | Moscovici 1969 | Последовательное меньшинство сдвигает большинство | Мета Wood et al. 1994 существует (Psychol Bull 115(3)), числа не найдены | ⬜ | [Wikipedia, Minority influence](https://en.wikipedia.org/wiki/Minority_influence); [Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence) |
| 4 | Подчинение авторитету (obedience) | Milgram 1963 | Обычные люди по указанию «бьют током» другого | 40 мужчин: 65 % дошли до 450 В, все — до 300 В. Мета 21 условия, N = 740: 43,6 % до 450 В. По условиям (по вторичному источнику): ученик в той же комнате 40 %, рука на пластине 30 %, двое бунтующих рядом 10 %, участник лишь передаёт приказ 92,5 % | ✅ поведение воспроизводится, механизм спорен | [Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment); [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/milgram-obedience/) (Haslam, Loughnan & Perry 2014, DOI 10.1371/journal.pone.0093927) |
| 5 | Повторы Милгрэма | Burger 2009; Doliński 2017; TV 2010 | Подчинение в наши дни | Burger: n = 70, остановка на 150 В; продолжили 70 % против 82,5 % у Милгрэма (разница незначима). Польша: n = 80, 90 % дошли до максимума схемы. Французское ТВ: из 80 остановились 16 | ✅ | [APA Monitor 2009](https://www.apa.org/monitor/2009/03/milgram); [SPSP 2017](https://www.spsp.org/news-center/press-releases/milgram-poland-obey); [Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment) |
| 6 | Диссонанс: вынужденное согласие (induced compliance) | Festinger & Carlsmith 1959 | За $1 «скучно → интересно» убеждаешь себя сильнее, чем за $20 | Оригинал: 71 студент. Многоцентровый повтор 2024: 39 лабораторий, 19 стран, N = 4 898 — высокий и низкий выбор не различаются (ds < 0,05, мощность 95 %); само написание эссе против своей позиции установку сдвигает (~1 балл из 9) и вызывает дискомфорт (ds > 0,22) | ❌ ключевое предсказание (роль выбора) не воспроизвелось | [Vaidis et al. 2024](https://research.sabanciuniv.edu/id/eprint/49125/); [FORRT, гл. 3](https://forrt.org/open-social-psychology/chapter3.html); [Wikipedia, Cognitive dissonance](https://en.wikipedia.org/wiki/Cognitive_dissonance) |
| 7 | Диссонанс: «свободный выбор» (spreading of alternatives) | 1956 (225 студенток) | После выбора выбранное нравится больше, отвергнутое — меньше | Chen & Risen 2010: схема «оценка — выбор — оценка» сама даёт такой сдвиг без диссонанса | ⚠ метод под сомнением | [Wikipedia, Cognitive dissonance](https://en.wikipedia.org/wiki/Cognitive_dissonance) |
| 8 | Оправдание усилия (effort justification) | Aronson & Mills 1959 | Тяжёлое «посвящение» → группа нравится больше | Числа и повторы не найдены | ⬜ | [Wikipedia, Cognitive dissonance](https://en.wikipedia.org/wiki/Cognitive_dissonance) |
| 9 | Ошибка соответствия / фундаментальная ошибка атрибуции | Jones & Harris 1967; Ross 1977 | Поведение под давлением ситуации приписывают характеру | Jones (1990): «кандидат в самые устойчивые и воспроизводимые находки соцпсихологии». Переосмысление 2022: при вероятностной (а не жёсткой) силе ситуации такой вывод рационален | ✅ эффект; ⚠ трактовка как «ошибки» | [Walker, Smith & Vul 2022](https://www.mit.edu/~k2smith/pdf/Walker_Smith_Vul_CorrBias_2022.pdf); [Wikipedia, FAE](https://en.wikipedia.org/wiki/Fundamental_attribution_error) |
| 10 | Асимметрия «действующий — наблюдатель» (actor–observer) | Jones & Nisbett 1971 | Себя объясняем ситуацией, других — чертами | Мета 173 опубликованных исследований: d от −0,016 до 0,095; для негативных событий есть, для позитивных — обратная | ❌ в общем виде | [Malle 2006](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_69016611) |
| 11 | Самообслуживающая атрибуция (self-serving bias) | Miller & Ross 1975 | Успех — себе, неудачу — обстоятельствам | Мета у спортсменов: 69 исследований, 10 515 человек, SMD 0,62 (личные исходы), 0,63 (командные); вероятно завышено публикационным смещением | ✅ с оговоркой | [Simply Psychology, Attribution](https://www.simplypsychology.org/attribution-theory.html) (Allen et al. 2020, DOI 10.1177/0146167219893995) |
| 12 | Разрыв установки и поведения; теория планируемого поведения | LaPiere 1934; Ajzen 1991 | Установка плохо предсказывает поступок, намерение и контроль — лучше | Лапьер: 251 заведение, 1 отказ; из 128 ответивших письменно >90 % «не обслужим». Мета ТПП: 185 исследований, 39 % дисперсии намерения, 27 % — поведения | ✅ (корреляционные данные) | [Simply Psychology, Attitudes](https://www.simplypsychology.org/attitudes.html); [Armitage & Conner 2001](https://scilit.com/publications/c73884734a474be9066d878392f16075) |
| 13 | Имплицитные установки (IAT) | Greenwald et al. 1998 | Скорость ассоциаций выдаёт скрытые установки | IAT плохо предсказывает дискриминацию, не лучше явных мер (Oswald 2013). Мета 492 исследований, 87 418 человек: имплицитные меры меняются слабо (\|d\| < 0,30), поведение — «тривиально». Schimmack 2021: нет доказательств, что IAT меряет что-то отличное от явных мер | ⚠ валидность как меры индивидуальных установок не доказана | [Oswald et al. 2013](https://ersearch2.cvtisr.sk/vufind/SummonRecord/FETCH-LOGICAL-a541t-fa5b6ddccd2f56f5bf71426a9064af38b3a843dedfcd8e3e4f9ec8682348baaa2?lng=en); [Forscher et al. 2019](https://scholarworks.uark.edu/psycpub/1); [FORRT, гл. 15](https://forrt.org/open-social-psychology/chapter15.html) |
| 14 | Минимальная группа / фаворитизм к своим | Tajfel 1970, 1971 | Случайного деления хватает для пристрастия к «своим» | Мета кооперации: d = 0,32 (без взаимозависимости 0,19, при взаимозависимости 0,42). Исследование в 20 странах (2025): фаворитизм везде, сила разная | ✅ | [Balliet et al. 2014](https://dare.uva.nl/id/6a43594a-d6ad-40d8-87f3-4f3c413629f2); [FORRT, гл. 9](https://forrt.org/open-social-psychology/chapter9.html) |
| 15 | Межгрупповой контакт (contact hypothesis) | Allport 1954 | Контакт снижает предубеждение | Мета 515 исследований, 713 выборок, >250 000 человек, d ≈ 0,43, но лишь ~5 % — настоящие эксперименты. 27 полевых экспериментов: d ≈ 0,39 (Paluck 2019); 418 экспериментов — признаки публикационного смещения (Paluck 2021); предрегистрированные РКИ: d ≈ 0,1 (Lowe 2025) | ⚠ эффект есть, но вчетверо меньше классической оценки | [FORRT, гл. 12](https://forrt.org/open-social-psychology/chapter12.html) |
| 16 | Угроза стереотипа (stereotype threat) | Steele & Aronson 1995 | Напоминание о стереотипе ухудшает результат теста | Регистрированный отчёт: N = 2 064 голландских школьника 13–14 лет — эффекта у девочек нет, модераторы не работают. Метаанализы показывают неоднородность и публикационное смещение | ⚠ / ❌ для математики у девочек | [Flore, Mulder & Wicherts 2018](https://research.tilburguniversity.edu/en/publications/the-influence-of-gender-stereotype-threat-on-mathematics-test-sco/); [FORRT, гл. 11](https://forrt.org/open-social-psychology/chapter11.html) |
| 17 | Социальная фасилитация | Triplett 1898; Zajonc 1965 | Рядом с другими простое — быстрее, сложное — хуже | Мета 241 исследования (Bond & Titus 1983; числа не получены). Предрегистрированный повтор Триплетта (>400 детей 7–13 лет): быстрее вместе. Тараканы Зайонца (Halfmann 2020): медленнее в присутствии других на обеих задачах | ✅ для простых задач; ⚠ теория драйва | [FORRT, гл. 8](https://forrt.org/open-social-psychology/chapter8.html); [Wikipedia, Social facilitation](https://en.wikipedia.org/wiki/Social_facilitation) |
| 18 | Социальная леность (social loafing) | Ringelmann 1913; Latané 1979 | В группе каждый вкладывает меньше | 1 человек ~100, двое ~180 единиц силы; Ingham 1974 повторил, в т. ч. с завязанными глазами (мотивация, а не координация). Мета Karau & Williams 1993 есть, числа не получены (страница заблокирована) | ✅ (числа меты ⬜) | [FORRT, гл. 7](https://forrt.org/open-social-psychology/chapter7.html) |
| 19 | Эффект свидетеля (bystander effect) | Darley & Latané 1968 | Чем больше свидетелей, тем реже/позже помогает каждый | Latané & Nida 1981: 56 исследований, ≥6 000 человек, в 48 из 56 одиночки помогали чаще (~75 % против <53 %). Мета 2011: g = −0,35, 105 эффектов, >7 700 человек; слабее в опасных ситуациях | ✅ в лаборатории | [FORRT, гл. 13](https://forrt.org/open-social-psychology/chapter13.html); [Fischer et al. 2011](https://pred.uni-regensburg.de/id/eprint/20599/) |
| 20 | Помощь в реальных конфликтах | Philpot et al. 2020 | Записи камер в Великобритании, Нидерландах, ЮАР | 219 конфликтов: хотя бы один свидетель вмешался примерно в 9 из 10; чем больше свидетелей, тем вероятнее помощь | ✅ (ограничивает перенос п. 19 на улицу) | [Philpot et al. 2020](https://eprints.lancs.ac.uk/id/eprint/134891) |
| 21 | Дело Китти Дженовезе «38 равнодушных» | NYT 1964 | Миф-основание эффекта свидетеля | Manning, Levine & Collins 2007: видели нападение гораздо меньше 38, полицию вызывали; NYT в 2016 г. назвала свой репортаж ошибочным | ❌ как факт | [Wikipedia, Bystander effect](https://en.wikipedia.org/wiki/Bystander_effect) |
| 22 | Стэнфордский тюремный эксперимент | Zimbardo 1971 | Роль «охранника» сама порождает жестокость | 24 мужчины из 75 заявок, остановлен на 6-й день из 14. 81 % студентов по описанию угадали гипотезу, 90 % предсказали жестокость охраны (Banuazizi & Movahedi 1975). Охране давали указания; записано <15 % из 150 часов; 11 из 17 правил скопированы из студенческого проекта | ❌ как доказательство «силы роли» | [Le Texier 2019](https://www.Gwern.net/doc/psychology/2019-letexier.pdf); [FORRT, гл. 10](https://forrt.org/open-social-psychology/chapter10.html); [Wikipedia, SPE](https://en.wikipedia.org/wiki/Stanford_prison_experiment) |
| 23 | Групповое мышление (groupthink) | Janis 1972 | Сплочённая группа подавляет несогласие и ошибается | Park 1990: всего 16 эмпирических работ, поддержка «частичная», сплочённость не влияет. Kramer 1998: президенты в заливе Свиней и Вьетнаме чаще звали внешних экспертов, чем писал Дженис | ⚠ | [Wikipedia, Groupthink](https://en.wikipedia.org/wiki/Groupthink) |
| 24 | Групповая поляризация | Stoner 1961; Moscovici & Zavalloni 1969 | Обсуждение сдвигает группу к крайности её исходного уклона | ~140 школьников: к де Голлю — ещё теплее, к американцам — ещё холоднее. Мета Isenberg 1986 подтверждает (DOI 10.1037/0022-3514.50.6.1141), числа не получены | ✅ | [Simply Psychology, Group polarization](https://www.simplypsychology.org/group-polarization.html) |
| 25 | Описательные нормы (мусор) | Cialdini, Reno & Kallgren 1990 | Делаем, как «тут принято», если норма заметна | Выбросили листовку: чисто и актёр прошёл мимо — 14 %, чисто и актёр мусорит — 6 %, грязно и мимо — 32 %, грязно и мусорит — 54 %. Повтор Bergquist 2021 — подтвердился. Мета 572 статей из 56 стран (Helferich 2023) | ✅ | [FORRT, гл. 22](https://forrt.org/open-social-psychology/chapter22.html) |
| 26 | Поведенческий прайминг «старость → медленная ходьба» | Bargh, Chen & Burrows 1996 | Слова о старости замедляют шаг | Оригинал: N = 30, 8,23 с против 7,3 с на 9,75 м. Повтор 2012: 120 человек, инфракрасный хронометр — эффекта нет; эффект появлялся, только когда экспериментатор ждал замедления | ❌ | [Doyen et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3261136); [FORRT, гл. 19](https://forrt.org/open-social-psychology/chapter19.html) |
| 27 | Денежный прайминг | Vohs, Mead & Goode 2006 | Мысль о деньгах делает самодостаточнее и менее отзывчивым | 9 предрегистрированных повторов (>1 800 человек): d ≈ 0,03. Мета 246 исследований: наивно g = 0,31, в 47 предрегистрированных g = 0,01 | ❌ | [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/money-priming/) (Rohrer et al. 2015, DOI 10.1037/xge0000058; Lodder et al. 2019, DOI 10.1037/xge0000570) |
| 28 | Истощение эго (ego depletion) | Baumeister 1998 | Самоконтроль — расходуемый ресурс | RRR 2016: 23 лаборатории, N = 2 141, d = 0,04 [−0,07; 0,15]. Многоцентровое 2021: 36 лабораторий, N = 3 531, d = 0,06, незначимо | ❌ | [Hagger et al. 2016](https://cris.maastrichtuniversity.nl/en/publications/a-multilab-preregistered-replication-of-the-ego-depletion-effect/); [Vohs et al. 2021](https://experts.umn.edu/en/publications/a-multisite-preregistered-paradigmatic-test-of-the-ego-depletion-/) |
| 29 | Лицевая обратная связь (ручка в зубах) | Strack, Martin & Stepper 1988 | «Улыбка» ручкой делает комиксы смешнее | Оригинал N = 92 и 83. RRR 2016, 17 лабораторий — не повторилось. Many Smiles 2022: N = 3 878, 19 стран — эффекты малые; произвольная улыбка — да, ручка — неясно; с видеокамерой эффект пропадает (Noah 2018) | ⚠ мал и зависит от условий; ❌ ручка | [FORRT, гл. 17](https://forrt.org/open-social-psychology/chapter17.html) |
| 30 | Позы силы (power posing) | Carney, Cuddy & Yap 2010 | 2 минуты «позы силы» меняют гормоны и риск | Оригинал n = 42. Повтор n = 200: только самоотчёт о силе. Мета 88 исследований, 9 779 человек: самоотчёт — да, физиология — нет, поведение — под подозрением смещения. Первый автор (2016) публично отказалась от эффекта | ❌ гормоны и поведение; ⚠ самоотчёт | [FORRT, гл. 27](https://forrt.org/open-social-psychology/chapter27.html) |

## 1.5 Методы исследования

- **Лабораторный эксперимент с подставными и обманом** — Аш (7–9 подставных), Милгрэм (подставной «ученик»), Дарли и
  Латане (записанный «припадок») ([FORRT, гл. 21](https://forrt.org/open-social-psychology/chapter21.html);
  [FORRT, гл. 13](https://forrt.org/open-social-psychology/chapter13.html)).
- **Минимальные парадигмы** — случайное деление на группы (Тэшфел), чтобы отделить «чистый» эффект категоризации
  ([FORRT, гл. 9](https://forrt.org/open-social-psychology/chapter9.html)).
- **Полевые эксперименты** — листовки и мусор (Cialdini 1990), просьбы на улице (Genschow 2021, см. часть 2)
  ([FORRT, гл. 22](https://forrt.org/open-social-psychology/chapter22.html)).
- **Опросы и корреляционные модели** — теория планируемого поведения, контакт (лишь ~5 % исследований контакта —
  эксперименты) ([FORRT, гл. 12](https://forrt.org/open-social-psychology/chapter12.html)).
- **Имплицитные меры** (IAT) — со спорной валидностью (1.4, п. 13).
- **Наблюдение реального поведения по записям** — камеры видеонаблюдения (Philpot 2020).
- **Архивный и исторический анализ** — аудиозаписи и архивы Милгрэма (Perry; Gibson 2013), архивы SPE (Le Texier)
  ([atticusli, вторичн.](https://www.atticusli.com/replication-crisis/milgram-obedience/);
  [Le Texier 2019](https://www.Gwern.net/doc/psychology/2019-letexier.pdf)).
- **Виртуальная реальность** — Милгрэм с виртуальным учеником: физиологическая реакция как на настоящего (Slater 2006)
  ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)).
- **Нейронаука** — конформность и fMRI (Berns 2005), стимуляция медиальной префронтальной коры снижает конформность
  (Klucharev 2011) ([Wikipedia, Conformity](https://en.wikipedia.org/wiki/Conformity)).
- **Агентное моделирование** — подражательные суициды (Mesoudi 2009) ([Wikipedia, Social proof](https://en.wikipedia.org/wiki/Social_proof)).
- **Кросс-культурные мета- и многострановые исследования** — Bond & Smith 1996; 20 стран по минимальной группе (2025).
- **Инструменты после кризиса** — метаанализы с поправкой на смещение, зарегистрированные отчёты (Registered Reports),
  многоцентровые повторы (Many Labs, RRR), предрегистрация (1.7).

## 1.6 Что опровергнуто, переоценено или оспорено

1. **Стэнфордский тюремный эксперимент** — не демонстрация «силы роли»: охрану инструктировали, участники угадывали
   гипотезу, заключённым мешали уйти, данные выборочны; альтернативный «Тюремный эксперимент Би-би-си» (Reicher &
   Haslam 2006: 5 охранников, 10 заключённых, без инструкций) показал обратное — охрана не приняла роль, заключённые
   сплотились ([Le Texier 2019](https://www.Gwern.net/doc/psychology/2019-letexier.pdf);
   [FORRT, гл. 10](https://forrt.org/open-social-psychology/chapter10.html)). Возможен и самоотбор: на объявление о
   «тюремном» исследовании откликаются люди с иными чертами (Carnahan & McFarland 2007, DOI 10.1177/0146167206292689)
   ([Wikipedia, SPE](https://en.wikipedia.org/wiki/Stanford_prison_experiment)).
2. **Милгрэм: цифры держатся, трактовка «слепого подчинения» оспорена.** По Перри, полностью верили в удары лишь около
   половины; из них 66 % отказались; экспериментатор отходил от четырёх сценарных фраз (в одном сеансе — 14 раз)
   ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment);
   [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/milgram-obedience/)). Анализ архивных анкет:
   больше двух третей участников были вовлечены в «научную цель», менее 10 % — нет (Haslam, Reicher et al. 2015).
3. **Китти Дженовезе и «38 равнодушных»** — газетный миф (1.4, п. 21).
4. **Эффект свидетеля как «на улице никто не поможет»** — в реальных конфликтах помогают ~9 из 10 (Philpot 2020).
5. **Классическая парадигма вынужденного согласия в диссонансе** — роль свободы выбора не воспроизвелась (Vaidis 2024).
   Сторонники (Harmon-Jones & Harmon-Jones 2024; Pauer et al. 2024) отвечают, что выбор действует через ощущаемую
   свободу; авторы повтора называют это объяснениями задним числом (Sleegers et al. 2024)
   ([FORRT, гл. 3](https://forrt.org/open-social-psychology/chapter3.html)).
6. **Свободный выбор в диссонансе** — методический артефакт (Chen & Risen 2010).
7. **Асимметрия «действующий — наблюдатель»** — в общем виде нет (Malle 2006).
8. **Поведенческий и денежный прайминг** — не воспроизвелись (1.4, пп. 26–27). Даниэль Канеман в 2012 г. публично
   предупредил область о «надвигающейся катастрофе» с праймингом
   ([atticusli, хаб, вторичн.](https://www.atticusli.com/replication-crisis/)).
9. **Истощение эго, позы силы, ручка в зубах** — не воспроизвелись (1.4, пп. 28–30).
10. **Угроза стереотипа** — эффект в крупном регистрированном отчёте отсутствует; ранние метаанализы завышены
    публикационным смещением (1.4, п. 16).
11. **IAT как мера скрытого расизма человека** — плохо предсказывает поведение; изменение IAT не меняет поведение
    (1.4, п. 13).
12. **Групповое мышление как закон** — эмпирически подтверждено частично; Baron (2005) считает, что «предпосылки»
    Джениса не нужны для симптомов ([Wikipedia, Groupthink](https://en.wikipedia.org/wiki/Groupthink)).
13. **Тараканы Зайонца** — повтор 2020 не подтвердил «быстрее на простой задаче» (1.4, п. 17).
14. **Контакт между группами** — эффект переоценён примерно вчетверо (1.4, п. 15).
15. **Фальсификации.** Дидерик Стапел (социальная психология, Нидерланды) — 57 отзывов статей по подсчёту Retraction
    Watch; комиссия установила подлог в десятках работ ([Retraction Watch 2015](https://retractionwatch.com/2015/10/20/diederik-stapel-retraction-count-updated-to-57)).
    В сентябре 2026 г. Data Colada заявила о вероятной подделке данных в Ariely & Wertenbroch 2002 (самоназначенные
    дедлайны); соавтор просит отзыв, повтор не удался — это обвинение, не завершённый отзыв
    †([Poets&Quants, 02.09.2026](https://poetsandquants.com/2026/09/02/data-colada-accuses-dukes-dan-ariely-of-tampering-with-data-in-a-2nd-influential-study/)).

## 1.7 Современное состояние и главные споры (2015–2026)

- **Кризис воспроизводимости ударил по соцпсихологии сильнее всего.**
  - OSC 2015: из 100 исследований значимы были 97 оригиналов и 35 из 97 повторов (36 %); средний эффект упал с
    r = 0,403 до 0,197. Социальная психология — 14 из 55 (25 %; JPSP — 7 из 31, 23 %), когнитивная — 21 из 42 (50 %)
    ([OSC 2015, PDF](https://discovery.dundee.ac.uk/ws/files/7385883/RPP_SCIENCE_2015.pdf)).
  - Many Labs 2 (2018): 28 эффектов, 125 выборок, 15 305 человек из 36 стран; повторились 15 (54 %) при p < 0,05;
    медианный d — 0,60 в оригиналах и 0,15 в повторах; 9 (32 %) — в обратную сторону. Различия «WEIRD / не-WEIRD»,
    онлайн/лаборатория почти ничего не объясняли: судьба результата зависит от самого эффекта, а не от выборки
    ([Klein et al. 2018](https://eprints.lse.ac.uk/91159)).
  - Повторы до кризиса были редкостью: ~1,6 % публикаций в топ-100 журналах (1900–2012); при участии авторов оригинала
    успех 91,7 %, без них — 64,6 % (Makel, Plucker & Hegarty 2012)
    ([зеркало Wikipedia, Replication crisis](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Replication_crisis.html)).
- **Что выдержало проверку:** конформность Аша (слабее), подчинение (поведение), фаворитизм к своим, фасилитация на
  простых задачах, эффект свидетеля в лаборатории, описательные нормы, ошибка соответствия как явление, групповая
  поляризация. **Что рухнуло:** социальный прайминг, истощение эго, позы силы, ручка в зубах, диссонанс в классической
  схеме выбора, SPE.
- **Спор о классических экспериментах как «демонстрациях»**: Zimbardo, Reicher и Haslam выпустили совместное заявление
  (2018), что оба тюремных исследования ценны; ответы на Le Texier — Haslam, Reicher & Van Bavel 2019 (DOI
  10.1037/amp0000443) и Zimbardo & Haney 2020 (DOI 10.1037/amp0000593) ([Wikipedia, SPE](https://en.wikipedia.org/wiki/Stanford_prison_experiment)).
- **Поворот к социальной идентичности:** и подчинение (вовлечённое следование), и тюремные исследования, и эффект
  свидетеля (свидетели из «своей» группы помогают чаще — Levine et al. 2005) переобъясняются через идентификацию с
  группой ([FORRT, гл. 13](https://forrt.org/open-social-psychology/chapter13.html);
  [Haslam & Reicher 2017, Annual Review, DOI 10.1146/annurev-lawsocsci-110316-113710](https://en.wikipedia.org/wiki/Milgram_experiment)).
- **«Искажения» как рациональный вывод:** ошибку соответствия переописывают как разумный байесовский вывод при
  вероятностной силе ситуации ([Walker, Smith & Vul 2022](https://www.mit.edu/~k2smith/pdf/Walker_Smith_Vul_CorrBias_2022.pdf)).
- **Имплицитные меры** — спор о валидности IAT не закрыт (Schimmack 2021 против авторов IAT).
- **Внешняя валидность** — переход от лабораторий к записям реального поведения (камеры) и к предрегистрированным
  полевым РКИ (контакт: d ≈ 0,1).

## 1.8 Что читать

| Автор, год | Работа | Русский перевод |
|---|---|---|
| Asch 1956 | «Studies of independence and conformity», Psychological Monographs 70(9) ([FORRT, гл. 21](https://forrt.org/open-social-psychology/chapter21.html)) | перевод не проверен |
| Festinger 1957 | «A Theory of Cognitive Dissonance» ([FORRT, гл. 3](https://forrt.org/open-social-psychology/chapter3.html)) | перевод не проверен (лимит поиска) |
| Allport 1954 | «The Nature of Prejudice» ([Wikipedia, Stereotype](https://en.wikipedia.org/wiki/Stereotype)) | перевод не проверен |
| Milgram 1974 | «Obedience to Authority: An Experimental View» ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)) | перевод не проверен (лимит поиска) |
| Latané & Darley 1970 | «The Unresponsive Bystander» ([Wikipedia, Bystander effect](https://en.wikipedia.org/wiki/Bystander_effect)) | перевод не проверен |
| Janis 1972/1982 | «Victims of Groupthink» / «Groupthink» ([Wikipedia, Groupthink](https://en.wikipedia.org/wiki/Groupthink)) | перевод не проверен |
| Haslam & Reicher 2017 | «50 Years of "Obedience to Authority"», Annual Review of Law and Social Science ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)) | — (статья) |
| Le Texier 2018 | «Histoire d'un mensonge: enquête sur l'expérience de Stanford» ([Wikipedia, SPE](https://en.wikipedia.org/wiki/Stanford_prison_experiment)) | перевод не проверен |
| Perry 2012/2013 | «Behind the Shock Machine» ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)) | перевод не проверен |
| FORRT (2024–2026) | «Open Social Psychology» — открытый учебник, где у каждой классики есть раздел о репликациях ([FORRT](https://forrt.org/open-social-psychology/)) | нет |

## 1.9 Этические и правовые границы

- **Милгрэм.** Baumrind (1964, American Psychologist) — экспериментатор обязан защищать участника и должен был
  прекращать сеансы при явном страдании; эта критика повлияла на пересмотр этических стандартов
  ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)). Архивы показывают страдание участников и
  отложенный разбор (debriefing) (Nicholson 2011, «Torture at Yale», DOI 10.1177/0959354311420199)
  ([atticusli, вторичн.](https://www.atticusli.com/replication-crisis/milgram-obedience/)).
- **Повтор возможен только с изменениями:** Burger получил одобрение этического комитета, остановив процедуру на 150 В
  ([Wikipedia, Milgram](https://en.wikipedia.org/wiki/Milgram_experiment)).
- **SPE.** Протокол предусматривал отговаривать заключённых от выхода, реальных путей выхода почти не было; охрану не
  предупредили, что она тоже объект исследования ([Le Texier 2019](https://www.Gwern.net/doc/psychology/2019-letexier.pdf)).
- **Обман и разбор.** Обман участников — стандартный инструмент дисциплины (подставные, легенды). Конкретные нормы
  (Кодекс АПА, ст. 8.07 «Обман в исследовании» и 8.08 «Разбор»; Отчёт Бельмонта) — ⬜ страницы APA и HHS в этом
  прогоне не открылись, формулировки не привожу.

---

# ЧАСТЬ 2. ПСИХОЛОГИЯ ВЛИЯНИЯ И УБЕЖДЕНИЯ (persuasion, social influence, compliance)

## 2.1 Что изучает, границы, названия

- **Предмет.** Как сообщения и просьбы меняют установки, убеждения и поведение: кто говорит (источник), что и как
  (сообщение), кому (получатель), каким каналом — и почему одни сообщения работают, а другие отторгаются. Модель
  «источник — сообщение — канал — получатель» восходит к Йельской группе Ховланда
  ([Wikipedia, Carl Hovland](https://en.wikipedia.org/wiki/Carl_Hovland)).
- **Три смежных понятия.**
  - **Убеждение (persuasion)** — изменение установки через доводы или символы, апеллируя к разуму или эмоциям
    ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)).
  - **Согласие, уступчивость (compliance)** — изменение поведения в ответ на просьбу, без обязательного изменения
    частной установки (Kelman 1958; обзор Cialdini & Goldstein 2004, Annual Review of Psychology, DOI
    10.1146/annurev.psych.55.090902.142015) ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)).
  - **Конформность и подчинение** — влияние группы и авторитета (часть 1).
- **Граница с манипуляцией.** В литературе манипуляцию отличают от убеждения: она эксплуатирует уязвимости человека
  (Van Dijk 2006, DOI 10.1177/0957926506060250), это «скрытое влияние» на слабые места принятия решений (Susser,
  Roessler & Nissenbaum 2019, DOI 10.14763/2019.2.1410); в этике — неправа, когда непрозрачна, подрывает автономию,
  выгодна манипулятору за счёт объекта (Ienca 2023, DOI 10.1007/s11245-023-09940-3)
  ([Wikipedia, Psychological manipulation](https://en.wikipedia.org/wiki/Psychological_manipulation)).
- **Названия и соседи.** Наука об убеждении (persuasion science), исследования установок и их изменения (attitude
  change), социальное влияние, коммуникативистика (communication science), исследования потребителя (consumer research);
  исторический корень — риторика Аристотеля (этос, логос, пафос) ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)).

## 2.2 История: основатели и ключевые работы

| Год | Кто | Что |
|---|---|---|
| Античность | Аристотель | Этос, логос, пафос ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)) |
| 1942 | Карл Ховланд (1912–1961) | Сэмюэл Стауффер привлёк его к армейским исследованиям; команда из 15 человек изучала фильмы «Why We Fight» ([Wikipedia, Carl Hovland](https://en.wikipedia.org/wiki/Carl_Hovland)) |
| 1949 | Hovland, Lumsdaine & Sheffield | «Experiments on Mass Communication»: через 5 дней эффекта фильма не было, через 9 недель мнения сдвинулись — открытие «эффекта спящего» ([Encyclopedia.com, Kumkale](https://www.encyclopedia.com/social-sciences/applied-and-social-sciences-magazines/sleeper-effects)) |
| 1951 | Hovland & Weiss | Доверие к источнику и эффективность сообщения (DOI 10.1086/266350) ([Wikipedia, Sleeper effect](https://en.wikipedia.org/wiki/Sleeper_effect)) |
| 1953 | Hovland, Janis & Kelley | «Communication and Persuasion» — программа Йельской группы ([Wikipedia, Carl Hovland](https://en.wikipedia.org/wiki/Carl_Hovland)) |
| 1958 | Kelman | Уступчивость, идентификация, интернализация ([Wikipedia, Conformity](https://en.wikipedia.org/wiki/Conformity)) |
| 1960 | Katz | Функциональный подход к установкам (DOI 10.1086/266945) ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)) |
| 1961 | Sherif & Hovland | «Social Judgment» — теория социального суждения ([Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)) |
| 1961 | McGuire | Теория прививки (inoculation) — ⬜ первоисточник в этом прогоне не открыт; описание см. 2.3 |
| 1966 | Brehm | «A theory of psychological reactance» ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)) |
| 1966 | Freedman & Fraser | «Нога в двери» ([Wikipedia, FITD](https://en.wikipedia.org/wiki/Foot-in-the-door_technique)) |
| 1975, 1978 | Cialdini и соавт. | «Дверь в лицо», «низкий мяч» ([Wikipedia, DITF](https://en.wikipedia.org/wiki/Door-in-the-face_technique); [Wikipedia, Low-ball](https://en.wikipedia.org/wiki/Low-ball)) |
| 1978 | Langer, Blank & Chanowitz | «Бездумность» согласия: «потому что» без причины ([atticusli, вторичн.](https://www.atticusli.com/replication-crisis/power-of-because-langer-1978/)) |
| 1979–1986 | Petty & Cacioppo | Модель вероятности обработки (ELM); семь постулатов — 1986 ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)) |
| 1980 | Chaiken | Эвристико-систематическая модель (HSM), DOI 10.1037/0022-3514.39.5.752 ([Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)) |
| 1984 | Cialdini | «Influence»: шесть принципов, ~3 года работы «под прикрытием» в продажах и сборе средств ([Wikipedia, Robert Cialdini](https://en.wikipedia.org/wiki/Robert_Cialdini)) |
| 1994 | Friestad & Wright | Модель знания об убеждении (PKM) — ⬜ первоисточник не открыт; мета см. 2.4 |
| 2016 | Cialdini | «Pre-Suasion»: седьмой принцип — единство (unity) ([Wikipedia, Robert Cialdini](https://en.wikipedia.org/wiki/Robert_Cialdini)) |
| 2015–2025 | — | Метаанализы с поправкой на смещение, повторы (Genschow 2021), полевые мегаисследования малых эффектов (Coppock 2020) |

## 2.3 Главные теории и модели

- **Йельский подход (Hovland).** Убеждение как обучение: эффект зависит от источника, сообщения, канала и получателя.
  Источники с высоким доверием дают больше немедленного сдвига; со временем связь «источник — сообщение» слабеет
  («эффект спящего»). Йельская группа сообщала, что умеренный страх убеждает лучше сильного ([Wikipedia, Attitude
  change](https://en.wikipedia.org/wiki/Attitude_change)) — современная мета этого не подтверждает (2.4, п. 8).
- **Теория социального суждения (Sherif & Hovland 1961).** Новое сообщение оценивается относительно своей позиции
  (зоны принятия и отвержения); считается, что она плохо объясняет мотивацию интегрировать информацию
  ([Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)).
- **Модель вероятности обработки (ELM, Petty & Cacioppo 1986).** Центральный путь — обдумывание качества доводов при
  наличии мотивации и способности; установки устойчивее, лучше противостоят контрдоводам и предсказывают поведение.
  Периферический путь — опора на признаки (привлекательность, экспертность, число доводов, настроение). Одна переменная
  может играть разные роли («множественные роли»). Критика: ранние «центральные» доводы были длиннее и сложнее
  «периферических» признаков (смешение); принцип множественных ролей делает модель трудно опровергаемой; степень
  обдумывания часто выводят из самих результатов; почти все данные — студенты и короткие лабораторные задания
  ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)).
- **Эвристико-систематическая модель (HSM, Chaiken 1980).** Систематическая обработка содержания против эвристик
  («эксперт прав», «большинство право»); в отличие от ELM, оба режима могут идти одновременно — складываться или
  один искажает другой; принцип достаточности: обрабатываем, пока не достигнута нужная уверенность; позже добавлены
  мотивы защиты и впечатления ([Wikipedia, HSM](https://en.wikipedia.org/wiki/Heuristic-systematic_model_of_information_processing);
  [Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)).
- **Унимодель (Kruglanski & Thompson 1999).** Один процесс вывода «если — то»; различие «путей» сводится к трудности
  и доступности свидетельств ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)).
  Авторы ELM в 2023 г. отвечают, что модели убеждения раньше других двухпроцессных теорий учли эту критику
  ([Petty, Wegener & Briñol 2023, BBS](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/abs/how-research-on-persuasion-can-inform-dualprocess-models-of-judgment/4D3F359F440C22BC8354028A608A0D9E)).
- **Самовалидация (Briñol & Petty 2003).** Кивание усиливает убеждение при сильных доводах и ослабляет при слабых:
  меняется уверенность в собственных мыслях ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)).
- **Принципы Чалдини.** Люди, перегруженные информацией, пользуются короткими путями решения, которые обычно работают,
  но могут быть использованы «профессионалами согласия»: взаимность, обязательство и последовательность, социальное
  доказательство, симпатия, авторитет, дефицит (1984) и единство (2016)
  ([Wikipedia, Influence: Science and Practice](https://en.wikipedia.org/wiki/Influence:_Science_and_Practice)).
  Это **таксономия**, а не одна проверяемая теория; доказательная база — у каждого принципа своя (2.4).
- **Механизмы последовательных просьб.** «Нога в двери» — самовосприятие (Bem 1967): согласившись на малое, человек
  выводит «я из тех, кто помогает» ([Simply Psychology, Compliance](https://www.simplypsychology.org/compliance.html));
  Burger (1999) считает, что одним самовосприятием эффект не объясняется. «Дверь в лицо» — взаимные уступки,
  социальная ответственность, самопрезентация, вина (Millar 2002 допускал, что вина — единственное объяснение)
  ([Wikipedia, DITF](https://en.wikipedia.org/wiki/Door-in-the-face_technique)).
- **Прививка (inoculation, McGuire).** Слабая, легко опровергаемая версия довода заранее повышает устойчивость к
  сильной версии ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)). Мета — 2.4, п. 27.
- **Реактивное сопротивление (reactance, Brehm 1966).** Угроза свободе выбора вызывает желание её вернуть — вплоть до
  принятия противоположной позиции (антиконформность), даже если влияние было верным
  ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)). Современная трактовка — сплав гнева и
  контраргументации; мета — 2.4, п. 26.
- **Модель знания об убеждении (PKM, Friestad & Wright 1994).** Люди со временем узнают тактики убеждения; распознав
  тактику, они перестраивают ответ на сообщение (⬜ первоисточник не открыт). Мета — 2.4, п. 28.
- **Эффект спящего: две гипотезы.** Забывание источника или распад связи «источник — сообщение» (диссоциация);
  Hovland & Weiss нашли эффект при сохранной памяти об источнике, что поддерживает диссоциацию
  ([Encyclopedia.com, Kumkale](https://www.encyclopedia.com/social-sciences/applied-and-social-sciences-magazines/sleeper-effects)).

## 2.4 Таблица ключевых эффектов и механизмов

| # | Эффект | Кто, год | Суть | Сила (размер, метаанализ, n) | Статус | Источник |
|---|---|---|---|---|---|---|
| 1 | Взаимодействие «качество доводов × вовлечённость» (ядро ELM) | Petty, Cacioppo & Goldman 1981 | Вовлечённых убеждают доводы, невовлечённых — статус источника | Оригинал: 145 студентов. Мета Carpenter 2015: k = 134, предсказание подтверждено, в схемах «до — после» эффект слабее | ✅ с оговорками о студентах | [Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html) (DOI 10.1111/hcre.12054) |
| 2 | Число доводов как периферический признак | Petty & Cacioppo 1984 | Больше доводов — сильнее убеждение при низкой вовлечённости | Чисел и повторов не нашёл | ⬜ | [Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html) |
| 3 | Доверие к источнику и «эффект спящего» | Hovland & Weiss 1951; Hovland et al. 1949 | Сообщение от недостоверного источника со временем убеждает сильнее | Мета: 72 набора данных из 24 работ; в среднем абсолютного эффекта нет (d = 0,08, как у фона); при условии «сильный довод, признак-обесцениватель после сообщения, мотивированный и способный получатель» — d = 0,25. Gillig & Greenwald 1974 предлагали «похоронить» эффект | ⚠ узкие условия | [Kumkale & Albarracín 2004, PDF](https://www.asc.upenn.edu/sites/default/files/2021-07/e3eff4_67a5be5947dc44208b8668beb6ceadd6.pdf); [Wikipedia, Sleeper effect](https://en.wikipedia.org/wiki/Sleeper_effect) |
| 4 | Двусторонние сообщения с опровержением | Hovland et al. 1949; O'Keefe 1999 | Назвать контрдовод и опровергнуть — сильнее, чем молчать о нём | Мета: двусторонние с опровержением убедительнее односторонних и вызывают больше доверия; без опровержения — слабее; в рекламе различий почти нет | ✅ † | †[O'Keefe 1999](https://doi.org/10.1080/23808985.1999.11678963) |
| 5 | Апелляция к страху (fear appeals) | Janis & Feshbach 1953 (Йель) | Угроза + «вот что делать» меняет поведение | Мета: 127 статей, 248 выборок, N = 27 372, d = 0,29; сильнее с утверждением эффективности рекомендации и при однократном действии; обратного эффекта не найдено | ✅ † (опровергает тезис «сильный страх вреден») | †[Tannenbaum et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC5789790/) |
| 6 | Нарратив (история) | — | Истории убеждают | Мета: убеждения r = 0,17 (k = 37, N = 7 376), установки 0,19 (k = 40), намерения 0,17 (k = 28), поведение 0,23 (k = 5); вымысел и носитель не влияют. Статистика сильнее меняет убеждения, истории — намерения (Zebregs 2015) | ✅ † | †[Braddock & Dillard 2016](https://doi.org/10.1080/03637751.2015.1128555); †[Zebregs et al. 2015](https://pubmed.ncbi.nlm.nih.gov/24836931/) |
| 7 | Рамка выгоды против рамки потерь | Tversky & Kahneman 1981 (общая идея) | «Потеряешь» убеждает сильнее «получишь»? | Мета: профилактика — 93 исследования, N = 21 656, r = 0,03 в пользу выгоды; обследования — 53 исследования, N = 9 145, r = −0,04 | ❌ преимущества потерь нет † | †[O'Keefe & Jensen 2007](https://doi.org/10.1080/10810730701615198); †[O'Keefe & Jensen 2009](https://doi.org/10.1111/j.1460-2466.2009.01417.x) |
| 8 | Иллюзия правды (illusory truth) | Hasher et al. 1977 | Повторённое кажется правдой | Мета: d = 0,39 (1-й против 2-го показа), d = 0,50 (повторённые против новых); работает даже при знании правильного ответа (Fazio 2015) | ✅ † (без поправки на публикации) | †[Dechêne et al. 2010](https://doi.org/10.1177/1088868309352251); †[Fazio et al. 2015](https://doi.org/10.1037/xge0000098) |
| 9 | Эффект простого предъявления (mere exposure) | Zajonc 1968 | Знакомое нравится больше | Мета Bornstein 1989: 208 экспериментов. Montoya et al. 2017: эффект надёжен после поправки на смещение, ослабевает при большом числе показов (перевёрнутая U), слабее для негативных стимулов | ✅ | [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/mere-exposure-effect/) (DOI 10.1037/0033-2909.106.2.265; 10.1037/bul0000085); †[11a: Montoya — 268 кривых из 81 статьи](https://doi.org/10.1037/bul0000085) |
| 10 | Взаимность (reciprocity) | Gouldner 1960; Regan 1971 | Получив услугу, отвечаем | Мета 38 исследований почтовых опросов: вознаграждение вперёд +19,1 % (деньги) и +7,9 % (вещь) к отклику, обещанное «если ответите» — эффекта нет. Обещанная награда не даёт сравнимого прироста (Tourangeau 2004). Числа Regan 1971 в пересказах расходятся | ✅ (опросы) † | †[Church 1993](https://doi.org/10.1086/269355); [Simply Psychology, Compliance](https://www.simplypsychology.org/compliance.html) (DOI 10.1146/annurev.psych.55.090902.142040) |
| 11 | «Нога в двери» (foot-in-the-door) | Freedman & Fraser 1966 | Малое согласие → большое | Знак «водите осторожно»: 76 % против 17 %. Мета Beaman 1983: 120 групп, почти половина — ноль или обратный эффект (по вторичн.). Мета Dillard, Hunter & Burgoon 1984: r = 0,17, нужна просоциальная тема. Burger 1999: r ≈ 0,17 | ✅ мал | [Wikipedia, FITD](https://en.wikipedia.org/wiki/Foot-in-the-door_technique); [Dillard et al. 1984](https://pure.psu.edu/en/publications/sequentialrequest-persuasive-strategies-metaanalysis-of-footinthe/); [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/foot-in-the-door/) |
| 12 | «Дверь в лицо» (door-in-the-face) | Cialdini et al. 1975 | После отказа на большую просьбу соглашаются на малую | Оригинал: 50 % против 17 % (только малая) и 25 % (обе описаны). Метаанализы: r = 0,15 (Dillard 1984); r = 0,10 (O'Keefe & Hale 1998, по вторичн.); словесное согласие r = 0,126 (k = 78), **поведенческое r = 0,052, незначимо** (k = 39) (Feeley 2012). Прямой повтор: 391 прохожий в Германии, 51 % против 34 % | ✅ словесное согласие; ⚠ реальное поведение | [Wikipedia, DITF](https://en.wikipedia.org/wiki/Door-in-the-face_technique); [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/door-in-the-face/); [Simply Psychology, Compliance](https://www.simplypsychology.org/compliance.html) (Genschow et al. 2021, DOI 10.1037/pspa0000261) |
| 13 | «Низкий мяч» (low-ball) | Cialdini, Cacioppo, Bassett & Miller 1978 | Согласие на выгодные условия держится, когда условия ухудшают | 56 % против 31 % согласились на встречу в 7 утра; пришли 95 % против 79 %. Burger & Cornelius 2003: 77,6 % против 42 % в контроле. Мета 19 исследований: ~54 % против ~33 % | ✅ | [Wikipedia, Low-ball](https://en.wikipedia.org/wiki/Low-ball); [Simply Psychology, Compliance](https://www.simplypsychology.org/compliance.html) (Burger & Caputo 2015, DOI 10.1080/15534510.2015.1049203) |
| 14 | «Это ещё не всё» (that's-not-all) | Burger 1986 | Цена → пауза → «добавим / снизим» лучше, чем сразу лучшее предложение | 7 экспериментов одной серии; метаанализ не найден | ⚠ одна серия † | †[Burger 1986](https://doi.org/10.1037/0022-3514.51.2.277) |
| 15 | «Сбить и переформулировать» (disrupt-then-reframe) | Davis & Knowles 1999 | Странная формулировка цены, затем выгодная рамка | Мета: r = 0,28 (OR 3,47); в продажах 0,20, в некоммерческих 0,32; признаков публикационного смещения нет | ✅ † | †[Carpenter & Boster 2009](https://doi.org/10.1080/08934210903092590) |
| 16 | «Даже копейка поможет» (legitimizing paltry contributions) | Cialdini & Schroeder 1976 | Узаконить малый вклад | Мета: согласие r = 0,22 (k = 34, n = 3 181), средняя сумма меньше (r = −0,23) | ✅ † | †[Bolkan & Rains 2017](https://doi.org/10.1177/0093650215602308) |
| 17 | «Но вы свободны отказаться» (but you are free) | Guéguen & Pascual 2000 | Напоминание о свободе повышает согласие | Ранняя мета Carpenter 2013 — удвоение согласия. Предрегистрированный пересмотр: g = 0,44 в целом, но в исследованиях с низким риском смещения g = 0,11 [−0,18; 0,40]; держится только при личном общении | ⚠ / ❌ вне живого общения † | †[Fillon et al. 2023, Metapsychology](https://open.lnu.se/index.php/metapsychology/article/view/2640) |
| 18 | «Потому что» без причины (placebic information) | Langer, Blank & Chanowitz 1978 | Любое «потому что» повышает согласие на мелкую просьбу | Ксерокс, 5 страниц: просьба 60 %, настоящая причина 94 %, пустая причина 93 %; на 20 страниц пустая причина не помогает. Folkes 1985 повторил лишь частично | ⚠ только для мелких просьб | [atticusli, вторичн.](https://www.atticusli.com/replication-crisis/power-of-because-langer-1978/) (DOI 10.1037/0022-3514.36.6.635) |
| 19 | Социальное доказательство: полотенца в отеле | Goldstein, Cialdini & Griskevicius 2008 | «Большинство гостей используют полотенца повторно» | Оригинал: 44,1 % против 35,1 %. Прямой повтор в Германии (N = 724 и 204): 81,9 % против 83,7 %, различий нет. Байесовское объединение 7 исследований: ~50 % против ~56 % | ⚠ эффект мал или нестабилен † | †[Bohner & Schlüter 2014](https://doi.org/10.1371/journal.pone.0104086); †[van der Linden & Chryst 2017](https://www.frontiersin.org/articles/10.3389/fams.2017.00012/full) |
| 20 | Социальные нормы в целом | Cialdini 1990 и др. | Описательные / предписывающие нормы | Мета 110 статей: эффекты последовательные, но малые, неоднородность большая (Rhodes 2020). Мета 250 эффектов, 112 478 человек, 22 страны: описательные сильнее предписывающих; конкретная близкая группа усиливает, ссылка на авторитет — нет (Melnyk 2022). Описательная норма может дать «бумеранг» у тех, кто был лучше среднего (Schultz 2007) | ✅ мал † | †[Rhodes et al. 2020](https://doi.org/10.1093/hcr/hqz023); †[Melnyk et al. 2022](https://doi.org/10.1177/00222429211029199); [FORRT, гл. 22](https://forrt.org/open-social-psychology/chapter22.html) |
| 21 | Авторитет | Milgram 1963; знаменитости | Символы и статус повышают согласие | Подчинение — часть 1, п. 4. Мета 46 исследований, N = 10 357: эффект знаменитостей зависит от соответствия (d от 0,90 до −0,96), хуже знаков качества и наград | ✅ / ⚠ для «знаменитостей» † | †[Knoll & Matthes 2017](https://doi.org/10.1007/s11747-016-0503-8) |
| 22 | Симпатия через случайное сходство | Burger et al. 2004 | Общий день рождения или имя → больше согласия | Эффект пропадает, если сходство с кем-то другим или признак распространён; метаанализа нет | ⬜ одна серия † | †[Burger et al. 2004](https://doi.org/10.1177/0146167203258838) |
| 23 | Дефицит (scarcity) | Worchel et al. 1975; Lynn 1991 | Редкое ценится выше | Мета Lynn 1991 — эффект на ценность (число не получено). Мета 416 эффектов из 131 исследования: вид дефицита (спрос / предложение / время) действует по-разному; меряли намерение, не покупку | ⚠ † | †[Lynn 1991](https://doi.org/10.1002/mar.4220080105); †[Barton et al. 2022](https://research.monash.edu/en/publications/scarcity-tactics-in-marketing-a-meta-analysis-of-product-scarcity/) |
| 24 | Единство (unity) | Cialdini 2016 | «Мы» сильнее «похожих» | Отдельного метаанализа не найдено; ближайшее — фаворитизм к своим (часть 1, п. 14) и нормы близкой группы (п. 20) | ⬜ | [Wikipedia, Robert Cialdini](https://en.wikipedia.org/wiki/Robert_Cialdini) |
| 25 | Юмор | — | Смешное привлекает внимание | Мета 369 корреляций: внимание и отношение к сообщению — да, доверие к источнику — ниже | ✅ † | †[Eisend 2009](https://doi.org/10.1007/s11747-008-0096-y) |
| 26 | Реактивное сопротивление | Brehm 1966 | Давление на свободу вызывает отпор | Мета 35 исследований, N = 10 658 (здоровье): угрожающий язык («должен», «обязан») → угроза свободе → реактивность; связь «реактивность → убеждение» отрицательная и слабая. Контрпример: запрет слов в низкоставочной задаче реактивности не вызвал (BF₀₁ = 223). Японские «отчуждённые» студенты давали заведомо неверные ответы около трети раз (Frager 1970) | ✅ † | †[Ma, Ebesu & Dillard 2025](https://doi.org/10.1093/joc/jqaf004); †[Vaughan-Johnston et al. 2024](https://doi.org/10.3389/frsps.2024.1260974); [Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence) |
| 27 | Прививка (inoculation) | McGuire 1961 | Слабая атака + опровержение заранее защищают от сильной | Мета: 54 случая; лучше поддерживающего сообщения и контроля; держится одинаково сразу и после умеренной паузы, после двух недель слабеет | ✅ † | †[Banas & Rains 2010](https://doi.org/10.1080/03637751003758193) |
| 28 | Знание об убеждении (persuasion knowledge) | Friestad & Wright 1994 | Распознанная тактика ослабляет её | Мета 148 статей, 171 набор данных: знание об убеждении снижает, но не отменяет убеждение; сильнее всего включается при личной коммуникации. Мета по раскрытию спонсорства: доверие ниже, сопротивление выше | ✅ † | †[Eisend & Tarrahi 2021](https://doi.org/10.1002/jcpy.1258); †[Eisend et al. 2020](https://research.wur.nl/en/publications/a-meta-analysis-of-the-effects-of-disclosing-sponsored-content/) |
| 29 | Убеждение политической рекламой в поле | Coppock, Hill & Vavreck 2020 | Насколько сдвигает реальная реклама | 59 экспериментов, 49 роликов, ≈34 000 человек: сдвиг ≈0,05 по 5-балльной шкале, почти одинаковый у разных групп | ✅ эффекты малы † | †[Yale News 2020](https://news.yale.edu/2020/09/02/political-ads-have-little-persuasive-power) |
| 30 | «Нога в лицо» (foot-in-the-face) | Dolinski 2011 | Отказ в первой просьбе → согласие на вторую | 63–68 % против ~50 % у классических техник; повторов не нашёл | ⬜ | [Wikipedia, FITD](https://en.wikipedia.org/wiki/Foot-in-the-door_technique) |
| 31 | Тёмные паттерны интерфейса | Luguri & Strahilevitz 2021; Mathur 2019 | Скрытое давление в интерфейсе повышает согласие | Согласие на сомнительную услугу: контроль 11,3 %, мягкие паттерны 25,8 %, агрессивные 41,9 %. Обход ~53 тыс. страниц ~11 тыс. магазинов: 1 818 паттернов 15 типов, 183 сайта с прямым обманом | ✅ (РКИ, обход) † | †[Luguri & Strahilevitz 2021](https://doi.org/10.1093/jla/laaa006); †[Mathur et al. 2019](https://doi.org/10.1145/3359183) |

## 2.5 Методы исследования

- **Эксперименты с сообщением.** Варьируют доводы (сильные/слабые), источник, вовлечённость; меряют установку до и
  после; «перечисление мыслей» как индикатор обдумывания — при этом обдумывание часто выводят из самих результатов
  (критика ELM) ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)).
- **Полевые эксперименты с последовательными просьбами** — дверь-к-двери, улица, телефон (Freedman & Fraser; Genschow
  2021).
- **Шкалы индивидуальных различий** — потребность в познании (Cacioppo et al. 1986, DOI 10.1037/0022-3514.51.5.1032),
  самомониторинг (Snyder & DeBono 1985) ([Simply Psychology, ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html)).
- **Отсроченные замеры** — эффект спящего, затухание прививки.
- **Метаанализы**, в т. ч. с проверкой публикационного смещения и предрегистрированные (Fillon 2023), байесовское
  объединение (полотенца).
- **Прямые предрегистрированные повторы** (Genschow 2021 для «двери в лицо»).
- **Полевые РКИ большого масштаба** — политическая реклама (Coppock 2020).
- **Обход веб-сайтов и эксперименты на репрезентативных выборках** — тёмные паттерны (Mathur 2019; Luguri 2021).

## 2.6 Что опровергнуто, переоценено или оспорено

1. **«Потеря убеждает сильнее выгоды»** — в сообщениях о здоровье преимущества нет (r = 0,03 / −0,04) †.
2. **«Сильный страх вызывает отторжение»** (тезис йельской эпохи) — мета Tannenbaum 2015 обратного эффекта не нашла †.
3. **«Дверь в лицо» как способ изменить поведение** — устойчиво поднимает словесное согласие, но на поведенческом
   согласии эффект незначим (Feeley 2012).
4. **«Но вы свободны»** — «удвоение» не пережило поправку на риск смещения †.
5. **Полотенца в отеле** — прямой повтор нулевой, объединённая оценка мала †.
6. **«Нога в двери» как надёжный рычаг** — эффект мал (r ≈ 0,17), почти половина ранних исследований без эффекта.
7. **«Потому что» как универсальный ключ** — работает лишь для мелких просьб, повтор частичный.
8. **Эффект спящего как общий закон** — в среднем отсутствует, есть лишь в узких условиях (Kumkale 2004).
9. **Социальный и денежный прайминг** как инструмент влияния — не воспроизвелись (часть 1).
10. **Универсальность принципов Чалдини.** Энциклопедическая статья о книге помечает утверждение об «эмпирической
    поддержке» как «нужна ссылка» ([Wikipedia, Influence](https://en.wikipedia.org/wiki/Influence:_Science_and_Practice));
    для единства и случайного сходства метаанализов нет; соцдоказательство и авторитет дают малые и зависимые от
    условий эффекты (2.4, пп. 19–24).
11. **ELM как исчерпывающая модель** — вопросы к опровергаемости и к доказательствам на студентах; конкурент —
    унимодель (2.3).
12. **Сильная массовая персуазия** — в полевых условиях эффекты реальной политической рекламы очень малы †.

## 2.7 Современное состояние и главные споры (2015–2026)

- **Эффекты меньше, чем в учебниках.** Систематическая картина: метаанализы с поправкой и полевые РКИ дают малые
  эффекты (нормы, BYAF, реклама), а классические одиночные исследования — крупные (50 % против 17 %). Разрыв объясняют
  нарушением граничных условий и публикационным смещением
  ([atticusli, вторичн.](https://www.atticusli.com/replication-crisis/door-in-the-face/)).
- **Что держится лучше всего:** «низкий мяч», «сбить и переформулировать», узаконивание малого вклада, страх с
  выходом, нарратив, повторение, прививка, двусторонние сообщения с опровержением — по метаанализам †.
- **Двухпроцессные модели.** Спор ELM/HSM против унимодели и общей критики двухпроцессных теорий (De Neys) продолжается;
  авторы ELM в 2023 г. защищают модель в Behavioral and Brain Sciences.
- **Сопротивление убеждению** — растущая тема: реактивность (мета 2025), знание об убеждении и раскрытие спонсорства,
  прививка против дезинформации. Энциклопедическая статья об убеждении ссылается на Compton & Braddock (2025) о прививке
  ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)). Метаанализы игровой «пребанкинг»-прививки
  (Roozenbeek и др.) ⬜ в этом прогоне не открывались.
- **Граница убеждения и манипуляции** обсуждается в этике технологий (Susser et al. 2019; Ienca 2023) и в
  эмпирике тёмных паттернов †.
- **Доверие к данным.** Обвинения Data Colada (2026) в адрес работы Ariely & Wertenbroch 2002 † (см. 1.6, п. 15).
  Перепроверку в этом прогоне не делал.

## 2.8 Что читать

| Автор, год | Работа | Русский перевод |
|---|---|---|
| Hovland, Lumsdaine & Sheffield 1949 | «Experiments on Mass Communication» ([Wikipedia, Sleeper effect](https://en.wikipedia.org/wiki/Sleeper_effect)) | перевод не проверен |
| Hovland, Janis & Kelley 1953 | «Communication and Persuasion» ([Wikipedia, Carl Hovland](https://en.wikipedia.org/wiki/Carl_Hovland)) | перевод не проверен |
| Sherif & Hovland 1961 | «Social Judgment» ([Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)) | перевод не проверен |
| Brehm 1966 | «A Theory of Psychological Reactance» ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)) | перевод не проверен |
| Petty & Cacioppo 1986 | «Communication and Persuasion: Central and Peripheral Routes to Attitude Change» и глава в Advances in Experimental Social Psychology, DOI 10.1016/S0065-2601(08)60214-2 ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion)) | перевод не проверен |
| Cialdini 1984 / 2001 / 2021 | «Influence» (4-е изд. 2001 — «Influence: Science and Practice») ([Wikipedia, Influence](https://en.wikipedia.org/wiki/Influence:_Science_and_Practice)) | перевод не проверен поиском (лимит) |
| Cialdini 2016 | «Pre-Suasion» ([Wikipedia, Robert Cialdini](https://en.wikipedia.org/wiki/Robert_Cialdini)) | перевод не проверен поиском (лимит) |
| Cialdini & Goldstein 2004 | «Social Influence: Compliance and Conformity», Annual Review of Psychology ([Wikipedia, Social influence](https://en.wikipedia.org/wiki/Social_influence)) | — (статья) |
| Crano & Prislin 2006; Albarracín & Shavitt 2018 | Обзоры в Annual Review of Psychology по установкам и убеждению (DOI 10.1146/annurev.psych.57.102904.190034; 10.1146/annurev-psych-122216-011911) ([Wikipedia, Persuasion](https://en.wikipedia.org/wiki/Persuasion); [Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)) | — (статьи) |
| Wood 2000 | «Attitude change: Persuasion and social influence», Annual Review of Psychology, DOI 10.1146/annurev.psych.51.1.539 ([Wikipedia, Attitude change](https://en.wikipedia.org/wiki/Attitude_change)) | — (статья) |

## 2.9 Этические и правовые границы

- **Этика (наука).** Манипуляция определяется через эксплуатацию уязвимостей и скрытость; неправа, когда
  непрозрачна, подрывает автономию и выгодна манипулятору за счёт объекта
  ([Wikipedia, Psychological manipulation](https://en.wikipedia.org/wiki/Psychological_manipulation)). Сам Чалдини
  описывает принципы как короткие пути, которые эксплуатируют «профессионалы согласия»
  ([Wikipedia, Influence](https://en.wikipedia.org/wiki/Influence:_Science_and_Practice)).
- **Эмпирика тёмных паттернов** — мягкие паттерны удваивают согласие на сомнительную услугу, агрессивные —
  почти вчетверо поднимают его †(Luguri & Strahilevitz 2021).
- **Право.** Практика правоприменения по обманным интерфейсам: урегулирование Amazon и FTC по подпискам Prime
  на 2,5 млрд долларов (2025) †([MediaPost](https://www.mediapost.com/publications/article/409399/amazon-settles-dark-patterns-charges-for-25-bi.html)).
  Нормы ЕС (Директива о недобросовестной коммерческой практике, ст. 25 DSA, ст. 5 AI Act о запрещённых
  манипулятивных техниках) и российский закон «О рекламе» — ⬜ в этом прогоне не открыты, формулировки не привожу.

---

## Пробелы этого прогона (догрузить вторым проходом)

- Числа метаанализов: Karau & Williams 1993 (леность), Bond & Titus 1983 (фасилитация), Isenberg 1986 (поляризация),
  Wood et al. 1994 (меньшинство), Lynn 1991 (дефицит), Mezulis 2004 (самообслуживание), Oswald 2013 (r IAT).
- Первоисточники: McGuire 1961 (прививка), Friestad & Wright 1994 (PKM), Hofling 1966 и Rank & Jacobson 1977 (медсёстры),
  Robbers Cave (Sherif 1954) и его критика, Regan 1971, Burger 1986 полностью, Carpenter 2013 (BYAF).
- Прививка против дезинформации (Roozenbeek, van der Linden; критика о росте общего скептицизма), Kalla & Broockman 2018.
- Правовые тексты (APA 8.07, Belmont, UCPD, DSA, AI Act, 38-ФЗ «О рекламе»).
- Русские переводы всех книг из 1.8 и 2.8.
- Перепроверка всех строк с †.

## Список источников

**Открыты в этом прогоне (первоисточники и рефераты)**
- [Vaidis et al. 2024 — multilab induced-compliance](https://research.sabanciuniv.edu/id/eprint/49125/)
- [APA Monitor 2009 — Burger replication](https://www.apa.org/monitor/2009/03/milgram)
- [Bond & Smith 1996 — ProQuest abstract](https://www.proquest.com/docview/614318101)
- [SPSP 2017 — Doliński et al.](https://www.spsp.org/news-center/press-releases/milgram-poland-obey)
- [Franzen & Mader 2023 — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10686423/)
- [Le Texier 2019 — PDF](https://www.Gwern.net/doc/psychology/2019-letexier.pdf)
- [Klein et al. 2018 — Many Labs 2](https://eprints.lse.ac.uk/91159)
- [Doyen et al. 2012 — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3261136)
- [Open Science Collaboration 2015 — PDF](https://discovery.dundee.ac.uk/ws/files/7385883/RPP_SCIENCE_2015.pdf)
- [Hagger et al. 2016 — ego depletion RRR](https://cris.maastrichtuniversity.nl/en/publications/a-multilab-preregistered-replication-of-the-ego-depletion-effect/)
- [Vohs et al. 2021 — multisite ego depletion](https://experts.umn.edu/en/publications/a-multisite-preregistered-paradigmatic-test-of-the-ego-depletion-/)
- [Retraction Watch 2015 — Stapel](https://retractionwatch.com/2015/10/20/diederik-stapel-retraction-count-updated-to-57)
- [Fischer et al. 2011 — bystander meta](https://pred.uni-regensburg.de/id/eprint/20599/)
- [Philpot et al. 2020 — CCTV](https://eprints.lancs.ac.uk/id/eprint/134891)
- [Malle 2006 — actor–observer meta](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_69016611)
- [Walker, Smith & Vul 2022 — correspondence bias](https://www.mit.edu/~k2smith/pdf/Walker_Smith_Vul_CorrBias_2022.pdf)
- [Forscher et al. 2019 — implicit measures meta](https://scholarworks.uark.edu/psycpub/1)
- [Armitage & Conner 2001 — TPB meta](https://scilit.com/publications/c73884734a474be9066d878392f16075)
- [Oswald et al. 2013 — IAT criterion meta](https://ersearch2.cvtisr.sk/vufind/SummonRecord/FETCH-LOGICAL-a541t-fa5b6ddccd2f56f5bf71426a9064af38b3a843dedfcd8e3e4f9ec8682348baaa2?lng=en)
- [Balliet, Wu & De Dreu 2014 — ingroup favoritism](https://dare.uva.nl/id/6a43594a-d6ad-40d8-87f3-4f3c413629f2)
- [Flore, Mulder & Wicherts 2018 — stereotype threat RR](https://research.tilburguniversity.edu/en/publications/the-influence-of-gender-stereotype-threat-on-mathematics-test-sco/)
- [Kumkale & Albarracín 2004 — sleeper effect PDF](https://www.asc.upenn.edu/sites/default/files/2021-07/e3eff4_67a5be5947dc44208b8668beb6ceadd6.pdf)
- [Dillard, Hunter & Burgoon 1984 — FITD/DITF meta](https://pure.psu.edu/en/publications/sequentialrequest-persuasive-strategies-metaanalysis-of-footinthe/)
- [Petty, Wegener & Briñol 2023 — BBS commentary](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/abs/how-research-on-persuasion-can-inform-dualprocess-models-of-judgment/4D3F359F440C22BC8354028A608A0D9E)
- [Kumkale — Sleeper Effects, Encyclopedia.com](https://www.encyclopedia.com/social-sciences/applied-and-social-sciences-magazines/sleeper-effects)

**Учебник с разбором репликаций (FORRT, Open Social Psychology)**
- [Оглавление](https://forrt.org/open-social-psychology/) · [гл. 3 диссонанс](https://forrt.org/open-social-psychology/chapter3.html) ·
  [гл. 7 леность](https://forrt.org/open-social-psychology/chapter7.html) · [гл. 8 фасилитация](https://forrt.org/open-social-psychology/chapter8.html) ·
  [гл. 9 минимальная группа](https://forrt.org/open-social-psychology/chapter9.html) · [гл. 10 SPE](https://forrt.org/open-social-psychology/chapter10.html) ·
  [гл. 11 угроза стереотипа](https://forrt.org/open-social-psychology/chapter11.html) · [гл. 12 контакт](https://forrt.org/open-social-psychology/chapter12.html) ·
  [гл. 13 свидетель](https://forrt.org/open-social-psychology/chapter13.html) · [гл. 15 IAT](https://forrt.org/open-social-psychology/chapter15.html) ·
  [гл. 17 лицевая обратная связь](https://forrt.org/open-social-psychology/chapter17.html) · [гл. 19 прайминг](https://forrt.org/open-social-psychology/chapter19.html) ·
  [гл. 21 конформность](https://forrt.org/open-social-psychology/chapter21.html) · [гл. 22 нормы](https://forrt.org/open-social-psychology/chapter22.html) ·
  [гл. 27 позы силы](https://forrt.org/open-social-psychology/chapter27.html)

**Энциклопедии и учебные сайты (навигаторы)**
- Wikipedia: [Social psychology](https://en.wikipedia.org/wiki/Social_psychology) · [Fundamental attribution error](https://en.wikipedia.org/wiki/Fundamental_attribution_error) ·
  [Milgram experiment](https://en.wikipedia.org/wiki/Milgram_experiment) · [Stanford prison experiment](https://en.wikipedia.org/wiki/Stanford_prison_experiment) ·
  [Bystander effect](https://en.wikipedia.org/wiki/Bystander_effect) · [Cognitive dissonance](https://en.wikipedia.org/wiki/Cognitive_dissonance) ·
  [Conformity](https://en.wikipedia.org/wiki/Conformity) · [Minority influence](https://en.wikipedia.org/wiki/Minority_influence) ·
  [Groupthink](https://en.wikipedia.org/wiki/Groupthink) · [Social facilitation](https://en.wikipedia.org/wiki/Social_facilitation) ·
  [Stereotype](https://en.wikipedia.org/wiki/Stereotype) · [Social influence](https://en.wikipedia.org/wiki/Social_influence) ·
  [Social proof](https://en.wikipedia.org/wiki/Social_proof) · [Persuasion](https://en.wikipedia.org/wiki/Persuasion) ·
  [Attitude change](https://en.wikipedia.org/wiki/Attitude_change) · [Heuristic-systematic model](https://en.wikipedia.org/wiki/Heuristic-systematic_model_of_information_processing) ·
  [Carl Hovland](https://en.wikipedia.org/wiki/Carl_Hovland) · [Sleeper effect](https://en.wikipedia.org/wiki/Sleeper_effect) ·
  [Robert Cialdini](https://en.wikipedia.org/wiki/Robert_Cialdini) · [Influence: Science and Practice](https://en.wikipedia.org/wiki/Influence:_Science_and_Practice) ·
  [Foot-in-the-door](https://en.wikipedia.org/wiki/Foot-in-the-door_technique) · [Door-in-the-face](https://en.wikipedia.org/wiki/Door-in-the-face_technique) ·
  [Low-ball](https://en.wikipedia.org/wiki/Low-ball) · [Psychological manipulation](https://en.wikipedia.org/wiki/Psychological_manipulation) ·
  [Leon Festinger](https://en.wikipedia.org/wiki/Leon_Festinger) · [зеркало: Replication crisis](https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.4everland.io/wiki/Replication_crisis.html)
- Simply Psychology: [ELM](https://www.simplypsychology.org/elaboration-likelihood-model.html) · [Compliance](https://www.simplypsychology.org/compliance.html) ·
  [Attribution](https://www.simplypsychology.org/attribution-theory.html) · [Attitudes](https://www.simplypsychology.org/attitudes.html) ·
  [Group polarization](https://www.simplypsychology.org/group-polarization.html) · [Central route](https://www.simplypsychology.org/central-route-to-persuasion.html)

**Вторичный источник-навигатор (блог, числа сверять с DOI)**
- atticusli.com: [Milgram](https://www.atticusli.com/replication-crisis/milgram-obedience/) · [FITD](https://www.atticusli.com/replication-crisis/foot-in-the-door/) ·
  [DITF](https://www.atticusli.com/replication-crisis/door-in-the-face/) · [Money priming](https://www.atticusli.com/replication-crisis/money-priming/) ·
  [Mere exposure](https://www.atticusli.com/replication-crisis/mere-exposure-effect/) · [Langer 1978](https://www.atticusli.com/replication-crisis/power-of-because-langer-1978/) ·
  [Хаб](https://www.atticusli.com/replication-crisis/)

**† Взяты из прежних проверенных отчётов, в этом прогоне не переоткрыты**
- [O'Keefe 1999](https://doi.org/10.1080/23808985.1999.11678963) · [Banas & Rains 2010](https://doi.org/10.1080/03637751003758193) ·
  [Tannenbaum et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC5789790/) · [Braddock & Dillard 2016](https://doi.org/10.1080/03637751.2015.1128555) ·
  [Zebregs et al. 2015](https://pubmed.ncbi.nlm.nih.gov/24836931/) · [O'Keefe & Jensen 2007](https://doi.org/10.1080/10810730701615198) ·
  [O'Keefe & Jensen 2009](https://doi.org/10.1111/j.1460-2466.2009.01417.x) · [Dechêne et al. 2010](https://doi.org/10.1177/1088868309352251) ·
  [Fazio et al. 2015](https://doi.org/10.1037/xge0000098) · [Montoya et al. 2017](https://doi.org/10.1037/bul0000085) ·
  [Church 1993](https://doi.org/10.1086/269355) · [Burger 1986](https://doi.org/10.1037/0022-3514.51.2.277) ·
  [Carpenter & Boster 2009](https://doi.org/10.1080/08934210903092590) · [Bolkan & Rains 2017](https://doi.org/10.1177/0093650215602308) ·
  [Fillon et al. 2023](https://open.lnu.se/index.php/metapsychology/article/view/2640) · [Bohner & Schlüter 2014](https://doi.org/10.1371/journal.pone.0104086) ·
  [van der Linden & Chryst 2017](https://www.frontiersin.org/articles/10.3389/fams.2017.00012/full) · [Rhodes et al. 2020](https://doi.org/10.1093/hcr/hqz023) ·
  [Melnyk et al. 2022](https://doi.org/10.1177/00222429211029199) · [Knoll & Matthes 2017](https://doi.org/10.1007/s11747-016-0503-8) ·
  [Burger et al. 2004](https://doi.org/10.1177/0146167203258838) · [Lynn 1991](https://doi.org/10.1002/mar.4220080105) ·
  [Barton et al. 2022](https://research.monash.edu/en/publications/scarcity-tactics-in-marketing-a-meta-analysis-of-product-scarcity/) ·
  [Eisend 2009](https://doi.org/10.1007/s11747-008-0096-y) · [Ma, Ebesu & Dillard 2025](https://doi.org/10.1093/joc/jqaf004) ·
  [Vaughan-Johnston et al. 2024](https://doi.org/10.3389/frsps.2024.1260974) · [Eisend & Tarrahi 2021](https://doi.org/10.1002/jcpy.1258) ·
  [Eisend et al. 2020](https://research.wur.nl/en/publications/a-meta-analysis-of-the-effects-of-disclosing-sponsored-content/) ·
  [Coppock et al. 2020 — Yale News](https://news.yale.edu/2020/09/02/political-ads-have-little-persuasive-power) ·
  [Luguri & Strahilevitz 2021](https://doi.org/10.1093/jla/laaa006) · [Mathur et al. 2019](https://doi.org/10.1145/3359183) ·
  [Poets&Quants 2026](https://poetsandquants.com/2026/09/02/data-colada-accuses-dukes-dan-ariely-of-tampering-with-data-in-a-2nd-influential-study/) ·
  [MediaPost 2025](https://www.mediapost.com/publications/article/409399/amazon-settles-dark-patterns-charges-for-25-bi.html)

**Не открылись (заблокированы системой в этом прогоне):** pubmed.ncbi.nlm.nih.gov/26315443; scispace.com (Karau & Williams);
growthlayer.app; atticusli.com/replication-crisis/cognitive-dissonance; en.wikipedia.org — Elaboration_likelihood_model,
Compliance_(psychology), Reciprocity_(social_psychology), Reactance_(psychology), Scarcity_heuristic, Replication_crisis,
Framing_effect_(psychology), Group_polarization, In-group–out-group_bias; simplypsychology.org/obedience; apa.org/ethics/code;
artificialintelligenceact.eu/article/5; hhs.gov (Belmont Report); doi.org/pmc для Tannenbaum, Bohner & Schlüter, Banas & Rains, Dechêne.
