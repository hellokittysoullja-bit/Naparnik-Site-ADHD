import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'
const D = process.env.GOBLIN_DIR ?? 'evals/breakdown/goblin'
const am = createOpenAICompatible({ name: 'c', baseURL: 'https://anymodel.org/v1', apiKey: process.env.ANYMODEL_API_KEY! })
const raw: Record<string, string[]> = { ...(process.env.ONLY_RAW ? {} : Object.fromEntries(Object.entries(GOBLIN_PLANS).map(([k, v]) => [k, [...v]]))), ...JSON.parse(readFileSync(`${D}/raw.json`, 'utf8')) }
const out: Record<string, string[]> = existsSync(`${D}/condensed.json`) ? JSON.parse(readFileSync(`${D}/condensed.json`, 'utf8')) : {}
const RULES = `Ты редактор списка шагов для людей с СДВГ. Дано дело и разбивка сервиса goblin.tools. Сделай из неё чистый план.
Правила:
- Сохраняй слова и порядок гоблина, где можно. Меняй только то, что нужно по правилам ниже.
- Выкинь пустые шаги, которые ничего не делают: «Определить цель», «Настроиться психологически», «Поддерживать позитивный настрой», «Выбрать подходящее время», «Отслеживать реакцию», «Быть готовым», «Проверить результат и внести коррективы», общие советы и режимы («придерживаться ежедневно»).
- Сколько шагов, решает размер дела и логика (владелец 16.11: большое дело специально не сокращать, мелкое не раздувать):
  · совсем мелкое или шуточное дело (чихнуть, зевнуть, выпить воды, поплакать): 3–5 шагов, без натяжек;
  · обычное бытовое дело на один заход (помыть посуду, позвонить, сходить в магазин, полить цветы): 3–6 шагов; если больше 6, объедини соседние мелкие в один («Взять губку и намочить посуду»), а не выкидывай важное;
  · большое дело из нескольких этапов или на несколько дней (курсовая, диплом, ремонт, переезд, отпуск, поиск работы, подготовка к экзамену): оставь настоящие этапы, до 8 шагов, не сжимай их искусственно; объединяй только мелочи внутри одного этапа.
- Первый шаг простой и конкретный. Главное действие дела есть отдельным шагом. Последний шаг завершает дело (отправлено, убрано, вернулся домой).
- Каждый шаг начинается с глагола в неопределённой форме («Открыть», не «Откройте»), без «вы», без точки в конце, до 10 слов, грамотно.
- Не добавляй ничего, чего нет в деле и разбивке, кроме исправления явной ошибки или пустого шага, который нужно заменить конкретным действием из этого дела.
- Если разбивка уже хорошая, верни её почти как есть.
Ответь ТОЛЬКО JSON-массивом строк.`
async function one(task: string, steps: string[]) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await generateText({ model: am.chatModel('ag/claude-sonnet-4-6'), system: RULES, prompt: `Дело: ${task}\nРазбивка гоблина:\n${steps.map((s, j) => `${j + 1}. ${s}`).join('\n')}`, maxOutputTokens: 600, temperature: 0 })
      const arr = JSON.parse(r.text.match(/\[[\s\S]*\]/)![0]) as string[]
      if (arr.length >= 3 && arr.length <= 8 && arr.every((s) => typeof s === 'string' && s.trim())) { out[task] = arr.map((s) => s.trim().replace(/\.$/, '')); break }
    } catch (e) { console.log('retry', task, String(e).slice(0, 60)) }
  }
  writeFileSync(`${D}/condensed.json`, JSON.stringify(out, null, 1))
  console.log(task, '→', out[task]?.length ?? 'FAIL')
}
const queue = Object.entries(raw).filter(([t]) => !out[t])
await Promise.all(Array.from({ length: Number(process.env.CONC ?? 4) }, async () => {
  for (let q = queue.shift(); q; q = queue.shift()) await one(q[0], q[1])
}))
console.log('DONE', Object.keys(out).length, '/', Object.keys(raw).length)
