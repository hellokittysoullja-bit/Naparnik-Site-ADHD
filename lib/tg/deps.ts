import type { ModelMessage, TextStreamPart, ToolSet } from 'ai'
import { breakdown } from '@/lib/ai/agents/breakdown'
import { chatTurn } from '@/lib/ai/agents/chat'
import { collectReply, pseudonym } from '@/lib/ai/channels/telegram'
import { newTurn } from '@/lib/ai/core/turn'
import { EMPTY_SNAPSHOT, type MemoryProvider } from '@/lib/ai/memory/provider'
import { savePlanInput } from '@/lib/ai/tools/catalog'
import { coerceToolInput } from '@/lib/ai/tools/registry'
import { recentHistory, type CatReply, type Converse, type Deps } from './bot'
import { getStore, type TgUser } from './store'
import { sign, tg } from './telegram'

/**
 * Что кот знает о человеке в боте: только текущий план и шаг (их человек сам назвал боту или прислал с сайта).
 * Памяти о человеке (фактов, навыков) у бота нет: на сайте она живёт на устройстве (решение владельца 12.11), а
 * серверной памяти бот не заводит, пока владелец не решит иначе. Поэтому инструменты memory и recall боту не даются.
 */
function botMemory(u: TgUser): MemoryProvider {
  return {
    name: 'telegram-plan',
    prefetch: async () => ({
      ...EMPTY_SNAPSHOT,
      plan: u.plan ? { forDate: '', task: u.plan.task, firstStep: u.plan.firstStep, startTime: u.plan.startTime } : null,
    }),
  }
}

const BOT_WITHOUT_TOOLS = ['memory', 'recall'] as const

/** Разговор с котом через обвязку: тот же агент чата, что на сайте; план из вызова savePlan возвращается боту */
export const converse: Converse = async (u, text) => {
  const now = Date.now()
  const history: ModelMessage[] = recentHistory(u, now).map((h) => ({ role: h.who === 'user' ? 'user' : 'assistant', content: h.text }))
  let plan: CatReply['plan']
  const stream = await chatTurn({
    // в журнал — псевдоним чата, а не его номер (security-ai.md R13)
    ctx: newTurn({ task: 'chat', channel: 'telegram', sessionId: pseudonym(u.id) }),
    memory: botMemory(u),
    mode: 'companion',
    // местный час человека: у бота есть его часовой пояс
    clientHour: new Date(now + u.tz * 60_000).getUTCHours(),
    conversation: [...history, { role: 'user', content: text }],
    userTexts: [...history.filter((m) => m.role === 'user').map((m) => String(m.content)), text],
    withoutTools: BOT_WITHOUT_TOOLS,
    reminders: 'on',
  })
  // план забираем из потока по пути: collectReply знает только текст и кнопку старта
  const tap = new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
    transform(part, controller) {
      if (part.type === 'tool-call' && part.toolName === 'savePlan' && !('invalid' in part && part.invalid)) {
        const parsed = savePlanInput.safeParse(coerceToolInput(part.input))
        if (parsed.success) plan = parsed.data
      }
      controller.enqueue(part)
    },
  })
  const reply = await collectReply(stream.pipeThrough(tap))
  if (reply.unavailable) return null
  return { text: reply.text, startFocus: reply.startFocus, plan }
}

/** Настоящие зависимости бота: Upstash (или память процесса), Telegram API, кот и дробление через обвязку */
export function liveDeps(site: string): Deps {
  return {
    store: getStore().store,
    send: (method, body) => tg(method, body),
    now: () => Date.now(),
    site,
    // то же дробление, что на сайте, через обвязку (lib/ai): проверки входа и вывода, страховка моделей, заготовка
    breakdown: async (task) => {
      const r = await breakdown({ task, ctx: newTurn({ task: 'breakdown', channel: 'telegram' }) })
      return r.kind === 'steps' ? { steps: r.steps, fallback: r.source !== 'model' } : { steps: [], fallback: true, care: r.reply }
    },
    converse,
    sign,
  }
}

/**
 * Постоянный адрес сайта из окружения, не из запроса: NEXT_PUBLIC_SITE_URL, иначе прод-домен проекта, который Vercel
 * сам кладёт в VERCEL_PROJECT_PRODUCTION_URL. null — вне Vercel и без переменной (локальный запуск).
 */
export function fixedSite(): string | null {
  const own = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (own) return own
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return prod ? `https://${prod}` : null
}

/** Адрес сайта для ссылок в сообщениях бота: постоянный, а локально — адрес самого запроса */
export function siteOf(req: Request) {
  return fixedSite() ?? new URL(req.url).origin
}
