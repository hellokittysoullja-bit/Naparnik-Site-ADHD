import { checkOutput, type OutputOpts, type OutputViolation } from '../guards/output'

/**
 * Проверка ответа ПО ХОДУ печати (чат печатает ответ по мере генерации).
 *
 * Проблема: правила тона и медицины (guards/output.ts) раньше проверяли готовый ответ, а в потоке человек видит
 * текст до того, как он готов. OpenAI Agents SDK решает это проверкой после потока (поздно: текст уже показан),
 * Hermes — никак. Здесь — выпуск по предложениям:
 *  - текст копится до границы предложения; накопленное целиком проверяется; прошло — предложение уходит человеку;
 *  - нарушение ДО первого выпуска — попытка негодна, ядро тихо берёт следующую модель (человек ничего не видел);
 *  - нарушение ПОСЛЕ — поток обрезается по последнему проверенному предложению (показанное не отзываем, плохое не
 *    показываем никогда).
 * Цена — задержка в одно предложение (реплики кота 1–3 предложения, первое ≈ 0,3–1 с генерации).
 */
// конец предложения или строки — но не строка, оканчивающаяся двоеточием: «Вот что я умею:» без следующей строки —
// обрывок (замер 11.11: следующую строку отрезала проверка, и человек видел висящий заголовок)
const SENTENCE_END = /[.!?…](?=\s|$)|(?<!:\s*)\n/g
const OPEN_QUOTE = /^\s*["«„]/
const CLOSE_QUOTE = /["»“]\s*$/

export type GuardStep =
  | { kind: 'release'; text: string }
  | { kind: 'hold' }
  | { kind: 'violation'; reason: OutputViolation }

export class SentenceGuard {
  private released = ''
  private pending = ''
  private opened = false

  constructor(private readonly opts: OutputOpts) {}

  /** что уже ушло человеку */
  get text(): string {
    return this.released
  }

  push(delta: string): GuardStep {
    this.pending += delta
    // реплика начинается с кавычки: обёртка это («Привет!») или цитата («Открыть файл» — хороший шаг), станет ясно
    // только в конце — держим целиком (реплики короткие) и решаем в end()
    if (!this.opened && OPEN_QUOTE.test(this.pending)) {
      return this.pending.length > this.opts.maxChars ? { kind: 'violation', reason: 'length' } : { kind: 'hold' }
    }
    let cut = -1
    for (const m of this.pending.matchAll(SENTENCE_END)) cut = (m.index ?? 0) + m[0].length
    if (cut <= 0) {
      // защита от бесконечного «предложения»: проверяем и на длину, не дожидаясь точки
      return this.released.length + this.pending.length > this.opts.maxChars
        ? { kind: 'violation', reason: 'length' }
        : { kind: 'hold' }
    }
    return this.release(cut, false)
  }

  /** модель упёрлась в лимит длины: недописанное предложение не показываем (сравнение 11.11: «…давай посмотрим, что») */
  dropUnfinished(): void {
    this.pending = ''
  }

  /** конец текста: выпускаем остаток (с проверкой на пустоту — у всего ответа) */
  end(): GuardStep {
    return this.release(this.pending.length, true)
  }

  private release(cut: number, final: boolean): GuardStep {
    let chunk = this.pending.slice(0, cut).replace(/\*\*/g, '*')
    // кавычки-обёртки снимаются, только если обёрнута ВСЯ реплика (её начало ещё не показано — см. push)
    if (final && !this.opened && OPEN_QUOTE.test(chunk) && CLOSE_QUOTE.test(chunk)) {
      chunk = chunk.replace(OPEN_QUOTE, '').replace(CLOSE_QUOTE, '')
    }
    if (final) chunk = chunk.trimEnd()
    const candidate = (this.released + chunk).trim()
    if (!final && !candidate) {
      this.pending = this.pending.slice(cut)
      return { kind: 'hold' }
    }
    const verdict = checkOutput(candidate, this.opts)
    if (!verdict.ok) return { kind: 'violation', reason: verdict.reason }
    this.pending = this.pending.slice(cut)
    if (!this.opened) chunk = chunk.trimStart()
    this.opened = true
    this.released += chunk
    return chunk ? { kind: 'release', text: chunk } : { kind: 'hold' }
  }
}
