import { describe, expect, it } from 'vitest'
import { converse } from '@/lib/tg/deps'
import type { TgUser } from '@/lib/tg/store'

/**
 * Живая проверка разговора с котом в боте (платно, нужен ANYMODEL_API_KEY; в CI не входит):
 *   ANYMODEL_API_KEY=… pnpm vitest run --config vitest.eval.config.ts evals/tg-live.eval.ts
 * Смотрим то, чего нет в юнит-тестах: настоящая модель с набором инструментов бота (без памяти и вспоминания).
 */
const user = (over: Partial<TgUser> = {}): TgUser => ({ id: 7, createdAt: 0, tz: 180, ignored: 0, lastActive: 0, variant: 0, ...over })
const DASH = /[—–]|\s-\s/

describe('кот в боте', () => {
  it('на «не могу начать» отвечает по делу, без тире и без звёздочек', async () => {
    const r = await converse(user(), 'привет, не могу сесть за курсовую уже неделю')
    console.log('1:', JSON.stringify(r))
    expect(r, 'модели не ответили').not.toBeNull()
    expect(r!.text.length + (r!.startFocus ? 1 : 0)).toBeGreaterThan(0)
    expect(r!.text).not.toMatch(DASH)
    expect(r!.text).not.toContain('*')
  }, 40_000)
  it('согласованный план сохраняет инструментом, а не словами', async () => {
    const history = [
      { who: 'user' as const, text: 'хочу завтра сесть за курсовую', at: Date.now() - 60_000 },
      { who: 'cat' as const, text: 'Давай. Какой первый шаг и во сколько начнём?', at: Date.now() - 50_000 },
    ]
    const r = await converse(user({ history }), 'открыть файл с черновиком, в 10:00. так и запиши')
    console.log('2:', JSON.stringify(r))
    expect(r, 'модели не ответили').not.toBeNull()
    expect(r!.plan?.firstStep, 'план не сохранён инструментом').toBeTruthy()
  }, 40_000)
  it('«запомни, что…» не вызывает память, которой у бота нет, и не обещает запомнить', async () => {
    const r = await converse(user(), 'запомни, что я учусь на логиста')
    console.log('3:', JSON.stringify(r))
    expect(r, 'модели не ответили').not.toBeNull()
    expect(r!.text).not.toMatch(/запомнил|запомню|записал(?!\p{L})/iu)
  }, 40_000)
})
