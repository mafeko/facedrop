import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Serial: each test spins up a real TensorFlow.js face detector (SSD
  // MobileNet V1, GPU/WebGL-backed). Several of those competing for the same
  // GPU across parallel workers starved each other badly enough to blow past
  // the per-test timeout, even though each detection alone takes well under
  // a second — this isn't a pipeline bug, just GPU contention between workers.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  // Face detection on real photos runs actual WASM inference, which is
  // slower than typical UI assertions.
  timeout: 30_000,
  expect: { timeout: 15_000 },
})
