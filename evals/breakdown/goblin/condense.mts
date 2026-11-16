import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { GOBLIN_PLANS } from '@/lib/ai/agents/breakdown-goblin'
const D = process.env.GOBLIN_DIR ?? 'evals/breakdown/goblin'
const am = createOpenAICompatible({ name: 'c', baseURL: 'https://anymodel.org/v1', apiKey: process.env.ANYMODEL_API_KEY! })
const raw: Record<string, string[]> = { ...Object.fromEntries(Object.entries(GOBLIN_PLANS).map(([k, v]) => [k, [...v]])), ...JSON.parse(readFileSync(`${D}/raw.json`, 'utf8')) }
const out: Record<string, string[]> = existsSync(`${D}/condensed.json`) ? JSON.parse(readFileSync(`${D}/condensed.json`, 'utf8')) : {}
const RULES = `Ты редактор списка шагов для людей с СДВГ. Дано дело и разбивка сервиса goblin.tools. Сделай из неё план не больше 6 шагов.
Правила:
- Сохраняй слова и порядок гоблина, где можно. Меняй только то, что нужно по правилам ниже.
- Выкинь пустые шаги, которые ничего не делают: «Определить цель», «Настроиться психологически», «Поддерживать позитивный настрой», «Выбрать подходящее время», «Отслеживать реакцию», «Быть готовым», «Проверить результат и внести коррективы», общие советы и режимы («придерживаться ежедневно»).
- Если шагов всё равно больше 6, объедини соседние мелкие в один («Взять губку и намочить посуду»), а не выкидывай важное.
- Первый шаг простой и конкретный. Главное действие дела есть отдельным шагом. Последний шаг завершает дело (отправлено, убрано, вернулся домой).
- Каждый шаг начинается с глагола в неопределённой форме («Открыть», не «Откройте»), без «вы», без точки в конце, до 10 слов, грамотно.
- Не добавляй ничего, чего нет в деле и разбивке, кроме исправления явной ошибки или пустого шага, который нужно заменить конкретным действием из этого дела.
- Если разбивка уже 3-6 хороших шагов, верни её почти как есть.
Ответь ТОЛЬКО JSON-массивом строк.`
for (const [task, steps] of Object.entries(raw)) {
  if (out[task]) continue
  for (let i = 0; i < 2; i++) {
    try {
      const r = await generateText({ model: am.chatModel('ag/claude-sonnet-4-6'), system: RULES, prompt: `Дело: ${task}\nРазбивка гоблина:\n${steps.map((s, j) => `${j + 1}. ${s}`).join('\n')}`, maxOutputTokens: 600, temperature: 0 })
      const arr = JSON.parse(r.text.match(/\[[\s\S]*\]/)![0]) as string[]
      if (arr.length >= 2 && arr.length <= 6 && arr.every((s) => typeof s === 'string' && s.trim())) { out[task] = arr.map((s) => s.trim().replace(/\.$/, '')); break }
    } catch (e) { console.log('retry', task, String(e).slice(0, 60)) }
  }
  writeFileSync(`${D}/condensed.json`, JSON.stringify(out, null, 1))
  console.log(task, '→', out[task]?.length ?? 'FAIL')
}
console.log('DONE', Object.keys(out).length, '/', Object.keys(raw).length)
