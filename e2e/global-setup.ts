import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'

/**
 * Сценарии идут против прод-сборки (.next), а сама команда тестов её не собирает. 13.11 два прогона «115 прошли»
 * проверяли сборку суточной давности: код этапа в неё не входил, и рост первой загрузки на 36 КБ на всех страницах
 * остался незамеченным. Поэтому: сборка старше исходников — тесты не начинаются, а говорят, что сделать.
 * Против внешнего адреса (E2E_BASE_URL) проверять нечего.
 */
const SOURCES = ['app', 'components', 'lib', 'content', 'hooks', 'public', 'next.config.ts', 'package.json']

export default function globalSetup() {
  if (process.env.E2E_BASE_URL) return
  const marker = '.next/BUILD_ID'
  if (!existsSync(marker)) throw new Error('Нет прод-сборки: сначала `pnpm build`.')
  const built = statSync(marker).mtimeMs
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '--', ...SOURCES], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)
  const newer = files.filter((f) => existsSync(f) && statSync(f).mtimeMs > built)
  if (newer.length > 0) {
    throw new Error(`Сборка старше кода (${newer.length} файлов новее, например ${newer.slice(0, 3).join(', ')}): сначала \`pnpm build\`.`)
  }
}
