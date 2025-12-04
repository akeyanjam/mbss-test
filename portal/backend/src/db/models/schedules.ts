import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import type { Schedule, ScheduleSelector } from '../../types/index.js';

// ============================================================================
// Row type (database representation)
// ============================================================================

interface ScheduleRow {
  id: string;
  name: string;
  cron: string;
  enabled: number;
  environment: string;
  last_triggered_at: string | null;
  selector: string;
  default_run_overrides: string | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Conversion helpers
// ============================================================================

function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    cron: row.cron,
    enabled: row.enabled === 1,
    environment: row.environment,
    lastTriggeredAt: row.last_triggered_at ? new Date(row.last_triggered_at) : undefined,
    selector: JSON.parse(row.selector) as ScheduleSelector,
    defaultRunOverrides: row.default_run_overrides ? JSON.parse(row.default_run_overrides) : undefined,
    createdByEmail: row.created_by_email || undefined,
    updatedByEmail: row.updated_by_email || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// Query functions
// ============================================================================

/**
 * Get all schedules
 */
export function getAllSchedules(): Schedule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM schedules ORDER BY name').all() as ScheduleRow[];
  return rows.map(rowToSchedule);
}

/**
 * Get enabled schedules (for scheduler tick)
 */
export function getEnabledSchedules(): Schedule[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY name').all() as ScheduleRow[];
  return rows.map(rowToSchedule);
}

/**
 * Get a schedule by ID
 */
export function getScheduleById(id: string): Schedule | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as ScheduleRow | undefined;
  return row ? rowToSchedule(row) : null;
}

// ============================================================================
// Mutation functions
// ============================================================================

/**
 * Create a new schedule
 */
export function createSchedule(data: {
  name: string;
  cron: string;
  environment: string;
  selector: ScheduleSelector;
  createdByEmail: string;
  defaultRunOverrides?: Record<string, any>;
}): Schedule {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO schedules (id, name, cron, enabled, environment, selector, default_run_overrides, created_by_email, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name,
    data.cron,
    data.environment,
    JSON.stringify(data.selector),
    data.defaultRunOverrides ? JSON.stringify(data.defaultRunOverrides) : null,
    data.createdByEmail,
    now,
    now
  );

  return getScheduleById(id)!;
}

/**
 * Update a schedule
 */
export function updateSchedule(
  id: string,
  data: {
    name?: string;
    cron?: string;
    enabled?: boolean;
    environment?: string;
    selector?: ScheduleSelector;
    defaultRunOverrides?: Record<string, any>;
    updatedByEmail: string;
  }
): Schedule | null {
  const db = getDb();
  const existing = getScheduleById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.cron !== undefined) {
    updates.push('cron = ?');
    params.push(data.cron);
  }
  if (data.enabled !== undefined) {
    updates.push('enabled = ?');
    params.push(data.enabled ? 1 : 0);
  }
  if (data.environment !== undefined) {
    updates.push('environment = ?');
    params.push(data.environment);
  }
  if (data.selector !== undefined) {
    updates.push('selector = ?');
    params.push(JSON.stringify(data.selector));
  }
  if (data.defaultRunOverrides !== undefined) {
    updates.push('default_run_overrides = ?');
    params.push(JSON.stringify(data.defaultRunOverrides));
  }

  updates.push('updated_by_email = ?');
  params.push(data.updatedByEmail);
  updates.push('updated_at = ?');
  params.push(now);

  params.push(id);

  db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return getScheduleById(id);
}

/**
 * Delete a schedule
 */
export function deleteSchedule(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Update last triggered timestamp
 */
export function updateScheduleLastTriggered(id: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE schedules SET last_triggered_at = ? WHERE id = ?').run(now, id);
}

/**
 * Toggle schedule enabled status
 */
export function toggleScheduleEnabled(id: string, enabled: boolean): Schedule | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?').run(enabled ? 1 : 0, now, id);
  return getScheduleById(id);
}
