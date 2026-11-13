import { describe, expect, it } from 'vitest'
import { collectReply } from '@/lib/ai/channels/telegram'
import { SentenceGuard } from '@/lib/ai/core/stream-guard'
import { cannedStream } from '@/lib/ai/core/stream-turn'
import { tidy } from '@/lib/ai/guards/output'
import { EMPHASIS_PAIR, ownMarkup, plainText } from '@/lib/emphasis'

/**
 * Акцент в речи кота — одна конвенция: *слово*, не больше двух на реплику (lib/emphasis.ts). Всё остальное, что модель
 * пишет разметкой, человек увидел бы знаками в тексте.
 */
const own = (s: string, budget?: number) => ownMarkup(s, budget).text

describe('разметка в ответе кота', () => {
  it('двойные и тройные звёздочки становятся одним акцентом', () => {
    expect(own('Это **первый шаг**.')).toBe('Это *первый шаг*.')
    expect(own('***жирно***')).toBe('*жирно*')
  })
  it('непарная звёздочка не доходит до человека', () => {
    expect(own('Это *шаг и ещё.')).toBe('Это шаг и ещё.')
    expect(own('*раз* хвост*')).toBe('*раз* хвост')
    expect(own('а * б')).toBe('а б')
  })
  it('акцентов не больше двух: остальные раскрываются в обычный текст', () => {
    expect(own('*раз* и *два* и *три*')).toBe('*раз* и *два* и три')
    expect(ownMarkup('*раз* и *два*').used).toBe(2)
  })
  it('заголовки, обратные кавычки и подчёркивания снимаются, имена файлов целы', () => {
    expect(own('# Заголовок\nтекст `код` и _курсив_ и имя_файла_тут')).toBe('Заголовок\nтекст код и курсив и имя_файла_тут')
  })
  it('звёздочки с пробелами внутри и умножение акцентом не считаются', () => {
    expect(own('* шаг * дальше')).toBe(' шаг дальше')
    expect(own('2 * 3 * 4')).toBe('2 * 3 * 4')
    expect('2 * 3 * 4'.match(new RegExp(EMPHASIS_PAIR.source, 'g'))).toBeNull()
  })
  it('после разбора в тексте остаются только парные звёздочки', () => {
    for (const raw of ['*а', 'а*', '**а* б*', '*а* *б* *в* *', '`*а*`', '_*а*_', '*\nа*', '*' + 'д'.repeat(80) + '*']) {
      const text = own(raw)
      expect(text.replace(new RegExp(EMPHASIS_PAIR.source, 'g'), ''), raw).not.toContain('*')
    }
  })
  it('готовый ответ разовой задачи проходит тот же разбор', () => {
    expect(tidy('«Ты уже **в игре**.»')).toBe('Ты уже *в игре*.')
    expect(tidy('Остров *чуть вырос, держись.')).toBe('Остров чуть вырос, держись.')
  })
  it('в потоке бюджет акцентов общий на всю реплику', () => {
    const g = new SentenceGuard({ maxChars: 400 })
    expect(g.push('Это *раз*. Это *два*. ')).toEqual({ kind: 'release', text: 'Это *раз*. Это *два*.' })
    expect(g.push('А это *три*. ')).toEqual({ kind: 'release', text: ' А это три.' })
  })
  it('без шрифта акцента (бот, буфер обмена) звёздочек нет', async () => {
    expect(plainText('Это *первый шаг* и *ещё*')).toBe('Это первый шаг и ещё')
    const stream = new ReadableStream({
      start(c) {
        for (const p of cannedStream('Открой *файл*, я рядом.')) c.enqueue(p)
        c.close()
      },
    })
    expect((await collectReply(stream)).text).toBe('Открой файл, я рядом.')
  })
})
