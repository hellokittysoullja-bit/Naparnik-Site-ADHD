# 20б. Разбор исходного кода открытых обвязок агентов → что взять «Напарнику» на AI SDK 7 (11.11.2026)

Цель: не пересказ документации, а приёмы, найденные **в коде** лучших открытых обвязок, с файлами и строками, и как
каждый сделать у нас поверх уже стоящего `ai@7.0.28` (ядро `lib/ai/` в ветке `claude/ai-harness`, см. `design.md`).
Только чтение: репозиторий продукта не менялся, кроме этого файла.

## 0. Что и в какой версии прочитано

| Репозиторий | Коммит (дата) | Где лежит клон |
|---|---|---|
| openai/openai-agents-js | `7589b9c` (09.11.2026) | `scratchpad/harness-ref/openai-agents-js` |
| mastra-ai/mastra | `d546b6c5` (11.11.2026) | `scratchpad/harness-ref/mastra` |
| letta-ai/letta-code (текущий Letta) | `ad308cd` (10.11.2026) | `scratchpad/harness-ref/letta-code` |
| letta-ai/letta (`main`) | — | только README: **сервер V1 (MemGPT, Python) снят и перенесён в ветку `archive`; `AGENTS.md` прямо запрещает брать его как образец**. Поэтому Letta читан по `letta-code` |
| mem0ai/mem0 | `f1791da` (06.11.2026) | `scratchpad/harness-ref/mem0` |
| NousResearch/hermes-agent | `3bcd0712` (11.11.2026) | `scratchpad/harness-ref/hermes-agent` (для сравнения в §9) |
| `ai@7.0.28` | установлен | `node_modules/ai/dist/index.d.ts` (8977 строк), `@ai-sdk/provider@4.0.37`, `@ai-sdk/provider-utils@5.0.12` |

Плюс официальные тексты: Anthropic «Building effective agents» (12.2024), «Effective context engineering for AI agents»
(anthropic.com/engineering/effective-context-engineering-for-ai-agents, прочитано 11.11), документация хуков Claude Code
(code.claude.com/docs/en/hooks).

Пути ниже — относительно клона (`packages/...`, `src/...`); строки — на указанных коммитах.

---

## 1. OpenAI Agents SDK (TypeScript)

### 1.1 Цикл хода и условия остановки
- `packages/agents-core/src/run.ts:690–711` — цикл: вызов агента → если есть финальный вывод нужного типа, стоп → если
  передача (handoff), снова с новым агентом → иначе выполнить инструменты и повторить. Исключения: `MaxTurnsExceeded` и
  растяжка проверки. Лимит — `maxTurns` (`run.ts:467`, `1293–1302`).
- **Обработчики ошибок хода вместо падения** — `runner/errorHandlers.ts:31` `RunErrorKind = 'maxTurns' | 'modelRefusal' |
  'invalidFinalOutput'`; обработчик возвращает `finalOutput` и флаг `includeInHistory` (`:53–60`). Это ровно наш
  «заготовленный ответ кота» — но с решением, попадает ли заготовка в историю разговора.
- **Поведение после инструмента** — `agent.ts:229` `ToolUseBehaviorFlags = 'run_llm_again' | 'stop_on_first_tool'`,
  плюс `stopAtToolNames` (`:299`) и `resetToolChoice` (`:453`, по умолчанию true — чтобы модель с принудительным
  `toolChoice` не зациклилась на одном инструменте).

### 1.2 Проверки (guardrails): вход, выход, инструменты
- `guardrail.ts:63–79`: у проверки входа поле `runInParallel` — «идти рядом с агентом (по умолчанию) или **блокировать агента,
  пока не закончит**». Разделение — `runner/guardrails.ts:264–280` `splitInputGuardrails` → `blocking` / `parallel`.
  Блокирующие идут до вызова модели (деньги не тратятся), параллельные — одновременно (быстрее, но модель уже платит).
- Растяжка: `guardrail.ts:24–28` `{ tripwireTriggered, outputInfo }` → `InputGuardrailTripwireTriggered` (`errors.ts:246`),
  `OutputGuardrailTripwireTriggered` (`errors.ts:261`). Ошибка самой проверки — отдельная `GuardrailExecutionError`
  (`runner/guardrails.ts:~315`), то есть «проверка упала» ≠ «проверка сработала».
- **Проверки вокруг инструментов** — `toolGuardrail.ts:12–15`: три исхода `allow` / `rejectContent(message)` /
  `throwException`. `rejectContent` — мягкий: вызов не выполняется, модель получает сообщение и продолжает. Для нас это
  правильная форма для `rememberFact` («нельзя запоминать диагнозы/лекарства» → мягкий отказ, кот не падает).
- **Скрытие заблокированного вывода** — `runner/outputGuardrailBlockedMessage.ts:4–5` подставляет нейтральную строку
  `'Output withheld by an output guardrail.'`; форматтер, который упал, «закрывается» без утечки деталей (`:43–56`).
  Отдельный модуль `runner/blockedOutputPersistence.ts` (2121 строка!) решает, что из заблокированного **сохранять в
  историю** — заблокированный текст не должен вернуться в контекст следующего хода.

### 1.3 Сессии и память разговора
- `memory/session.ts:28–95` — минимальный интерфейс `Session`: `getSessionId`, `getItems(limit)`, `addItems`, `popItem`,
  `clearSession`. `popItem` нужен для «исправить последнее сообщение» и для отката хода, если ответ заблокирован.
- Сжатие как часть сессии: `OpenAIResponsesCompactionAwareSession.runCompaction` (`session.ts:~205`) вызывается
  **после** сохранения завершённого хода, «best-effort»; порог по умолчанию — 10 элементов-кандидатов
  (`agents-openai/src/memory/openaiResponsesCompactionSession.ts:31`), решение можно переопределить `shouldTriggerCompaction`.
- **Сериализуемое состояние хода** — `runState.ts:201` `CURRENT_SCHEMA_VERSION = '1.24'`, `RunState.fromString` (`:3740`):
  ход, остановленный на «нужно одобрение», сохраняется строкой и продолжается в другом процессе. Для serverless
  (Vercel) это значит: «ожидание человека» не держит функцию.

### 1.4 Повторы, трассы, передачи
- `runner/modelRetry.ts:1005–1060` `retryPolicies`: `never`, `providerSuggested` (уважает `retry-after` и «безопасность
  повтора»), `networkError`, `httpStatus([...])`, `retryAfter`, `any(...)`. Главное — **«replay safety»**: повторять
  можно только то, что не дало побочных эффектов.
- Трассы: `tracing/createSpans.ts:109–462` — отрезки `agent`, `turn`, `function`(инструмент), `handoff`, `generation`,
  `guardrail`, `custom`; процессор `tracing/processor.ts:25–55` (`onTraceStart/End`, `onSpanStart/End`).
  `traceIncludeSensitiveData` **по умолчанию true** (`run.ts:363`, `:652`) — у нас должно быть наоборот.
  `groupId` (`run.ts:380`) — связать все трассы одного разговора.
- Передачи: `handoff.ts:170` `inputFilter`, готовый фильтр `extensions/handoffFilters.ts:38` `removeAllTools` — новый
  агент получает историю без служебных вызовов инструментов.
- Мост к AI SDK: `agents-extensions/src/ai-sdk/index.ts:1696` `aisdk(model)` — их цикл может работать на любой модели AI SDK.
  Нам не нужен: свой цикл у AI SDK уже есть.

---

## 2. Mastra

### 2.1 Процессоры — общий механизм для проверок, памяти и контекста
`packages/core/src/processors/index.ts:633–830` — интерфейс `Processor` с фазами:
`processInput` (раз в начале), `processInputStep` (перед **каждым** шагом, в т. ч. после инструментов),
`processLLMResponse`, `processOutputStep` (после каждого ответа модели, **до** выполнения инструментов),
`processOutputStream` (по кусочкам потока), `processOutputResult` (раз в конце), обработка результата инструмента и
`processAPIError` (`:579–605`, `{ retry: boolean }`).
- **Перегенерация как часть проверки:** `ProcessorContext.abort(reason, { retry: true })` и счётчик `retryCount`
  (`index.ts:62–89`); в комментарии к `processOutputStep` (`:812–818`) прямо: «место для проверок тона и формата с
  самоисправлением через `abort({ retry: true })`». Отдельный бюджет повторов — `processors/retry-budget.ts`.
- `onViolation` (`index.ts:~690`) — побочный эффект (алерт/журнал), ошибки которого глотаются.
- Стратегии реакции у встроенных детекторов: `processors/prompt-injection-detector.ts:75–80` `'block' | 'warn' |
  'filter' | 'rewrite'`; есть `moderation.ts`, `pii-detector.ts`, `language-detector.ts`, `system-prompt-scrubber.ts`
  (вырезает утёкший системный промпт из ответа), `unicode-normalizer.ts`, `regex-filter.ts`, `token-limiter.ts`.
- **Проверка потока до показа:** `moderation.ts:268–300` — режим `bufferSize`: текст копится в буфер и выпускается
  клиенту только после проверки (`processBufferedTextStream`); режим `chunkWindow` (`:90`, `:510`) — судье даётся окно
  последних N кусков. Это ответ на нашу главную дыру: в потоковом чате проверка «после» уже ничего не может отозвать.
- **Деньги как процессор:** `token-cost-control.ts:1–60` — потолок стоимости по области `run | resource | thread | user |
  session` и окну `1h…365d`; нет ключа в контексте → «fail-open».

### 2.2 Память: три слоя
Опции — `packages/core/src/memory/types.ts`:
- **История** `lastMessages` (`:1041–1047`) — последние N, можно ограничить токенами.
- **Рабочая память** (`:195–240`): `scope: 'resource'` по умолчанию (одна на человека, через все разговоры), шаблон
  Markdown или **схема** (zod/JSON). Инструмент `updateWorkingMemory` — `packages/memory/src/tools/working-memory.ts:125`.
  Детали, которые стоит перенять:
  - у схемной памяти — **слияние**: пропущенное поле не трогается, `null` — удалить, массив заменяется целиком
    (`working-memory.ts:15–57` `deepMergeWorkingMemory`);
  - строгие провайдеры заставляют модель слать `null` во все необязательные поля — их отбрасывают до слияния,
    иначе «стирались бы соседние разделы» (`:175–186` `stripNullsFromOptional`);
  - проверка схемой без AJV/`new Function` — «падает в рантаймах без eval» (`:150–154`). У нас тот же CSP-урок
    (`lib/zod-jitless.ts`).
  - `agentManaged: false` — память обновляет не основной агент, а фоновый извлекатель (`types.ts:~212`).
- **Семантическое припоминание** `semanticRecall: { topK, messageRange, scope }` (`types.ts:356–385`) — похожие старые
  сообщения + соседи до/после.

### 2.3 Наблюдательная память (Observational Memory, OM) — лучшее, что есть в открытом коде по длинным разговорам
`packages/memory/src/processors/observational-memory/` (`ARCHITECTURE.md`, 432 строки):
- Две фоновые модели: **Observer** превращает сырые сообщения в короткие «наблюдения», **Reflector** сжимает
  накопившиеся наблюдения. Основной агент видит `<observations>` + хвост сырых сообщений.
- Пороги (`constants.ts:4–41`): наблюдать после 30 000 токенов сообщений, буферизовать в фоне каждые 20 %, при
  активации оставлять 20 % сырого хвоста; рефлексия после 40 000 токенов наблюдений; температура рефлексии 0.
- Формат наблюдения (`observer-agent.ts:49–110`, `:336–378`): приоритет 🔴/🟡/🟢, время, ✅ — завершено.
  Правила, которые прямо ложатся на кота:
  - **«утверждения человека — авторитетны»**: сказанное о себе важнее его же позднего вопроса;
  - **смена состояния записывается как смена** («будет делать X вместо Y»), а не как новый факт рядом со старым;
  - **временная привязка**: «на прошлой неделе» → «(meaning <дата>)»; размытые «недавно» не датировать.
- Подсказка продолжения (`constants.ts:47–54`): «не упоминай память, сжатие, пропавшие сообщения; продолжай
  естественно» — защита от неловкого «я помню, что…».
- **Метка разрыва во времени** — `temporal-markers.ts:68–120` + `date-utils.ts:440`: если между сообщениями прошло
  ≥ порога, перед новым сообщением вставляется системное напоминание «3 days later — <дата>». Для продукта, где человек
  «пропадает на неделю» и кот должен встретить без стыда, — прямое попадание.
- Инварианты корректности (ARCHITECTURE.md, «Invariants we want»): каждое сообщение доходит до агента **ровно один раз** —
  сырым или через наблюдение; готовое наблюдение не выбрасывается без покрывающей рефлексии; политика порогов не может
  ломать покрытие. Раздел «Known problems» честно перечисляет найденные гонки по каждой базе — полезно, когда у нас
  будет база.

### 2.4 Оценка (evals) и тесты
- Конвейер оценщика — 4 шага `preprocess → analyze → generateScore → generateReason` (`core/src/evals/base.ts:317–324`);
  оценщики делятся на код (`evals/src/scorers/code/`: tone, keyword-coverage, tool-call-accuracy, trajectory…) и судью
  (`scorers/llm/`: rubric, toxicity, prompt-alignment, multi-turn-judge…).
- **Рубрика** (`scorers/llm/rubric/index.ts:13–60`): список критериев с `required`; строка — чек-лист по строкам;
  судья возвращает `{criterion, satisfied, required, reasoning}` по каждому. «Задача выполнена» = все обязательные.
- **Выборочная оценка живого трафика**: `core/src/evals/types.ts:14` `{ type: 'ratio', rate }`.
- **Запись/воспроизведение ответов LLM для тестов**: `packages/_llm-recorder` (MSW): первый прогон пишет ответ, дальше
  воспроизводит детерминированно; ключ — хэш URL+тела; ночной «контрактный» прогон ловит дрейф API провайдера.

---

## 3. Letta (текущий — `letta-code`)

- **Блоки памяти**: `src/agent/memory.ts:16` `MEMORY_BLOCK_LABELS = ["persona", "human"]`; блоки из `.mdx` с
  `label`/`description` во front-matter (`:26–80`); часть — только для чтения (`READ_ONLY_BLOCK_LABELS`). Пустой блок
  «human» (`src/agent/prompts/human.mdx`) написан не как пустота, а как намерение («I haven't gotten to know this person
  yet. I'm curious…»).
- **Бюджеты памяти**: `src/memory-constraints.ts:5–20` — `maxCoreMemoryCharacters`, `maxFileCharacters`, лимиты по
  шаблону пути, `readOnlyFiles`; проверка отделяет новые нарушения от старых (`changedPaths` → `warnings`).
- **Фоновая рефлексия** вместо записи памяти основным агентом: `src/reflection-settings.ts:1–18` триггер
  `"step-count" | "compaction-event"`; подагент `src/agent/subagents/builtin/reflection.md`. Его фильтры извлечения
  (Phase 2) — лучший готовый чек-лист «что запоминать»:
  1) ошибки и поправки человека; 2) предпочтения; 3) новые факты; 4) **противоречия** с памятью; 5) повторяемые процедуры;
  отсев: «длится или одноразовое?», «уже записано?», «обобщается?», «**относительные даты → абсолютные**»;
  «если ничего не прошло фильтр — ничего не менять».
- **Сжатие скользящим окном**: `src/backend/local/compaction.ts:43–44` (по умолчанию `sliding_window`, 30 %),
  `:738–805` план: вытесняется начало, срез не режет незавершённый вызов инструмента (`hasPendingLocalToolCall`),
  нужен ≥ 1 ответ ассистента в остатке; промпт выжимки `:238–255` (цели / что было / важные детали дословно /
  ошибки и исправления / «подсказки для поиска»), ≤ 300 слов; выжимка вставляется как `system_alert`
  «N сообщений скрыто, вот выжимка» (`:836–863`). Есть запасная модель именно для выжимки (`:27–29`).
- **Каналы (Telegram)**: `src/channels/telegram/debounce.ts:3–56` — склейка пачки сообщений в один ход
  (ключ `telegram:<account>:<chat>:<thread>`, окно 0–10 с); `typing-controller.ts` — «печатает…» до первого исходящего;
  `channel-rich-draft-streamer.ts` — поток ответа в Telegram правкой черновика.

---

## 4. mem0 (конвейер извлечения памяти)

`mem0/memory/main.py:881–1100` — «V3 phased batch pipeline» (заметно изменился: прежний ADD/UPDATE/DELETE заменён
**только-добавлением со ссылками**):
- Фаза 0–1 (`:912–940`): последние 10 сообщений сессии + поиск 10 похожих существующих воспоминаний.
- **Анти-галлюцинация ID** (`:935–940`): UUID существующих воспоминаний подменяются на `"0"…"9"` перед подачей в модель
  и мапятся обратно — модель не выдумывает и не портит длинные идентификаторы.
- Фаза 2 (`:942–985`): **один** вызов модели с `response_format: json_object`; при сбое провайдера — исключение, а не
  тихий пустой список (комментарий `:957–961`: иначе «модель недоступна» неотличимо от «нечего запоминать»).
- Фазы 4–5 (`:1007–1025`): дедуп по MD5 нормализованного текста — и против существующих, и внутри пачки; лемматизация
  для BM25 (гибридный поиск).
- Промпт `mem0/configs/prompts.py:468+` `ADDITIVE_EXTRACTION_PROMPT`: извлекать и из реплик ассистента («человеку
  рекомендовано X», «план включает X»), **не** извлекать оценки ассистента («звучит тяжело»), если человек их не
  подтвердил; связывать с существующими через `linked_memory_ids`; **все относительные даты — к дате наблюдения**
  («Paris last week» бесполезно через полгода).

---

## 5. Hermes Agent — кратко, для сравнения (подробно в `design.md` §2а)
- Память — два файла с жёсткими лимитами: `MEMORY.md` 2200 и `USER.md` 1375 символов (`tools/memory_tool.py:56`),
  в системном промпте; поставщик памяти — `agent/memory_provider.py:84–226` (`prefetch`, `sync_turn`,
  `on_pre_compress`, `on_session_end`, `on_memory_write`).
- Фоновый разбор после хода — `agent/background_review.py:1–6`: форк агента в потоке, тот же префикс кэша, белый список
  инструментов, запись в память и навыки, основной разговор не трогается.
- Сжатие — `agent/context_compressor*.py` (5707 строк): голова и хвост защищены, сначала обрезка выводов инструментов,
  выжимка ~20 % (`_SUMMARY_RATIO = 0.20`, `:826`), хвост ≤ 20 % окна (`:929`).

---

## 6. Принципы Anthropic, которые подтверждаются кодом выше
- **«Building effective agents»**: сначала простейшие «рабочие процессы» (цепочка промптов, маршрутизация,
  распараллеливание секциями/голосованием, оценщик-оптимизатор), агент — только когда шаги нельзя предсказать.
  Для кота: чат — один шаг + до 2 инструментов; дробление задачи — «оценщик-оптимизатор» (сгенерировать → проверить
  правилами → одна перегенерация). Инструменты проектировать как интерфейс (ACI): примеры в описании, «защита от дурака»
  в аргументах (poka-yoke).
- **«Effective context engineering»**: сжатие (сначала максимизировать полноту, потом точность), структурированные
  заметки вне окна, подагенты с чистым контекстом, извлечение «точно в срок», и **очистка результатов старых
  инструментов как самое безопасное сжатие**.
- **Хуки Claude Code**: события `SessionStart`, `UserPromptSubmit`, `PreToolUse`/`PostToolUse`, `PreCompact`, `Stop`…;
  блокировка — код выхода 2 или JSON `decision: "block"` с причиной, которая возвращается модели. Тот же паттерн, что
  `rejectContent` у OpenAI и `abort({retry})` у Mastra: **отказ с объяснением, который модель видит и исправляется**.

---

## 7. Vercel AI SDK 7.0.28 — что реально есть в установленной версии (`node_modules/ai/dist/index.d.ts`)

| Примитив | Где (строка d.ts) | Что даёт нам |
|---|---|---|
| `ToolLoopAgent` | `:5241`, настройки `:5034–5232` | `instructions`, `stopWhen` (по умолчанию `isStepCount(20)`), `prepareStep`, `prepareCall` + `callOptionsSchema` (типизированные параметры вызова: канал, человек), `toolApproval`, `runtimeContext`, колбэки `onStart/onStepStart/onToolExecutionStart/End/onStepEnd/onEnd` |
| Условия остановки | `:1745–1771` | `isStepCount(n)`, `hasToolCall('savePlan')`, `isLoopFinished()`, массив = «любое». Цикл сам стоп при инструменте без `execute` (наши клиентские `savePlan/rememberFact/startFocus`) и при нужном одобрении |
| `prepareStep` | `:1621–1727` | на каждом шаге: сменить `model`, `activeTools`, `toolChoice`, `instructions`, **переписать `messages`** (переносится на следующие шаги), `runtimeContext`, `providerOptions` — место для обрезки истории, вставки «прошло 3 дня», запасной модели на шаге 2 |
| Тайм-ауты | `:592–599` `TimeoutConfiguration` | `{ totalMs, stepMs, chunkMs, toolMs, tools: { savePlanMs } }`; `chunkMs` — «нет нового куска N мс → обрыв» (лимит первого токена в потоке без своего кода) |
| `toolApproval` | `:3078–3147` | `'not-applicable' \| 'approved' \| 'denied' \| 'user-approval'` + `reason`; функция на все вызовы или на инструмент; у `tool()` — `needsApproval` (provider-utils `:1827`) |
| Инструменты | provider-utils `:1821–1905` | `contextSchema` (типизированный контекст инструмента), `toModelOutput` (что видит модель ≠ что видит UI), `strict`, `inputExamples`; `onInputStart/Delta/Available` (поток аргументов) |
| Починка вызова | `:3594–3601` | `repairToolCall` (кривой JSON аргументов → починить вместо падения), `experimental_refineToolInput` (нормализовать аргумент: обрезать длину, убрать перевод строки) |
| Промежуточные слои | `wrapLanguageModel` `:8153`; тип `LanguageModelV4Middleware` (provider `:3510–3581`) | `transformParams` (выключить рассуждение, добавить `cache_control`), `wrapGenerate`/`wrapStream` (запасная модель, лимит первого куска, проверка вывода, журнал); готовые: `defaultSettingsMiddleware`, `extractReasoningMiddleware`, `extractJsonMiddleware`, `simulateStreamingMiddleware`, `addToolInputExamplesMiddleware` (`:8031–8121`) |
| Реестр провайдеров | `createProviderRegistry` `:8463`, `customProvider` `:8361` (`fallbackProvider`), `wrapProvider` `:8210` | имена задач как модели: `naparnik:chat` → цепочка; общий `languageModelMiddleware` на все модели реестра |
| Телеметрия | `Telemetry` `:4290–4440`, `registerTelemetry` `:8633`, `TelemetryOptions` `:931` | свой интегратор без OpenTelemetry: `onStart/onStepStart/onLanguageModelCallStart/End/onToolExecutionStart/End/onEnd/onAbort/onError`; **`recordInputs: false`, `recordOutputs: false`**, `functionId`; `includeRuntimeContext` — только явно отмеченные поля (по умолчанию ничего) |
| Поток в UI | `createUIMessageStream` `:6001`, `toUIMessageStream` `:6114`, `createAgentUIStreamResponse` `:5299` | `originalMessages` → режим сохранения, `onFinish({ responseMessage, isAborted, isContinuation })` (`:2554–2563`), `messageMetadata`, data-части с `transient: true` (`:2373`) — служебные сигналы, не попадающие в историю; `onError` по умолчанию скрывает детали ошибки от клиента |
| Трансформ потока | `experimental_transform` в `streamText`; `smoothStream({ chunking: Intl.Segmenter \| RegExp \| ChunkDetector })` `:6973` | **точка для потоковой проверки**: свой `TransformStream`, выпускающий текст клиенту по предложениям после проверки |
| История | `pruneMessages({ reasoning, toolCalls: 'before-last-2-messages', emptyMessages })` `:6947` | «очистка старых результатов инструментов» Anthropic одной функцией |
| Сообщения | `validateUIMessages`/`safeValidateUIMessages` `:5941–5958` (со схемами `metadata`, `data`, `tools`), `convertToModelMessages` `:5673` | уже используем в `companion` |
| Дрейф инструментов | `fingerprintTools` / `detectToolDrift` `:6995–7002` | снимок описаний и схем инструментов → тест «поверхности» как у Hermes, готовой функцией |
| Тесты | `ai/test`: `MockLanguageModelV4`, `simulateReadableStream`, `mockId` | детерминированные юнит-тесты обвязки без сети |
| Прочее | `reasoning: 'none'` в `CallSettings` (`:575–583`); `allowSystemInMessages` (по умолчанию **false**) | рассуждение выключается стандартной настройкой, а не правкой тела запроса; системные сообщения в `messages` запрещены по умолчанию — данные из чата не станут инструкцией |

Вывод: всё, что делает текущий `runTurn` руками (тайм-ауты, перебор моделей, журнал), в 7.0.28 уже имеет штатные места,
кроме **страхующего параллельного запроса** (hedging) — его ни у кого из разобранных нет, он остаётся нашим.

---

## 8. Как это собрать у нас (эскизы на AI SDK 7, не внедрено)

### 8.1 Модели: реестр + слой «страховка/запасная/журнал»
```ts
// lib/ai/models.ts
const anymodel = createOpenAICompatible({ name: 'anymodel', baseURL, apiKey, includeUsage: true })
export const registry = createProviderRegistry(
  { anymodel, google },
  { languageModelMiddleware: [reasoningOff, traceModelCall] }, // reasoningOff: transformParams → reasoning: 'none'
)
// задача → цепочка; hedgedModel оборачивает wrapGenerate/wrapStream: старт основной, через hedgeAfterMs — запасной,
// побеждает первый годный (для потока — первый кусок текста), второй отменяется abort'ом
export const chatModel = hedgedModel([registry.languageModel('anymodel:ds/deepseek-v4-flash'),
                                      registry.languageModel('anymodel:cc/claude-haiku-5-5')], { hedgeAfterMs: 1500 })
```
Так страховка работает и для `streamText`, и для `generateText`, и для бота — сейчас она живёт только внутри `runTurn`
и чат (`app/api/companion/route.ts:110`) её не получает.

### 8.2 Чат кота — `ToolLoopAgent`
```ts
export const catAgent = new ToolLoopAgent({
  model: chatModel,
  callOptionsSchema: z.object({ channel: z.enum(['web', 'telegram']), hour: z.number(), memory: MemorySchema.nullable() }),
  prepareCall: ({ options, ...rest }) => ({ ...rest, instructions: persona(options.channel) /* стабильно, под снимком */ }),
  tools: { savePlan, rememberFact, startFocus },            // клиентские: без execute → цикл сам остановится
  stopWhen: [isStepCount(3), hasToolCall('startFocus')],
  timeout: { totalMs: 9000, chunkMs: 4000 },
  prepareStep: ({ messages, stepNumber }) => ({
    messages: withDataBlock(withGapMarker(pruneMessages({ messages, toolCalls: 'before-last-2-messages' }))),
    ...(stepNumber > 0 && { activeTools: [] }),              // после инструмента — только слова
  }),
  experimental_refineToolInput: { rememberFact: ({ fact }) => ({ fact: fact.slice(0, 160) }) },
  toolApproval: { rememberFact: (i) => (isMedical(i.fact) ? { type: 'denied', reason: 'медицину не запоминаем' } : undefined) },
  telemetry: { functionId: 'chat', recordInputs: false, recordOutputs: false },
})
// маршрут: return createAgentUIStreamResponse({ agent: catAgent, uiMessages, options, experimental_transform: sentenceGuard })
```

### 8.3 Проверка потока по предложениям (`sentenceGuard`)
`experimental_transform`: копить `text-delta` до конца предложения (`Intl.Segmenter('ru', { granularity: 'sentence' })`),
прогнать правила `guards/output` (стыд/вина, медицина, латиница, длина) — и только тогда отдать клиенту. Нарушение
в первом предложении → оборвать поток и подать заготовку тем же каналом (data-часть `transient`, клиент заменит пузырь);
нарушение позже → обрезать до последнего чистого предложения. Это `bufferSize`-режим Mastra (`moderation.ts:290–300`),
цена — задержка в одно предложение (~0,3–0,8 с при наших 1–3 предложениях). Альтернатива «проверить после» в потоке
бессмысленна: текст уже показан.

### 8.4 Проверки: две очереди, как у OpenAI
`guards/input` делить на **блокирующие** (кризис, бюджет, лимит на человека, размер — до вызова модели) и
**параллельные** (дорогой судья взлома промпта, если появится — идёт вместе с моделью, при срабатывании поток
обрывается). Исход каждой проверки — тройка `allow | reject(message) | trip`, где `reject` — мягкий отказ голосом кота.
Упавшая проверка ≠ сработавшая: падение правила → `allow` + запись в журнал (как `GuardrailExecutionError`).

### 8.5 Память человека (когда будет база; интерфейс — сейчас)
- **Рабочая память = схема**, не свободный текст: `{ name?, activeTask?, blockers[], whatHelps[], preferredMinutes?,
  lastSessionAt? }`; запись — слиянием Mastra (`null` = удалить, пропуск = не трогать), лимит символов как у Hermes/Letta.
- **Запись — фоном, а не основным ходом** (Letta reflection, Hermes background_review, Mastra `agentManaged: false`):
  после ответа (`onFinish` / `after()` из `next/server`) дешёвая модель по чек-листу Letta + правилам mem0 (только
  утверждения человека, относительные даты → абсолютные, не записывать оценки кота, не записывать медицину/диагнозы,
  «ничего не прошло фильтр — ничего не писать») возвращает JSON-патч; ID существующих фактов — порядковые номера (mem0).
  Основной ответ от этого не медленнее, а `rememberFact` перестаёт зависеть от того, вспомнила ли модель вызвать инструмент.
- **Метка разрыва** (Mastra temporal-gap): если с прошлого сообщения/сессии прошло ≥ 1 дня — в блок данных строка
  «Человек вернулся через 6 дней (последний старт — 05.11)» + правило персоны «встречай без упрёка». Это прямо про
  тон продукта («даже если ты пропал на неделю»).
- **Сжатие** — не сейчас (разговоры короткие); когда понадобится — схема Letta (скользящее окно 30 %, не резать
  незавершённый инструмент, выжимка ≤ 300 слов отдельной дешёвой моделью, вставка «N сообщений скрыто») и подсказка
  продолжения Mastra («не упоминай память и сжатие»).

### 8.6 Журнал/трассы
`registerTelemetry(naparnikTelemetry)` с `onLanguageModelCallEnd` (модель, мс, токены, `finishReason`),
`onToolExecutionEnd` (имя, успех, мс), `onAbort`, `onError`; везде `recordInputs/Outputs: false`; общий `turnId`
через `runtimeContext` + `includeRuntimeContext: { turnId: true, channel: true }`. Журнал — fail-open (как сейчас).
Наш `trace.ts` остаётся сводкой хода; телеметрия даёт отрезки внутри.

### 8.7 Проверочный прогон
- Ситуации `evals/` → оценщики двух типов (Mastra): **правила** (длина, язык, стоп-фразы, вызван ли нужный инструмент,
  траектория «не больше 1 инструмента») и **рубрика-судья** с `required`-критериями («нет стыда», «один следующий шаг»,
  «не обещает того, чего продукт не умеет»).
- Юнит-тесты обвязки — `MockLanguageModelV4` + `simulateReadableStream` (страховка, тайм-аут `chunkMs`, обрыв потока
  проверкой) без сети; живой прогон — отдельно, как сейчас.
- Снимок поверхности: `fingerprintTools(tools)` + хэш персоны → `tests/unit/prompt-surface.test.ts`.
- С базой: выборочная оценка живых ходов (`ratio`, Mastra) — только числа, без текстов.

### 8.8 Telegram
Тот же агент через адаптер канала; из Letta: **склейка пачки** сообщений одного чата в один ход (окно ~1,5–3 с),
«печатает…» до первого исходящего, поток ответа правкой одного сообщения (не чаще ~1 раза в секунду из-за лимитов
Telegram). Одобрение `startFocus` в боте — через `toolApproval: 'user-approval'` + кнопки, состояние хода — в базе
(как `RunState.fromString` у OpenAI), функция не ждёт человека.

---

## 9. Таблица приёмов

Приоритет: **P0** — делать при переносе чата на обвязку; **P1** — следующий шаг/с ботом; **P2** — когда будет база
или длинные разговоры; **—** — не брать.

| приём | у кого (файл:строки / ссылка) | как сделать у нас на AI SDK 7 | приоритет |
|---|---|---|---|
| Чат на общей обвязке со страховкой и запасной | наш `lib/ai/harness.ts`; Hermes fallback chains | `hedgedModel` как `LanguageModelMiddleware.wrapStream/wrapGenerate`; чат → `ToolLoopAgent` | P0 |
| Проверка потока до показа (буфер по предложениям) | Mastra `core/src/processors/processors/moderation.ts:268–300` (`bufferSize`), `:90` (`chunkWindow`) | `experimental_transform` + `Intl.Segmenter('ru','sentence')` + `guards/output`; срыв → заготовка data-частью | P0 |
| Лимит «нет куска N мс» | OpenAI `runner/modelRetry.ts` (тайм-ауты модели) | `timeout: { totalMs, chunkMs }` (`index.d.ts:592`) вместо ручных `AbortSignal` | P0 |
| Рассуждение выключено штатно | Hermes reasoning normalization | `reasoning: 'none'` / `defaultSettingsMiddleware`, вместо `transformRequestBody` | P0 |
| Проверки входа: блокирующие vs параллельные | OpenAI `guardrail.ts:63–79`, `runner/guardrails.ts:264–280` | `guards/input` → два списка; блокирующие до вызова, параллельные — `Promise.race` с потоком | P0 |
| Исход проверки allow / reject(message) / trip; сбой ≠ срабатывание | OpenAI `toolGuardrail.ts:12–15`; `GuardrailExecutionError` | единый тип `Verdict`; `reject` → голос кота | P0 |
| Отказ инструмента с причиной, видимой модели | OpenAI `rejectContent`; Claude Code hooks `decision: block`; AI SDK `toolApproval` `:3078` | `toolApproval: { rememberFact: () => ({ type:'denied', reason }) }` | P0 |
| Нормализация аргументов инструмента | AI SDK `experimental_refineToolInput` `:3601`; Mastra `stripNullsFromOptional` `working-memory.ts:175` | обрезка длины, чистка `null`, без перевода строки | P0 |
| Починка кривого вызова инструмента | AI SDK `repairToolCall` `:3594` | одна попытка починки дешёвой моделью, иначе ответ без инструмента | P1 |
| Остановка цикла по инструменту и лимит шагов | AI SDK `isStepCount`, `hasToolCall` `:1757–1771`; OpenAI `stop_on_first_tool` `agent.ts:229` | `stopWhen: [isStepCount(3), hasToolCall('startFocus')]`; после инструмента `activeTools: []` | P0 |
| Заготовка вместо ошибки + решение «в историю или нет» | OpenAI `runner/errorHandlers.ts:31–60` (`includeInHistory`) | заготовки кота помечать в `messageMetadata`, в модель не отправлять как реплику ассистента | P1 |
| Заблокированный вывод не возвращается в контекст | OpenAI `runner/blockedOutputPersistence.ts`, `outputGuardrailBlockedMessage.ts:4` | при срыве проверки не сохранять оборванный текст в историю (`onFinish` → отбросить) | P0 |
| Журнал без текстов через телеметрию SDK | AI SDK `Telemetry` `:4290`, `recordInputs/Outputs` `:931`; OpenAI `traceIncludeSensitiveData` (у них по умолч. true) | `registerTelemetry(...)`, `includeRuntimeContext: { turnId, channel }` | P1 |
| Снимок поверхности промпта и инструментов | Hermes `tests/ci/test_prompt_surface.py`; AI SDK `fingerprintTools`/`detectToolDrift` `:6995` | юнит-тест: хэш персоны + отпечатки инструментов | P0 |
| Детерминированные тесты обвязки | AI SDK `ai/test` `MockLanguageModelV4`; Mastra `_llm-recorder` | моки для страховки/тайм-аутов/обрыва; запись-воспроизведение — по желанию | P1 |
| Оценщики: правила + рубрика с `required` | Mastra `evals/src/scorers/llm/rubric/index.ts:13–60`, `core/src/evals/base.ts:317` | `evals/scorers/*.ts`: rule-scorers + judge с чек-листом тона | P1 |
| Метка разрыва во времени («вернулся через 6 дней») | Mastra `observational-memory/temporal-markers.ts:68–120`, `date-utils.ts:440` | `prepareStep`/блок данных: строка о паузе + правило персоны «без упрёка» | P1 |
| Рабочая память схемой со слиянием (`null` = удалить) | Mastra `memory/src/tools/working-memory.ts:15–57,125` | zod-схема профиля; слияние на сервере/устройстве; лимит символов | P1 |
| Запись памяти фоном, не основным ходом | Letta `subagents/builtin/reflection.md`; Hermes `agent/background_review.py:1–6`; Mastra `agentManaged:false` | `after()` в маршруте → дешёвая модель → JSON-патч памяти | P2 (с базой; на устройстве — P1 через ответ клиенту) |
| Правила извлечения: утверждения авторитетны, смена состояния, абсолютные даты, не записывать оценки ассистента | Mastra `observer-agent.ts:49–110`; mem0 `configs/prompts.py:468+`; Letta reflection Phase 2 | промпт извлекателя + юнит-кейсы | P1 |
| Порядковые ID вместо UUID в промпте | mem0 `memory/main.py:935–940` | факты в блоке данных под номерами 1..N, обратная карта на сервере | P1 |
| Дедуп фактов хэшем | mem0 `main.py:1007–1025` | нормализованный текст → хэш, повтор не пишется | P1 |
| Очистка старых результатов инструментов | Anthropic context engineering; AI SDK `pruneMessages` `:6947` | `pruneMessages({ toolCalls: 'before-last-2-messages' })` в `prepareStep` | P1 |
| Сжатие скользящим окном | Letta `backend/local/compaction.ts:43–44,238–255,738–863`; Hermes `context_compressor.py:826,929` | дешёвая модель, ≤ 300 слов, не резать вызов инструмента, «N сообщений скрыто» | P2 |
| Подсказка продолжения после сжатия | Mastra `observational-memory/constants.ts:47–54` | одна строка в блоке данных: «не упоминай память» | P2 |
| Наблюдательная память (Observer/Reflector) | Mastra OM `ARCHITECTURE.md`, `constants.ts:4–41` | только при длинных разговорах в боте; пороги масштабировать вниз | P2 |
| Потолок стоимости по человеку/окну | Mastra `processors/processors/token-cost-control.ts:1–60` | `budget.ts`: области `user`/`day` с базой; до вызова модели | P2 |
| Сериализуемое состояние хода для одобрений | OpenAI `runState.ts:201,3740` | одобрение `startFocus` в Telegram: состояние в базе, не держать функцию | P2 |
| Склейка пачки сообщений, «печатает…», правка черновика | Letta `channels/telegram/debounce.ts:3–56`, `typing-controller.ts`, `channel-rich-draft-streamer.ts` | адаптер `channels/telegram.ts` | P1 (с ботом) |
| Политики повтора с «безопасностью повтора» | OpenAI `runner/modelRetry.ts:1005–1060` | `maxRetries: 0` + страховка; повтор только для вызовов без побочных эффектов | P1 |
| Вырезание утёкшего системного промпта из ответа | Mastra `processors/processors/system-prompt-scrubber.ts:80` | правило в `guards/output`: n-граммы персоны в ответе → срыв | P1 |
| Передачи между агентами, подагенты, MCP, песочницы | OpenAI `handoff.ts`; Letta subagents | — коту не нужны, лишняя поверхность атаки | — |
| Семантическое припоминание векторным поиском | Mastra `semanticRecall` `types.ts:356–385`; mem0 | пока данных мало и они на устройстве — не нужно | — (пересмотреть с базой) |

---

## 10. Что из этого лучше, чем у Hermes

Hermes — личный агент одного владельца на долгих разговорах; мы — много людей, короткие реплики, поток в браузер,
serverless. Поэтому лучше, чем у Hermes, для нас:

1. **Проверка потока до показа** (Mastra `bufferSize`). У Hermes вывод модели идёт в терминал/мессенджер владельцу,
   которому доверяют; потоковой проверки тона там нет. Нам она обязательна: показанную фразу со стыдом нельзя отозвать.
2. **Проверки трёх типов с растяжкой и мягким отказом** (OpenAI: вход blocking/parallel, выход, вокруг инструмента;
   `rejectContent`). У Hermes есть промежуточные слои и наблюдатели, но нет явного разделения «проверить до денег» и
   «проверить параллельно», и нет «сбой проверки ≠ срабатывание».
3. **Данные человека — не в системном промпте.** Hermes кладёт `USER.md` прямо в системный промпт (ему можно: один
   хозяин). У нас — сообщение-блок «это данные», а AI SDK 7 ещё и по умолчанию запрещает системные сообщения в `messages`
   (`allowSystemInMessages: false`). Это сильнее модели Hermes для многопользовательского продукта.
4. **Память схемой со слиянием** (Mastra) вместо двух файлов свободного текста с лимитом символов (Hermes). Схема
   проверяема, частично обновляема, не «переписывается» моделью целиком и не теряет соседние поля.
5. **Правила извлечения памяти** — Mastra Observer (утверждения авторитетны, смена состояния, временная привязка) +
   mem0 (порядковые ID, хэш-дедуп, «сбой модели ≠ нечего запоминать», не записывать оценки ассистента) + Letta (чек-лист
   отсева). У Hermes фоновый разбор есть, но его критерии менее формализованы и рассчитаны на навыки агента-программиста.
6. **Метка разрыва во времени** (Mastra) — у Hermes нет; для «вернулся через неделю» это ядро тона продукта.
7. **Телеметрия без текстов штатными средствами** (AI SDK `recordInputs/Outputs: false`, `includeRuntimeContext` только
   по белому списку). У Hermes наблюдатели с «правилами безопасности полезной нагрузки», у OpenAI тексты в трассах
   по умолчанию **включены** — у нас по умолчанию выключены.
8. **Снимок поверхности готовой функцией** (`fingerprintTools`/`detectToolDrift`) — тот же тест, что у Hermes, без
   своего кода сериализации.
9. **Страхующие запросы** (наш `runTurn`, Dean & Barroso) — их нет ни у Hermes (последовательные запасные), ни у OpenAI,
   ни у Mastra (повтор после ошибки). Замер 11.11: заготовок 9 → 5 из 21, ответ 8–12 → 3,5–7 с. Это уже лучше Hermes;
   следующий шаг — перенести в слой модели, чтобы страховку получил и поток чата.
10. **Оценщики с рубрикой `required`** (Mastra) — формальнее, чем `evals/`-пробы Hermes: каждая плохая реплика из жизни
    становится критерием, а не только сценарием.

Где Hermes остаётся образцом и менять не надо: стабильный байт-в-байт системный промпт ради кэша, «узкая талия» ядра
и адаптеры каналов, отдельные вспомогательные модели под служебные задачи, документ модели доверия.

## 11. Что не брать и почему
- Передачи/подагенты/MCP/песочницы (OpenAI, Letta, Mastra, Hermes) — кот не действует в мире; поверхность атаки.
- Векторную память и семантическое припоминание — пока память на устройстве и фактов десятки; вернуться с базой.
- Наблюдательную память Mastra целиком — её пороги рассчитаны на 30–40 тыс. токенов; наш разговор — сотни. Взять
  только правила формата наблюдений и метку разрыва.
- Мост `aisdk()` OpenAI Agents — второй цикл поверх цикла AI SDK, лишний слой.
- Старый сервер Letta (MemGPT, Python) — снят самими авторами (`letta/AGENTS.md`: «не использовать как образец»).
