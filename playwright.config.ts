import { defineConfig } from '@playwright/test';
const port = process.env.CARD_RV_TEST_PORT ?? '4176';
const url = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  workers: 4,
  fullyParallel: false,
  outputDir: '.test-data/card-rv/browser/results',
  reporter: [['list'], ['json', { outputFile: '.test-data/card-rv/browser/report.json' }]],
  use: { baseURL: url, browserName: 'chromium', channel: 'chromium', viewport: { width: 1280, height: 900 } },
  webServer: {
    command: 'bun run scripts/serve.ts',
    url,
    env: { CARD_RV_TEST_PORT: port },
    reuseExistingServer: false,
  },
});
