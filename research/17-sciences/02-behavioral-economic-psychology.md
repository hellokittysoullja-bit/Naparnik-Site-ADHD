# Поведенческая экономика и экономическая психология — независимый обзор

Дата: 09.11.2026. Метод: WebSearch + WebFetch; каждое число ниже взято из открытой страницы (реферат, полный текст,
таблица) со ссылкой. Где указано «по вторичному источнику», первоисточник не открывался.

**Ограничение этого прогона (честно).** Общий лимит веб-поиска сессии (200 запросов на всех агентов) кончился на середине
работы, а прямые запросы к адресам, которых не было в выдаче поиска, система не пропускала (stanford.edu, nobelprize.org,
doi.org, en.wikipedia.org, nber.org/w31547 и др. — «PROVENANCE_REQUIRED»). Поэтому:
- **Часть 1 (поведенческая экономика)** проверена почти целиком, кроме скандалов (Ariely, Gino, Wansink), boosts
  (Hertwig) и нобелевских формулировок.
- **Часть 2 (экономическая психология)** проверена только там, где она пересекается с частью 1 (сбережения, умолчания,
  психология дефицита, денежный прайминг). Традиция Катоны, боль оплаты, левая цифра, карта против наличных, подписки,
  налоги, долги — **не проверены**; они вынесены в раздел «2.11 Что догрузить» с пометкой «из памяти, не проверено» и без
  чисел. Их нельзя цитировать как факты, пока не будет второго прогона.

Условные обозначения статуса: ✅ подтверждён (метаанализ / массовая репликация) · ⚠ спорен · ❌ не воспроизвёлся /
опровергнут · ⬜ не проверено в этом прогоне.

---

# ЧАСТЬ 1. ПОВЕДЕНЧЕСКАЯ ЭКОНОМИКА (behavioral economics)

## 1.1 Что изучает, границы, названия

- **Предмет.** Как реальные люди принимают экономические решения (выбор при риске, во времени, при покупке, сбережении),
  когда их поведение систематически отклоняется от модели полностью рационального агента, — и как встроить эти
  отклонения в экономические модели.
- **Корень — ограниченная рациональность (bounded rationality).** Термин и понятие «довольствования» (satisficing)
  ввёл Herbert Simon в статье «A Behavioral Model of Rational Choice» (1955): человек ищет не оптимум, а вариант,
  дотягивающий до уровня притязаний, и прекращает поиск ([Encyclopedia.com, Simon](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert);
  [Wikipedia-зеркало, Bounded rationality](https://ipfs.ssi.eecc.de/ipns/en.wikipedia-on-ipfs.org/wiki/Bounded_rationality)).
- **Другие названия и соседи.** «Поведенческие финансы» (behavioral finance) — ветвь про рынки и инвесторов; «наука о
  поведении в политике» (behavioural public policy) — прикладная ветвь (nudge units); «исследования суждений и решений»
  (judgment and decision making, JDM) — психологическая сестринская область, откуда пришли эвристики и искажения.
  Отличие от **экономической психологии** — в части 2 (раздел 2.1).
- **Граница.** Поведенческая экономика сохраняет язык экономики (функции полезности, параметры β, λ, равновесия) и меряет
  отклонения как параметры. Пример: квазигиперболическое дисконтирование Laibson — модификация стандартной модели одним
  параметром β ([Laibson 1997, PDF](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf)).

## 1.2 История: основатели и ключевые работы

| Год | Работа | Что дала | Источник |
|---|---|---|---|
| 1947 | Simon, *Administrative Behavior* | Решения в организациях; основа его программы | [Encyclopedia.com](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert) |
| 1955 | Simon, «A Behavioral Model of Rational Choice» | Ограниченная рациональность, satisficing | [Encyclopedia.com](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert); [PDF статьи](https://edisciplinas.usp.br/pluginfile.php/7058332/mod_resource/content/1/1955%20Racionalidade%20limitada.pdf) |
| 1957 | Simon, *Models of Man* | Сборник эссе об ограниченной рациональности | [Wikipedia-зеркало](https://ipfs.ssi.eecc.de/ipns/en.wikipedia-on-ipfs.org/wiki/Bounded_rationality) |
| 1968 | Phelps & Pollak | Квазигиперболическая форма (для межпоколенческого альтруизма) | цит. по [Laibson 1997](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf) |
| 1975 / 1978 | Премия Тьюринга (с Newell) / Нобелевская премия по экономике — Simon | Признание | [Encyclopedia.com](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert) |
| 1979 | Kahneman & Tversky, «Prospect Theory», *Econometrica* | Теория перспектив; коэффициента потерь в статье не было | по вторичному: [atticusli](https://atticusli.com/replication-crisis/loss-aversion/) (DOI 10.2307/1914185) |
| 1982 | Huber, Payne & Puto, *J Consumer Research* 9(1):90–98 | Эффект асимметричного доминирования (приманки) | [EconPapers](https://econpapers.repec.org/RePEc:oup:jconrs:v:9:y:1982:i:1:p:90-98) |
| 1990 | Thaler — ментальный учёт в потреблении | Премию тратят сразу, рост акций — почти нет | цит. по [Laibson 1997](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf) |
| 1992 | Tversky & Kahneman, кумулятивная теория перспектив | λ ≈ 2,25 на 25 аспирантах, гипотетические выборы | по вторичному: [atticusli](https://atticusli.com/replication-crisis/loss-aversion/) |
| 1992 | Ainslie | Функции дисконтирования «приблизительно гиперболические» | цит. по [Laibson 1997](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf) |
| 1997 | Laibson, «Golden Eggs and Hyperbolic Discounting», *QJE* 112(2):443–478 | β-δ модель, спрос на неликвидные активы как обязательство | [EconPapers](https://econpapers.repec.org/RePEc:oup:qjecon:v:112:y:1997:i:2:p:443-478.) |
| 2001 | Madrian & Shea, *QJE* 116(4):1149–1187 | Сила умолчания в пенсионных планах | [NBER w7682](https://www.nber.org/papers/w7682) |
| 2003 | Johnson & Goldstein, *Science* | Умолчания и донорство органов | по обзору [Steffel и др. 2019](https://behavioralpolicy.org/wp-content/uploads/2020/01/Does-changing-defaults-save-lives_-Effectd-of-presumed-consent-organ-donation-policies.pdf) |
| 2004 | Thaler & Benartzi, Save More Tomorrow, *JPE* | Обязательство сберегать из будущих прибавок | [Chicago Booth](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving) |
| 2014 | Many Labs 1 | Массовая репликация классики JDM | [Klein и др. 2014, PDF](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 2016 | Camerer и др., *Science* | Репликация 18 лабораторных экспериментов в экономике | [MPRA](https://mpra.ub.uni-muenchen.de/75461/1/MPRA_paper_75461.pdf) |
| 2018–2024 | Спор о неприятии потерь: Gal & Rucker 2018 → Mrkva и др. 2020 → Brown и др. 2024 | См. 1.6–1.7 | ссылки ниже |
| 2022 | Mertens и др. (*PNAS*) и критики; DellaVigna & Linos (*Econometrica*) | Спор об эффективности nudge | ссылки ниже |

⬜ Не проверено в этом прогоне: Нобелевские премии Kahneman (2002) и Thaler (2017) и их формулировки; книга Thaler &
Sunstein *Nudge* (2008); Kahneman, Knetsch & Thaler 1990 (кружки); Samuelson & Zeckhauser 1988 (статус-кво);
Tversky & Kahneman 1974 (*Science*, эвристики). Адреса nobelprize.org и первоисточников система не открыла.

## 1.3 Главные теории и модели

1. **Ограниченная рациональность и satisficing (Simon, 1955).** Рациональность ограничена трудностью задачи, когнитивными
   пределами и временем. Агент задаёт уровень притязаний и берёт первый вариант, который до него дотягивает
   ([Encyclopedia.com](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert)).
2. **Программа «эвристики и искажения» (heuristics and biases; Tversky & Kahneman).** Суждения опираются на упрощённые
   правила (доступность, репрезентативность, якорение), которые дают систематические ошибки. Классические демонстрации
   якорения, рамки и невозвратных затрат массово воспроизвелись (Many Labs 1, таблица 1.4).
3. **Экологическая рациональность (Gigerenzer).** Альтернативная трактовка: простые эвристики часто дают решения не хуже
   «оптимальных» процедур, если подходят к структуре среды; «ошибка» — свойство пары «правило × среда»
   ([Wikipedia-зеркало](https://ipfs.ssi.eecc.de/ipns/en.wikipedia-on-ipfs.org/wiki/Bounded_rationality)).
4. **Теория перспектив (prospect theory, 1979; кумулятивная — 1992).** Ценность считается от точки отсчёта, потери
   весят больше выигрышей (неприятие потерь, коэффициент λ), вероятности взвешиваются нелинейно. Паттерны теории
   воспроизведены на 4 098 людях в 19 странах ([Ruggeri и др. 2020](https://ideas.repec.org/a/nat/nathum/v4y2020i6d10.1038_s41562-020-0886-x.html)).
5. **Квазигиперболическое дисконтирование (β-δ; Laibson 1997).** Веса периодов {1, βδ, βδ², …}, 0 < β < 1: резкий спад
   ценности сразу после «сейчас», дальше — экспоненциально. Отсюда динамическая несогласованность (сегодня планирую
   сберечь, завтра трачу) и спрос на обязательства — неликвидные активы. Модель предсказывает, что потребление следует
   за доходом, а финансовые инновации (лишняя ликвидность) могут снижать сбережения и благосостояние
   ([Laibson 1997](https://econpapers.repec.org/RePEc:oup:qjecon:v:112:y:1997:i:2:p:443-478.)).
6. **Ментальный учёт (mental accounting; Thaler).** Деньги раскладываются по «счетам» по происхождению и назначению,
   поэтому склонность потреблять разная: премию тратят сразу, неожиданный рост портфеля акций почти не меняет
   потребление (цит. по [Laibson 1997](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf)).
7. **Сконструированные предпочтения (constructed preferences).** Предпочтения во многом создаются в момент выбора и
   зависят от набора вариантов. Huber, Payne & Puto (2014) прямо называют эффект приманки опорой этой идеи и, через неё,
   архитектуры выбора ([Huber и др. 2014](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf)).
   Mrkva и др. (2020) объясняют более сильное неприятие потерь у малознающих тем же: они строят предпочтение на ходу
   ([Mrkva и др. 2020](https://researchportal.bath.ac.uk/en/publications/moderating-loss-aversion-loss-aversion-has-moderators-but-reports/)).
8. **Архитектура выбора и nudge (Thaler & Sunstein).** Изменение подачи вариантов без запретов и без изменения
   экономических стимулов. Мета-анализ Mertens и др. делит вмешательства на три класса: информация о решении
   (decision information), структура решения (decision structure: умолчания, порядок и т. п.) и помощь в решении
   (decision assistance: напоминания, обязательства) ([Leuphana, реферат](https://fis.leuphana.de/en/publications/the-effectiveness-of-nudging-a-meta-analysis-of-choice-architectu/)).
   ⬜ Boosts (Hertwig & Grüne-Yanoff — вмешательства, которые наращивают компетенцию, а не меняют среду) — в этом
   прогоне не проверены.

## 1.4 Таблица ключевых эффектов и механизмов

| # | Эффект | Кто, год | Суть | Сила (размер, n) | Статус | Источник |
|---|---|---|---|---|---|---|
| 1 | Неприятие потерь (loss aversion) | Kahneman & Tversky 1979; λ≈2,25 — 1992 | Потеря весит больше равного выигрыша | Мета: 607 оценок из 150 статей (1992–2017), средний λ = **1,955** [1,820; 2,102]; черты дизайна мало объясняют разброс | ✅ существует, ⚠ величина зависит от контекста | [Brown и др. 2024, JEL](https://www.aeaweb.org/doi/10.1257/jel.20221698) |
| 2 | Модераторы неприятия потерь | Mrkva, Johnson, Gächter, Herrmann 2020 | Меньше у знающих и опытных, больше у старших; есть у всех уровней знания | 5 выборок, N = 17 720 | ✅ | [Bath research portal](https://researchportal.bath.ac.uk/en/publications/moderating-loss-aversion-loss-aversion-has-moderators-but-reports/) |
| 3 | Паттерны теории перспектив (рефлексия, вес вероятностей и др.) | Kahneman & Tversky 1979 | Повтор оригинальных задач | N = 4 098, 19 стран, 13 языков; 94 % пунктов и 12 из 13 теоретических контрастов воспроизвелись, с ослаблением | ✅ | [Ruggeri и др. 2020](https://ideas.repec.org/a/nat/nathum/v4y2020i6d10.1038_s41562-020-0886-x.html) |
| 4 | Эффект рамки (gain vs loss framing, «азиатская болезнь») | Tversky & Kahneman 1981 | Одинаковый исход в рамке «спасти» vs «умрут» меняет выбор | Many Labs 1: N = 6 271, d = 0,60 | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 5 | Невозвратные затраты (sunk cost) | Arkes & Blumer 1985 (по ML1) | Уже потраченное тянет продолжать | ML1: N = 6 330, d = 0,27 | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 6 | Якорение в фактических оценках | Tversky & Kahneman 1974 | Названное число сдвигает оценку | ML1, 4 задачи: d = 1,17–2,42 (N 5 284–5 627) | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 7 | Якорение готовности платить (WTP/WTA) | Ariely, Loewenstein & Prelec 2003 | Произвольное число (напр. цифры соцномера) сдвигает цену | Мета 53 исследований: «умеренный» эффект, меньше ранних; несвязанные с товаром якоря — малые, часто незначимые; оценку считать верхней границей | ⚠ | [Li, Maniadis, Sedikides 2021](https://ideas.repec.org/a/eee/soceco/v90y2021ics2214804320306728.html) |
| 8 | То же — мощная репликация | Li, Weigel, Ferraro, Messer 2025 | Повтор с мощностью 96 % вместо 46 % | Оригинал +31 % к ставкам; повтор **+3,4 %** [−3,4; 10]; мощность поля обычно < 30 % | ❌ для величины оригинала | [Economic Inquiry 2025](https://econpapers.repec.org/RePEc:bla:ecinqu:v:63:y:2025:i:2:p:387-402) |
| 9 | То же — довод «за» | Yoon, Fong, Dimoka 2019 | Сводка 5 исследований, 30 товаров | r ≈ 0,27 (оригинал Ariely 2003: 0,32–0,52); p-curve без признаков отбора | ⚠ (эффект есть, меньше оригинала) | [JDM 2019](https://dlab.sauder.ubc.ca/sjdm/journal/19/190426/jdm190426.html) |
| 10 | Эффект владения / разрыв WTA–WTP (endowment effect) | Kahneman, Knetsch, Thaler 1990 | Продавец просит больше, чем покупатель готов платить | Обзор 45 исследований, 201 наблюдение: WTA/WTP в среднем 7,17, медиана 2,6; обычные частные товары 2,92; общественные/нерыночные 10,41 | ✅ разрыв есть, ⚠ его природа | [Horowitz & McConnell 2002, WP](https://ageconsearch.umn.edu/record/197848/files/agecon-maryland-98-05.pdf) |
| 11 | Разрыв WTA–WTP и процедура | Plott & Zeiler 2005; ответ Isoni, Loomes, Sugden 2011 | При процедурах против «непонимания» разрыв для кружек исчез, для лотерей — остался | Качественно (реферат) | ⚠ зависит от блага | [Isoni и др. 2011, AER](https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:2:p:991-1011) |
| 12 | Статус-кво / «неприятие перемен» вместо неприятия потерь | Gal & Rucker 2018 | Потери часто смешаны с бездействием; если развести, эффекты пропадают | Теоретический обзор + свои опыты | ⚠ (оспорено Mrkva 2020, Brown 2024) | [Kitces, пересказ](https://www.kitces.com/blog/loss-aversion-pain-loom-larger-than-gain-gal-rucker-journal-psychology/); [Kellogg](https://www.kellogg.northwestern.edu/academics-research/research/detail/2018/the-loss-of-loss-aversion-will-it-loom-larger/) |
| 13 | Предпочтение настоящего (present bias, β) | Laibson 1997; Phelps & Pollak 1968 | «Сейчас» переоценено относительно любого «потом» | Мета: 220 оценок β из 28 статей (метод Convex Time Budget): в среднем есть, большой разброс; главный источник разброса — тип награды (деньги/не деньги); умеренный отбор в сторону завышения | ✅ в среднем, ⚠ на деньгах | [Imai, Rutter, Camerer 2021](https://econpapers.repec.org/RePEc:oup:econjl:v:131:y:2021:i:636:p:1788-1814.) |
| 14 | Эффект умолчания (default effect) | Johnson & Goldstein 2003; Madrian & Shea 2001 | Предвыбранный вариант выбирают чаще | Мета: 58 исследований, N = 73 675, d = 0,68 [0,53; 0,83]; в выборе из двух предвыбранный выбирают ~на 27 % чаще; сильнее в потребительских решениях, слабее в «зелёных» | ✅ (размер — без поправки на смещение) | [Jachimowicz и др. 2019](https://ideas.repec.org/a/cup/bpubpo/v3y2019i02p159-186_00.html); [Columbia](https://business.columbia.edu/press-release/cbs-press-releases/defaults-are-not-same-default) |
| 15 | Автоматическая запись в пенсионный план | Madrian & Shea 2001 | Опт-аут вместо опт-ина | Участие новичков 86 % против 37 %; 76 % остаются на ставке по умолчанию 3 % (до — ~10 %) | ✅ (классика, многократно в поле) | [NBER w7682, полный текст](https://www.nber.org/papers/w7682.pdf) |
| 16 | Презумпция согласия на донорство | Johnson & Goldstein 2003 | Опт-аут повышает согласие | Гипотетический опрос 161 человека: согласие при опт-ауте на 24–95 % выше; реальные донорства по 14 панельным исследованиям ~+30 % в среднем; Чили — −29 %; Уэльс — +11 % зарегистрированных доноров | ✅ на согласие, ⚠ на реальные донорства (инфраструктура важнее) | [Steffel, Williams, Tannenbaum 2019](https://behavioralpolicy.org/wp-content/uploads/2020/01/Does-changing-defaults-save-lives_-Effectd-of-presumed-consent-organ-donation-policies.pdf) |
| 17 | Обязательство «сберегай завтра» (Save More Tomorrow) | Thaler & Benartzi 2004 | Согласие отдавать часть будущих прибавок | 78 % предложенных вступили; ставка сбережений 3,5 % → 13,6 % за 40 месяцев (4 прибавки) | ✅ как полевой результат (одна фирма в исходной статье) | [Chicago Booth](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving) |
| 18 | Эффект приманки (decoy / attraction / asymmetric dominance) | Huber, Payne & Puto 1982 | Явно худший вариант поднимает долю «цели» | 38 исследований: при числовых таблицах — 4 из 5 значимы; смешанные — 2 из 5; перцептивные/опытные признаки — **0 из 27** (1 обратный эффект) | ❌ вне абстрактных числовых задач, ⚠ в целом | [Frederick, Lee, Baskin 2014](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/The-Limits-of-Attraction.pdf) |
| 19 | Приманка — ответ авторов | Huber, Payne & Puto 2014 | Эффект держится при точном повторе условий; 5 условий, которые его гасят | В их опытах долю приманки выбирали ~2 % | ⚠ | [Huber и др. 2014](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf) |
| 20 | Перегрузка выбором (choice overload) | Iyengar & Lepper 2000 | Много вариантов → отказ от выбора | Мета 50 экспериментов (63 условия), N = 5 036: средний эффект около нуля, большой разброс | ❌ как общий закон | [Scheibehenne и др. 2010](https://ideas.repec.org/a/oup/jconrs/v37y2010i3p409-425.html) |
| 21 | Перегрузка выбором — при условиях | Chernev, Böckenholt, Goodman 2015 | Появляется при сложном наборе, трудной задаче, неясных предпочтениях, цели «минимум усилий» | 99 наблюдений, N = 7 202; с модераторами общий эффект значим | ⚠ (условный эффект) | [Kellogg](https://www.kellogg.northwestern.edu/academics-research/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual/) |
| 22 | Ретроспективная ошибка игрока | Oppenheimer & Monin (по ML1) | Редкий исход заставляет думать, что было много попыток | ML1: N = 5 942, d = 0,61 | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 23 | Шкала ответа как якорь (low vs high category scales) | Schwarz и др. (по ML1) | Диапазон вариантов ответа меняет самоотчёт | ML1: N = 5 899, d = 0,49 | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 24 | «Разрешить» vs «запретить» (allowed/forbidden) | Rugg 1941 (по ML1) | Формулировка вопроса меняет ответ при одинаковом смысле | ML1: N = 6 292, d = 1,96 | ✅ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 25 | Подталкивания в целом (nudge), академические статьи | Mertens и др. 2022 | Сводный эффект архитектуры выбора | >200 исследований, >450 эффектов, ~2,15 млн участников; d = 0,43 [0,38; 0,48] (в исправленной версии реферата 0,45 [0,39; 0,52]); «структура» сильнее «информации» и «помощи»; еда — до 2,5 раза сильнее | ⚠ (см. №26–28) | [Leuphana](https://fis.leuphana.de/en/publications/the-effectiveness-of-nudging-a-meta-analysis-of-choice-architectu/); [Maier и др. 2022, табл.](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501) |
| 26 | То же после поправки на публикационное смещение | Maier и др. 2022 | Робастный байесовский мета-анализ (RoBMA-PSMA) | d = 0,04 [0,00; 0,14], BF01 = 0,95 (неопределённо); «информация» 0,00 (BF01 = 33,8 — за ноль); «структура» 0,12 [0,00; 0,43] (неопределённо); финансы 0,00 (BF01 = 41,2); еда 0,02 (по самым точным оценкам 0,27) | ❌ для «информации» и финансов; ⚠ для «структуры» и еды | [Maier и др. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501) |
| 27 | То же — другие поправки | Szaszi и др. 2022 | Andrews–Kasy, WAAP, trim-and-fill | d от 0,03 (сильное смещение) до 0,31 (умеренное); Andrews–Kasy −0,01; WAAP 0,06; trim-and-fill 0,08 | ❌ для среднего, ⚠ отдельные nudge (умолчания) | [Szaszi и др. 2022, PDF](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf) |
| 28 | Nudge units в поле против журналов | DellaVigna & Linos 2022 | Все испытания двух крупных отделов США | 126 РКИ, >23 млн человек: **+1,4 п. п. (+8,1 %)** против +8,7 п. п. (+33,5 %) в статьях; разницу целиком объясняет публикационное смещение при малой мощности | ✅ (малый, но значимый эффект в поле) | [NBER w27594](https://nber.org/papers/w27594); [Econometrica 90(1)](https://econpapers.repec.org/RePEc:wly:emetrp:v:90:y:2022:i:1:p:81-116) |
| 29 | Воспроизводимость лабораторной экономики (мета-уровень) | Camerer и др. 2016 | 18 экспериментов из AER/QJE 2011–2014 | 11 из 18 (61 %) воспроизвелись; эффект в среднем 66 % исходного; прогноз рынка — 75,2 % | ✅ (лучше психологии, но не полностью) | [MPRA](https://mpra.ub.uni-muenchen.de/75461/1/MPRA_paper_75461.pdf) |

## 1.5 Методы исследования

- **Лабораторные эксперименты с реальными деньгами** (incentive-compatible): выборы между лотереями, аукционы,
  процедура BDM для WTP/WTA; их воспроизводимость — 61 % в выборке Camerer 2016
  ([MPRA](https://mpra.ub.uni-muenchen.de/75461/1/MPRA_paper_75461.pdf)). Сама процедура выявления может создавать или
  гасить эффект (Plott & Zeiler vs Isoni и др. — [AER 2011](https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:2:p:991-1011)).
- **Гипотетические задачи и опросы** (классика Kahneman–Tversky; λ = 2,25 получен на 25 аспирантах с гипотетическими
  ставками — по вторичному [atticusli](https://atticusli.com/replication-crisis/loss-aversion/)).
- **Структурное оценивание параметров** (λ, β, δ) по выбору: метод Convex Time Budget для β
  ([Imai и др. 2021](https://econpapers.repec.org/RePEc:oup:econjl:v:131:y:2021:i:636:p:1788-1814.)).
- **Полевые РКИ**, в том числе в государственных «nudge units»
  ([DellaVigna & Linos 2022](https://nber.org/papers/w27594)).
- **Естественные эксперименты** со сменой правила (автозапись в пенсионный план до/после —
  [Madrian & Shea 2001](https://www.nber.org/papers/w7682.pdf); смена закона о донорстве —
  [Steffel и др. 2019](https://behavioralpolicy.org/wp-content/uploads/2020/01/Does-changing-defaults-save-lives_-Effectd-of-presumed-consent-organ-donation-policies.pdf)).
- **Массовые многоцентровые репликации** (Many Labs; кросс-национальные повторы —
  [Ruggeri 2020](https://ideas.repec.org/a/nat/nathum/v4y2020i6d10.1038_s41562-020-0886-x.html)).
- **Мета-анализ с поправкой на смещение**: RoBMA, Andrews–Kasy, WAAP, trim-and-fill, z-curve
  ([Maier 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501); [Szaszi 2022](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf);
  [Schimmack 2026](https://replicationindex.com/2026/09/07/what-is-the-effect-of-nudging-43/)).

## 1.6 Что опровергнуто, переоценено или оспорено

1. **«Nudge работают в среднем с d ≈ 0,4».** После поправки на публикационное смещение средний эффект от −0,01 до 0,08 по
   разным методам; для информационных подталкиваний и финансов — свидетельства за ноль
   ([Maier 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501); [Szaszi 2022](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf)).
   В поле у государственных отделов эффект ~в 6 раз меньше журнального ([DellaVigna & Linos](https://nber.org/papers/w27594)).
   Оговорка: разброс огромный, и «ноль в среднем» не значит «ноль везде» — 91 % наблюдаемых эффектов положительны,
   средний положительный эффект по разным моделям 0,26–0,44 ([Schimmack 2026](https://replicationindex.com/2026/09/07/what-is-the-effect-of-nudging-43/),
   блог-реанализ с явной позицией автора).
2. **Эффект приманки как «стилизованный факт».** В реалистичных (перцептивных) условиях 0 из 27 попыток; авторы советуют
   перестать считать его установленным ([Frederick и др. 2014](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/The-Limits-of-Attraction.pdf)).
   Авторы оригинала отвечают, что эффект узко-условный, а чистое асимметричное доминирование на рынке редко
   ([Huber и др. 2014](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf)).
3. **Перегрузка выбором (джем 24 vs 6) как закон.** Средний эффект в мета-анализе около нуля
   ([Scheibehenne 2010](https://ideas.repec.org/a/oup/jconrs/v37y2010i3p409-425.html)); есть только при четырёх условиях
   ([Chernev 2015](https://www.kellogg.northwestern.edu/academics-research/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual/)).
4. **Сильное «произвольное» якорение цены (Ariely, Loewenstein, Prelec 2003).** Мощный повтор дал +3,4 % вместо +31 %
   ([Li и др. 2025](https://econpapers.repec.org/RePEc:bla:ecinqu:v:63:y:2025:i:2:p:387-402)); повтор Maniadis, Tufano & List
   2014 ([AER](https://econpapers.repec.org/RePEc:aea:aecrev:v:104:y:2014:i:1:p:277-90)) дал эффект ~вдвое меньше
   (28,6 %, p = 0,253), но Data Colada показывает, что он не исключает умеренного эффекта
   ([Data Colada #7](https://datacolada.org/7)). Итог: эффект есть, но заметно меньше раннего.
5. **λ = 2,25 как универсальная константа.** Средняя оценка по 607 измерениям — 1,955
   ([Brown 2024](https://www.aeaweb.org/doi/10.1257/jel.20221698)); величина зависит от знания, возраста
   ([Mrkva 2020](https://researchportal.bath.ac.uk/en/publications/moderating-loss-aversion-loss-aversion-has-moderators-but-reports/))
   и, по Gal & Rucker, от смешения потерь с бездействием ([Kitces](https://www.kitces.com/blog/loss-aversion-pain-loom-larger-than-gain-gal-rucker-journal-psychology/)).
   Сильная форма тезиса Gal & Rucker («неприятия потерь нет») большинством данных не поддержана.
6. **Эффект владения для кружек.** При процедурах против непонимания у Plott & Zeiler исчез; для лотерей держится
   ([Isoni и др. 2011](https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:2:p:991-1011)).
7. **Опт-аут в донорстве «почти до 100 %».** Это про согласие в опросах/регистрах; реальные донорства — в среднем ~+30 %
   по панельным данным, есть контрпример (Чили, −29 %), инфраструктура (число центров, расходы на здоровье) объясняет не
   меньше ([Steffel и др. 2019](https://behavioralpolicy.org/wp-content/uploads/2020/01/Does-changing-defaults-save-lives_-Effectd-of-presumed-consent-organ-donation-policies.pdf)).
8. **Подделки и отзывы (Ariely, Gino, Wansink).** ⬜ **Не проверено в этом прогоне** — адреса Data Colada, Retraction Watch
   и журналов система не открыла, поиск исчерпан. Что проверить: (а) отзыв Shu, Mazar, Gino, Ariely, Bazerman 2012
   (*PNAS*, «подпись вверху формы») в 2021 после анализа Data Colada; (б) отзывы статей Gino и решение Гарварда; (в) отзывы
   статей Wansink (поведение за едой) и его уход из Корнелла; (г) новые обвинения 2026 по Ariely & Wertenbroch 2002. До
   проверки — без дат и чисел.

## 1.7 Современное состояние и споры (2015–2026)

- **Кризис воспроизводимости ударил неравномерно.** Ядро «эвристик и искажений» (рамка, якорение фактов, невозвратные
  затраты, теория перспектив) воспроизводится массово ([Many Labs 1](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf);
  [Ruggeri 2020](https://ideas.repec.org/a/nat/nathum/v4y2020i6d10.1038_s41562-020-0886-x.html)). Не воспроизводятся
  прайминги (денежный, флаг; см. 2.4) и эффекты, «упакованные» для практики (приманка в реальных условиях, перегрузка
  выбором, произвольные якоря цены).
- **Спор о неприятии потерь (2018–2024).** Gal & Rucker (2018) — потери не весят больше «в целом»; Mrkva и др. (2020) —
  «слухи о его смерти сильно преувеличены», N = 17 720; Brown и др. (2024) — λ ≈ 1,96 по 607 оценкам. Консенсус-тенденция:
  явление реально, величина ~2 в среднем и зависит от контекста, ставок и опыта.
- **Спор о nudge (2022–2026).** Mertens (d = 0,43) → три письма в PNAS (Maier; Szaszi; Bakdash & Marusich «Left-truncated
  effects…») → ответ Mertens (признают Egger b = 2,10, при сильном смещении d = 0,08 —
  [PMC9351449](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351449)) → реанализы гетерогенности
  ([Schimmack 2026](https://replicationindex.com/2026/09/07/what-is-the-effect-of-nudging-43/)). Сводная позиция:
  средний nudge мал; разброс велик; «структурные» (умолчания) — лучший кандидат на реальный эффект; вопрос не «работают
  ли nudge», а «какие и где» ([Szaszi 2022](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf)).
- **Академия против практики.** Полевые испытания nudge units: малый (+1,4 п. п.), но надёжный эффект; журнальные эффекты
  раздуты отбором ([DellaVigna & Linos 2022](https://nber.org/papers/w27594)).
- **Эвристики: ошибки или адаптация.** Линия Gigerenzer (экологическая рациональность) против линии Kahneman–Tversky
  ([Wikipedia-зеркало](https://ipfs.ssi.eecc.de/ipns/en.wikipedia-on-ipfs.org/wiki/Bounded_rationality)).
- **Предпочтение настоящего на деньгах** — слабее и неоднороднее, чем на немедленных благах; есть умеренное завышение в
  публикациях ([Imai и др. 2021](https://econpapers.repec.org/RePEc:oup:econjl:v:131:y:2021:i:636:p:1788-1814.)).
- ⬜ Boosts (Hertwig) как альтернатива nudge и дискуссия «nudge vs sludge» — в этом прогоне не проверены.

## 1.8 Что читать (от самих исследователей)

Наличие русского перевода в этом прогоне **не проверено** (поиск исчерпан) — для каждой позиции «перевод не проверен».

1. Simon H. (1955). A Behavioral Model of Rational Choice. *QJE* — [PDF](https://edisciplinas.usp.br/pluginfile.php/7058332/mod_resource/content/1/1955%20Racionalidade%20limitada.pdf). Перевод не проверен.
2. Laibson D. (1997). Golden Eggs and Hyperbolic Discounting. *QJE* — [PDF](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf). Перевод не проверен.
3. Brown A., Imai T., Vieider F., Camerer C. (2024). Meta-analysis of Empirical Estimates of Loss Aversion. *JEL* — [AEA](https://www.aeaweb.org/doi/10.1257/jel.20221698). Перевод не проверен.
4. DellaVigna S., Linos E. (2022). RCTs to Scale. *Econometrica* — [NBER](https://nber.org/papers/w27594). Перевод не проверен.
5. Mertens S. и др. (2022) + письма Maier, Szaszi и ответ авторов (*PNAS*) — [Maier](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501), [Szaszi](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf), [ответ](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351449). Перевод не проверен.
6. Frederick S., Lee L., Baskin E. (2014). The Limits of Attraction + ответ Huber, Payne, Puto (2014) — [FLB](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/The-Limits-of-Attraction.pdf), [HPP](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf). Перевод не проверен.
7. ⬜ Книги, которые нужно проверить на наличие перевода во втором прогоне (из памяти, не проверено): Kahneman *Thinking,
   Fast and Slow* (2011); Thaler & Sunstein *Nudge* (2008/2021); Thaler *Misbehaving* (2015); Gigerenzer (книги о риске и
   эвристиках); Kahneman, Sibony, Sunstein *Noise* (2021).

## 1.9 Этические и правовые границы

- **Свидетельства и этика пересекаются:** если средний эффект информационных nudge после поправки около нуля
  ([Maier 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501)), обоснование «мягкого вмешательства ради блага»
  опирается на меньшую доказательную базу, чем заявлялось; авторы приманки сами пишут, что создавали не инструмент
  маркетинга, а демонстрацию нарушения аксиомы рациональности ([Huber и др. 2014](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf)).
- **Умолчания:** эффект сильнее, когда умолчание воспринимается как рекомендация (endorsement) или как уже своё
  (endowment) ([Jachimowicz 2019](https://ideas.repec.org/a/cup/bpubpo/v3y2019i02p159-186_00.html)) — то есть именно там,
  где человек доверяет выбирающему за него.
- ⬜ Не проверено в этом прогоне: либертарианский патернализм и его критика; «sludge»; регулирование «тёмных паттернов»
  (ЕС, США, РФ). Без источников — без утверждений.

---

# ЧАСТЬ 2. ЭКОНОМИЧЕСКАЯ ПСИХОЛОГИЯ (economic psychology)

> Большая часть этой дисциплины в этом прогоне **не проверена** (см. ограничение в начале). Ниже — только то, что
> подтверждено источниками, плюс точный список того, что догрузить.

## 2.1 Что изучает, границы, названия

- **Проверено:** ничего из определения дисциплины, её истории (Катона, Мичиганский индекс потребительских настроений,
  *Journal of Economic Psychology*, IAREP) в этом прогоне подтвердить источником не удалось.
- **Рабочее описание для проверки (из памяти, не проверено):** экономическая психология (economic psychology,
  «психология экономического поведения») изучает, как люди думают о деньгах, ценах, налогах, долгах, сбережениях и
  экономике в целом, их установки, ожидания и эмоции — часто опросными и социально-психологическими методами, на уровне
  домохозяйств и общества. Поведенческая экономика, в отличие от неё, работает в рамке экономической теории и меряет
  отклонения от рациональности как параметры модели (подтверждённая часть — 1.1). Перед цитированием — проверить.

## 2.2 История

⬜ Не проверено: George Katona, Survey Research Center Мичиганского университета, Индекс потребительских настроений
(Index of Consumer Sentiment), книга *Psychological Analysis of Economic Behavior*; основание *Journal of Economic
Psychology* и IAREP; европейская традиция (Lea, Webley, Kirchler, Furnham). Ни годов, ни названий журналов без источника
не привожу.

## 2.3 Главные теории и модели (только проверенное)

1. **Сбережения и самоконтроль через β-δ.** Человек с гиперболическим дисконтированием ценит неликвидные активы как
   обязательство; потребление следует за доходом; лишняя ликвидность может снижать сбережения
   ([Laibson 1997](https://econpapers.repec.org/RePEc:oup:qjecon:v:112:y:1997:i:2:p:443-478.)).
2. **Ментальный учёт в потреблении.** Склонность тратить зависит от «счёта», из которого пришли деньги: премия vs рост
   акций (Thaler 1990, цит. по [Laibson 1997](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf)).
3. **Инерция и умолчание как «совет».** Работники остаются на ставке и фонде по умолчанию; авторы объясняют это инерцией и
   тем, что умолчание воспринимают как совет работодателя ([Madrian & Shea 2001](https://www.nber.org/papers/w7682)).
4. **Психология дефицита (scarcity).** Гипотеза: нехватка денег сама по себе ухудшает мышление и решения. Массовая проверка
   её почти не подтвердила для когнитивных способностей, но частично — для финансовых решений (2.4, №4–5).

## 2.4 Таблица ключевых эффектов (проверенная часть)

| # | Эффект | Кто, год | Суть | Сила | Статус | Источник |
|---|---|---|---|---|---|---|
| 1 | Денежный прайминг (money priming) | Vohs и др. 2006 и последователи | Напоминание о деньгах → эгоистичнее, самостоятельнее | Мета 246 экспериментов: g = 0,31 [0,26; 0,36], но публикационное смещение «вероятно» | ❌ / ⚠ | [Lodder и др. 2019](https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-money-priming/) |
| 2 | Денежный прайминг — независимые повторы | — | Только независимые репликации | 47 повторов, доля значимых 4 %, ожидаемая ~5 % (уровень шума) | ❌ | [Replicability-Index 2019](https://replicationindex.com/2019/06/04/nullresultsinmeta/) |
| 3 | Прайминг валютой (currency priming) | Caruso и др. 2013 (по ML1) | Изображение денег → поддержка свободного рынка | ML1: N = 6 333, d = 0,02 | ❌ | [Klein и др. 2014](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf) |
| 4 | Психологические последствия дефицита | Mani, Mullainathan, Shafir и др. (оригиналы) | Нехватка → хуже когнитивные функции и решения | Повтор 20 исследований с выборкой ×2,5: значимы 4; эффект меньше оригинала в 80 %, обратного знака в 30 % | ❌ для когнитивных эффектов | [O'Donnell и др. 2021, PNAS](https://researchwith.stevens.edu/en/publications/empirical-audit-and-review-and-an-assessment-of-evidentiary-value/); [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349) |
| 5 | Дефицит → финансовые решения | там же | 3 из 4 успешных повторов: прайминг финансовых ограничений → финансовые/потребительские решения | Качественно | ⚠ (узкий, возможный эффект) | [PMC8612349](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349) |
| 6 | Автозапись в пенсионный план | Madrian & Shea 2001 | Опт-аут | 86 % против 37 %; 76 % на ставке 3 % по умолчанию | ✅ | [NBER PDF](https://www.nber.org/papers/w7682.pdf) |
| 7 | Обязательство из будущих прибавок | Thaler & Benartzi 2004 | Save More Tomorrow | 78 % вступили; 3,5 % → 13,6 % за 40 мес. | ✅ (поле) | [Chicago Booth](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving) |
| 8 | Nudge в финансовой сфере (сводно) | Mertens 2022 → Maier 2022 | Финансовые подталкивания после поправки | d = 0,00, BF01 = 41,2 (сильные свидетельства за ноль) | ❌ в среднем | [Maier и др. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501) |
| 9 | Предпочтение настоящего на денежных наградах | мета Imai и др. 2021 | β по денежным vs неденежным наградам | Тип награды — главный источник разброса; задержка «текущего» платежа влияет на оценку | ⚠ | [Imai и др. 2021](https://econpapers.repec.org/RePEc:oup:econjl:v:131:y:2021:i:636:p:1788-1814.) |
| 10 | Разрыв WTA–WTP для денег и благ | Horowitz & McConnell 2002 | Чем дальше благо от рыночного, тем больше разрыв | Обычные товары 2,92; нерыночные 10,41; здоровье/безопасность 10,06 | ✅ | [WP](https://ageconsearch.umn.edu/record/197848/files/agecon-maryland-98-05.pdf) |

Строк меньше 20 — потому что остальные эффекты дисциплины в этом прогоне не проверены (2.11). Добавлять их без
источников правила запрещают.

## 2.5 Методы

Проверено только то, что пересекается с частью 1: естественные эксперименты на данных работодателей
([Madrian & Shea](https://www.nber.org/papers/w7682.pdf)), полевые программы ([SMarT](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving)),
лабораторный прайминг и его массовые повторы ([O'Donnell 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349);
[Lodder 2019](https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-money-priming/)).
⬜ Опросные панели потребительских ожиданий (метод Катоны), налоговые лабораторные игры и данные налоговых служб,
транзакционные банковские данные — не проверены.

## 2.6 Что опровергнуто или оспорено (проверенное)

1. **Денежный прайминг** — мета-эффект держится на публикационном смещении; независимые повторы на уровне шума
   ([Lodder 2019](https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-money-priming/);
   [Replicability-Index](https://replicationindex.com/2019/06/04/nullresultsinmeta/); [ML1](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf)).
2. **«Бедность сама снижает интеллект» (scarcity mindset) в лабораторных праймингах** — 4 из 20 повторов
   ([O'Donnell 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349)).
3. **Финансовые nudge в среднем** — после поправки свидетельства за ноль ([Maier 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501)).
   Это не противоречит сильным умолчаниям в пенсиях (2.4, №6): умолчание — «структура», а не «информация».

## 2.7 Современное состояние и споры

⬜ В этом прогоне не проверено: прогностическая сила индексов потребительских настроений; спор о боли оплаты и
безналичных платежах; эффект левой цифры в поле; подписки и автопродление; модель «скользкого склона» в налоговом
поведении. Проверенные споры этой дисциплины совпадают с частью 1: денежный прайминг и дефицит (2.6).

## 2.8 Что читать

1. O'Donnell M. и др. (2021). Empirical audit… psychological consequences of scarcity. *PNAS* — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349). Перевод не проверен.
2. Lodder P. и др. (2019). A comprehensive meta-analysis of money priming. *JEP: General* — [Tilburg](https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-money-priming/). Перевод не проверен.
3. Madrian B., Shea D. (2001). The Power of Suggestion. *QJE* — [NBER](https://www.nber.org/papers/w7682). Перевод не проверен.
4. Thaler R., Benartzi S. (2004). Save More Tomorrow. *JPE* — [Chicago Booth](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving). Перевод не проверен.
5. ⬜ К проверке (из памяти): Katona *Psychological Analysis of Economic Behavior*; Kirchler *The Economic Psychology of
   Tax Behaviour*; Lea, Tarpy, Webley *The Individual in the Economy*; Mullainathan & Shafir *Scarcity*; обзоры
   Prelec & Loewenstein о «красном и чёрном» (боль оплаты). Годы, переводы — не проверены.

## 2.9 Этические и правовые границы

⬜ Не проверено в этом прогоне (законы об автопродлении подписок и отмене в ЕС, США, РФ; регулирование кредитной
информации; налоговые «письма с нормами»). Без источника не привожу.

## 2.10 Сводка проверенного по части 2

Подтверждено: сила умолчаний в сбережениях (86 % vs 37 %), обязательства из будущих прибавок (3,5 → 13,6 %), большой
разрыв WTA–WTP для нерыночных благ. Опровергнуто / не воспроизвелось: денежный прайминг, когнитивные эффекты «дефицита»,
средний эффект финансовых nudge.

## 2.11 Что догрузить во втором прогоне (точный список, всё — «из памяти, не проверено»)

| Тема | Что найти | Что проверить на воспроизводимость |
|---|---|---|
| Катона | Годы работ, основание Индекса потребительских настроений, его прогностическая сила (работы о вкладе в прогноз потребления) | — |
| Журнал и общество | Год основания *Journal of Economic Psychology*, IAREP | — |
| Боль оплаты | Prelec & Loewenstein 1998 (*Marketing Science*, «The Red and the Black»); Rick, Cryder, Loewenstein (шкала tightwad–spendthrift); нейроданные Knutson и др. 2007 | Повторы фМРТ-работ |
| Карта против наличных | Feinberg 1986; Prelec & Simester 2001 («премия кредитки»); мета-анализы способа оплаты и трат | Провалы повтора «премии кредитки» |
| Левая цифра | Thomas & Morwitz 2005; Lacetera, Pope, Sydnor 2012; Strulov-Shlain 2023 | Поле (уже сильное) |
| Подписки | DellaVigna & Malmendier 2006 (спортзал); Einav, Klopack, Mahoney 2023 (невнимательность); Miller, Sahni, Strulov-Shlain (автопродление) | — |
| Налоги | Allingham & Sandmo 1972; Kirchler — «скользкий склон»; полевые письма с нормами (HMRC) | Мета-анализы писем |
| Долги | Психология множественных долгов (Amar и др. 2011; Kettle и др. 2016); отвращение к долгу | — |
| Скандалы | Ariely (Shu и др. 2012, отзыв 2021; обвинения 2026), Gino (отзывы, решение Гарварда), Wansink (число отзывов, уход 2019) | Даты и число отзывов — только по Retraction Watch / журналам |
| Boosts | Hertwig & Grüne-Yanoff 2017 и эмпирика boosts | Мета-анализы |
| Переводы | «Думай медленно… решай быстро», «Nudge. Архитектура выбора», «Новая поведенческая экономика», «Шум», «Дефицит» и др. | — |

---

# 10. Список всех источников (открыты в этом прогоне)

**Поведенческая экономика — ядро и спор о потерях**
- [Brown, Imai, Vieider, Camerer 2024, JEL — страница AEA](https://www.aeaweb.org/doi/10.1257/jel.20221698)
- [Brown и др. 2024 — EconPapers](https://econpapers.repec.org/RePEc:aea:jeclit:v:62:y:2024:i:2:p:485-516)
- [Gal & Rucker 2018 — Kellogg](https://www.kellogg.northwestern.edu/academics-research/research/detail/2018/the-loss-of-loss-aversion-will-it-loom-larger/) (страница не открылась; пересказ — Kitces)
- [Kitces — пересказ Gal & Rucker](https://www.kitces.com/blog/loss-aversion-pain-loom-larger-than-gain-gal-rucker-journal-psychology/)
- [Mrkva, Johnson, Gächter, Herrmann 2020 — Bath](https://researchportal.bath.ac.uk/en/publications/moderating-loss-aversion-loss-aversion-has-moderators-but-reports/)
- [atticusli — вторичный обзор loss aversion (λ = 2,25, 1979/1992)](https://atticusli.com/replication-crisis/loss-aversion/)
- [Ruggeri и др. 2020, Nature Human Behaviour — IDEAS](https://ideas.repec.org/a/nat/nathum/v4y2020i6d10.1038_s41562-020-0886-x.html)

**Ограниченная рациональность, дисконтирование**
- [Encyclopedia.com — Herbert Simon](https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/simon-herbert)
- [Simon 1955 — PDF](https://edisciplinas.usp.br/pluginfile.php/7058332/mod_resource/content/1/1955%20Racionalidade%20limitada.pdf)
- [Wikipedia (зеркало IPFS) — Bounded rationality, только как навигатор](https://ipfs.ssi.eecc.de/ipns/en.wikipedia-on-ipfs.org/wiki/Bounded_rationality)
- [Laibson 1997 — PDF Harvard DASH](https://dash.harvard.edu/bitstream/1/4481499/2/Laibson_GoldenEggs.pdf)
- [Laibson 1997 — EconPapers](https://econpapers.repec.org/RePEc:oup:qjecon:v:112:y:1997:i:2:p:443-478.)
- [Imai, Rutter, Camerer 2021, Economic Journal — EconPapers](https://econpapers.repec.org/RePEc:oup:econjl:v:131:y:2021:i:636:p:1788-1814.)

**Владение, якорение**
- [Horowitz & McConnell 2002 — рабочая версия](https://ageconsearch.umn.edu/record/197848/files/agecon-maryland-98-05.pdf)
- [Horowitz & McConnell 2002 — IDEAS](https://ideas.repec.org:443/a/eee/jeeman/v44y2002i3p426-447.html)
- [Isoni, Loomes, Sugden 2011, AER — ответ Plott & Zeiler](https://econpapers.repec.org/RePEc:aea:aecrev:v:101:y:2011:i:2:p:991-1011)
- [Plott & Zeiler 2005, AER — EconPapers](https://econpapers.repec.org/RePEc:aea:aecrev:v:95:y:2005:i:3:p:530-545)
- [Maniadis, Tufano, List 2014, AER — EconPapers](https://econpapers.repec.org/RePEc:aea:aecrev:v:104:y:2014:i:1:p:277-90)
- [Data Colada #7 — о повторе Maniadis и др.](https://datacolada.org/7)
- [Li, Maniadis, Sedikides 2021 — мета якорения WTP/WTA](https://ideas.repec.org/a/eee/soceco/v90y2021ics2214804320306728.html)
- [Li, Weigel, Ferraro, Messer 2025, Economic Inquiry](https://econpapers.repec.org/RePEc:bla:ecinqu:v:63:y:2025:i:2:p:387-402)
- [Yoon, Fong, Dimoka 2019, JDM](https://dlab.sauder.ubc.ca/sjdm/journal/19/190426/jdm190426.html)
- [Psychology Today — обзор репликаций якорения](https://psychologytoday.com/gb/blog/cultural-animal/202204/is-anchoring-and-adjustment-the-best-replicated-finding)
- [Röseler и др. 2022 — Open Anchoring Quest](https://eprints.soton.ac.uk/478278)

**Приманка, перегрузка выбором**
- [Huber, Payne, Puto 1982 — EconPapers](https://econpapers.repec.org/RePEc:oup:jconrs:v:9:y:1982:i:1:p:90-98)
- [Frederick, Lee, Baskin 2014 — PDF](https://marketing.wharton.upenn.edu/wp-content/uploads/2016/10/The-Limits-of-Attraction.pdf)
- [Huber, Payne, Puto 2014 — ответ, PDF](https://people.duke.edu/~jch8/bio/Papers/HuberPaynePutoJMR%202014.pdf)
- [Decoy effect — Wikipedia (PDF-копия), только как навигатор](https://www.cognitionandculture.net/wp-content/uploads/Decoy-effect-Wikipedia.pdf)
- [Scheibehenne, Greifeneder, Todd 2010 — IDEAS](https://ideas.repec.org/a/oup/jconrs/v37y2010i3p409-425.html)
- [Chernev, Böckenholt, Goodman 2015 — Kellogg](https://www.kellogg.northwestern.edu/academics-research/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual/)

**Умолчания, nudge**
- [Jachimowicz и др. 2019 — IDEAS](https://ideas.repec.org/a/cup/bpubpo/v3y2019i02p159-186_00.html)
- [Columbia — «Defaults are not the same by default»](https://business.columbia.edu/press-release/cbs-press-releases/defaults-are-not-same-default)
- [Steffel, Williams, Tannenbaum 2019 — обзор презумпции согласия](https://behavioralpolicy.org/wp-content/uploads/2020/01/Does-changing-defaults-save-lives_-Effectd-of-presumed-consent-organ-donation-policies.pdf)
- [Madrian & Shea 2001 — NBER](https://www.nber.org/papers/w7682); [полный текст](https://www.nber.org/papers/w7682.pdf)
- [Thaler & Benartzi 2004 — Chicago Booth](https://www.chicagobooth.edu/research/rustandy/social-impact-research/research-papers/2004/save-more-tomorrow-using-behavioral-economics-to-increase-employee-saving)
- [Mertens и др. 2022 — реферат, Leuphana](https://fis.leuphana.de/en/publications/the-effectiveness-of-nudging-a-meta-analysis-of-choice-architectu/)
- [Maier и др. 2022, PNAS — PMC9351501](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501)
- [Szaszi и др. 2022, PNAS — PDF](https://sites.stat.columbia.edu/gelman/research/published/PNAS_letter_Nudge-meta-analysis.pdf)
- [Mertens и др. 2022, ответ критикам — PMC9351449](https://pmc.ncbi.nlm.nih.gov/articles/PMC9351449)
- [Bayesian Spectacles — rejoinder Maier и др.](https://www.bayesianspectacles.org/rejoinder-no-evidence-for-nudging/)
- [PsyPost — пересказ Maier и др.](https://www.psypost.org/2022/07/re-analysis-of-meta-analysis-reveals-no-evidence-for-nudging-once-accounting-for-publication-bias-63598)
- [Behavioral Scientist — «Making Sense of the Do Nudges Work Debate»](https://behavioralscientist.org/making-sense-of-the-do-nudges-work-debate/)
- [The Behavioral Scientist — «Bad News for Nudges»](https://www.thebehavioralscientist.com/articles/bad-news-for-nudges)
- [Replicability-Index 2026 — «What is the effect of nudging?»](https://replicationindex.com/2026/09/07/what-is-the-effect-of-nudging-43/)
- [Critical reading — Mertens 2022](https://ber.jcx.au/critical-reading/mertens-2022.html)
- [DellaVigna & Linos 2022 — NBER](https://nber.org/papers/w27594); [Econometrica — EconPapers](https://econpapers.repec.org/RePEc:wly:emetrp:v:90:y:2022:i:1:p:81-116)

**Репликации**
- [Klein и др. 2014, Many Labs 1 — PDF](https://research.unipd.it/bitstream/11577/2688304/1/ManyLabs.2014.SP.fulltext.pdf)
- [Camerer и др. 2016 — MPRA PDF](https://mpra.ub.uni-muenchen.de/75461/1/MPRA_paper_75461.pdf)
- [Retraction Watch — о Camerer 2016](https://retractionwatch.com/2016/03/03/more-than-half-of-top-tier-economics-papers-are-replicable-study-finds/)

**Экономическая психология (проверенная часть)**
- [Lodder и др. 2019 — мета денежного прайминга, Tilburg](https://research.tilburguniversity.edu/en/publications/a-comprehensive-meta-analysis-of-money-priming/)
- [Replicability-Index 2019 — повторы денежного прайминга](https://replicationindex.com/2019/06/04/nullresultsinmeta/)
- [O'Donnell и др. 2021 — Stevens](https://researchwith.stevens.edu/en/publications/empirical-audit-and-review-and-an-assessment-of-evidentiary-value/); [PMC8612349](https://pmc.ncbi.nlm.nih.gov/articles/PMC8612349)

**Адреса, которые система не открыла (для второго прогона):** plato.stanford.edu (Bounded rationality),
nobelprize.org (Thaler 2017), en.wikipedia.org (Herbert Simon), doi.org/10.1509/jmr.14.0020 (Yang & Lynn 2014),
doi.org/10.1037/pspa0000374 (отзыв Tian … Gino 2018), eml.berkeley.edu (DellaVigna & Malmendier 2006),
nber.org/papers/w31547 (Einav и др. 2023), poetsandquants.com (Ariely 2026), europepmc (полный текст Maier).
