import copy from '@/content/sdvg-copy.ru.json'
import { effectiveType, type ProcType, type SdvgState } from '@/lib/sdvg'

/**
 * Страница «Что я записал» (ТЗ research/15-product-science/traffic-attachment.md, п. 2а): каждая строка выведена из
 * конкретного ответа человека — его же слова из 4 вопросов Напарника, сфера, механизм типа и сколько ответов про него.
 * Ответы ВОЗ сюда не попадают никогда. Правило: смена любого своего ответа меняет видимый текст (tests/unit/sdvg-notebook).
 */

export type NotebookPage = {
  type: ProcType
  /** Его слова по порядку вопросов */
  notes: string[]
  sphere: string | null
  mechanism: string
  count: string
}

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}

/** Записи кота по ходу 4 вопросов (то, что человек выбрал, его же словами) */
export function notesOf(l2: ProcType[]): string[] {
  return l2.map((t, i) => copy.layer2[i].options[t])
}

export function notebookPage(state: SdvgState): NotebookPage | null {
  const type = effectiveType(state)
  if (!type) return null
  const k = state.l2.filter((t) => t === type).length
  const sphere = state.sphere
    ? fill(copy.notebook.sphere, {
        sphere: state.sphere === 'all' ? copy.notebook.sphereAll : copy.sphere.options[state.sphere].toLowerCase(),
      })
    : null
  return {
    type,
    notes: notesOf(state.l2),
    sphere,
    mechanism: fill(copy.notebook.mechanism, { mechanism: copy.types[type].mechanism }),
    count: fill(copy.notebook.count, { k: String(k) }),
  }
}

/** Весь видимый текст страницы — для проверки «смена ответа меняет текст» */
export function notebookText(page: NotebookPage | null): string {
  if (!page) return ''
  return [...page.notes, page.sphere ?? '', page.mechanism, page.count, copy.types[page.type].title].join('\n')
}
