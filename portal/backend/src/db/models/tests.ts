import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import type { TestDefinition, TestMeta, TestConstants, DiscoveredTest } from '../../types/index.js';

// ============================================================================
// Row type (database representation)
// ============================================================================

interface TestDefinitionRow {
  id: string;
  test_key: string;
  folder_path: string;
  spec_path: string;
  meta: string;
  constants: string;
  overrides: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Conversion helpers
// ============================================================================

function rowToTestDefinition(row: TestDefinitionRow): TestDefinition {
  return {
    id: row.id,
    testKey: row.test_key,
    folderPath: row.folder_path,
    specPath: row.spec_path,
    meta: JSON.parse(row.meta) as TestMeta,
    constants: JSON.parse(row.constants) as TestConstants,
    overrides: row.overrides ? JSON.parse(row.overrides) : undefined,
    active: row.active === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================================================
// Query functions
// ============================================================================

/**
 * Get all active test definitions
 */
export function getAllTests(includeInactive = false): TestDefinition[] {
  const db = getDb();
  const query = includeInactive
    ? 'SELECT * FROM test_definitions ORDER BY folder_path, test_key'
    : 'SELECT * FROM test_definitions WHERE active = 1 ORDER BY folder_path, test_key';
  
  const rows = db.prepare(query).all() as TestDefinitionRow[];
  return rows.map(rowToTestDefinition);
}

/**
 * Get a test definition by test key
 */
export function getTestByKey(testKey: string): TestDefinition | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM test_definitions WHERE test_key = ?'
  ).get(testKey) as TestDefinitionRow | undefined;
  
  return row ? rowToTestDefinition(row) : null;
}

/**
 * Get a test definition by ID
 */
export function getTestById(id: string): TestDefinition | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM test_definitions WHERE id = ?'
  ).get(id) as TestDefinitionRow | undefined;
  
  return row ? rowToTestDefinition(row) : null;
}

/**
 * Get tests by folder prefix
 */
export function getTestsByFolder(folderPrefix: string): TestDefinition[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM test_definitions WHERE active = 1 AND folder_path LIKE ? ORDER BY folder_path, test_key'
  ).all(`${folderPrefix}%`) as TestDefinitionRow[];
  
  return rows.map(rowToTestDefinition);
}

/**
 * Get tests by tags (tests that have ANY of the specified tags)
 */
export function getTestsByTags(tags: string[]): TestDefinition[] {
  const db = getDb();
  const allTests = db.prepare(
    'SELECT * FROM test_definitions WHERE active = 1'
  ).all() as TestDefinitionRow[];
  
  return allTests
    .map(rowToTestDefinition)
    .filter(test => {
      const testTags = test.meta.tags || [];
      return tags.some(tag => testTags.includes(tag));
    });
}

/**
 * Get tests by explicit test keys
 */
export function getTestsByKeys(testKeys: string[]): TestDefinition[] {
  if (testKeys.length === 0) return [];
  
  const db = getDb();
  const placeholders = testKeys.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM test_definitions WHERE active = 1 AND test_key IN (${placeholders}) ORDER BY folder_path, test_key`
  ).all(...testKeys) as TestDefinitionRow[];
  
  return rows.map(rowToTestDefinition);
}

/**
 * Get all unique tags from active tests
 */
export function getAllTags(): string[] {
  const tests = getAllTests();
  const tagSet = new Set<string>();
  
  for (const test of tests) {
    for (const tag of test.meta.tags || []) {
      tagSet.add(tag);
    }
  }
  
  return Array.from(tagSet).sort();
}

/**
 * Get folder tree structure
 */
export function getFolderTree(): string[] {
  const tests = getAllTests();
  const folderSet = new Set<string>();
  
  for (const test of tests) {
    folderSet.add(test.folderPath);
  }
  
  return Array.from(folderSet).sort();
}

// ============================================================================
// Mutation functions
// ============================================================================

/**
 * Upsert a test definition (used during discovery)
 */
export function upsertTest(discovered: DiscoveredTest): TestDefinition {
  const db = getDb();
  const testKey = discovered.meta.testKey;
  const now = new Date().toISOString();
  
  const existing = getTestByKey(testKey);
  
  if (existing) {
    // Update existing test
    db.prepare(`
      UPDATE test_definitions 
      SET folder_path = ?, spec_path = ?, meta = ?, constants = ?, active = 1, updated_at = ?
      WHERE test_key = ?
    `).run(
      discovered.folderPath,
      discovered.specPath,
      JSON.stringify(discovered.meta),
      JSON.stringify(discovered.constants),
      now,
      testKey
    );
    
    return getTestByKey(testKey)!;
  } else {
    // Insert new test
    const id = uuidv4();
    db.prepare(`
      INSERT INTO test_definitions (id, test_key, folder_path, spec_path, meta, constants, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      testKey,
      discovered.folderPath,
      discovered.specPath,
      JSON.stringify(discovered.meta),
      JSON.stringify(discovered.constants),
      now,
      now
    );
    
    return getTestByKey(testKey)!;
  }
}

/**
 * Update test overrides
 */
export function updateTestOverrides(testKey: string, overrides: Record<string, any>): TestDefinition | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE test_definitions SET overrides = ?, updated_at = ? WHERE test_key = ?
  `).run(JSON.stringify(overrides), now, testKey);
  
  return getTestByKey(testKey);
}

/**
 * Mark tests as inactive (used during discovery for removed tests)
 */
export function deactivateTestsNotIn(activeTestKeys: string[]): number {
  const db = getDb();
  
  if (activeTestKeys.length === 0) {
    // Deactivate all tests
    const result = db.prepare('UPDATE test_definitions SET active = 0').run();
    return result.changes;
  }
  
  const placeholders = activeTestKeys.map(() => '?').join(',');
  const result = db.prepare(
    `UPDATE test_definitions SET active = 0 WHERE test_key NOT IN (${placeholders})`
  ).run(...activeTestKeys);
  
  return result.changes;
}

/**
 * Delete inactive tests (optional cleanup)
 */
export function deleteInactiveTests(): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM test_definitions WHERE active = 0').run();
  return result.changes;
}
