import { dataMessage } from '../context'
import { newTurn, type TurnContext } from '../core/turn'
import { runTurn } from '../core/run-turn'
import { NoMemory, prefetchWithin, type MemoryProvider } from '../memory/provider'
import { memoryWords, renderTaskMemory } from '../memory/render'
import { sessionVoicePresets } from '@/lib/scripted-companion'

/**
 * Голос кота во время фокус-сессии: одна короткая фраза на момент сессии. Каждому моменту — своя системная
 * инструкция (5 стабильных вариантов → кэш провайдера); в роли user — только данные (дело, длина).
 */
export const MOMENTS = ['start', 'middle', 'late', 'done', 'early-exit'] as const
export type Moment = (typeof MOMENTS)[number]

const BASE =
  'Режим: ФОКУС-СЕССИЯ. Человек работает над делом из блока данных, ты сидишь рядом. Отвечай ТОЛЬКО самой фразой, без кавычек и пояснений. ' +
  // правило персоны «награждай старт, а не минуты» модели в этой задаче нарушали (аудит 12.11: «целых 25 минут, молодец»)
  'Минуты, время и длительность не называй и не хвали: радуйся тому, что человек начал и был в деле. ' +
  'Если перед делом есть блок ПАМЯТЬ О ЧЕЛОВЕКЕ, возьми из него тон, род и то, что человеку помогает; сами факты вслух не называй, если они не про это дело.'

const MOMENT: Record<Moment, string> = {
  start: 'Человек только что нажал «старт». Скажи одну короткую фразу (максимум 12 слов), что ты рядом и он уже в игре.',
  middle: 'Половина сессии позади. Одна короткая фраза поддержки (максимум 12 слов), без пафоса.',
  late: 'Осталось совсем немного. Одна короткая фраза (максимум 12 слов): финишная прямая.',
  done: 'Сессия закончена, человек отработал её целиком. Одна-две короткие фразы радости за конкретное дело, без пафоса. Упомяни, что твой остров стал чуть больше.',
  'early-exit':
    'Человек вышел из сессии раньше таймера. Это НЕ провал: он начал, а старт и есть главное. Одна-две короткие тёплые фразы без малейшего упрёка и без слов «всё равно», «хотя бы», «зато»: они звучат как утешение за неудачу. Можно упомянуть, что остров вырос.',
}

export const sessionVoiceSystem = (m: Moment) => `${BASE}\nСейчас: ${MOMENT[m]}`

export async function sessionVoice(input: {
  ctx?: TurnContext
  moment: Moment
  task: string
  /** память о человеке: тон, род, что помогает (memory/render.ts renderTaskMemory) */
  memory?: MemoryProvider
  signal?: AbortSignal
}): Promise<string | null> {
  const preset = () => {
    const presets = sessionVoicePresets[input.moment]
    return presets ? presets[input.task.length % presets.length] : null
  }
  const ctx = input.ctx ?? newTurn({ task: 'session-voice' })
  const snapshot = await prefetchWithin(input.memory ?? NoMemory, ctx)
  const { value } = await runTurn<string | null>({
    ctx,
    system: sessionVoiceSystem(input.moment),
    memory: renderTaskMemory(snapshot, input.task, 'session-voice'),
    echoExtra: memoryWords(snapshot),
    // длина сессии модели не нужна: она только провоцировала похвалу за минуты
    data: dataMessage({ Дело: input.task }),
    userTexts: [input.task],
    timeoutMs: 6000,
    hedgeAfterMs: 1500,
    // запас под скрытое рассуждение Gemini (набор задач 12.11: 79 из 120 токенов ушли на него, ответ обрезан)
    maxOutputTokens: 1000,
    maxChars: 220,
    parse: (text) => text,
    fallback: preset,
    onCrisis: (reply) => reply,
    signal: input.signal,
  })
  return value
}
