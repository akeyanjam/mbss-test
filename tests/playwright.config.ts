import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for LOCAL development only.
 * When tests run via the MBSS Portal, the backend uses its own execution config.
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  
  /* Test execution settings */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  timeout: 60000, // 60 seconds per test
  
  /* Reporter */
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  
  /* Shared settings for all tests */
  use: {
    /* Base URL - override with TEST_ENV */
    baseURL: process.env.BASE_URL || 'https://secure.pointofsale-sit1.bofa.com/sparta/auth/mbss/login/',
    
    /* Timeouts */
    actionTimeout: 15000, // 15 seconds for actions (click, fill, etc.)
    navigationTimeout: 30000, // 30 seconds for page navigation
    
    /* Collect trace on failure */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  
  /* Assertion timeout */
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },

  /* Default project for local dev */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
