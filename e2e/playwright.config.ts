import { defineConfig, devices } from '@playwright/test'

// Points at the isolated acceptance stack (compose.test.yaml), never the
// developer stack: when this suite runs as the `e2e` Compose service, Docker
// DNS resolves `frontend-test`/`backend-test` (see compose.test.yaml). The
// localhost fallbacks let a learner run `npx playwright test` directly
// against `docker compose up` (the dev stack, which does publish host
// ports) while iterating on a test locally, without needing the full
// acceptance stack running.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const apiBaseURL = process.env.E2E_API_BASE_URL || 'http://localhost:8000/api/v1'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  // Host-mounted by compose.test.yaml's `e2e` service so artifacts survive
  // the container's own teardown (`down -v`) - see compose.test.yaml.
  outputDir: 'test-results',
  use: {
    baseURL,
    // Retained only on failure, per docs/testing-strategy.md's stability
    // rules - a passing run stays small and free of incidental
    // screen/network capture.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-journey\.spec\.ts/
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /mobile-journey\.spec\.ts/
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /mobile-journey\.spec\.ts/
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile-journey\.spec\.ts/
    }
  ]
})

export { apiBaseURL }
