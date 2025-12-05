import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import type { Run, RunStatus, RunSummary, RunTest, RunTestStatus, TestArtifacts, RunWithTests } from '../../types/index.js';

// ============================================================================
// Row types (database representation)
// ============================================================================

interface RunRow {
  id: string;
  status: string;
  trigger_type: string;
  environment: string;
  schedule_id: string | null;
  triggered_by_email: string | null;
  run_overrides: string | null;
  metadata: string | null;
  started_at: string | null;
  finished_at: string | null;
  summary: string | null;
  created_at: string;
}

interface RunTestRow {
  id: string;
  run_id: string;
  test_id: string;
  test_key: string;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  artifacts: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ============================================================================
// Conversion helpers
// ============================================================================

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    status: row.status as RunStatus,
    triggerType: row.trigger_type as 'manual' | 'schedule',
    environment: row.environment,
    scheduleId: row.schedule_id || undefined,
    triggeredByEmail: row.triggered_by_email || undefined,
    runOverrides: row.run_overrides ? JSON.parse(row.run_overrides) : undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
    summary: row.summary ? JSON.parse(row.summary) as RunSummary : undefined,
    createdAt: new Date(row.created_at),
  };
}

function rowToRunTest(row: RunTestRow): RunTest {
  return {
    id: row.id,
    runId: row.run_id,
    testId: row.test_id,
    testKey: row.test_key,
    status: row.status as RunTestStatus,
    durationMs: row.duration_ms || undefined,
    errorMessage: row.error_message || undefined,
    artifacts: row.artifacts ? JSON.parse(row.artifacts) as TestArtifacts : undefined,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
  };
}

// ============================================================================
// Run Query functions
// ============================================================================

/**
 * Get all runs with optional filters
 */
export function getRuns(options: {
  status?: RunStatus | undefined;
  environment?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
} = {}): Run[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options.environment) {
    conditions.push('environment = ?');
    params.push(options.environment);
  }

  let query = 'SELECT * FROM runs';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const rows = db.prepare(query).all(...params) as RunRow[];
  return rows.map(rowToRun);
}

/**
 * Get a run by ID
 */
export function getRunById(id: string): Run | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

/**
 * Get a run with all its tests
 */
export function getRunWithTests(id: string): RunWithTests | null {
  const run = getRunById(id);
  if (!run) return null;

  const tests = getRunTests(id);
  return { ...run, tests };
}

/**
 * Get the next queued run (for the queue processor)
 */
export function getNextQueuedRun(): Run | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM runs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
  ).get() as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

/**
 * Count running runs
 */
export function countRunningRuns(): number {
  const db = getDb();
  const result = db.prepare(
    "SELECT COUNT(*) as count FROM runs WHERE status = 'running'"
  ).get() as { count: number };
  return result.count;
}

/**
 * Get runs for a schedule (to check for overlapping)
 */
export function getActiveRunsForSchedule(scheduleId: string): Run[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM runs WHERE schedule_id = ? AND status IN ('queued', 'running')"
  ).all(scheduleId) as RunRow[];
  return rows.map(rowToRun);
}

// ============================================================================
// Run Mutation functions
// ============================================================================

/**
 * Create a new run
 */
export function createRun(data: {
  triggerType: 'manual' | 'schedule';
  environment: string;
  scheduleId?: string | undefined;
  triggeredByEmail?: string | undefined;
  runOverrides?: Record<string, any> | undefined;
  metadata?: import('../../types/index.js').RunMetadata | undefined;
  testIds: { testId: string; testKey: string }[];
}): Run {
  const db = getDb();
  const runId = uuidv4();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    // Create the run
    db.prepare(`
      INSERT INTO runs (id, status, trigger_type, environment, schedule_id, triggered_by_email, run_overrides, metadata, created_at)
      VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      data.triggerType,
      data.environment,
      data.scheduleId || null,
      data.triggeredByEmail || null,
      data.runOverrides ? JSON.stringify(data.runOverrides) : null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now
    );

    // Create run_tests entries for each test
    const insertTest = db.prepare(`
      INSERT INTO run_tests (id, run_id, test_id, test_key, status)
      VALUES (?, ?, ?, ?, 'pending')
    `);

    for (const { testId, testKey } of data.testIds) {
      insertTest.run(uuidv4(), runId, testId, testKey);
    }
  });

  transaction();
  return getRunById(runId)!;
}

/**
 * Update run status
 */
export function updateRunStatus(id: string, status: RunStatus): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (status === 'running') {
    db.prepare('UPDATE runs SET status = ?, started_at = ? WHERE id = ?').run(status, now, id);
  } else if (['passed', 'failed', 'skipped', 'cancelled'].includes(status)) {
    db.prepare('UPDATE runs SET status = ?, finished_at = ? WHERE id = ?').run(status, now, id);
  } else {
    db.prepare('UPDATE runs SET status = ? WHERE id = ?').run(status, id);
  }
}

/**
 * Update run summary
 */
export function updateRunSummary(id: string, summary: RunSummary): void {
  const db = getDb();
  db.prepare('UPDATE runs SET summary = ? WHERE id = ?').run(JSON.stringify(summary), id);
}

/**
 * Cancel a run (if queued or running)
 */
export function cancelRun(id: string): boolean {
  const db = getDb();
  const result = db.prepare(
    "UPDATE runs SET status = 'cancelled', finished_at = datetime('now') WHERE id = ? AND status IN ('queued', 'running')"
  ).run(id);
  return result.changes > 0;
}

// ============================================================================
// RunTest Query functions
// ============================================================================

/**
 * Get all tests for a run
 */
export function getRunTests(runId: string): RunTest[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM run_tests WHERE run_id = ? ORDER BY test_key'
  ).all(runId) as RunTestRow[];
  return rows.map(rowToRunTest);
}

/**
 * Get a specific test from a run
 */
export function getRunTest(runId: string, testKey: string): RunTest | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM run_tests WHERE run_id = ? AND test_key = ?'
  ).get(runId, testKey) as RunTestRow | undefined;
  return row ? rowToRunTest(row) : null;
}

/**
 * Get the next pending test in a run
 */
export function getNextPendingTest(runId: string): RunTest | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM run_tests WHERE run_id = ? AND status = 'pending' ORDER BY test_key LIMIT 1"
  ).get(runId) as RunTestRow | undefined;
  return row ? rowToRunTest(row) : null;
}

// ============================================================================
// RunTest Mutation functions
// ============================================================================

/**
 * Update test status within a run
 */
export function updateRunTestStatus(
  runId: string,
  testKey: string,
  status: RunTestStatus,
  extra?: {
    durationMs?: number;
    errorMessage?: string;
    artifacts?: TestArtifacts;
  }
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (status === 'running') {
    db.prepare(
      'UPDATE run_tests SET status = ?, started_at = ? WHERE run_id = ? AND test_key = ?'
    ).run(status, now, runId, testKey);
  } else if (['passed', 'failed', 'skipped'].includes(status)) {
    db.prepare(`
      UPDATE run_tests 
      SET status = ?, finished_at = ?, duration_ms = ?, error_message = ?, artifacts = ?
      WHERE run_id = ? AND test_key = ?
    `).run(
      status,
      now,
      extra?.durationMs || null,
      extra?.errorMessage || null,
      extra?.artifacts ? JSON.stringify(extra.artifacts) : null,
      runId,
      testKey
    );
  } else {
    db.prepare(
      'UPDATE run_tests SET status = ? WHERE run_id = ? AND test_key = ?'
    ).run(status, runId, testKey);
  }
}

/**
 * Mark all pending tests as skipped (used when cancelling a run)
 */
export function skipPendingTests(runId: string): number {
  const db = getDb();
  const result = db.prepare(
    "UPDATE run_tests SET status = 'skipped' WHERE run_id = ? AND status = 'pending'"
  ).run(runId);
  return result.changes;
}

// ============================================================================
// Cleanup functions
// ============================================================================

/**
 * Delete runs older than retention days
 */
export function deleteOldRuns(retentionDays: number): number {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const result = db.prepare(
    'DELETE FROM runs WHERE created_at < ?'
  ).run(cutoffDate.toISOString());
  
  return result.changes;
}

/**
 * Get run IDs older than retention days (for artifact cleanup)
 */
export function getOldRunIds(retentionDays: number): string[] {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const rows = db.prepare(
    'SELECT id FROM runs WHERE created_at < ?'
  ).all(cutoffDate.toISOString()) as { id: string }[];
  
  return rows.map(r => r.id);
}
