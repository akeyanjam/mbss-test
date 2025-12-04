import { getDb } from '../db/index.js';
import { logger } from '../utils/logger.js';

/**
 * Clean up orphaned runs on startup
 * Marks any runs that were running or queued as failed
 * This handles cases where the server crashed or was stopped while tests were running
 */
export function cleanupOrphanedRuns(): void {
  const db = getDb();
  
  try {
    // Find all runs that are in running or queued state
    const orphanedRuns = db.prepare(`
      SELECT id, status FROM runs 
      WHERE status IN ('running', 'queued')
    `).all() as Array<{ id: string; status: string }>;

    if (orphanedRuns.length === 0) {
      logger.info('✅ No orphaned runs found');
      return;
    }

    logger.info(`🧹 Found ${orphanedRuns.length} orphaned run(s), marking as failed...`);

    const now = new Date().toISOString();

    // Use a transaction to update all orphaned runs
    const transaction = db.transaction(() => {
      for (const run of orphanedRuns) {
        // Mark the run as failed
        db.prepare(`
          UPDATE runs 
          SET status = 'failed', 
              finished_at = ?
          WHERE id = ?
        `).run(now, run.id);

        // Mark all pending or running tests in this run as failed
        db.prepare(`
          UPDATE run_tests 
          SET status = 'failed',
              finished_at = ?,
              error_message = 'Test execution interrupted by server restart'
          WHERE run_id = ? 
            AND status IN ('pending', 'running')
        `).run(now, run.id);

        logger.info(`  ❌ Marked run ${run.id} (was ${run.status}) as failed`);
      }
    });

    transaction();
    logger.info('✅ Orphaned runs cleanup complete');
  } catch (error) {
    logger.error('Failed to cleanup orphaned runs:', error);
    // Don't throw - we want the server to start even if cleanup fails
  }
}
