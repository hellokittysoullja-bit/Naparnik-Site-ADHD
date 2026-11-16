import { EMPHASIS_PAIR } from '@/lib/emphasis'

/**
 * Акцент на словах внутри обычного текста: *слово* — жирное и цветом кнопки (Von Restorff Effect: то, что отличается от
 * фона, замечается само). До 16.11 акцент был рукописным Caveat — владелец убрал рукописный шрифт из продукта целиком.
 *
 * Конвенция разметки: *слово* или *короткая фраза* — источник (системный промпт в lib/companion.ts, скриптовый фолбэк
 * в lib/scripted-companion.ts, статичные реплики в компонентах) оборачивает 1, изредка 2 ключевых слова за реплику.
 */
export function EmphasisText({ text }: { text: string }) {
  if (!text.includes('*')) return <>{text}</>

  // то же правило пары, что у сервера (lib/emphasis.ts): «2 * 3 * 4» акцентом не становится
  const re = new RegExp(EMPHASIS_PAIR.source, EMPHASIS_PAIR.flags)
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = re.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      <span key={key++} className="font-semibold text-primary">
        {match[1]}
      </span>,
    )
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return <>{parts}</>
}
