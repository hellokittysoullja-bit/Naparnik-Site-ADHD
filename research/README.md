# Исследование источников по дизайну и UX (02.11.2026)

Владелец дал источники хорошего UI, UX и моушна. Четыре агента изучили их целиком: открывали сайты в браузере,
клонировали репозитории, читали файлы, смотрели картинки и кадры видео. **Сравнения с Напарником здесь нет
намеренно** — это изучение самих источников; что применять, решаем отдельно.

| Отчёт | Источники | Самое ценное |
|---|---|---|
| [01-ui-ux-skills.md](01-ui-ux-skills.md) | [taste-skill](https://github.com/Leonxlnx/taste-skill) + [tasteskill.dev](https://www.tasteskill.dev/), [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), [motion-design-agent](https://github.com/soilmass/motion-design-agent) | правила моушна taste-skill (кривые, ~420 мс, ничего не скрыто >900 мс, без overshoot); доступность ui-ux-pro-max; цифры M3 и анимации персонажа |
| [02-visual-motion-godly-sl-ui.md](02-visual-motion-godly-sl-ui.md) | [Godly](https://godly.website/) (теперь recent.design → Websites), [SL UI Library](https://sltowl.github.io/sl-ui-library/) | 7 схем героя, тайминги появления/наведения/нажатия, свет как событие; 388 компонентов SL в 6 состояниях |
| [03-onboarding-conversion-mobbin-growthdesign.md](03-onboarding-conversion-mobbin-growthdesign.md) | [Growth.Design](https://growth.design/case-studies) (все 52 кейса, 106 принципов), [Mobbin](https://mobbin.com/) (открытая часть) | онбординг с действия, а не слайдов; разрешения в контексте; честный пейвол; прощающие механики; этический фильтр тёмных паттернов |
| [04-ux-research-baymard-nngroup.md](04-ux-research-baymard-nngroup.md) | [Baymard](https://baymard.com/), [Nielsen Norman Group](https://www.nngroup.com/) | числа: отклик 0,1/1/10 с, анимации 100–400 мс, цели касания 7 мм–1 см, чтение ~20% слов, онбординг лучше пропускаемый, чат-боты |
| [05-elaya-design-skills.md](05-elaya-design-skills.md) | [ai-design-skills](https://github.com/elayadesign/ai-design-skills) (landing-page-design, figma-designer), [redesign-skill](https://github.com/elayadesign/redesign-skill), design-to-motion (из истории репозитория), неслитый PR #1, SlopScan | все правила пака целиком по-русски + сводная таблица чисел; оригиналы дословно — `skills/elayadesign/`; замер страницы — `tools/elaya-audit.mjs`; в §11 — сверка с Напарником (исключение из правила «без сравнения»: так просил владелец) |
| [06-onboarding-psychology.md](06-onboarding-psychology.md) | Noom, Headspace × Irrational Labs, Duolingo, Fabulous, Liven, Inflow, Me+, Structured, Forest, Finch, BitePal, Ahead, Opal; исследования (Buell & Norton, Gollwitzer, Spangenberg, Aguirre, Wohl, Silverman & Barasch, Villar); закон (UCPD, 376-ФЗ, FTC) | психология знакомства: механизмы с цветом честности, разбор 12 онбордингов, что сейчас у Напарника, новая последовательность, 25 идей |
| [07-funnel-onboarding-paywall.md](07-funnel-onboarding-paywall.md) | эксперт A, 03.11: 286 экранов живых воронок, метаанализы, RevenueCat/ChartMogul/Miller-Sahni | модель покупателя (стыд/вина, самозатруднение, расхождение «я»), воронка от ролика до продления с текстами, обратный триал, цены, движок персонализации, бот, A/B-тесты |
| [08-traffic-first-sales-payments.md](08-traffic-first-sales-payments.md) | эксперт B, 03.11: Airbridge UGC, Adapty, ppc.world, TGStat, Robokassa/ЮKassa/Stars | трафик на 5 площадках и 12 сценариев роликов, креаторы и сделки, Telegram-воронка, первые 10/100 продаж по дням, платёжный стек и интеграция, юнит-экономика, аналитика |
| [09-ideal-onboarding/](09-ideal-onboarding/) | 05.11: четыре эксперта (A — СДВГ и нейропсихология, B — рост/воронка/цены, C — убеждение/тексты/кот, D — глубинные механизмы), критик (E), сводка v1 (F) и проверки главного сеанса по первоисточникам (G); ТЗ — `00-brief.md` | онбординг экран за экраном от ролика до пейвола; вердикты критика по 39 утверждениям — что верно, что перенесено неверно |
| [10-youtube-study/](10-youtube-study/) | 04.11: 29 видео (~21 ч) по онбордингу, маркетинговой психологии, поведенческой экономике, конверсии; конспект на каждое (`notes/`), список (`videos.json`) | `SKILL.md` — 20 принципов с таймкодами, плейбук по экранам, формулы текстов; субтитры — автоматические YouTube |

`img/` — ключевые скриншоты, на которые ссылаются отчёты (ужаты до 1600 px). Остальные снимки (≈1 150 по Godly/SL,
≈4 000 экранов Mobbin, кадры комиксов Growth.Design) в репозиторий не положены из-за веса: ссылки на них в отчётах
вида `shots/…`, `gd/…`, `mb/…` указывают на архив сессии, которого больше нет.

**Чего не удалось изучить** (подробно — в разделе «Метод/охват» каждого отчёта): платные гайдлайны Baymard и
закрытая логином часть Mobbin; комиксы Growth.Design глазами просмотрены у 6 кейсов из 52 (текст — у всех);
в Baymard/NN/g полностью прочитана часть статей, остальные — конспектом; 51 вложенный файл motion-design-agent;
несколько WebGL-сайтов Godly изучены по видеозаписям.
