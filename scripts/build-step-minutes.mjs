// Собирает lib/ai/agents/breakdown-minutes.ts из research/27-breakdown/minutes/minutes.json —
// минут на каждый шаг готовых планов (оценены вручную по research/27-breakdown/minutes/RULES.md, 18.11).
// Запуск: node scripts/build-step-minutes.mjs (после правки minutes.json или новой партии дел)
import fs from 'node:fs'
const src = JSON.parse(fs.readFileSync('research/27-breakdown/minutes/minutes.json', 'utf8'))
const lines = Object.entries(src).map(([t, m]) => `  ${JSON.stringify(t)}: [${m.join(', ')}],`)
const out = `// СГЕНЕРИРОВАНО scripts/build-step-minutes.mjs из research/27-breakdown/minutes/minutes.json — руками не править.
/**
 * Минуты на каждый шаг готовых планов (breakdown-goblin.ts), по порядку шагов. Оценены вручную по правилам
 * research/27-breakdown/minutes/RULES.md: обычный взрослый делает сам, без спешки; ожидание (стирка, сушка,
 * доставка, ответ) считается целиком. Число шагов у плана и у оценки сверяет тест.
 */
export const GOBLIN_MINUTES: Record<string, readonly number[]> = {
${lines.join('\n')}
}
`
fs.writeFileSync('lib/ai/agents/breakdown-minutes.ts', out)
console.log('plans', lines.length)
