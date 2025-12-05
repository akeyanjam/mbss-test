import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

interface Migration {
  version: number;
  name: string;
  up: string;
}

/**
 * All migrations in order. Each migration should be idempotent where possible.
 * Never modify existing migrations - always add new ones.
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Test definitions table
      CREATE TABLE IF NOT EXISTS test_definitions (
        id TEXT PRIMARY KEY,
        test_key TEXT UNIQUE NOT NULL,
        folder_path TEXT NOT NULL,
        spec_path TEXT NOT NULL,
        meta TEXT NOT NULL,           -- JSON: { testKey, friendlyName, description, tags }
        constants TEXT NOT NULL,      -- JSON: { shared, environments }
        overrides TEXT,               -- JSON: optional overrides
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_test_definitions_test_key ON test_definitions(test_key);
      CREATE INDEX IF NOT EXISTS idx_test_definitions_active ON test_definitions(active);

      -- Runs table
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'queued',  -- queued, running, passed, failed, skipped, cancelled
        trigger_type TEXT NOT NULL,              -- manual, schedule
        environment TEXT NOT NULL,
        schedule_id TEXT,
        triggered_by_email TEXT,
        run_overrides TEXT,                      -- JSON
        started_at TEXT,
        finished_at TEXT,
        summary TEXT,                            -- JSON: { totalTests, passed, failed, skipped, durationMs }
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_environment ON runs(environment);
      CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);

      -- Run tests table (individual test results within a run)
      CREATE TABLE IF NOT EXISTS run_tests (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        test_id TEXT NOT NULL,
        test_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, passed, failed, skipped
        duration_ms INTEGER,
        error_message TEXT,
        artifacts TEXT,                          -- JSON: { video, trace, consoleLog, screenshots }
        started_at TEXT,
        finished_at TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
        FOREIGN KEY (test_id) REFERENCES test_definitions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_run_tests_run_id ON run_tests(run_id);
      CREATE INDEX IF NOT EXISTS idx_run_tests_test_id ON run_tests(test_id);
      CREATE INDEX IF NOT EXISTS idx_run_tests_status ON run_tests(status);

      -- Schedules table
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        environment TEXT NOT NULL,
        last_triggered_at TEXT,
        selector TEXT NOT NULL,                  -- JSON: { type, folderPrefix/tags/testKeys }
        default_run_overrides TEXT,              -- JSON
        created_by_email TEXT,
        updated_by_email TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
      CREATE INDEX IF NOT EXISTS idx_schedules_environment ON schedules(environment);

      -- System settings table (key-value store)
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Insert default settings
      INSERT OR IGNORE INTO system_settings (key, value) VALUES ('retention_days', '30');
    `,
  },
  {
    version: 2,
    name: 'add_run_metadata',
    up: `
      -- Add metadata column to runs table to store selection criteria
      ALTER TABLE runs ADD COLUMN metadata TEXT;
    `,
  },
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get current version
  const currentVersion = db.prepare(
    'SELECT MAX(version) as version FROM schema_migrations'
  ).get() as { version: number | null };

  const appliedVersion = currentVersion?.version || 0;
  logger.info(`Current database schema version: ${appliedVersion}`);

  // Apply pending migrations
  const pendingMigrations = migrations.filter(m => m.version > appliedVersion);

  if (pendingMigrations.length === 0) {
    logger.info('Database schema is up to date');
    return;
  }

  logger.info(`Applying ${pendingMigrations.length} pending migration(s)...`);

  for (const migration of pendingMigrations) {
    logger.info(`  Applying migration ${migration.version}: ${migration.name}`);
    
    const transaction = db.transaction(() => {
      // Run the migration SQL
      db.exec(migration.up);
      
      // Record the migration
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      ).run(migration.version, migration.name);
    });

    try {
      transaction();
      logger.info(`  ✅ Migration ${migration.version} applied successfully`);
    } catch (error) {
      logger.error(`  ❌ Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  logger.info('All migrations applied successfully');
}

/**
 * Get current schema version
 */
export function getSchemaVersion(db: Database.Database): number {
  try {
    const result = db.prepare(
      'SELECT MAX(version) as version FROM schema_migrations'
    ).get() as { version: number | null };
    return result?.version || 0;
  } catch {
    return 0;
  }
}
