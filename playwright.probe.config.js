import { defineConfig, devices } from '@playwright/test';

// Lane-local probe runner (lane/pico-cov). The diagnostic probes live in
// tests/e2e/probes/*.probe.js so the DEFAULT playwright.config.js testMatch
// (`**/*.@(spec|test).?(c|m)[jt]s?(x)`) never collects them — the main suite
// stays clean. Run one with:
//
//   TMPDIR=$PWD/.tmp-vitest TEMP=$PWD/.tmp-vitest TMP=$PWD/.tmp-vitest \
//     npx playwright test --config=playwright.probe.config.js --workers=1
//
export default defineConfig({
  testDir: './tests/e2e/probes',
  testMatch: '**/*.probe.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5184',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
