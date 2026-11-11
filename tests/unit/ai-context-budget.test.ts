import { describe, expect, it } from 'vitest'
import type { ModelMessage } from 'ai'
import { estimateTokens, fitConversation } from '@/lib/ai/prompt/context-budget'

const user = (t: string): ModelMessage => ({ role: 'user', content: t })
const cat = (t: string): ModelMessage => ({ role: 'assistant', content: t })
const call = (id: string): ModelMessage => ({ role: 'assistant', content: [{ type: 'tool-call', toolCallId: id, toolName: 'rememberFact', input: { fact: 'x' } }] })
const result = (id: string, text = 'Запомнил. '.repeat(30)): ModelMessage => ({
  role: 'tool',
  content: [{ type: 'tool-result', toolCallId: id, toolName: 'rememberFact', output: { type: 'text', value: text } }],
})
const long = (n: number) => 'слово '.repeat(n)

describe('бюджет контекста (Hermes context_compressor: подрезка → окно по токенам)', () => {
  it('влезает — не трогает', () => {
    const ms = [user('привет'), cat('привет!')]
    expect(fitConversation(ms, 1000)).toBe(ms)
  })
  it('сначала ужимает старые результаты инструментов, свежие оставляет', () => {
    const ms = [user('a'), call('1'), result('1'), user('b'), call('2'), result('2'), user('c')]
    const out = fitConversation(ms, ms.reduce((n, m) => n + estimateTokens(m), 0) - 50, 1)
    expect(out).toHaveLength(ms.length)
    expect(JSON.stringify(out[2])).toContain('выполнено')
    expect(JSON.stringify(out[5])).toContain('Запомнил')
  })
  it('отрезает начало по репликам человека: хвост целиком, пары вызов/результат не рвутся', () => {
    const tail = [user('дело'), call('9'), result('9', 'Запомнил.'), cat('ок'), user('что дальше?')]
    const ms = [user(long(300)), cat(long(300)), ...tail]
    const budget = tail.reduce((n, m) => n + estimateTokens(m), 0) + 5 // ровно хвост влезает, начало — нет
    const out = fitConversation(ms, budget)
    expect(out).toEqual(tail)
    const roles = out.map((m) => m.role)
    expect(roles[roles.indexOf('tool') - 1]).toBe('assistant') // результат стоит сразу за своим вызовом
  })
  it('даже огромная последняя реплика человека остаётся', () => {
    const ms = [user('старое'), cat('ответ'), user(long(5000))]
    expect(fitConversation(ms, 100)).toEqual([ms[2]])
  })
})
