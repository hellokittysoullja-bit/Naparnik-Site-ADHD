import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from 'ai'
import { installStorage } from './storage-stub'
import * as memory from '@/lib/memory'
import { archiveMessages, forgetInArchive, searchArchive } from '@/lib/chat-archive'
import { enforceExplicitMemory, explicitForgetOps, hiddenFromModel, pendingChunk } from '@/lib/memory-sync'
import { isForgotten } from '@/lib/forgotten'
import { applyFactOps, forgetMatches, forgetsLast, type Fact } from '@/lib/ai/memory/facts'
import { toFactOp } from '@/lib/ai/memory/policy'
import { sameStem } from '@/lib/ai/memory/stems'
import { factGrounded, groundedIn } from '@/lib/ai/memory/write-guard'

/** Аудит 12.11, группа Б (research/21-agent-audit/2-memory.md): забывание и честность памяти */
const store = installStorage()
beforeEach(() => {
  store.data.clear()
  store.state.blocked = false
})

const msg = (id: string, role: 'user' | 'assistant', text: string): UIMessage => ({ id, role, parts: [{ type: 'text', text }] }) as UIMessage
const OLD = '2026-11-12T10:00:00.000Z'
const add = (text: string, category: Fact['category'] = 'about') => memory.applyMemoryOps([{ op: 'add', category, text, source: 'stated' }])

describe('сравнение по основе', () => {
  it.each([
    ['машу', 'маша'],
    ['олю', 'оля'],
    ['маму', 'мама'],
    ['душ', 'душа'],
    ['чай', 'чая'],
    ['пишу', 'пишет'],
    ['переезд', 'переезжаю'],
    ['диплом', 'диплома'],
  ])('%s ~ %s', (a, b) => expect(sameStem(a, b)).toBe(true))
  it.each([
    ['кот', 'код'],
    ['переезд', 'перерыв'],
    ['чай', 'часы'],
    ['мама', 'машина'],
  ])('%s ≠ %s', (a, b) => expect(sameStem(a, b)).toBe(false))
})

describe('«забудь про Машу», «забудь это»', () => {
  it('имя в падеже находит факт', () => {
    expect(forgetMatches('Маша — научный руководитель', 'забудь про Машу')).toBe(true)
    expect(forgetMatches('Оля помогает с отчётом', 'забудь про Олю')).toBe(true)
    expect(forgetMatches('Начинать помогает чай', 'забудь про переезд')).toBe(false)
  })
  it('«забудь это» — о только что записанном факте, и только о нём', () => {
    expect(forgetsLast('забудь это')).toBe(true)
    expect(forgetsLast('не запоминай это')).toBe(true)
    expect(forgetsLast('забудь про диплом')).toBe(false)
    const ctx = { refs: ['a', 'b'], lastUserText: 'забудь это', textOf: () => 'Пишет диплом', latestId: 'b' }
    expect(toFactOp({ op: 'forget', ref: '1' }, ctx)).toMatchObject({ ok: true })
    expect(toFactOp({ op: 'forget', ref: '0' }, ctx)).toMatchObject({ ok: false })
  })
  it('правило без модели: «забудь это» стирает то, что кот записал в прошлом ответе', async () => {
    await add('Пишет диплом про котиков')
    await add('Любит чай')
    const facts = memory.peekFacts()
    expect(explicitForgetOps('забудь это', facts, ['Пишет диплом про котиков'])).toEqual([{ op: 'forget', id: facts.find((f) => f.text.startsWith('Пишет'))!.id }])
  })
  it('«забудь всё» исполняется и без фактов: навыки, план, знакомство', async () => {
    await memory.savePlan({ task: 'отчёт', firstStep: 'открыть файл' })
    expect(explicitForgetOps('забудь всё', [])).toEqual([{ op: 'forgetAll' }])
    await memory.applyMemoryOps([{ op: 'forgetAll' }])
    expect(memory.peekPlan()).toBeNull()
    expect(isForgotten('что угодно', OLD)).toBe(true)
  })
})

describe('забытое не видит кот', () => {
  it('реплики о забытой теме старше просьбы не уходят модели; сказанное после — уходит', async () => {
    await add('Переезжает в Казань в декабре')
    const f = memory.peekFacts()[0]
    await memory.applyMemoryOps([{ op: 'forget', id: f.id }])
    const messages = [msg('u1', 'user', 'я переезжаю в Казань в декабре'), msg('a1', 'assistant', 'Ого, переезд в Казань!'), msg('u2', 'user', 'забудь про переезд'), msg('a2', 'assistant', 'Хорошо.'), msg('u3', 'user', 'я всё-таки переезжаю в Казань, помоги собраться')]
    const times = { u1: OLD, a1: OLD, u2: OLD, a2: OLD }
    expect([...hiddenFromModel(messages, times)].sort()).toEqual(['a1', 'u1', 'u2'])
  })
  it('фоновое ревью не видит ничего до просьбы «забудь» и скрытые реплики', () => {
    const messages = [msg('u1', 'user', 'я переезжаю в Казань в декабре'), msg('u2', 'user', 'забудь про переезд'), msg('a2', 'assistant', 'Хорошо.'), msg('u3', 'user', 'а ещё я пишу диплом про котиков')]
    const { lines, upTo } = pendingChunk(messages, null)
    expect(lines.map((l) => l.text)).toEqual(['Хорошо.', 'а ещё я пишу диплом про котиков'])
    expect(upTo).toBe('u3')
    // только просьба забыть — отправлять нечего, но курсор уходит за неё
    expect(pendingChunk(messages.slice(0, 2), null)).toEqual({ lines: [], upTo: 'u2' })
  })
  it('длинная реплика режется, а не застревает навсегда', () => {
    const { lines } = pendingChunk([msg('u1', 'user', 'я '.repeat(20_000))], null)
    expect(lines[0].text.length).toBeLessThanOrEqual(1200)
  })
  it('забытое не возвращается в архив из переписки на экране и не находится поиском', async () => {
    const messages = [msg('u1', 'user', 'я переезжаю в Казань в декабре'), msg('u2', 'user', 'помоги начать отчёт по продажам')]
    archiveMessages(messages, { u1: OLD, u2: OLD })
    await add('Переезжает в Казань в декабре')
    await memory.applyMemoryOps([{ op: 'forget', id: memory.peekFacts()[0].id }])
    archiveMessages(messages, { u1: OLD, u2: OLD })
    expect(searchArchive('Казань переезд', new Set())).toEqual([])
    expect(searchArchive('отчёт продажам', new Set()).length).toBe(1)
  })
  it('короткий факт не стирает архив целиком', () => {
    archiveMessages([msg('u1', 'user', 'помоги мне начать отчёт'), msg('u2', 'user', 'пью чай и думаю')], { u1: OLD, u2: OLD })
    forgetInArchive(['Пьёт чай'])
    expect(searchArchive('отчёт начать', new Set()).length).toBe(1)
    forgetInArchive(['Мама помогает'])
    expect(searchArchive('отчёт начать', new Set()).length).toBe(1)
  })
  it('тема без факта («забудь про развод») всё равно уходит из архива и из разговора для модели', async () => {
    const messages = [msg('u1', 'user', 'у меня развод, тяжело'), msg('a1', 'assistant', 'Сочувствую.'), msg('u2', 'user', 'забудь про развод'), msg('a2', 'assistant', 'Ладно.')]
    archiveMessages(messages.slice(0, 2), { u1: OLD, a1: OLD })
    expect(await enforceExplicitMemory(messages)).toBe('forgot')
    expect(searchArchive('развод', new Set())).toEqual([])
    expect(hiddenFromModel(messages, { u1: OLD, a1: OLD, u2: OLD, a2: OLD }).has('u1')).toBe(true)
  })
  it('забытый факт уносит навык и план о том же', async () => {
    await add('Залипает в телефон по вечерам')
    await memory.applySkillMemoryOps([{ op: 'create', name: 'Телефон', when: 'когда залипает в телефон', steps: 'убрать телефон в другую комнату' }])
    await memory.savePlan({ task: 'не залипать в телефон', firstStep: 'положить телефон в коридор' })
    await memory.applyMemoryOps([{ op: 'forget', id: memory.peekFacts()[0].id }])
    expect(memory.peekSkills()).toEqual([])
    expect(memory.peekPlan()).toBeNull()
  })
})

describe('правило без модели смотрит на вид операции', () => {
  it('«забудь X и запомни Y»: кот записал Y — X всё равно забывается', async () => {
    await add('Переезжает в Казань')
    const tool = { type: 'tool-memory', toolCallId: 't', state: 'output-available', input: { op: 'add', text: 'Пишет диплом' }, output: 'ok' }
    const messages = [msg('u1', 'user', 'забудь про переезд и запомни, что я пишу диплом'), { id: 'a1', role: 'assistant', parts: [tool] } as unknown as UIMessage]
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    await enforceExplicitMemory(messages)
    expect(memory.peekFacts().map((f) => f.text)).toEqual([])
    vi.unstubAllGlobals()
  })
})

describe('запись не легла — кот не говорит «запомнил»', () => {
  it('хранилище закрыто: операция памяти и план отвечают отказом', async () => {
    store.state.blocked = true
    const [r] = await memory.applyMemoryOps([{ op: 'add', category: 'about', text: 'Пишет диплом', source: 'stated' }])
    expect(r).toMatchObject({ ok: false, reason: 'storage' })
    await expect(memory.savePlan({ task: 'x', firstStep: 'y' })).rejects.toThrow()
  })
})

describe('основание факта', () => {
  it('отрицание и слова о другом человеке — не основание', () => {
    expect(groundedIn('люблю работать утром', ['я не люблю работать утром'])).toBe(false)
    expect(groundedIn('пишет диплом', ['мой брат пишет диплом'])).toBe(false)
    expect(groundedIn('люблю работать утром', ['я люблю работать утром'])).toBe(true)
    expect(groundedIn('брат пишет диплом', ['мой брат пишет диплом'])).toBe(true)
  })
  it('короткие слова считаются: «Пьёт чай перед стартом» из «пью чай перед стартом»', () => {
    expect(factGrounded('Пьёт чай перед стартом', 'пью чай перед стартом', ['обычно пью чай перед стартом'])).toBe(true)
    expect(factGrounded('Работает юристом в Сбере', 'диплом горит', ['диплом горит'])).toBe(false)
  })
})

describe('замена не о том же', () => {
  const fact = (o: Partial<Fact>): Fact => ({ id: 'a', category: 'style', text: 'Не любит, когда торопят', source: 'explicit', createdAt: OLD, updatedAt: OLD, status: 'active', ...o })
  it('перепутанный номер не портит чужой факт: старое остаётся, новое — отдельным фактом «о себе»', () => {
    const r = applyFactOps([fact({})], [{ op: 'replace', id: 'a', text: 'Переезжает в Казань' }], { now: OLD, newId: () => 'n', today: '2026-11-12' })
    expect(r.facts.map((f) => [f.text, f.category, f.status])).toEqual([
      ['Не любит, когда торопят', 'style', 'active'],
      ['Переезжает в Казань', 'about', 'active'],
    ])
  })
})
