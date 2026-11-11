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
const SENTENCE_END = /[.!?…](?=\s|$)|\n/g

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

  /** конец текста: выпускаем остаток (с проверкой на пустоту — у всего ответа) */
  end(): GuardStep {
    return this.release(this.pending.length, true)
  }

  private release(cut: number, final: boolean): GuardStep {
    let chunk = this.pending.slice(0, cut).replace(/\*\*/g, '*')
    if (!this.opened) chunk = chunk.replace(/^\s*["«„]/, '') // кавычка-обёртка в начале всей реплики
    if (final) chunk = chunk.replace(/["»“]\s*$/, '')
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
