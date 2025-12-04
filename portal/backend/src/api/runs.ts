import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
  getRuns, 
  getRunById, 
  getRunWithTests, 
  getRunTests, 
  getRunTest,
  createRun, 
  cancelRun 
} from '../db/models/runs.js';
import { getTestsByKeys } from '../db/models/tests.js';
import { config, hasEnvironmentAccess, isValidEnvironment } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { CreateRunRequest, RunStatus, LogsResponse } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

/**
 * GET /api/runs
 * List runs with optional filters
 * Query params:
 *   - status: filter by status
 *   - environment: filter by environment
 *   - limit: max results (default 50)
 *   - offset: pagination offset
 */
router.get('/', (req, res) => {
  try {
    const { status, environment, limit, offset } = req.query;

    const runs = getRuns({
      status: status as RunStatus | undefined,
      environment: environment as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      runs,
      count: runs.length,
    });
  } catch (error) {
    logger.error('Error fetching runs:', error);
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});

/**
 * POST /api/runs
 * Create a new manual run
 */
router.post('/', (req, res) => {
  try {
    const body = req.body as CreateRunRequest;
    const { testKeys, environment, userEmail, overrides } = body;

    // Validate required fields
    if (!testKeys || !Array.isArray(testKeys) || testKeys.length === 0) {
      res.status(400).json({ error: 'testKeys is required and must be a non-empty array' });
      return;
    }
    if (!environment) {
      res.status(400).json({ error: 'environment is required' });
      return;
    }
    if (!userEmail) {
      res.status(400).json({ error: 'userEmail is required' });
      return;
    }

    // Validate environment
    if (!isValidEnvironment(environment)) {
      res.status(400).json({ error: `Invalid environment: ${environment}` });
      return;
    }

    // Check user access
    if (!hasEnvironmentAccess(userEmail, environment)) {
      res.status(403).json({ error: `User ${userEmail} does not have access to environment ${environment}` });
      return;
    }

    // Get test definitions
    const tests = getTestsByKeys(testKeys);
    if (tests.length === 0) {
      res.status(400).json({ error: 'No valid tests found for the provided testKeys' });
      return;
    }

    // Warn about missing tests
    const foundKeys = tests.map(t => t.testKey);
    const missingKeys = testKeys.filter(k => !foundKeys.includes(k));
    if (missingKeys.length > 0) {
      logger.warn(`Some tests not found: ${missingKeys.join(', ')}`);
    }

    // Create the run
    const run = createRun({
      triggerType: 'manual',
      environment,
      triggeredByEmail: userEmail,
      runOverrides: overrides,
      testIds: tests.map(t => ({ testId: t.id, testKey: t.testKey })),
    });

    logger.info(`Created run ${run.id} with ${tests.length} test(s) for ${environment} by ${userEmail}`);

    res.status(201).json(run);
  } catch (error) {
    logger.error('Error creating run:', error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

/**
 * GET /api/runs/:runId
 * Get run details with test statuses
 */
router.get('/:runId', (req, res) => {
  try {
    const { runId } = req.params;
    const run = getRunWithTests(runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(run);
  } catch (error) {
    logger.error('Error fetching run:', error);
    res.status(500).json({ error: 'Failed to fetch run' });
  }
});

/**
 * GET /api/runs/:runId/tests
 * Get all tests in a run
 */
router.get('/:runId/tests', (req, res) => {
  try {
    const { runId } = req.params;
    const run = getRunById(runId);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const tests = getRunTests(runId);
    res.json({ tests });
  } catch (error) {
    logger.error('Error fetching run tests:', error);
    res.status(500).json({ error: 'Failed to fetch run tests' });
  }
});

/**
 * GET /api/runs/:runId/tests/:testKey
 * Get a specific test from a run
 */
router.get('/:runId/tests/:testKey', (req, res) => {
  try {
    const { runId, testKey } = req.params;
    const test = getRunTest(runId, testKey);

    if (!test) {
      res.status(404).json({ error: 'Test not found in run' });
      return;
    }

    res.json(test);
  } catch (error) {
    logger.error('Error fetching run test:', error);
    res.status(500).json({ error: 'Failed to fetch run test' });
  }
});

/**
 * GET /api/runs/:runId/tests/:testKey/logs
 * Get logs for a test (supports offset for polling)
 * Query params:
 *   - offset: byte offset to start reading from (default 0)
 */
router.get('/:runId/tests/:testKey/logs', (req, res) => {
  try {
    const { runId, testKey } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;

    const test = getRunTest(runId, testKey);
    if (!test) {
      res.status(404).json({ error: 'Test not found in run' });
      return;
    }

    // Build log file path
    const artifactRoot = resolve(__dirname, '../..', config.artifactRoot);
    const logPath = join(artifactRoot, runId, testKey, 'console.log');

    let content = '';
    let newOffset = offset;
    let finished = false;

    if (existsSync(logPath)) {
      const fullContent = readFileSync(logPath, 'utf-8');
      content = fullContent.slice(offset);
      newOffset = fullContent.length;
    }

    // Check if test is finished
    finished = ['passed', 'failed', 'skipped'].includes(test.status);

    const response: LogsResponse = {
      content,
      offset: newOffset,
      finished,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/runs/:runId/tests/:testKey/screenshot
 * Get the latest live screenshot for a running test
 */
router.get('/:runId/tests/:testKey/screenshot', (req, res) => {
  try {
    const { runId, testKey } = req.params;

    const test = getRunTest(runId, testKey);
    if (!test) {
      res.status(404).json({ error: 'Test not found in run' });
      return;
    }

    // Build screenshot path
    const artifactRoot = resolve(__dirname, '../..', config.artifactRoot);
    const screenshotPath = join(artifactRoot, runId, testKey, 'live.jpg');

    if (!existsSync(screenshotPath)) {
      res.status(404).json({ error: 'No screenshot available' });
      return;
    }

    res.sendFile(screenshotPath);
  } catch (error) {
    logger.error('Error fetching screenshot:', error);
    res.status(500).json({ error: 'Failed to fetch screenshot' });
  }
});

/**
 * POST /api/runs/:runId/cancel
 * Cancel a queued or running run
 */
router.post('/:runId/cancel', (req, res) => {
  try {
    const { runId } = req.params;

    const run = getRunById(runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    if (!['queued', 'running'].includes(run.status)) {
      res.status(400).json({ error: `Cannot cancel run with status: ${run.status}` });
      return;
    }

    const cancelled = cancelRun(runId);
    if (!cancelled) {
      res.status(400).json({ error: 'Failed to cancel run' });
      return;
    }

    logger.info(`Cancelled run ${runId}`);
    res.json({ success: true, message: 'Run cancelled' });
  } catch (error) {
    logger.error('Error cancelling run:', error);
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

export default router;
