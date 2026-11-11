import { z } from 'zod'
import { dataMessage } from '@/lib/ai/context'
import { runTurn } from '@/lib/ai/harness'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

export const maxDuration = 15

/**
 * «Раздроби мне задачу»: task initiation — главный bottleneck СДВГ.
 * Большая задача пугает; 3 микрошага по 1-5 минут — нет.
 * Возвращает массив из 3 шагов, каждый начинается с глагола.
 */
// дело длиннее 300 символов обрезаем, а не отклоняем: человек не должен получить отказ за подробность
const Body = z.object({
  task: z.string().trim().min(3).transform((s) => s.slice(0, 300)),
})

const SYSTEM = `Режим: ДРОБЛЕНИЕ ЗАДАЧИ. Человек назвал дело (оно в блоке данных), которое его пугает своим размером. Разбей его на РОВНО 3 крошечных первых шага. Правила:
- Каждый шаг выполняется за 1-5 минут, не больше
- Каждый начинается с глагола («Открыть…», «Найти…», «Написать…»)
- Первый шаг — самый крошечный, почти смешной («Открыть документ»)
- Максимум 6 слов на шаг
- Никаких пояснений: ответь ТОЛЬКО тремя строками, по шагу на строку`

const FALLBACK = ['Открыть то, что нужно для дела', 'Сделать одно крошечное действие', 'Записать, что дальше']

/** Три строки, в каждой 1–8 слов; нумерацию и маркеры срезаем. Иначе — ответ не годится (следующая модель). */
export function parseSteps(text: string): string[] | null {
  const steps = text
    .split('\n')
    .map((s) => s.replace(/^[\s\d\-–—.)•*]+/, '').trim())
    .filter(Boolean)
  if (steps.length < 3) return null
  const three = steps.slice(0, 3)
  return three.every((s) => {
    const words = s.split(/\s+/).length
    return words >= 1 && words <= 8
  })
    ? three
    : null
}

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'breakdown', 10)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ steps: null }, { status: 400 })
  const { task } = parsed.data
  const { value } = await runTurn<{ steps: string[] } | { reply: string }>({
    task: 'breakdown',
    system: SYSTEM,
    data: dataMessage({ 'Дело': task }),
    prompt: 'Три шага для этого дела.',
    userTexts: [task],
    timeoutMs: 8000,
    hedgeAfterMs: 2000,
    maxOutputTokens: 160,
    maxChars: 300,
    parse: (text) => {
      const steps = parseSteps(text)
      return steps ? { steps } : null
    },
    fallback: () => ({ steps: FALLBACK }),
    // кризисный текст вместо дела — не шаги, а бережный проверенный ответ (lib/ai/crisis.ts)
    onCrisis: (reply) => ({ reply }),
    signal: req.signal,
  })
  return Response.json('reply' in value ? { steps: null, reply: value.reply } : { steps: value.steps })
})
