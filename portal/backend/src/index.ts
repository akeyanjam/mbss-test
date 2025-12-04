import express from 'express';
import cors from 'cors';
import { config, environments } from './config/index.js';
import { logger } from './utils/logger.js';
import { initDatabase, closeDatabase } from './db/index.js';
import { runDiscoveryAndSync, testRootExists } from './core/discovery/index.js';
import { startQueueProcessor, stopQueueProcessor } from './core/queue/index.js';
import { startScheduler, stopScheduler } from './core/scheduler/index.js';
import { startCleanupWorker, stopCleanupWorker } from './core/cleanup/index.js';
import { cleanupOrphanedRuns } from './core/startup-cleanup.js';
import apiRouter, { artifactsRouter } from './api/index.js';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environments: environments.map(e => e.code),
  });
});

// API routes
app.use('/api', apiRouter);
app.use('/artifacts', artifactsRouter);

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down...');
  stopQueueProcessor();
  stopScheduler();
  stopCleanupWorker();
  closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    // Initialize database (runs migrations)
    logger.info('Initializing database...');
    initDatabase();

    // Clean up orphaned runs from previous crashes/restarts
    cleanupOrphanedRuns();

    // Check test root
    if (!testRootExists()) {
      logger.warn(`⚠️  Test root directory not found: ${config.testRoot}`);
      logger.warn('   Tests will not be discovered until the directory exists.');
    } else {
      // Run test discovery and sync
      runDiscoveryAndSync();
    }

    // Start background workers
    startQueueProcessor();
    startScheduler();
    startCleanupWorker();

    // Start HTTP server
    const PORT = config.port;
    app.listen(PORT, () => {
      logger.info(`🚀 MBSS Portal Backend running on http://localhost:${PORT}`);
      logger.info(`📁 Test root: ${config.testRoot}`);
      logger.info(`📦 Artifact root: ${config.artifactRoot}`);
      logger.info(`🗄️  Database: ${config.databasePath}`);
      logger.info(`🌍 Environments: ${environments.map(e => e.code).join(', ')}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
