import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Прогон обвязки на настоящей модели (платно, нужен ANYMODEL_API_KEY): pnpm eval:ai. В CI не входит.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: { include: ['evals/**/*.eval.ts'], environment: 'node', testTimeout: 600_000, fileParallelism: false },
})
