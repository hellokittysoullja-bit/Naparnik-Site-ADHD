import { defineConfig, devices } from '@playwright/test'

// Сквозные проверки против ПРОД-сборки (`npm run build` заранее): dev-режим Turbopack ведёт себя иначе (CLAUDE.md §6).
// E2E_BASE_URL — проверить уже запущенный сервер или превью-деплой.
const port = 3300
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { outputFolder: 'e2e-report', open: 'never' }]] : 'list',
  use: {
    baseURL,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start -p ${port}`, url: baseURL, reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
