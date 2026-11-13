import { EMPHASIS_PAIR } from '@/lib/emphasis'

/**
 * Рукописные слова внутри обычного текста. Раньше вся речь напарника шла
 * шрифтом Caveat целиком — в топовых чат-продуктах (Apple Messages, Linear,
 * ChatGPT, Claude, Notion) основной читаемый текст всегда набирается
 * обычной гарнитурой: глаза читают тысячи сообщений, декоративный шрифт
 * их утомляет. Рукописный стиль остаётся, но только как акцент на
 * отдельных словах — Von Restorff Effect: то, что отличается от фона,
 * замечается само, без утяжеления всего текста.
 *
 * Конвенция разметки: *слово* или *короткая фраза* — источник (системный
 * промпт в lib/companion.ts, скриптовый фолбэк в lib/scripted-companion.ts,
 * статичные реплики в компонентах) оборачивает 1, изредка 2 ключевых слова
 * за реплику. Всё остальное остаётся обычным шрифтом.
 */
export function EmphasisText({ text }: { text: string }) {
  if (!text.includes('*')) return <>{text}</>

  // то же правило пары, что у сервера (lib/emphasis.ts): «2 * 3 * 4» акцентом не становится
  const re = new RegExp(EMPHASIS_PAIR.source, 'g')
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      // mr-[0.14em]: Caveat наклонён вправо — последняя буква слова визуально
      // наезжает на следующее слово, даже когда между ними есть обычный
      // пробел (замерено рендером: «прикоснуться к» читалось как
      // «прикоснутьсяк» без зазора). Компенсируем только справа — переход
      // «прямой → курсив» слева уже читается нормально, слева не трогаем.
      <span key={key++} className="font-hand text-[1.08em] mr-[0.14em]">
        {match[1]}
      </span>,
    )
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return <>{parts}</>
}
