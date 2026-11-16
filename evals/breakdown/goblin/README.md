# Сбор готовых разбивок с goblin.tools (владелец 16.11)

1. `tasks.txt` — список дел, по одному на строку.
2. `node collect.mjs "$(cat have.json)"` — берёт разбивку каждого дела с goblin.tools (острота 1, русский), по одному запросу
   раз в 4 секунды, пишет `raw.json`. `have.json` — уже имеющиеся дела, их не запрашивает. Папка — `GOBLIN_DIR`.
3. `npx tsx --tsconfig tsconfig.json evals/breakdown/goblin/condense.mts` (нужен `ANYMODEL_API_KEY`) — сокращает каждую
   разбивку до 6 шагов: выкидывает пустые шаги, сливает мелкие, слова гоблина сохраняет; пишет `condensed.json`.
4. Результат после проверки глазами — в `lib/ai/agents/breakdown-goblin.ts`, сырьё — в `research/27-breakdown/`.
