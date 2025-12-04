#!/usr/bin/env node

/**
 * Test Runner Utility
 * 
 * Allows running tests with a specific environment from constants.json
 * 
 * Usage:
 *   npm run test:env SIT1
 *   npm run test:env UAT -- -g "login"
 *   npm run test:env PROD -- src/auth/basic-login/basic-login.spec.ts
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const args = process.argv.slice(2);

// Check if environment is provided
if (args.length === 0) {
  console.log('❌ Please specify an environment');
  console.log('\nUsage:');
  console.log('  npm run test:env <ENV> [-- playwright-args]');
  console.log('\nExamples:');
  console.log('  npm run test:env SIT1');
  console.log('  npm run test:env UAT -- -g "login"');
  console.log('  npm run test:env PROD -- src/auth/basic-login/basic-login.spec.ts');
  console.log('\nAvailable environments: SIT1, SIT2, UAT, PROD');
  console.log('\nPlaywright options:');
  console.log('  -g, --grep <pattern>     Filter tests by name');
  console.log('  --headed                 Run with visible browser');
  console.log('  --debug                  Run in debug mode');
  process.exit(1);
}

const env = args[0].toUpperCase();
const playwrightArgs = args.slice(1);

// Validate environment
const validEnvs = ['SIT1', 'SIT2', 'UAT', 'PROD'];
if (!validEnvs.includes(env)) {
  console.log(`❌ Invalid environment: ${env}`);
  console.log(`   Valid options: ${validEnvs.join(', ')}`);
  process.exit(1);
}

console.log(`\n🚀 Running tests with environment: ${env}`);
if (playwrightArgs.length > 0) {
  console.log(`📋 Additional args: ${playwrightArgs.join(' ')}`);
}

// Set TEST_ENV and run Playwright
const testProcess = spawn('npx', ['playwright', 'test', ...playwrightArgs], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    TEST_ENV: env,
  },
});

testProcess.on('close', (code) => {
  process.exit(code);
});
