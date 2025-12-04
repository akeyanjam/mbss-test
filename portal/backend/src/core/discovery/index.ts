import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { upsertTest, deactivateTestsNotIn } from '../../db/models/tests.js';
import type { DiscoveredTest, TestMeta, TestConstants } from '../../types/index.js';

/**
 * Discover all tests from the test root directory.
 * 
 * Expected structure:
 * testRoot/
 *   category/
 *     test-name/
 *       test-name.spec.js
 *       meta.json
 *       constants.json
 */
export function discoverTests(): DiscoveredTest[] {
  const testRoot = config.testRoot;
  
  if (!existsSync(testRoot)) {
    logger.warn(`Test root directory not found: ${testRoot}`);
    return [];
  }

  logger.info(`🔍 Discovering tests in: ${testRoot}`);
  const discovered: DiscoveredTest[] = [];

  // Recursively scan directories
  scanDirectory(testRoot, testRoot, discovered);

  logger.info(`📋 Discovered ${discovered.length} test(s)`);
  return discovered;
}

/**
 * Recursively scan a directory for test folders
 */
function scanDirectory(dir: string, testRoot: string, discovered: DiscoveredTest[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = join(dir, entry.name);
    
    // Check if this directory is a test folder (has meta.json and a spec file)
    if (isTestFolder(fullPath)) {
      const test = parseTestFolder(fullPath, testRoot);
      if (test) {
        discovered.push(test);
      }
    } else {
      // Recurse into subdirectory
      scanDirectory(fullPath, testRoot, discovered);
    }
  }
}

/**
 * Check if a directory is a test folder
 */
function isTestFolder(dir: string): boolean {
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(metaPath)) return false;

  // Check for a .spec.js file
  const entries = readdirSync(dir);
  return entries.some(e => e.endsWith('.spec.js'));
}

/**
 * Parse a test folder and extract test information
 */
function parseTestFolder(dir: string, testRoot: string): DiscoveredTest | null {
  try {
    // Read meta.json
    const metaPath = join(dir, 'meta.json');
    const metaContent = readFileSync(metaPath, 'utf-8');
    const meta = JSON.parse(metaContent) as TestMeta;

    // Validate meta
    if (!meta.testKey || !meta.friendlyName) {
      logger.warn(`Invalid meta.json in ${dir}: missing testKey or friendlyName`);
      return null;
    }

    // Read constants.json
    const constantsPath = join(dir, 'constants.json');
    let constants: TestConstants = {};
    if (existsSync(constantsPath)) {
      const constantsContent = readFileSync(constantsPath, 'utf-8');
      constants = JSON.parse(constantsContent) as TestConstants;
    }

    // Find the spec file
    const entries = readdirSync(dir);
    const specFile = entries.find(e => e.endsWith('.spec.js'));
    if (!specFile) {
      logger.warn(`No .spec.js file found in ${dir}`);
      return null;
    }

    // Calculate relative paths
    const folderPath = relative(testRoot, dir).replace(/\\/g, '/');
    const specPath = join(folderPath, specFile).replace(/\\/g, '/');

    logger.debug(`  Found test: ${meta.testKey} at ${folderPath}`);

    return {
      folderPath,
      specPath,
      meta,
      constants,
    };
  } catch (error) {
    logger.error(`Error parsing test folder ${dir}:`, error);
    return null;
  }
}

/**
 * Run discovery and sync with database.
 * This should be called on application startup.
 */
export function runDiscoveryAndSync(): void {
  logger.info('🚀 Starting test discovery and database sync...');

  // Discover tests from filesystem
  const discovered = discoverTests();

  if (discovered.length === 0) {
    logger.warn('No tests discovered. Database will not be modified.');
    return;
  }

  // Upsert each discovered test
  const testKeys: string[] = [];
  for (const test of discovered) {
    try {
      upsertTest(test);
      testKeys.push(test.meta.testKey);
    } catch (error) {
      logger.error(`Failed to upsert test ${test.meta.testKey}:`, error);
    }
  }

  // Deactivate tests not found in filesystem
  const deactivated = deactivateTestsNotIn(testKeys);
  if (deactivated > 0) {
    logger.info(`🗑️  Deactivated ${deactivated} test(s) not found in filesystem`);
  }

  logger.info('✅ Test discovery and sync complete');
}

/**
 * Get test root path (resolved)
 */
export function getTestRootPath(): string {
  return config.testRoot;
}

/**
 * Check if test root exists
 */
export function testRootExists(): boolean {
  return existsSync(config.testRoot);
}
