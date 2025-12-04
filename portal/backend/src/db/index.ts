import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { runMigrations } from './migrations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

/**
 * Initialize the database connection and run migrations
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = resolve(__dirname, '../..', config.databasePath);
  logger.info(`📦 Initializing SQLite database at: ${dbPath}`);

  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Run migrations
  runMigrations(db);

  logger.info('✅ Database initialized successfully');
  return db;
}

/**
 * Get the database instance (must call initDatabase first)
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

export { db };
