import { defineConfig } from '@playwright/test';

/**
 * Tests E2E visuels du site web RISAC.
 * Prérequis (voir E2E-REPORT.md) : API locale « risac-api-e2e » sur la base simulée (port 4000)
 * et site « risac-web » (port 3100). Le Chrome installé sur la machine est utilisé (channel: chrome).
 */
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 3),
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'results/results.json' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
  ],
  use: {
    baseURL: WEB,
    channel: 'chrome',
    locale: 'fr-FR',
    timezoneId: 'Africa/Lubumbashi',
    navigationTimeout: 120_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { viewport: { width: 1440, height: 900 } } },
    {
      name: 'desktop-1440',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|expo-web\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-390',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts|expo-web\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    {
      // Application mobile Expo, version web (repli quand l'app n'est pas installée dans l'émulateur)
      name: 'expo-web-390',
      testMatch: /expo-web\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
  ],
});
