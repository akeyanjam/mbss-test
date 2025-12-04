# MBSS UI Tests

Playwright-based end-to-end tests for MBSS applications.

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all tests with specific environment
npm run test:env SIT1
npm run test:env UAT
npm run test:env PROD

# Run specific test with environment
npm run test:env SIT1 -- -g "basic-login"

# Run all tests (default: SIT1)
npm test

# Run tests in headed mode
npm run test:headed

# Run with Playwright UI
npm run test:ui
```

## Creating a New Test

### Option 1: Record and Convert (Recommended for QA)

1. **Start the recording helper:**
   ```bash
   npm run record
   ```

2. **Follow the prompts** to enter test information

3. **Perform your test actions** in the browser that opens

4. **Close the browser** when done - recording is saved automatically

5. **Copy the dynamic AI prompt** from terminal output and paste into Copilot/Claude

6. **Paste the generated files** into the created test folder

7. **Run your test:**
   ```bash
   # Run with specific environment
   npm run test:env SIT1 -- -g "your-test-name"
   
   # Or run with default environment
   npm test -- -g "your-test-name"
   ```

### Option 2: Manual Creation

1. Create a folder: `src/[feature]/[test-name]/`
2. Create three files:
   - `[test-name].spec.ts` - The test file
   - `meta.json` - Test metadata
   - `constants.json` - Configuration per environment

See `prompts/test-template.md` for the exact structure.

## Project Structure

```
tests/
├── src/                          # Test source files
│   ├── login/                    # Feature: Login
│   │   └── basic-login/         # Test folder
│   │       ├── basic-login.spec.ts
│   │       ├── meta.json
│   │       └── constants.json
│   │
│   └── shared/                   # Shared utilities (NOT tests)
│       ├── fixtures/            # Playwright fixtures
│       │   └── base.fixture.ts  # Config injection
│       ├── helpers/             # Reusable functions
│       │   └── auth.helper.ts   # Login/logout helpers
│       └── page-objects/        # Page Object Models
│           └── login.page.ts
│
├── scripts/                      # Build & utility scripts
│   ├── record.js                # Recording helper
│   └── build-tests.js           # Build for deployment
│
├── prompts/                      # Copilot/AI prompts
│   ├── convert-recording.md     # Convert recording to test
│   └── test-template.md         # Barebone test structure
│
├── recordings/                   # Saved recordings (gitignored)
├── playwright.config.ts          # Local dev config
├── package.json
└── tsconfig.json
```

## Test File Structure

### Spec File (`[test-name].spec.ts`)

```typescript
import { test, expect, logStep } from '../../shared/fixtures/base.fixture.js';

test('test-name', async ({ page, config }) => {
  logStep(`Starting test in environment: ${config.envCode}`);
  
  // Use config values - never hardcode!
  await page.goto(config.baseUrl);
  await page.fill('#username', config.username);
  
  logStep('Test completed successfully');
});
```

### meta.json

```json
{
  "testKey": "test-name",
  "friendlyName": "Human Readable Name",
  "description": "What this test verifies",
  "tags": ["feature", "smoke"]
}
```

### constants.json

```json
{
  "shared": {
    "timeoutMs": 30000
  },
  "environments": {
    "SIT1": { "baseUrl": "...", "username": "...", "password": "..." },
    "SIT2": { "baseUrl": "...", "username": "...", "password": "..." },
    "UAT": { "baseUrl": "...", "username": "...", "password": "..." },
    "PROD": { "baseUrl": "...", "username": "...", "password": "..." }
  }
}
```

## Running Tests

### Local Development

```bash
# Run all tests (default: SIT1)
npm test

# Run against specific environment
TEST_ENV=SIT2 npm test

# Run specific test
npm test -- --grep "basic-login"

# Run in headed mode (see browser)
npm run test:headed

# Run with Playwright UI
npm run test:ui

# Debug mode
npm run test:debug
```

### Via MBSS Portal

When tests run via the portal:
- Config is injected via `MBSS_TEST_CONFIG` environment variable
- Portal handles environment selection
- Results stream back via WebSocket

## Key Rules

1. **One test per file** - Each spec file has exactly one `test()` block
2. **Use config values** - Never hardcode URLs, credentials, or test data
3. **Use logStep()** - Before every significant action (visible in portal)
4. **File naming** - Folder name matches spec file: `basic-login/basic-login.spec.ts`
5. **Use shared utilities** - Check `helpers/` and `page-objects/` before writing new code

## Available Utilities

### Fixtures

```typescript
import { test, expect, logStep, logInfo, logWarn } from '../../shared/fixtures/base.fixture.js';

// test - Extended with config injection
// expect - Playwright assertions
// logStep(msg) - Log test step
// logInfo(msg) - Log info
// logWarn(msg) - Log warning
```

### Helpers

```typescript
import { login, logout, isLoggedIn } from '../../shared/helpers/auth.helper.js';

await login(page, { baseUrl: config.baseUrl, username: config.username, password: config.password });
await logout(page);
const loggedIn = await isLoggedIn(page);
```

### Page Objects

```typescript
import { LoginPage } from '../../shared/page-objects/login.page.js';

const loginPage = new LoginPage(page);
await loginPage.goto(config.baseUrl);
await loginPage.fillCredentials(config.username, config.password);
await loginPage.submit();
```

## Building for Deployment

```bash
npm run build
```

This compiles TypeScript and copies JSON files to `../../dist/tests/` for portal deployment.

## Troubleshooting

### "Cannot find module" errors
Run `npm install` to install dependencies.

### Tests fail with timeout
- Check if the target environment is accessible
- Increase `timeoutMs` in constants.json
- Run in headed mode to see what's happening

### Config not loading
- Ensure `constants.json` exists in the test folder
- Check JSON syntax is valid
- Verify environment code matches (SIT1, SIT2, UAT, PROD)
