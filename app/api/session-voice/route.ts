import { generateText } from 'ai'
import { z } from 'zod'
import { google } from '@ai-sdk/google'
import { personaBase } from '@/lib/companion'
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
})

export const POST = handle(async (req) => {
  sameOrigin(req)
  rateLimit(req, 'session-voice', 30)
  const parsed = Body.safeParse(await readJsonBody(req, 4 * 1024))
  if (!parsed.success) return Response.json({ text: null }, { status: 400 })
  const { moment, task, minutes } = parsed.data
  const prompt = momentPrompts[moment]
  try {
    const { text } = await generateText({
      model: process.env.GOOGLE_GENERATIVE_AI_API_KEY
        ? google('gemini-2.5-flash-lite')
        : 'openai/gpt-5.4-nano',
      instructions: `${personaBase}

Режим: ФОКУС-СЕССИЯ. Человек работает над: «${task}»${
        minutes ? ` (сессия ${minutes} минут)` : ''
      }. Отвечай ТОЛЬКО самой фразой, без кавычек и пояснений.`,
      prompt,
      maxOutputTokens: 1024, // одна-две короткие фразы; запас под токены рассуждения моделей шлюза
      maxRetries: 1,
      abortSignal: req.signal,
    })
    return Response.json({ text: text.trim() })
  } catch {
    // LLM недоступен — скриптовый пресет вместо молчания
    const presets = sessionVoicePresets[moment]
    const fallback = presets ? presets[task.length % presets.length] : null
    return Response.json({ text: fallback })
  }
})
