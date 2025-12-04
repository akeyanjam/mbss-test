import { test as base, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * Test configuration that gets merged from multiple sources:
 * 1. constants.json (shared + environment-specific)
 * 2. DB overrides (when running via portal)
 * 3. Run-level overrides (when running via portal)
 */
export interface TestConfig {
  // Environment
  envCode: string;
  baseUrl: string;
  
  // Credentials (example - extend as needed)
  username?: string;
  password?: string;
  
  // Timeouts
  timeoutMs?: number;
  retryCount?: number;
  
  // Allow any additional properties
  [key: string]: any;
}

/**
 * Extended test fixtures with config injection
 */
export const test = base.extend<{ config: TestConfig }>({
  config: async ({}, use, testInfo) => {
    // Priority 1: Config passed from portal runner via environment variable
    const portalConfig = process.env.MBSS_TEST_CONFIG;
    if (portalConfig) {
      const config = JSON.parse(portalConfig) as TestConfig;
      await use(config);
      return;
    }
    
    // Priority 2: Load from local constants.json (for local development)
    const testFilePath = testInfo.file;
    const testDir = dirname(testFilePath);
    const constantsPath = join(testDir, 'constants.json');
    
    if (!existsSync(constantsPath)) {
      throw new Error(`constants.json not found at ${constantsPath}`);
    }
    
    const constants = JSON.parse(readFileSync(constantsPath, 'utf-8'));
    
    // Determine environment (default to SIT1 for local dev)
    const envCode = process.env.TEST_ENV || 'SIT1';
    
    // Merge: shared + environment-specific
    const config: TestConfig = {
      envCode,
      ...constants.shared,
      ...(constants.environments?.[envCode] || {}),
    };
    
    await use(config);
  },
});

export { expect };

/**
 * Helper to log test steps (visible in portal logs)
 */
export function logStep(message: string) {
  console.log(`[STEP] ${message}`);
}

/**
 * Helper to log test info
 */
export function logInfo(message: string) {
  console.log(`[INFO] ${message}`);
}

/**
 * Helper to log warnings
 */
export function logWarn(message: string) {
  console.warn(`[WARN] ${message}`);
}
