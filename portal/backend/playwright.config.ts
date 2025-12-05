import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for MBSS test execution
 * This config is used when the backend executes tests via CLI
 */
export default defineConfig({
  // Test directory
  testDir: './dist-tests',
  
  // Test match pattern
  testMatch: '**/*.spec.js',
  
  // Timeout per test
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 10000,
  },
  
  // Run tests in parallel
  fullyParallel: false,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: 0,
  
  // Reporter (we handle our own logging)
  reporter: 'line',
  
  // Shared settings for all projects
  use: {
    // Base URL - will be overridden by test config
    baseURL: 'http://localhost:3000',
    
    // Collect trace on failure
    trace: 'retain-on-failure',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Always record video
    video: 'on',
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
  ],
});
