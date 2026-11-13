import { EMPHASIS_LIMIT, ownMarkup } from '@/lib/emphasis'
import { checkOutput, plainWords, stripGreeting, stripPetNames, undash, type OutputOpts, type OutputViolation } from '../guards/output'

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
// Граница выпуска — конец предложения, за которым уже пришёл пробел или перевод строки. Не границы:
//  - конец текущего куска без пробела: «2.» + «5 минуты» и «site.» + «ru» разрезались бы посередине (аудит 12.11);
//    последнее предложение выпускает end(), когда текст закончился;
//  - номер пункта в начале строки («1. Открыть»): иначе «Шаги:\n1.» уходило бы висящим заголовком;
//  - строка, оканчивающаяся двоеточием: «Вот что я умею:» без следующей строки — обрывок.
const SENTENCE_END = /(?<!(?:^|\n)[ \t]*\d{1,3})[.!?…](?=\s)|(?<!:[ \t]*)\n/g
const LAST_SENTENCE_END = /[.!?…](?![\s\S]*[.!?…])/
const OPEN_QUOTE = /^\s*["«„]/
const CLOSE_QUOTE = /["»“]\s*$/

const FIRST_RELEASE_SENTENCES = 2
/** нарушения стиля: после первого выпуска негодное предложение пропускается, а не обрывает ответ */
const SKIPPABLE: ReadonlySet<OutputViolation> = new Set<OutputViolation>(['bureaucratese', 'absence'])

export type GuardStep =
  | { kind: 'release'; text: string }
  | { kind: 'hold' }
  | { kind: 'violation'; reason: OutputViolation }

export class SentenceGuard {
  private released = ''
  private pending = ''
  private opened = false
  /** сколько акцентов (*слово*) уже ушло человеку: на реплику их не больше EMPHASIS_LIMIT */
  private emphasis = 0

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
    let ends = 0
    for (const m of this.pending.matchAll(SENTENCE_END)) {
      cut = (m.index ?? 0) + m[0].length
      ends++
    }
    // Первый выпуск — когда готовы ДВА предложения (или текст кончился — тогда выпускает end()). Нарушение во втором
    // предложении иначе обрезало бы ответ после первого: человек видел «О, про морских котиков!» и всё (аудит 12.11:
    // 14 % показанных ответов оборваны так). Теперь оно бракует попытку до показа, и ход берёт следующая модель.
    // Цена — первое слово позже на одно предложение (~0,3–0,8 с)
    if (!this.opened && ends < FIRST_RELEASE_SENTENCES) cut = -1
    if (cut <= 0) {
      // защита от бесконечного «предложения»: проверяем и на длину, не дожидаясь точки
      return this.released.length + this.pending.length > this.opts.maxChars
        ? { kind: 'violation', reason: 'length' }
        : { kind: 'hold' }
    }
    return this.release(cut, false)
  }

  /**
   * Модель упёрлась в лимит длины: недописанное предложение не показываем (сравнение 11.11: «…давай посмотрим,
   * что»). Законченные предложения, которые ещё не выпущены (реплика в кавычках держится целиком), остаются.
   */
  dropUnfinished(): void {
    const m = LAST_SENTENCE_END.exec(this.pending)
    this.pending = m ? this.pending.slice(0, m.index + 1) : ''
  }

  /** конец текста: выпускаем остаток (с проверкой на пустоту — у всего ответа) */
  end(): GuardStep {
    return this.release(this.pending.length, true)
  }

  private release(cut: number, final: boolean): GuardStep {
    const marked = ownMarkup(this.pending.slice(0, cut), EMPHASIS_LIMIT - this.emphasis)
    let chunk = plainWords(stripPetNames(undash(marked.text)))
    // кавычки-обёртки снимаются, только если обёрнута ВСЯ реплика (её начало ещё не показано — см. push)
    if (final && !this.opened && OPEN_QUOTE.test(chunk) && CLOSE_QUOTE.test(chunk)) {
      const inner = chunk.replace(OPEN_QUOTE, '').replace(CLOSE_QUOTE, '')
      if (!/["«»„“]/.test(inner)) chunk = inner // «A» — шаг «B» — не обёртка
    }
    if (final) chunk = chunk.trimEnd()
    const candidate = (this.released + chunk).trim()
    if (!final && !candidate) {
      this.pending = this.pending.slice(cut)
      return { kind: 'hold' }
    }
    const verdict = checkOutput(candidate, this.opts)
    // «Запомнил.» до вызова инструмента: ждём вызова (тогда это правда), а не бракуем — модели часто пишут слово
    // раньше вызова. Не дождались до конца текста — нарушение: неправду не показываем
    if (!verdict.ok && verdict.reason === 'claim' && !final) return { kind: 'hold' }
    // казённая фраза в середине уже начатого ответа: пропускаем это предложение и идём дальше (следующее может быть
    // шагом или вопросом, ради которых ответ писался), а не обрываем весь ответ
    if (!verdict.ok && this.opened && SKIPPABLE.has(verdict.reason) && checkOutput(this.released.trim() || 'а', this.opts).ok) {
      this.pending = this.pending.slice(cut)
      return { kind: 'hold' }
    }
    if (!verdict.ok) return { kind: 'violation', reason: verdict.reason }
    this.pending = this.pending.slice(cut)
    if (!this.opened) chunk = chunk.trimStart()
    if (!this.opened && this.opts.noGreeting) {
      chunk = stripGreeting(chunk)
      if (!chunk.trim()) {
        // ответ начался только с приветствия: ждём следующее предложение
        return { kind: 'hold' }
      }
    }
    this.opened = true
    this.emphasis += marked.used
    this.released += chunk
    return chunk ? { kind: 'release', text: chunk } : { kind: 'hold' }
  }
}
