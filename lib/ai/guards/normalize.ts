/**
 * Нормализация текста до любых проверок (research/20-ai-harness/security-ai.md R4; Unicode TR39 confusables;
 * «ASCII smuggling» тегами U+E0000–E007F). Две функции с разными задачами:
 *  - stripInvisible — то, что уходит модели и в память: исходные буквы не трогаем, убираем только невидимое
 *    (нулевой ширины, управление направлением, BOM, теги) — человек их не видит, а модель читает;
 *  - forMatching — только для сопоставления с правилами: NFKC, нижний регистр, ё→е, латинские двойники рядом с
 *    кириллицей → кириллица («нe хочу жить» с латинской e больше не обходит проверку кризиса).
 */
const INVISIBLE = /[\p{Cf}\u{E0000}-\u{E007F}\u2028\u2029]/gu

export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, '')
}

// латиница и цифры, похожие на кириллицу (Unicode TR39 confusables, только однозначные пары)
const HOMO: Readonly<Record<string, string>> = {
  a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', u: 'и', '3': 'з', '0': 'о', '6': 'б',
}

// латинские буквы, прилипшие к кириллице, — всегда; цифры — только внутри кириллического слова («с0бой»), иначе
// «20мг» стало бы «2омг» и обошло правило о дозах
const MIXED = /[a-z]+(?=\p{Script=Cyrillic})|(?<=\p{Script=Cyrillic})[a-z]+|(?<=\p{Script=Cyrillic})[036]+(?=\p{Script=Cyrillic})/gu

// знаки ударения и прочие комбинируемые (категория Mn) — «умере́ть» должно совпасть с «умереть». После NFKC «й» и
// «ё» уже собраны в одну букву, поэтому снятие Mn их не портит
const COMBINING = /\p{Mn}/gu

export function forMatching(s: string, invisibleAs = ''): string {
  return s
    .normalize('NFKC')
    .replace(COMBINING, '')
    .replace(INVISIBLE, invisibleAs)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(MIXED, (run) => [...run].map((ch) => HOMO[ch] ?? ch).join(''))
    .replace(/\s+/g, ' ')
}

/**
 * Оба прочтения для правил: невидимый символ внутри слова («по\u200bкончить») и вместо пробела («хочу\u200bумереть»).
 * Правило срабатывает, если совпало любое.
 */
export function matchVariants(s: string): string[] {
  const glued = forMatching(s)
  const out = new Set([glued, forMatching(s, ' ')])
  // слова целиком из латинских двойников («HE ХОЧУ ЖИТЬ», «покончить c собой» с латинской c): если в тексте есть
  // кириллица — ещё одно прочтение, где ВСЕ двойники стали кириллицей. Английские правила (ignore previous…) от
  // этого не страдают: они совпадают с другими прочтениями
  if (/\p{Script=Cyrillic}/u.test(glued)) out.add(glued.replace(/[a-z]/g, (ch) => HOMO[ch] ?? ch))
  return [...out]
}
