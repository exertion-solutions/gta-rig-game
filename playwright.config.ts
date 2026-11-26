import { defineConfig } from '@playwright/test'

// E2E aparte de vitest (`npm test` queda rápido). E2E_CHANNEL=chrome usa el Chrome del sistema en vez del chromium bajado.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.ts',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true, // sin ventanas de navegador visibles
    channel: process.env.E2E_CHANNEL || undefined,
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort --bypass-lock', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
})
