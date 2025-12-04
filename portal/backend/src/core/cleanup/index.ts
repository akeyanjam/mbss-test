import { existsSync, rmSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { deleteOldRuns, getOldRunIds } from '../../db/models/runs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cleanup worker state
let cleanupInterval: NodeJS.Timeout | null = null;

// How often to run cleanup (in milliseconds) - once per hour
const CLEANUP_INTERVAL = 60 * 60 * 1000;

/**
 * Start the cleanup worker
 */
export function startCleanupWorker(): void {
  if (cleanupInterval) {
    logger.warn('Cleanup worker already running');
    return;
  }

  logger.info('🧹 Starting cleanup worker');
  
  // Run cleanup on start (delayed by 1 minute to let other services initialize)
  setTimeout(() => {
    runCleanup();
  }, 60000);
  
  // Then run periodically
  cleanupInterval = setInterval(() => {
    runCleanup();
  }, CLEANUP_INTERVAL);
}

/**
 * Stop the cleanup worker
 */
export function stopCleanupWorker(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('Cleanup worker stopped');
  }
}

/**
 * Run cleanup - delete old runs and their artifacts
 */
export function runCleanup(): void {
  logger.info('Running cleanup...');

  try {
    const retentionDays = config.retentionDays;
    
    // Get run IDs that will be deleted (for artifact cleanup)
    const oldRunIds = getOldRunIds(retentionDays);
    
    if (oldRunIds.length === 0) {
      logger.info('No old runs to clean up');
      return;
    }

    logger.info(`Found ${oldRunIds.length} run(s) older than ${retentionDays} days`);

    // Delete artifacts first
    const artifactRoot = resolve(__dirname, '../../..', config.artifactRoot);
    let artifactsDeleted = 0;

    for (const runId of oldRunIds) {
      const runArtifactDir = join(artifactRoot, runId);
      if (existsSync(runArtifactDir)) {
        try {
          rmSync(runArtifactDir, { recursive: true, force: true });
          artifactsDeleted++;
        } catch (error) {
          logger.error(`Failed to delete artifacts for run ${runId}:`, error);
        }
      }
    }

    // Delete database records
    const deletedRuns = deleteOldRuns(retentionDays);

    logger.info(`Cleanup complete: deleted ${deletedRuns} run(s) and ${artifactsDeleted} artifact folder(s)`);

    // Also clean up orphaned artifact folders (folders without DB records)
    cleanupOrphanedArtifacts(artifactRoot);

  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

/**
 * Clean up artifact folders that don't have corresponding DB records
 */
function cleanupOrphanedArtifacts(artifactRoot: string): void {
  if (!existsSync(artifactRoot)) {
    return;
  }

  try {
    const folders = readdirSync(artifactRoot, { withFileTypes: true });
    let orphansDeleted = 0;

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;

      // Check if this looks like a UUID (run ID)
      const folderName = folder.name;
      if (!isUuidLike(folderName)) continue;

      // Check if run exists in DB
      const { getRunById } = require('../../db/models/runs.js');
      const run = getRunById(folderName);

      if (!run) {
        // Orphaned folder - delete it
        const folderPath = join(artifactRoot, folderName);
        try {
          rmSync(folderPath, { recursive: true, force: true });
          orphansDeleted++;
          logger.debug(`Deleted orphaned artifact folder: ${folderName}`);
        } catch (error) {
          logger.error(`Failed to delete orphaned folder ${folderName}:`, error);
        }
      }
    }

    if (orphansDeleted > 0) {
      logger.info(`Deleted ${orphansDeleted} orphaned artifact folder(s)`);
    }
  } catch (error) {
    logger.error('Error cleaning up orphaned artifacts:', error);
  }
}

/**
 * Check if a string looks like a UUID
 */
function isUuidLike(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Get cleanup status
 */
export function getCleanupStatus(): {
  retentionDays: number;
  lastRun: Date | null;
} {
  return {
    retentionDays: config.retentionDays,
    lastRun: null, // Could track this if needed
  };
}
