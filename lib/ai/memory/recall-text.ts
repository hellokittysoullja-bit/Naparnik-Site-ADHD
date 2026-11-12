/**
 * Тексты вспоминания, общие для устройства и сервера (без зависимостей: устройство не тянет ядро обвязки).
 */
export type RecallEpisode = { at: string; lines: { role: 'user' | 'cat'; text: string }[] }

export const RECALL_NONE = 'В прошлых разговорах об этом ничего не нашёл.'

/** Без модели (сбой провайдера): короткая выдержка реплик человека — лучше, чем ничего, и честно помечена */
export function rawRecall(episodes: readonly RecallEpisode[]): string {
  const lines = episodes.flatMap((e) => e.lines.filter((l) => l.role === 'user').map((l) => `${e.at}: «${l.text.slice(0, 120)}»`))
  return lines.length ? `Нашёл в прошлых разговорах слова человека: ${lines.slice(0, 4).join('; ')}` : RECALL_NONE
}
