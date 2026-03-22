import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.spec.ts', '**/screenshots/**/*.spec.ts', '**/integration/**/*.spec.ts', '**/debug/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://localhost:3000',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
             '--use-fake-ui-for-media-stream',
             '--use-fake-device-for-media-stream',
             '--allow-file-access-from-files',
             '--disable-web-security'
          ]
        }
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @isc/apps/node dev',
      port: 9091, // Wait for the admin/health port (relay listens on 9000 for libp2p, 9091 for admin)
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @isc/apps/browser dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],
});
