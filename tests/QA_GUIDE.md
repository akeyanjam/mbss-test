# QA Test Authoring Guide

Welcome! This guide shows the fastest path for QA to create automated UI tests.

## 🎯 Quick Reference

```bash
# Create a new test
npm run record

# Run test with specific environment
npm run test:env SIT1 -- -g "test-name"
npm run test:env UAT -- -g "test-name"

# Run with visible browser
npm run test:headed

# Debug mode
npm run test:debug
```

---

## 🚀 Getting Started

### First-Time Setup

```bash
cd tests
npm install
npx playwright install
```

---

## 📝 Create a New Test (Record → Generate → Run)

### 1) Start the Recorder

```bash
npm run record
```

You'll be asked for:
- Feature folder (e.g., `login` or `transfers/domestic`)
- Test name (e.g., `basic-login`)
- Friendly name, Description, Tags
- Base URL to record against

The tool will create the target folder and placeholder files automatically.

### 2) Record Your Flow

1. A browser opens
2. Perform the steps you want automated
3. **IMPORTANT**: Before closing the browser, click on an element that indicates success (e.g., dashboard heading, user menu, success message)
   - This final click will be converted into an assertion in your test
4. Close the browser when done

The recording is saved to `recordings/[test-name]-recording.ts`.

### 3) Copy the Dynamic AI Prompt

After recording, the terminal prints a pre-filled prompt containing:
- Exact target paths already created (spec/meta/constants)
- Your metadata (name, description, tags)
- The full recorded script

Copy that prompt and paste it into Copilot/Claude. The model will return:
- A complete `[test-name].spec.ts` with exactly one test()
- `meta.json`
- `constants.json` with extracted values/placeholders

Paste the generated files into the already-created folder when prompted.

### 4) Run Your Test

```bash
# Run with specific environment (SIT1, SIT2, UAT, PROD)
npm run test:env SIT1

# Run specific test with environment (use -g to filter by name)
npm run test:env UAT -- -g "basic-login"

# Run specific test file with environment
npm run test:env PROD -- src/auth/basic-login/basic-login.spec.ts

# Run with default environment (SIT1)
npm test

# Run with visible browser
npm run test:headed
```

---

## 📁 Test Structure

Every test lives in its own folder with exactly 3 files:

```
src/
└── [feature]/
    └── [test-name]/
        ├── [test-name].spec.ts   # The test code
        ├── meta.json             # Test metadata
        └── constants.json        # Environment configs
```

### meta.json
```json
{
  "testKey": "basic-login",
  "friendlyName": "Basic Login Flow",
  "description": "Verifies user can log in with valid credentials",
  "tags": ["login", "smoke", "critical"]
}
```

### constants.json
```json
{
  "shared": {
    "timeoutMs": 30000
  },
  "environments": {
    "SIT1": {
      "baseUrl": "https://sit1.example.com",
      "username": "qa.user@bofa.com",
      "password": "password123"
    },
    "SIT2": { ... },
    "UAT": { ... },
    "PROD": { ... }
  }
}
```

---

## 🌍 Understanding Environments

Your test can run against different environments (SIT1, SIT2, UAT, PROD). Each environment has its own configuration in `constants.json`:

```json
{
  "shared": { "timeoutMs": 30000 },
  "environments": {
    "SIT1": {
      "baseUrl": "https://sit1.example.com",
      "username": "qa.user@bofa.com",
      "password": "password123"
    },
    "UAT": {
      "baseUrl": "https://uat.example.com",
      "username": "qa.user@bofa.com",
      "password": "uatPassword456"
    }
  }
}
```

**How to select an environment:**

```bash
# Use the test:env command (RECOMMENDED)
npm run test:env UAT

# Or set TEST_ENV manually
TEST_ENV=UAT npm test
```

The base fixture automatically loads the correct environment config based on `TEST_ENV` (defaults to `SIT1`).

---

## ✅ Rules (Keep It Simple)

- One test per file (exactly one `test()` block)
- Do not hardcode URLs/credentials; put them in `constants.json`
- Keep steps inline (no shared helpers required)
- Match folder/file names: `basic-login/basic-login.spec.ts`

---

## 🔧 Running Tests

### Local Development

```bash
# Run all tests with specific environment (RECOMMENDED)
npm run test:env SIT1
npm run test:env SIT2
npm run test:env UAT
npm run test:env PROD

# Run specific test with environment (use -g to filter by name)
npm run test:env UAT -- -g "basic-login"

# Run specific test file with environment
npm run test:env PROD -- src/auth/basic-login/basic-login.spec.ts

# Run all tests (default: SIT1)
npm test

# Run specific test by name
npm test -- -g "basic-login"

# Run with visible browser
npm run test:headed

# Debug mode (step through)
npm run test:debug

# Playwright UI (interactive)
npm run test:ui
```

### Via MBSS Portal

When triggered from the dashboard, the portal selects the environment, injects config, streams logs/screenshots, and stores artifacts.

---

---

## 📋 Minimal Example (Using Base Fixture)

```typescript
import { test, expect } from '../../shared/fixtures/base.fixture.js';

test('basic-login', async ({ page, config }) => {
  // Config is automatically loaded from constants.json
  // Based on TEST_ENV (defaults to SIT1)
  
  // Navigate to login page
  await page.goto(config.baseUrl);
  await page.waitForLoadState('networkidle');

  // Fill credentials from config
  await page.fill('#username', config.username!);
  await page.fill('#password', config.password!);
  
  // Submit and wait
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  
  // Assert success
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
});
```

---

## ❓ Troubleshooting

### Test can't find elements
- Run in headed mode: `npm run test:headed`
- Check if selectors changed
- Use `data-testid` attributes when possible

### Test times out
- Increase `timeoutMs` in `constants.json`
- Check if environment is accessible
- Add `await page.waitForLoadState('networkidle')`

### Config not loading
- Verify `constants.json` exists in test folder
- Check JSON syntax (use a validator)
- Ensure environment code matches exactly: `SIT1`, `SIT2`, `UAT`, `PROD`

### Import errors
- Always use `.js` extension: `import { x } from './file.js'`
- Run `npm install` if modules missing

---

## 📞 Need Help?

- Check existing tests in `src/` for examples
- Ask in the QA Teams channel
