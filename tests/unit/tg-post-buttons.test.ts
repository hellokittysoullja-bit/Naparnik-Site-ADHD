import { describe, expect, it } from 'vitest'
import { parseButtonCommand, parsePostLink, postButtons } from '@/lib/tg/post-buttons'

describe('кнопки под постом канала (/button)', () => {
  it('ссылка на пост: открытый и закрытый канал', () => {
    expect(parsePostLink('https://t.me/naparnik_ch/45')).toEqual({ chat: '@naparnik_ch', message: 45 })
    expect(parsePostLink('t.me/c/1234567890/7?single')).toEqual({ chat: '-1001234567890', message: 7 })
    expect(parsePostLink('https://example.com/a/1')).toBeNull()
  })
  it('строки → кнопки: цвет, куда ведёт, ряд из двух', () => {
    const r = parseButtonCommand('/button https://t.me/ch_name/45\n🐾 Разбить дело | зелёный | апп\nНаписать коту | синий | бот ;; Сайт | | https://site.ru', 'NaparnikBot')
    expect(r).toEqual({
      kind: 'set', chat: '@ch_name', message: 45,
      rows: [
        [{ text: '🐾 Разбить дело', url: 'https://t.me/NaparnikBot?startapp=channel', style: 'success' }],
        [{ text: 'Написать коту', url: 'https://t.me/NaparnikBot?start=channel', style: 'primary' }, { text: 'Сайт', url: 'https://site.ru' }],
      ],
    })
  })
  it('без цвета и без «куда» — обычная кнопка в чат с ботом; «убрать» — снять', () => {
    expect(parseButtonCommand('/button t.me/ch_name/3 Начать', 'B')).toMatchObject({ kind: 'set', rows: [[{ text: 'Начать', url: 'https://t.me/B?start=channel' }]] })
    expect(parseButtonCommand('/кнопка t.me/ch_name/3 убрать', 'B')).toEqual({ kind: 'clear', chat: '@ch_name', message: 3 })
  })
  it('ошибки — понятным текстом: нет ссылки, чужой цвет, непонятная цель', () => {
    expect(parseButtonCommand('/button', 'B')).toMatchObject({ kind: 'error', reply: expect.stringContaining('/button https://t.me/канал/45') })
    expect(parseButtonCommand('/button t.me/ch_name/3\nА | фиолетовый', 'B')).toMatchObject({ kind: 'error', reply: expect.stringContaining('фиолетовый') })
    expect(parseButtonCommand('/button t.me/ch_name/3\nА | синий | куда-то', 'B')).toMatchObject({ kind: 'error', reply: expect.stringContaining('куда-то') })
  })
  it('ставит кнопки только админ канала; бот правит пост через editMessageReplyMarkup', async () => {
    const calls: [string, Record<string, unknown>][] = []
    const send = (status: string) => async (m: string, b: Record<string, unknown>) => {
      calls.push([m, b])
      if (m === 'getMe') return { username: 'NaparnikBot' }
      if (m === 'getChatMember') return { status }
      return true
    }
    expect(await postButtons(send('member'), 1, '/button t.me/ch_name/9\nА | красный')).toContain('только админы')
    expect(calls.some(([m]) => m === 'editMessageReplyMarkup')).toBe(false)
    expect(await postButtons(send('creator'), 1, '/button t.me/ch_name/9\nА | красный')).toContain('Готово')
    expect(calls.at(-1)).toEqual(['editMessageReplyMarkup', { chat_id: '@ch_name', message_id: 9, reply_markup: { inline_keyboard: [[{ text: 'А', url: 'https://t.me/NaparnikBot?start=channel', style: 'danger' }]] } }])
  })
})
