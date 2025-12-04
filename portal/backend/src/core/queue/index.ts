import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { getNextQueuedRun, countRunningRuns } from '../../db/models/runs.js';
import { executeRun } from '../executor/index.js';

// Queue processor state
let isProcessing = false;
let processorInterval: NodeJS.Timeout | null = null;

// How often to check for new runs (in milliseconds)
const QUEUE_CHECK_INTERVAL = 5000;

/**
 * Start the queue processor
 */
export function startQueueProcessor(): void {
  if (processorInterval) {
    logger.warn('Queue processor already running');
    return;
  }

  logger.info('🚀 Starting queue processor');
  
  // Process immediately on start
  processQueue();
  
  // Then check periodically
  processorInterval = setInterval(() => {
    processQueue();
  }, QUEUE_CHECK_INTERVAL);
}

/**
 * Stop the queue processor
 */
export function stopQueueProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    logger.info('Queue processor stopped');
  }
}

/**
 * Process the queue - pick up next run if capacity allows
 */
async function processQueue(): Promise<void> {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  try {
    isProcessing = true;

    // Check current capacity
    const runningCount = countRunningRuns();
    if (runningCount >= config.maxConcurrentRuns) {
      logger.debug(`Queue full: ${runningCount}/${config.maxConcurrentRuns} runs active`);
      return;
    }

    // Get next queued run
    const nextRun = getNextQueuedRun();
    if (!nextRun) {
      // No runs in queue
      return;
    }

    logger.info(`Processing run ${nextRun.id} from queue`);

    // Execute the run (don't await - let it run in background)
    executeRun(nextRun).catch(error => {
      logger.error(`Error executing run ${nextRun.id}:`, error);
    });

  } catch (error) {
    logger.error('Error processing queue:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  isProcessing: boolean;
  runningCount: number;
  maxConcurrent: number;
} {
  return {
    isProcessing,
    runningCount: countRunningRuns(),
    maxConcurrent: config.maxConcurrentRuns,
  };
}
