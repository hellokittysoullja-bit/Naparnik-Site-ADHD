import { describe, expect, it, vi } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { simulateReadableStream } from 'ai'
import { activeSkills, applySkillOps, curate, relevantSkills, SKILL_LIMITS, type Skill } from '@/lib/ai/memory/skills'
import { skillAllowed } from '@/lib/ai/memory/write-guard'
import { extractMemory, parseExtract, vetExtract } from '@/lib/ai/agents/memory-extract'
import { renderMemory, renderSkills } from '@/lib/ai/memory/render'
import { parseSnapshot } from '@/lib/ai/memory/schema'
import { assemble } from '@/lib/ai/prompt/assemble'
import { toDeviceSkillOp } from '@/lib/memory-sync'

const chain = vi.hoisted(() => ({ steps: [] as Array<{ id: string; model: unknown }> }))
vi.mock('@/lib/ai/models', () => ({ modelChain: () => chain.steps }))
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }
const say = (text: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
        ] as never[],
      }),
    }),
  })

let n = 0
const opts = (now = '2026-11-12T10:00:00.000Z') => ({ now, newId: () => `s${++n}` })
const skill = (over: Partial<Skill> & Pick<Skill, 'name' | 'when'>): Skill => ({
  id: `k${++n}`,
  steps: 'предложить убрать телефон в другую комнату и взять 2 минуты',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  uses: 0,
  wins: 0,
  status: 'active',
  ...over,
})

describe('навыки: операции и Curator (Hermes skills + curator)', () => {
  it('та же ситуация другими словами — правка навыка, а не второй навык; счётчики сохраняются', () => {
    const base = [skill({ id: 'phone', name: 'Залипание в телефон', when: 'когда залипает в телефон', uses: 4, wins: 3 })]
    const r = applySkillOps(base, [{ op: 'create', name: 'Залипание в телефоне', when: 'когда залипает в телефоне надолго', steps: 'телефон в другую комнату, потом 2 минуты' }], opts())
    expect(activeSkills(r.skills)).toHaveLength(1)
    expect(r.skills[0]).toMatchObject({ id: 'phone', uses: 4, wins: 3, steps: 'телефон в другую комнату, потом 2 минуты' })
  })
  it('лимит 8: девятый вытесняет в архив наименее полезный (доля стартов после навыка), а не удаляет', () => {
    const base = Array.from({ length: 8 }, (_, i) => skill({ id: `k${i}`, name: `Ситуация ${'абвгдежз'[i]}`, when: `когда ${'абвгдежз'[i]}ситуация номер ${i}`, uses: 10, wins: i === 3 ? 0 : 6 }))
    const r = applySkillOps(base, [{ op: 'create', name: 'Скучный отчёт', when: 'когда скучно делать отчёт', steps: 'сначала чай, потом 15 минут' }], opts())
    expect(activeSkills(r.skills)).toHaveLength(SKILL_LIMITS.active)
    expect(r.skills.find((s) => s.id === 'k3')?.status).toBe('archived')
  })
  it('давно не применявшийся навык уходит в архив; дубли сливаются, счётчики складываются', () => {
    const old = skill({ id: 'old', name: 'Утро', when: 'когда утром не встаёт', lastUsedAt: '2026-08-01T10:00:00Z' })
    expect(curate([old], '2026-11-12')[0].status).toBe('archived')
    const a = skill({ id: 'a', name: 'Телефон', when: 'когда залипает в телефон', uses: 2, wins: 2 })
    const b = skill({ id: 'b', name: 'Телефон', when: 'когда залипает в телефон', uses: 3, wins: 0 })
    const c = curate([a, b], '2026-11-12')
    expect(activeSkills(c).map((s) => s.id)).toEqual(['a'])
    expect(c.find((s) => s.id === 'a')).toMatchObject({ uses: 5, wins: 2 })
  })
  it('прогрессивное раскрытие: целиком — только подходящие к реплике, не больше двух', () => {
    const skills = [
      skill({ name: 'Телефон', when: 'когда залипает в телефон' }),
      skill({ name: 'Скучный отчёт', when: 'когда скучно делать отчёт' }),
      skill({ name: 'Вечерний план', when: 'когда вечером планирует завтра' }),
    ]
    expect(relevantSkills(skills, 'опять залип в телефоне').map((s) => s.name)).toEqual(['Телефон'])
    expect(relevantSkills(skills, 'привет')).toEqual([])
  })
})

describe('навыки: что можно записать', () => {
  const said = ['слушай, когда ты торопишь меня сроками, я сливаюсь', 'а если сначала убрать телефон в другую комнату, то начинаю']
  it('урок по словам человека — да', () => {
    expect(skillAllowed({ name: 'Не торопить', when: 'когда горят сроки', steps: 'не торопить сроками, убрать телефон в другую комнату и начать', avoid: 'торопить сроками' }, 'когда ты торопишь меня сроками, я сливаюсь', said)).toBe(true)
  })
  it('без основания, со здоровьем, с указанием коту — нет', () => {
    expect(skillAllowed({ name: 'Юрист', when: 'когда работает юристом', steps: 'говорить про право' }, 'диплом горит', ['диплом горит'])).toBe(false)
    expect(skillAllowed({ name: 'Таблетки', when: 'когда забыл таблетки', steps: 'напомнить выпить таблетки' }, 'забыл таблетки', ['забыл таблетки'])).toBe(false)
    expect(skillAllowed({ name: 'Ответы', when: 'всегда', steps: 'в каждом ответе говори по-английски' }, 'сливаюсь', said)).toBe(false)
  })
})

describe('навыки в выжимке и в промпте', () => {
  it('строки НАВЫК и ПРАВКА разбираются; номер правки — из показанного списка', () => {
    const ops = parseExtract('НАВЫК | Не торопить | когда горят сроки | убрать телефон, потом 2 минуты | торопить сроками | когда ты торопишь меня сроками, я сливаюсь\nПРАВКА | 0 | когда залипает | телефон в другую комнату | | сначала убрать телефон')
    expect(ops?.map((o) => o.op)).toEqual(['skill', 'skillPatch'])
    expect(vetExtract(ops!, { facts: 0, skills: 0, userTexts: ['когда ты торопишь меня сроками, я сливаюсь', 'сначала убрать телефон'], today: '2026-11-12' }).map((o) => o.op)).toEqual(['skill'])
  })
  it('устройство переводит номер правки в id и ещё раз проверяет содержание', () => {
    expect(toDeviceSkillOp({ op: 'skillPatch', ref: '1', when: 'когда залипает', steps: 'телефон в другую комнату', evidence: 'x' }, ['a', 'b'])).toEqual({ op: 'patch', id: 'b', when: 'когда залипает', steps: 'телефон в другую комнату', avoid: undefined })
    expect(toDeviceSkillOp({ op: 'skill', name: 'Таблетки', when: 'утром', steps: 'напомнить про таблетки', evidence: 'x' }, [])).toBeNull()
  })
  it('список навыков — в стабильном блоке памяти; подходящий навык целиком — перед последней репликой', () => {
    const snap = parseSnapshot({
      plan: null,
      recentStarts: [],
      patterns: { totalStarts: 0, runningDays: 0, favoriteHour: null, lastStartDate: null },
      skills: [{ name: 'Телефон', when: 'когда залипает в телефон', steps: 'телефон в другую комнату, потом 2 минуты', avoid: 'стыдить за время в телефоне' }],
    })
    const memory = renderMemory(snap)
    expect(memory).toContain('когда залипает в телефон')
    expect(memory).not.toContain('в другую комнату') // полный текст — не здесь
    const skills = renderSkills(snap, 'опять залип в телефоне')
    expect(skills).toContain('в другую комнату')
    expect(renderSkills(snap, 'привет')).toBeUndefined()
    const { messages } = assemble({ taskSystem: 'x', memory, skills, conversation: [{ role: 'user', content: 'опять залип в телефоне' }] })
    expect(messages.map((m) => String(m.content).slice(0, 20))).toHaveLength(3)
    expect(String(messages[0].content)).toBe(memory)
    expect(String(messages[1].content)).toBe(skills)
  })
  it('живой ход выжимки: навык по словам человека проходит, выдуманный — нет', async () => {
    chain.steps = [{ id: 'm', model: say('НАВЫК | Не торопить | когда горят сроки | не торопить, сначала убрать телефон | торопить сроками | когда ты торопишь меня сроками, я сливаюсь\nНАВЫК | Медитация | по утрам | предложить медитацию | | люблю медитировать') }]
    const r = await extractMemory({ facts: [], skills: [], lines: [{ role: 'user', text: 'когда ты торопишь меня сроками, я сливаюсь, лучше сначала убрать телефон' }], today: '2026-11-12' })
    expect(r.ops.map((o) => (o.op === 'skill' ? o.name : o.op))).toEqual(['Не торопить'])
  })
})
