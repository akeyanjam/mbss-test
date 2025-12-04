#!/usr/bin/env node

/**
 * MBSS Test Recording Helper
 *
 * - Creates the test folder structure
 * - Runs Playwright codegen to capture a recording
 * - On completion, prints a DYNAMIC AI PROMPT to the terminal
 *   pre-filled with paths, metadata, and the recorded script.
 *
 * Usage: npm run record
 */

import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname, posix } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(__dirname, '../src');
const RECORDINGS_DIR = join(__dirname, '../recordings');

if (!existsSync(RECORDINGS_DIR)) {
  mkdirSync(RECORDINGS_DIR, { recursive: true });
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((r) => rl.question(q, r));

function toPosixPath(p) {
  return p.split('\\').join('/');
}

async function main() {
  console.log('\n🎬 MBSS Test Recording Helper');
  console.log('This tool records a flow and prepares a dynamic AI prompt for you.\n');

  // Collect inputs
  const featureFolder = (await question('Feature folder (e.g., "login", "transfers/domestic"): ')).trim();
  const testName = (await question('Test name (e.g., "basic-login"): ')).trim();
  const friendlyName = (await question('Friendly name (e.g., "Basic Login Flow"): ')).trim();
  const description = (await question('Description: ')).trim();
  const tagsInput = (await question('Tags (comma-separated, e.g., "login,smoke,critical"): ')).trim();
  const baseUrl = (await question('Base URL to record against (e.g., "https://sit1.example.com"): ')).trim();

  const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
  const testKey = testName;

  // Paths
  const testFolder = join(TESTS_ROOT, featureFolder, testName);
  const recordingFile = join(RECORDINGS_DIR, `${testName}-recording.ts`);

  // Ensure folder
  if (!existsSync(testFolder)) {
    console.log(`\n📁 Creating test folder: ${testFolder}`);
    mkdirSync(testFolder, { recursive: true });
  }

  // Write meta.json
  const meta = { testKey, friendlyName, description, tags };
  writeFileSync(join(testFolder, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log('✅ Created meta.json');

  // Write constants.json template
  const constants = {
    shared: { timeoutMs: 30000, retryCount: 2 },
    environments: {
      SIT1: { baseUrl: baseUrl || 'https://secure.pointofsale-sit1.bofa.com/sparta/auth/mbss/login/' },
      SIT2: { baseUrl: 'https://secure.pointofsale-sit2.bofa.com/sparta/auth/mbss/login/' },
      PROD: { baseUrl: 'https://secure.pointofsale.bofa.com/sparta/auth/mbss/login/' },
    },
  };
  writeFileSync(join(testFolder, 'constants.json'), JSON.stringify(constants, null, 2));
  console.log('✅ Created constants.json (fill credentials later)');

  // Placeholder spec (empty, will be overwritten by generated code)
  writeFileSync(join(testFolder, `${testName}.spec.ts`), `// Placeholder. Will be overwritten by AI output.\n`);
  console.log(`✅ Created ${testName}.spec.ts (placeholder)`);

  rl.close();

  // Start codegen
  console.log('\n🎬 Starting Playwright Codegen...');
  console.log(`📍 Recording will be saved to: ${recordingFile}`);
  console.log('\n💡 IMPORTANT: Before closing the browser:');
  console.log('   👉 Click on an element that indicates SUCCESS (e.g., dashboard heading, user menu, success message)');
  console.log('   👉 This final click will be used as the assertion in your test');

  const codegenArgs = ['playwright', 'codegen', '--output', recordingFile, '--target', 'playwright-test', baseUrl || 'https://sit1.example.com'];
  const codegen = spawn('npx', codegenArgs, { stdio: 'inherit', shell: true, cwd: join(__dirname, '..') });

  codegen.on('close', (code) => {
    if (code !== 0) {
      console.log(`\n⚠️  Codegen exited with code ${code}`);
      return;
    }

    // Build dynamic prompt
    const recording = existsSync(recordingFile) ? readFileSync(recordingFile, 'utf-8') : '// (recording file missing)';
    const relTestFolder = toPosixPath(posix.join('tests', 'src', featureFolder, testName));
    const relSpecPath = `${relTestFolder}/${testName}.spec.ts`;
    const relMetaPath = `${relTestFolder}/meta.json`;
    const relConstantsPath = `${relTestFolder}/constants.json`;

    const prompt = `I have a Playwright recording that I need to convert into an MBSS test. Please:

1) Create or overwrite the following files (paths already exist):
- Spec: ${relSpecPath}
- Meta: ${relMetaPath}
- Constants: ${relConstantsPath}

2) Use this test information:
- Test Name: ${testName}
- Friendly Name: ${friendlyName}
- Feature Folder: ${featureFolder}
- Description: ${description}
- Tags: ${tags.join(', ')}

3) Generate meta.json with this exact shape:
{
  "testKey": "${testKey}",
  "friendlyName": "${friendlyName}",
  "description": "${description}",
  "tags": [${tags.map((t) => `"${t}"`).join(', ')}]
}

4) EXTRACT USER INPUTS from the recording:
- Scan the recording for .fill() and .selectOption() calls
- For each input, create a semantic variable name based on the field context (e.g., "email", "password", "accountNumber", "merchantName", "transferAmount")
- Use the ACTUAL VALUE from the recording (e.g., if the recording has .fill('akj@outlook.com'), extract "akj@outlook.com")
- Add these variables to constants.json under each environment with the extracted values

5) Generate constants.json with this structure:
{
  "shared": { "timeoutMs": 30000, "retryCount": 2 },
  "environments": {
    "SIT1": {
      "baseUrl": "<extracted from recording>",
      "<variable1>": "<actual value from recording>",
      "<variable2>": "<actual value from recording>",
      ...
    },
    "SIT2": {
      "baseUrl": "<same structure, use SIT2 URL if known, otherwise copy SIT1>",
      "<variable1>": "<same value or environment-specific>",
      ...
    },
    "PROD": { ... same structure ... }
  }
}

Example: If recording has:
  await page.fill('#email', 'user@example.com');
  await page.fill('#password', 'myPassword123');
  
Then constants.json should have:
  "email": "user@example.com",
  "password": "myPassword123"

6) Generate the spec file (${testName}.spec.ts) following these STRICT rules:

STRUCTURE:
- Import: import { test, expect } from '../../shared/fixtures/base.fixture.js';
- EXACTLY ONE test() block
- Use ({ page, config }) in the test function signature - config is injected by the fixture
- Use config.variableName for ALL dynamic values (never hardcode)
- Add ! (non-null assertion) when using optional config properties like config.email!

BEST PRACTICES:
- Add clear comments for each logical step
- Use proper waits: await page.waitForLoadState('networkidle') after navigation
- Use waitForSelector or waitFor before interacting with elements that may load asynchronously
- Prefer data-testid selectors when available, fallback to role-based or CSS selectors
- Use page.locator() with specific selectors instead of broad queries
- Handle dynamic content with proper waits, not fixed timeouts

ASSERTION STRATEGY:
- Identify the LAST click action in the recording (before the recording ends)
- This final click represents the SUCCESS INDICATOR the user clicked to verify the flow worked
- Convert this final click into an assertion using expect().toBeVisible() or expect().toHaveText()
- Example: If the last action is clicking a heading "Select Reseller", assert that element is visible
- Remove the click action itself from the test, only keep the assertion

EXAMPLE PATTERN:
\`\`\`typescript
import { test, expect } from '../../shared/fixtures/base.fixture.js';

test('${testName}', async ({ page, config }) => {
  // Config is automatically loaded from constants.json via the base fixture
  
  // Navigate
  await page.goto(config.baseUrl);
  await page.waitForLoadState('networkidle');

  // Fill form fields with config values (use ! for optional properties)
  await page.fill('[data-testid="email"], #email, input[name="email"]', config.email!);
  await page.fill('[data-testid="password"], #password, input[name="password"]', config.password!);

  // Submit and wait
  await page.click('[data-testid="submit"], button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Assert success (using the final click from recording as assertion target)
  // If recording ended with: await page.getByRole('heading', { name: 'Dashboard' }).click();
  // Convert to: await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('[data-testid="success-indicator"]')).toBeVisible();
});
\`\`\`

7) Use this recording as reference for steps and selectors:

\`\`\`typescript
${recording}
\`\`\`

IMPORTANT REMINDERS:
- Extract ALL .fill() and .selectOption() values as variables
- Use the ACTUAL values from the recording in constants.json
- Replace ALL hardcoded values in the spec with config.variableName
- Add proper waits (waitForLoadState, waitForSelector, waitForURL)
- Include assertions to verify success
- Keep the test self-contained (no external helpers)
`;

    console.log('\n============================================================');
    console.log('📋 DYNAMIC AI PROMPT (Copy from here to your AI assistant)');
    console.log('============================================================\n');
    console.log(prompt);
    console.log('\n============================================================');
    console.log(`➡️  After the AI responds, paste the generated files into:\n- ${relSpecPath}\n- ${relMetaPath}\n- ${relConstantsPath}`);
    console.log(`\n➡️  Then run your test:`);
    console.log(`   npm run test:env SIT1 -- -g "${testName}"`);
    console.log(`   npm run test:env SIT2 -- -g "${testName}"`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
