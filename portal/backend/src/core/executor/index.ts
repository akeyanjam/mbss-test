import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, appendFileSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type BrowserContext } from 'playwright';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Safely append to a file, creating directory and file if needed
 */
function safeAppendFileSync(filePath: string, data: string): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '');
    }
    appendFileSync(filePath, data);
  } catch (error) {
    logger.error(`Failed to append to file ${filePath}:`, error);
  }
}
import { getTestByKey } from '../../db/models/tests.js';
import { 
  updateRunStatus, 
  updateRunSummary, 
  updateRunTestStatus, 
  getRunTests,
  skipPendingTests,
  getRunById
} from '../../db/models/runs.js';
import type { Run, RunTest, TestDefinition, RunSummary, TestArtifacts } from '../../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Screenshot interval in milliseconds
const SCREENSHOT_INTERVAL = 5000;

/**
 * Execute a run (all tests in the run)
 */
export async function executeRun(run: Run): Promise<void> {
  logger.info(`Starting execution of run ${run.id} for environment ${run.environment}`);

  // Update run status to running
  updateRunStatus(run.id, 'running');

  const artifactRoot = resolve(__dirname, '../../..', config.artifactRoot);
  const testRoot = resolve(__dirname, '../../..', config.testRoot);

  // Create artifact directory for this run
  const runArtifactDir = join(artifactRoot, run.id);
  if (!existsSync(runArtifactDir)) {
    mkdirSync(runArtifactDir, { recursive: true });
  }

  let browser: Browser | null = null;
  const summary: RunSummary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
  };

  const startTime = Date.now();

  try {
    // Launch browser
    logger.info(`Launching browser for run ${run.id}`);
    browser = await chromium.launch({
      headless: true,
    });

    // Get all tests for this run
    const runTests = getRunTests(run.id);
    summary.totalTests = runTests.length;

    // Execute each test sequentially
    for (const runTest of runTests) {
      // Check if run was cancelled
      const currentRun = getRunById(run.id);
      if (currentRun?.status === 'cancelled') {
        logger.info(`Run ${run.id} was cancelled, stopping execution`);
        skipPendingTests(run.id);
        break;
      }

      await executeTest(browser, run, runTest, testRoot, runArtifactDir, summary);
    }

    // Calculate final status
    summary.durationMs = Date.now() - startTime;
    
    const finalStatus = summary.failed > 0 ? 'failed' : 
                        summary.passed === summary.totalTests ? 'passed' : 
                        'passed'; // If some skipped but none failed

    // Update run with summary
    updateRunSummary(run.id, summary);
    updateRunStatus(run.id, finalStatus);

    logger.info(`Run ${run.id} completed: ${finalStatus} (${summary.passed}/${summary.totalTests} passed)`);

  } catch (error) {
    logger.error(`Run ${run.id} failed with error:`, error);
    summary.durationMs = Date.now() - startTime;
    updateRunSummary(run.id, summary);
    updateRunStatus(run.id, 'failed');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Execute a single test
 */
async function executeTest(
  browser: Browser,
  run: Run,
  runTest: RunTest,
  testRoot: string,
  runArtifactDir: string,
  summary: RunSummary
): Promise<void> {
  const testKey = runTest.testKey;
  logger.info(`Executing test: ${testKey}`);

  // Get test definition
  const testDef = getTestByKey(testKey);
  if (!testDef) {
    logger.error(`Test definition not found for ${testKey}`);
    updateRunTestStatus(run.id, testKey, 'skipped', {
      errorMessage: 'Test definition not found',
    });
    summary.skipped++;
    return;
  }

  // Create artifact directory for this test
  const testArtifactDir = join(runArtifactDir, testKey);
  if (!existsSync(testArtifactDir)) {
    mkdirSync(testArtifactDir, { recursive: true });
  }

  // Update test status to running
  updateRunTestStatus(run.id, testKey, 'running');

  const testStartTime = Date.now();
  let context: BrowserContext | null = null;
  let screenshotInterval: NodeJS.Timeout | null = null;

  try {
    // Build effective config for this test
    const effectiveConfig = buildEffectiveConfig(testDef, run);

    // Create browser context with video recording
    context = await browser.newContext({
      recordVideo: {
        dir: testArtifactDir,
        size: { width: 1280, height: 720 },
      },
    });

    // Create page
    const page = await context.newPage();

    // Set up log file
    const logPath = join(testArtifactDir, 'console.log');
    writeFileSync(logPath, `[${new Date().toISOString()}] Starting test: ${testKey}\n`);
    writeFileSync(logPath, `[${new Date().toISOString()}] Environment: ${run.environment}\n`, { flag: 'a' });

    // Set up console log capture
    page.on('console', msg => {
      const logLine = `[${new Date().toISOString()}] [CONSOLE] ${msg.type()}: ${msg.text()}\n`;
      appendFileSync(logPath, logLine);
    });

    // Set up periodic screenshots
    const liveScreenshotPath = join(testArtifactDir, 'live.jpg');
    screenshotInterval = setInterval(async () => {
      try {
        await page.screenshot({ path: liveScreenshotPath, type: 'jpeg', quality: 80 });
      } catch {
        // Page might be navigating, ignore errors
      }
    }, SCREENSHOT_INTERVAL);

    // Run the test using Playwright CLI
    const specPath = join(testRoot, testDef.specPath);
    
    appendFileSync(logPath, `[${new Date().toISOString()}] Running spec: ${specPath}\n`);

    // Execute test via child process
    const result = await runPlaywrightTest(specPath, effectiveConfig, logPath, testArtifactDir);

    // Stop screenshot interval
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
      screenshotInterval = null;
    }

    // Clean up live screenshot
    if (existsSync(liveScreenshotPath)) {
      unlinkSync(liveScreenshotPath);
    }

    // Close context to finalize video
    await context.close();
    context = null;

    // Find video file
    const videoFile = findVideoFile(testArtifactDir);

    const durationMs = Date.now() - testStartTime;
    const artifacts: TestArtifacts = {
      consoleLog: 'console.log',
      video: videoFile,
    };

    if (result.success) {
      appendFileSync(logPath, `[${new Date().toISOString()}] Test PASSED\n`);
      updateRunTestStatus(run.id, testKey, 'passed', { durationMs, artifacts });
      summary.passed++;
    } else {
      appendFileSync(logPath, `[${new Date().toISOString()}] Test FAILED: ${result.error}\n`);
      updateRunTestStatus(run.id, testKey, 'failed', {
        durationMs,
        errorMessage: result.error ?? 'Unknown error',
        artifacts,
      });
      summary.failed++;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Test ${testKey} failed:`, error);

    const durationMs = Date.now() - testStartTime;
    updateRunTestStatus(run.id, testKey, 'failed', {
      durationMs,
      errorMessage,
    });
    summary.failed++;

  } finally {
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
    }
    if (context) {
      await context.close();
    }
  }
}

/**
 * Build effective configuration for a test run
 */
function buildEffectiveConfig(testDef: TestDefinition, run: Run): Record<string, any> {
  const env = run.environment;
  
  // Start with shared constants
  const config: Record<string, any> = {
    envCode: env,
    ...(testDef.constants.shared || {}),
  };

  // Add environment-specific constants
  if (testDef.constants.environments?.[env]) {
    Object.assign(config, testDef.constants.environments[env]);
  }

  // Add test-level overrides (shared)
  if (testDef.overrides) {
    if (testDef.overrides.shared) {
      Object.assign(config, testDef.overrides.shared);
    }
    // Add test-level environment-specific overrides
    if (testDef.overrides.environments?.[env]) {
      Object.assign(config, testDef.overrides.environments[env]);
    }
  }

  // Add run-level overrides
  if (run.runOverrides) {
    Object.assign(config, run.runOverrides);
  }

  return config;
}

/**
 * Run a Playwright test via CLI
 */
async function runPlaywrightTest(
  specPath: string,
  config: Record<string, any>,
  logPath: string,
  outputDir: string
): Promise<{ success: boolean; error?: string }> {
  // Compute cwd before entering Promise to avoid shadowing `resolve`
  const cwd = resolve(__dirname, '../../..');
  
  // Ensure log directory exists and create log file
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  
  // Create log file if it doesn't exist
  if (!existsSync(logPath)) {
    writeFileSync(logPath, '');
  }
  
  return new Promise((promiseResolve) => {
    const env = {
      ...process.env,
      MBSS_TEST_CONFIG: JSON.stringify(config),
    };

    // Use npx playwright test
    const args = ['playwright', 'test', specPath, '--reporter=line', `--output=${outputDir}`];

    safeAppendFileSync(logPath, `[${new Date().toISOString()}] Executing: npx ${args.join(' ')}\n`);

    const child: ChildProcess = spawn('npx', args, {
      env,
      shell: true,
      cwd,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      safeAppendFileSync(logPath, text);
    });

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      safeAppendFileSync(logPath, `[STDERR] ${text}`);
    });

    child.on('close', (code: number | null) => {
      safeAppendFileSync(logPath, `[${new Date().toISOString()}] Process exited with code ${code}\n`);
      
      if (code === 0) {
        promiseResolve({ success: true });
      } else {
        promiseResolve({ 
          success: false, 
          error: stderr || stdout || `Process exited with code ${code}` 
        });
      }
    });

    child.on('error', (error: Error) => {
      safeAppendFileSync(logPath, `[${new Date().toISOString()}] Process error: ${error.message}\n`);
      promiseResolve({ success: false, error: error.message });
    });
  });
}

/**
 * Find video file in artifact directory
 */
function findVideoFile(dir: string): string | undefined {
  const { readdirSync } = require('fs');
  try {
    const files = readdirSync(dir) as string[];
    const videoFile = files.find((f: string) => f.endsWith('.webm') || f.endsWith('.mp4'));
    return videoFile;
  } catch {
    return undefined;
  }
}
