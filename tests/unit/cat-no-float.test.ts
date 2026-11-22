import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Кот не плавает (владелец 22.11, «он дышать должен, но не плавать будто в воде, исправь навсегда везде»): ни одна
 * бесконечная анимация сдвига или поворота не оборачивает кота. Дыхание, моргание, хвост и уши — внутри самой куклы.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) ? [p] : []
  })
}

describe('кот не плавает', () => {
  it('нет бесконечного покачивания вверх-вниз или поворота у обёрток в компонентах', () => {
    const bad: string[] = []
    for (const f of [...files('components'), ...files('app')]) {
      const src = readFileSync(f, 'utf8')
      // анимация motion с бесконечным повтором, где меняются y или rotate (покачивание целого блока)
      const re = /animate=\{[^}]*\b(y|rotate):\s*\[[^\]]*\][^}]*\}[\s\S]{0,200}?repeat:\s*Infinity/g
      for (const m of src.matchAll(re)) bad.push(`${f}: ${m[0].slice(0, 80)}`)
    }
    expect(bad).toEqual([])
  })
})
