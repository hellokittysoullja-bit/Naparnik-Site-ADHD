# Скиллы проекта

Постоянная база знаний по дизайну для любого ИИ-агента, работающего с этим репозиторием.
Грузятся автоматически из `.claude/skills/`, приносить руками не нужно.

Это **вендоренные копии чужих открытых репозиториев**, не наша работа. Файлы скопированы
дословно; каждое отступление от оригинала перечислено ниже в разделе «Что изменено».
Лицензии лежат в `LICENSES/`.

## Источники

| Репозиторий | Скиллов | Лицензия |
|---|---|---|
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 12 | MIT |
| [emilkowalski/skills](https://github.com/emilkowalski/skills) | 11 | MIT |
| [plugin87/ux-ui-agent-skills](https://github.com/plugin87/ux-ui-agent-skills) | 21 | MIT |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 7 | MIT |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills) | 7 | MIT |
| [anthropics/skills](https://github.com/anthropics/skills) | 1 | Apache 2.0 (см. `LICENSES/anthropics-frontend-design.LICENSE.txt`) |

Итого **59 скиллов**, 9.3 МБ. Все 222 скопированных файла сверены с исходниками
побайтово, расхождений ноль.

## С чего начинать

Порядок применения, а не просто список:

1. **`design-doctrine`** (plugin87) - домашние правила для любой работы с UI: протокол
   проверки («прогони гейт, не заявляй число»), токены по смыслу, восемь состояний.
2. **`design-taste-frontend`** (taste-skill) - «design read»: что за страница, для кого,
   каким языком. Потом диалы `DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`.
   Заканчивать **всегда** Pre-Flight чек-листом из §14.
3. **`frontend-design`** (anthropics) - как не получить шаблонный результат.
4. **`apple-design`** (emil) - всё, что двигается и на что нажимают: пружины вместо
   длительностей, прерываемость, отклик на нажатие, тач-таргеты, материалы, трекинг.
5. **`ui-ux-pro-max`** - локальная база: 79 стилей, 192 палитры, 74 пары шрифтов,
   119 UX-правил. Ищется офлайн:
   `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<запрос>" --domain <домен>`
6. Дальше по задаче: `animate` и `improve-animations` для движения, `a11y-audit` и
   `fixing-accessibility` для доступности, `redesign` и `improve-ui` для переделки
   существующего, `design-code` для кода компонентов.

## Полный реестр

| Скилл | Источник | Строк | О чём |
|---|---|---|---|
| `a11y-audit` | plugin87 | 21 | Audit a UI or design against WCAG 2.2 AA/AAA and ARIA patterns, returning criterion-referenced f |
| `animate-expo` | emilkowalski/skills | 640 | Build animations in React Native and Expo, making the decisions in the order that determines whe |
| `animate` | emilkowalski/skills | 523 | Build an animation from scratch, making the decisions in the order that determines whether it fe |
| `animation-vocabulary` | emilkowalski/skills | 173 | Reverse-lookup glossary that turns a vague description of a web animation or motion effect into  |
| `apple-design` | emilkowalski/skills | 282 | Apple's approach to interface design and fluid, physical motion, translated for the web. Use whe |
| `apply-aesthetic` | plugin87 | 23 | Apply a visual direction — an archetype (high-end agency, editorial minimal, brutalist, soft-S |
| `ask-sonner` | emilkowalski/skills | 144 | Guide to Sonner, the React toast library — install and wire up the Toaster, pick the right toa |
| `banner-design` | ui-ux-pro-max | 263 | Design banners for social media, ads, website heroes, creative assets, and print. Multiple art d |
| `baseline-ui` | ibelick/ui-skills | 85 | Quickly deslop UI code by fixing spacing, hierarchy, typography, and small layout issues. Use wh |
| `brand` | ui-ux-pro-max | 1908 | Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activat |
| `brandkit` | plugin87 | 798 | Premium brand-kit image generation skill for creating high-end brand-guidelines boards, logo sys |
| `create-design-md` | ibelick/ui-skills | 254 | Create or update a DESIGN.md from an existing product repository or public website. Use when ask |
| `data-dashboard` | plugin87 | 141 | Build a dense, data-heavy screen - an analytics console or a trading terminal - with real charts |
| `design-code` | plugin87 | 40 | Generate production-ready, accessible, token-driven component code for ANY framework — React+T |
| `design-component` | plugin87 | 81 | Design a UI component spec to the house quality bar — anatomy, variants, sizes, the 8 states,  |
| `design-doctrine` | plugin87 | 77 | The house rules for ANY design or UI work - the verification protocol (run the gate, never claim |
| `design-qa` | plugin87 | 23 | Set up or run design QA gates — token + hardcoded-value lint, automated a11y (axe), contrast,  |
| `design-review` | plugin87 | 24 | Review or audit a design/UI across 6 weighted dimensions with Nielsen's 10 heuristics and a prio |
| `design-system` | ui-ux-pro-max | 1832 | Token architecture, component specifications, and slide generation. Three-layer tokens (primitiv |
| `design-taste-frontend-v1` | taste-skill | 226 | The original v1 taste-skill, preserved for projects depending on its exact behavior. The current |
| `design-taste-frontend` | taste-skill | 1206 | Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief |
| `design-tokens` | plugin87 | 23 | Generate, extend, or audit design tokens in DTCG format with the 3-tier architecture (primitive  |
| `design` | ui-ux-pro-max | 2611 | Comprehensive design skill: brand identity, design tokens, UI styling, logo generation (55 style |
| `emil-design-eng` | emilkowalski/skills | 674 | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decision |
| `figma-integration` | plugin87 | 24 | Keep Figma and code in sync — map the 3-tier DTCG tokens to Figma Variables (collections + mod |
| `find-animation-opportunities` | emilkowalski/skills | 132 | Search a codebase or UI for places that don't animate but should, and reject everything that sho |
| `fixing-accessibility` | ibelick/ui-skills | 135 | Audit and fix HTML accessibility issues including ARIA labels, keyboard navigation, focus manage |
| `fixing-metadata` | ibelick/ui-skills | 112 | > |
| `fixing-motion-performance` | ibelick/ui-skills | 151 | Audit and fix animation performance issues including layout thrashing, compositor properties, sc |
| `frontend-design` | anthropics/skills | 71 | Guidance for distinctive, intentional visual design when building new UI or reshaping an existin |
| `full-output-enforcement` | taste-skill | 49 | Overrides default LLM truncation behavior. Enforces complete code generation, bans placeholder p |
| `governance` | plugin87 | 24 | Govern how the design system evolves — SemVer for tokens/components, the contribution workflow |
| `gpt-taste` | taste-skill | 74 | Elite UX/UI & Advanced GSAP Motion Engineer. Enforces Python-driven true randomization for layou |
| `high-end-visual-design` | taste-skill | 98 | Teaches the AI to design like a high-end agency. Defines the exact fonts, spacing, shadows, card |
| `image-to-code` | taste-skill | 1228 | Elite website image-to-code skill for Codex. For visually important web tasks, it must first gen |
| `imagegen-frontend-mobile` | taste-skill | 1465 | Elite mobile app image-generation skill for creating premium, app-native screen concepts and flo |
| `imagegen-frontend-web` | taste-skill | 987 | Elite frontend image-direction skill for generating premium, conversion-aware website design ref |
| `improve-animations` | emilkowalski/skills | 289 | Survey a codebase's animation and motion code as a senior motion advisor, then produce a priorit |
| `improve-ui` | ibelick/ui-skills | 171 | Audit an existing product surface against its own design evidence, identify verified UI problems |
| `industrial-brutalist-ui` | taste-skill | 92 | Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics. Rigi |
| `migrate-design-system` | plugin87 | 23 | Map this token system to or from any external design system (Material Design 3, Apple HIG, Fluen |
| `minimalist-ui` | taste-skill | 85 | Clean editorial-style interfaces. Warm monochrome palette, typographic contrast, flat bento grid |
| `p87-brandkit` | plugin87 | 26 | Generate a complete, accessible brand design system from a brief — primitive → semantic →  |
| `p87-image-to-code` | plugin87 | 30 | Turn a reference image, screenshot, or mockup into token-driven, accessible code — infer the d |
| `p87-prototype` | plugin87 | 28 | Move an idea up the fidelity ladder (content-first → wireframe → low-fi → high-fi → code |
| `performance` | plugin87 | 23 | Optimize UI performance against Core Web Vitals — LCP, INP, CLS — with loading/code-split st |
| `pick-ui-library` | emilkowalski/skills | 77 | Pick the right library for a given frontend task from a curated, opinionated list — numbers, O |
| `prototype` | plugin87 | 287 | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual |
| `redesign-existing-projects` | taste-skill | 178 | Upgrades existing websites and apps to premium quality. Audits current design, identifies generi |
| `redesign` | plugin87 | 25 | Upgrade an existing website or app to premium quality without breaking functionality — audit t |
| `review-animations` | emilkowalski/skills | 299 | Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design e |
| `slides` | ui-ux-pro-max | 658 | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywritin |
| `stitch-design-taste` | taste-skill | 305 | Semantic Design System Skill for Google Stitch. Generates agent-friendly DESIGN.md files that en |
| `token-build` | plugin87 | 23 | Set up or run the token build pipeline — transform the DTCG tokens/*.json (source of truth) in |
| `ui-skills-root` | ibelick/ui-skills | 59 | Use before UI-related work to select the smallest useful UI Skills context through the ui-skills |
| `ui-styling` | ui-ux-pro-max | 3236 | Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tail |
| `ui-ux-pro-max` | ui-ux-pro-max | 589 | UI/UX design intelligence for web, mobile, and desktop. This skill should be used when designing |
| `ux-writing` | plugin87 | 32 | Write or review UI copy — buttons, errors, empty states, microcopy, notifications, labels —  |
| `write-swift` | emilkowalski/skills | 388 | How to write modern Swift well — modeling with value types, Swift 6 data-race safety and appro |

## Что изменено относительно оригиналов

Дословность нарушена ровно в трёх местах, каждое вынужденное:

1. **Три скилла переименованы из-за коллизии имён.** Два скилла с одинаковым `name`
   затирают друг друга. Победили те, что пришли раньше; версии plugin87 получили
   префикс `p87-` (изменена одна строка `name:` и имя папки):
   `brandkit` → `p87-brandkit`, `prototype` → `p87-prototype`,
   `image-to-code` → `p87-image-to-code`.
   Оригиналы под этими именами - из taste-skill, emil и taste-skill соответственно.
2. **В 19 скиллов plugin87 добавлено по две строки примечания.** Они ссылаются на
   `frameworks/…`, `accessibility/…`, `components/…` от корня своего репозитория.
   Эти папки лежат в `_bundles/plugin87-ux-ui/`, примечание говорит агенту, где искать.
3. **В `ui-ux-pro-max` добавлены две строки** про то, что `${CLAUDE_PLUGIN_ROOT}` здесь -
   корень репозитория. Скрипт поиска проверен, работает офлайн на локальных `data/*.csv`.

## Что НЕ скопировано и почему

- `ui-styling/canvas-fonts/` - 5.5 МБ, 54 файла `.ttf` для python-рендера макетов на
  канвасе. Ссылается ровно один файл (`references/canvas-design-system.md`). Проект
  самостоятельно раздаёт свои три шрифта через `next/font`, эта ветка ему не нужна.
- `plugin87/examples/thumbs/` - 2.0 МБ, 22 png-превью галереи.
- Из `anthropics/skills` взят только `frontend-design`, как и было указано флагом
  `--skill frontend-design`. Остальное там - `docx`/`pdf`/`pptx`/`xlsx` (они и так
  доступны в Claude как встроенные) плюс `canvas-design` на 5.6 МБ.

Вернуть любое из этого:
```bash
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git
cp -r ui-ux-pro-max-skill/.claude/skills/ui-styling/canvas-fonts .claude/skills/ui-styling/
```

## Где они спорят с CLAUDE.md

`CLAUDE.md` в корне описывает уже принятые и проверенные на живых данных решения
продукта и **имеет приоритет**. Известные расхождения:

- **Иконки.** `taste-skill` §3.C не любит `lucide-react`, `design-doctrine` требует
  lucide вместо эмодзи. В проекте lucide уже стоит и используется везде: оставляем.
- **Свои SVG.** `taste-skill` §4.8 запрещает рисовать декоративные SVG руками. Здесь кот,
  остров и спрайты построек нарисованы руками намеренно - это бренд продукта,
  а не декоративная заглушка.
- **Коридор светлоты фона.** `CLAUDE.md` §3 фиксирует `oklch 0.152-0.172` во все часы
  суток. Замер подтверждает, что на этом коридоре держится весь контрастный бюджет.
  Любые советы скиллов про цвет фона подчиняются этому коридору.
- **Тире.** `taste-skill` §9.G запрещает `—` в интерфейсе полностью. Русская типографика
  без тире беднее, но правило про первый экран (заголовок, кнопки, подписи) принимаем:
  там тире действительно читается как машинный след.

## Обновление

```bash
git clone --depth 1 https://github.com/Leonxlnx/taste-skill.git
git clone --depth 1 https://github.com/emilkowalski/skills.git
git clone --depth 1 https://github.com/plugin87/ux-ui-agent-skills.git
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git
git clone --depth 1 https://github.com/ibelick/ui-skills.git
git clone --depth 1 https://github.com/anthropics/skills.git
```
Скопировать `SKILL.md` поверх, сверить `diff`, заново развести коллизии имён
и вернуть три примечания из раздела «Что изменено».
