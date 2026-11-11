import { z } from 'zod'
import { dataMessage } from '@/lib/ai/context'
import { runTurn } from '@/lib/ai/harness'
import { sessionVoicePresets } from '@/lib/scripted-companion'
import { handle, rateLimit, readJsonBody, sameOrigin } from '@/lib/api-guard'

export const maxDuration = 15

type Moment = 'start' | 'middle' | 'late' | 'done' | 'early-exit'

const momentPrompts: Record<Moment, string> = {
  start:
    'Человек только что нажал «старт». Скажи одну короткую фразу (максимум 12 слов), что ты рядом и он уже в игре.',
  middle:
    'Половина сессии позади. Одна короткая фраза поддержки (максимум 12 слов), без пафоса.',
  late: 'Осталось совсем немного. Одна короткая фраза (максимум 12 слов) — финишная прямая.',
  done:
    'Сессия закончена, человек отработал её целиком. Одна-две короткие фразы радости за конкретное дело, без пафоса. Упомяни, что твой остров стал чуть больше.',
  'early-exit':
    'Человек вышел из сессии раньше таймера. Это НЕ провал: он начал, а старт — главное. Одна-две короткие тёплые фразы без малейшего упрёка. Можно упомянуть, что остров всё равно вырос.',
}

// enum, а не поиск по объекту: momentPrompts['__proto__'] был «найден» и уходил в модель
const Body = z.object({
  moment: z.enum(['start', 'middle', 'late', 'done', 'early-exit']),
  task: z.string().trim().min(1).transform((s) => s.slice(0, 300)),
  minutes: z.number().int().min(1).max(240).optional(),
  audience: z.enum(['adult', 'minor']).optional(),
})

const SYSTEM =
  'Режим: ФОКУС-СЕССИЯ. Человек работает над делом из блока данных, ты сидишь рядом. Отвечай ТОЛЬКО самой фразой, без кавычек и пояснений.'

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'session-voice', 30)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ text: null }, { status: 400 })
  const { moment, task, minutes, audience } = parsed.data
  const preset = () => {
    const presets = sessionVoicePresets[moment]
    return presets ? presets[task.length % presets.length] : null
  }
  // Дело человека — в блоке данных, не в инструкции (находка 4 аудита безопасности). Обвязка: кризис в тексте дела →
  // проверенный ответ; модель не уложилась в 4 с или ответила не тем тоном → следующая модель → заготовка.
  const { value } = await runTurn<string | null>({
    task: 'session-voice',
    system: SYSTEM,
    data: dataMessage({ 'Дело': task, 'Длина сессии, минут': minutes }),
    prompt: momentPrompts[moment],
    userTexts: [task],
    audience,
    timeoutMs: 4000,
    maxOutputTokens: 120,
    maxChars: 220,
    parse: (text) => text,
    fallback: preset,
    onCrisis: (reply) => reply,
    signal: req.signal,
  })
  return Response.json({ text: value })
})
