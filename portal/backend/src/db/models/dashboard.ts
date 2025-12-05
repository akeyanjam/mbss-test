import { getDb } from '../index.js';

// ============================================================================
// Dashboard Statistics Types
// ============================================================================

export interface DashboardOverview {
  activeRuns: {
    running: number;
    queued: number;
    currentRuns: Array<{
      id: string;
      environment: string;
      progress: { completed: number; total: number };
      startedAt: Date;
    }>;
  };
  passRate: {
    percentage: number;
    trend: number;
    period: string;
  };
  totalExecutions: {
    count: number;
    byEnvironment: Record<string, number>;
    trend: number;
  };
  flakyTests: {
    count: number;
    critical: number;
  };
}

export interface ExecutionHistoryItem {
  id: string;
  environment: string;
  status: string;
  triggerType: string;
  triggeredBy: string | null;
  metadata?: import('../../types/index.js').RunMetadata;
  startedAt: Date | null;
  finishedAt: Date | null;
  duration: number | null;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

export interface TimelineDataPoint {
  date: string;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface EnvironmentHealth {
  code: string;
  name: string;
  lastRun: {
    id: string;
    status: string;
    finishedAt: Date;
  } | null;
  stats: {
    passRate: number;
    avgDuration: number;
    totalRuns: number;
    last24Hours: number;
  };
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export interface FlakyTest {
  testKey: string;
  testName: string;
  flakinessScore: number;
  executions: {
    total: number;
    passed: number;
    failed: number;
  };
  lastResults: string[];
  environments: string[];
  lastFailure: {
    runId: string;
    date: Date;
    environment: string;
    errorMessage: string | null;
  } | null;
}

export interface TestPerformance {
  testKey: string;
  testName: string;
  avgDuration: number;
  executions: number;
  trend: number;
}

export interface TagStatistics {
  tag: string;
  executions: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  avgDuration: number;
}

// ============================================================================
// Dashboard Query Functions
// ============================================================================

/**
 * Get active runs (running and queued)
 */
export function getActiveRuns(): DashboardOverview['activeRuns'] {
  const db = getDb();

  // Count running and queued
  const counts = db.prepare(`
    SELECT 
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
    FROM runs
    WHERE status IN ('running', 'queued')
  `).get() as { running: number; queued: number };

  // Get current running runs with progress
  const currentRuns = db.prepare(`
    SELECT 
      r.id,
      r.environment,
      r.started_at,
      COUNT(rt.id) as total,
      SUM(CASE WHEN rt.status IN ('passed', 'failed', 'skipped') THEN 1 ELSE 0 END) as completed
    FROM runs r
    LEFT JOIN run_tests rt ON r.id = rt.run_id
    WHERE r.status = 'running'
    GROUP BY r.id, r.environment, r.started_at
  `).all() as Array<{
    id: string;
    environment: string;
    started_at: string;
    total: number;
    completed: number;
  }>;

  return {
    running: counts.running || 0,
    queued: counts.queued || 0,
    currentRuns: currentRuns.map(run => ({
      id: run.id,
      environment: run.environment,
      progress: {
        completed: run.completed,
        total: run.total,
      },
      startedAt: new Date(run.started_at),
    })),
  };
}

/**
 * Get pass rate for a given period
 */
export function getPassRate(days: number = 30): DashboardOverview['passRate'] {
  const db = getDb();

  const currentPeriod = db.prepare(`
    SELECT 
      COUNT(*) as total_tests,
      SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed_tests
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      AND rt.status IN ('passed', 'failed')
  `).get(days) as { total_tests: number; passed_tests: number };

  const previousPeriod = db.prepare(`
    SELECT 
      COUNT(*) as total_tests,
      SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed_tests
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      AND r.finished_at < date('now', '-' || ? || ' days')
      AND rt.status IN ('passed', 'failed')
  `).get(days * 2, days) as { total_tests: number; passed_tests: number };

  const currentPassRate = currentPeriod.total_tests > 0
    ? (currentPeriod.passed_tests / currentPeriod.total_tests) * 100
    : 0;

  const previousPassRate = previousPeriod.total_tests > 0
    ? (previousPeriod.passed_tests / previousPeriod.total_tests) * 100
    : 0;

  const trend = currentPassRate - previousPassRate;

  return {
    percentage: Math.round(currentPassRate * 10) / 10,
    trend: Math.round(trend * 10) / 10,
    period: `last_${days}_days`,
  };
}

/**
 * Get total executions with breakdown by environment
 */
export function getTotalExecutions(days: number = 30): DashboardOverview['totalExecutions'] {
  const db = getDb();

  const current = db.prepare(`
    SELECT 
      COUNT(*) as count,
      environment
    FROM runs
    WHERE finished_at >= date('now', '-' || ? || ' days')
    GROUP BY environment
  `).all(days) as Array<{ count: number; environment: string }>;

  const previous = db.prepare(`
    SELECT COUNT(*) as count
    FROM runs
    WHERE finished_at >= date('now', '-' || ? || ' days')
      AND finished_at < date('now', '-' || ? || ' days')
  `).get(days * 2, days) as { count: number };

  const totalCount = current.reduce((sum, item) => sum + item.count, 0);
  const trend = totalCount - (previous.count || 0);

  const byEnvironment: Record<string, number> = {};
  current.forEach(item => {
    byEnvironment[item.environment] = item.count;
  });

  return {
    count: totalCount,
    byEnvironment,
    trend,
  };
}

/**
 * Get flaky tests count
 */
export function getFlakyTestsCount(days: number = 30, minExecutions: number = 5): DashboardOverview['flakyTests'] {
  const db = getDb();

  const result = db.prepare(`
    WITH test_stats AS (
      SELECT 
        rt.test_key,
        COUNT(*) as total_executions,
        SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed_count,
        SUM(CASE WHEN rt.status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM run_tests rt
      JOIN runs r ON rt.run_id = r.id
      WHERE r.finished_at >= date('now', '-' || ? || ' days')
        AND rt.status IN ('passed', 'failed')
      GROUP BY rt.test_key
      HAVING total_executions >= ?
        AND passed_count > 0 
        AND failed_count > 0
        AND (failed_count * 100.0 / total_executions) BETWEEN 10 AND 90
    )
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN (failed_count * 100.0 / total_executions) >= 30 THEN 1 ELSE 0 END) as critical
    FROM test_stats
  `).get(days, minExecutions) as { total: number; critical: number };

  return {
    count: result.total || 0,
    critical: result.critical || 0,
  };
}

/**
 * Get complete dashboard overview
 */
export function getDashboardOverview(days: number = 30): DashboardOverview {
  return {
    activeRuns: getActiveRuns(),
    passRate: getPassRate(days),
    totalExecutions: getTotalExecutions(days),
    flakyTests: getFlakyTestsCount(days),
  };
}

/**
 * Get execution history with filters
 */
export function getExecutionHistory(options: {
  environment?: string;
  status?: string;
  triggerType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): { executions: ExecutionHistoryItem[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.environment) {
    conditions.push('r.environment = ?');
    params.push(options.environment);
  }
  if (options.status) {
    conditions.push('r.status = ?');
    params.push(options.status);
  }
  if (options.triggerType) {
    conditions.push('r.trigger_type = ?');
    params.push(options.triggerType);
  }
  if (options.startDate) {
    conditions.push('r.finished_at >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    conditions.push('r.finished_at <= ?');
    params.push(options.endDate);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM runs r ${whereClause}`;
  const { total } = db.prepare(countQuery).get(...params) as { total: number };

  // Get executions with summary
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const executionsQuery = `
    SELECT 
      r.id,
      r.environment,
      r.status,
      r.trigger_type,
      r.triggered_by_email,
      r.metadata,
      r.started_at,
      r.finished_at,
      r.summary,
      CASE 
        WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
        THEN (julianday(r.finished_at) - julianday(r.started_at)) * 86400000 
        ELSE NULL 
      END as duration_ms
    FROM runs r
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(executionsQuery).all(...params, limit, offset) as Array<{
    id: string;
    environment: string;
    status: string;
    trigger_type: string;
    triggered_by_email: string | null;
    metadata: string | null;
    started_at: string | null;
    finished_at: string | null;
    summary: string | null;
    duration_ms: number | null;
  }>;

  const executions: ExecutionHistoryItem[] = rows.map(row => {
    const summary = row.summary ? JSON.parse(row.summary) : { total: 0, passed: 0, failed: 0, skipped: 0 };
    
    return {
      id: row.id,
      environment: row.environment,
      status: row.status,
      triggerType: row.trigger_type,
      triggeredBy: row.triggered_by_email,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      duration: row.duration_ms,
      summary,
    };
  });

  return { executions, total };
}

/**
 * Get execution timeline data
 */
export function getExecutionTimeline(days: number = 30, environment?: string): {
  timeline: TimelineDataPoint[];
  summary: { totalRuns: number; totalPassed: number; totalFailed: number; totalSkipped: number };
} {
  const db = getDb();
  const params: any[] = [days];
  let envFilter = '';

  if (environment) {
    envFilter = 'AND r.environment = ?';
    params.push(environment);
  }

  const timeline = db.prepare(`
    SELECT 
      date(r.finished_at) as date,
      SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      COUNT(*) as total
    FROM runs r
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      ${envFilter}
    GROUP BY date(r.finished_at)
    ORDER BY date(r.finished_at) ASC
  `).all(...params) as TimelineDataPoint[];

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as totalRuns,
      SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as totalPassed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as totalFailed,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as totalSkipped
    FROM runs r
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      ${envFilter}
  `).get(...params) as { totalRuns: number; totalPassed: number; totalFailed: number; totalSkipped: number };

  return { timeline, summary };
}

/**
 * Get environment health data
 */
export function getEnvironmentHealth(days: number = 30): EnvironmentHealth[] {
  const db = getDb();

  const stats = db.prepare(`
    SELECT 
      r.environment,
      COUNT(*) as total_runs,
      SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
      AVG(CASE 
        WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
        THEN (julianday(r.finished_at) - julianday(r.started_at)) * 86400000 
        ELSE NULL 
      END) as avg_duration_ms,
      MAX(r.finished_at) as last_run_at,
      SUM(CASE WHEN r.finished_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) as last_24h_runs
    FROM runs r
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
    GROUP BY r.environment
  `).all(days) as Array<{
    environment: string;
    total_runs: number;
    passed_runs: number;
    avg_duration_ms: number;
    last_run_at: string;
    last_24h_runs: number;
  }>;

  // Get last run per environment (SQLite compatible)
  const lastRuns = db.prepare(`
    SELECT 
      r.id,
      r.environment,
      r.status,
      r.finished_at
    FROM runs r
    WHERE r.finished_at IS NOT NULL
      AND r.id IN (
        SELECT id FROM runs r2
        WHERE r2.environment = r.environment
          AND r2.finished_at IS NOT NULL
        ORDER BY r2.finished_at DESC
        LIMIT 1
      )
  `).all() as Array<{
    id: string;
    environment: string;
    status: string;
    finished_at: string;
  }>;

  const lastRunMap = new Map(lastRuns.map(lr => [lr.environment, lr]));

  return stats.map(stat => {
    const passRate = stat.total_runs > 0 ? (stat.passed_runs / stat.total_runs) * 100 : 0;
    const lastRun = lastRunMap.get(stat.environment);
    
    // Determine health status
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (passRate < 70 || stat.last_24h_runs === 0) {
      healthStatus = 'critical';
    } else if (passRate < 90 || stat.last_24h_runs < 2) {
      healthStatus = 'warning';
    }

    return {
      code: stat.environment,
      name: stat.environment, // Will be enriched by API layer with environment config
      lastRun: lastRun ? {
        id: lastRun.id,
        status: lastRun.status,
        finishedAt: new Date(lastRun.finished_at),
      } : null,
      stats: {
        passRate: Math.round(passRate * 10) / 10,
        avgDuration: Math.round(stat.avg_duration_ms || 0),
        totalRuns: stat.total_runs,
        last24Hours: stat.last_24h_runs,
      },
      healthStatus,
    };
  });
}

/**
 * Get flaky tests
 */
export function getFlakyTests(options: {
  minExecutions?: number;
  days?: number;
  environment?: string;
}): FlakyTest[] {
  const db = getDb();
  const minExecutions = options.minExecutions || 5;
  const days = options.days || 30;
  const params: any[] = [days, minExecutions];
  let envFilter = '';

  if (options.environment) {
    envFilter = 'AND r.environment = ?';
    params.push(options.environment);
  }

  // Get flaky test statistics
  const flakyStats = db.prepare(`
    WITH test_results AS (
      SELECT 
        rt.test_key,
        rt.test_id,
        rt.status,
        r.environment,
        r.finished_at,
        r.id as run_id,
        rt.error_message
      FROM run_tests rt
      JOIN runs r ON rt.run_id = r.id
      WHERE r.finished_at >= date('now', '-' || ? || ' days')
        AND rt.status IN ('passed', 'failed')
        ${envFilter}
    ),
    test_stats AS (
      SELECT 
        test_key,
        test_id,
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM test_results
      GROUP BY test_key, test_id
      HAVING total_executions >= ?
        AND passed_count > 0 
        AND failed_count > 0
        AND (failed_count * 100.0 / total_executions) BETWEEN 10 AND 90
    )
    SELECT 
      ts.*,
      (ts.failed_count * 100.0 / ts.total_executions) as flakiness_score
    FROM test_stats ts
    ORDER BY flakiness_score DESC
  `).all(...params) as Array<{
    test_key: string;
    test_id: string;
    total_executions: number;
    passed_count: number;
    failed_count: number;
    flakiness_score: number;
  }>;

  // For each flaky test, get additional details
  const flakyTests: FlakyTest[] = [];

  for (const stat of flakyStats) {
    // Get test definition
    const testDef = db.prepare(`
      SELECT meta FROM test_definitions WHERE id = ?
    `).get(stat.test_id) as { meta: string } | undefined;

    const meta = testDef ? JSON.parse(testDef.meta) : { friendlyName: stat.test_key };

    // Get last 10 results
    const lastResults = db.prepare(`
      SELECT rt.status
      FROM run_tests rt
      JOIN runs r ON rt.run_id = r.id
      WHERE rt.test_key = ?
        AND r.finished_at >= date('now', '-' || ? || ' days')
        AND rt.status IN ('passed', 'failed')
        ${envFilter}
      ORDER BY r.finished_at DESC
      LIMIT 10
    `).all(stat.test_key, days, ...(options.environment ? [options.environment] : [])) as Array<{ status: string }>;

    // Get affected environments
    const environments = db.prepare(`
      SELECT DISTINCT r.environment
      FROM run_tests rt
      JOIN runs r ON rt.run_id = r.id
      WHERE rt.test_key = ?
        AND r.finished_at >= date('now', '-' || ? || ' days')
        AND rt.status = 'failed'
    `).all(stat.test_key, days) as Array<{ environment: string }>;

    // Get last failure
    const lastFailure = db.prepare(`
      SELECT 
        r.id as run_id,
        r.finished_at as date,
        r.environment,
        rt.error_message
      FROM run_tests rt
      JOIN runs r ON rt.run_id = r.id
      WHERE rt.test_key = ?
        AND rt.status = 'failed'
        AND r.finished_at >= date('now', '-' || ? || ' days')
      ORDER BY r.finished_at DESC
      LIMIT 1
    `).get(stat.test_key, days) as {
      run_id: string;
      date: string;
      environment: string;
      error_message: string | null;
    } | undefined;

    flakyTests.push({
      testKey: stat.test_key,
      testName: meta.friendlyName || stat.test_key,
      flakinessScore: Math.round(stat.flakiness_score * 10) / 10,
      executions: {
        total: stat.total_executions,
        passed: stat.passed_count,
        failed: stat.failed_count,
      },
      lastResults: lastResults.map(r => r.status),
      environments: environments.map(e => e.environment),
      lastFailure: lastFailure ? {
        runId: lastFailure.run_id,
        date: new Date(lastFailure.date),
        environment: lastFailure.environment,
        errorMessage: lastFailure.error_message,
      } : null,
    });
  }

  return flakyTests;
}

/**
 * Get test performance metrics
 */
export function getTestPerformance(options: {
  metric?: 'duration' | 'execution_count';
  limit?: number;
  days?: number;
  environment?: string;
}): TestPerformance[] {
  const db = getDb();
  const limit = options.limit || 10;
  const days = options.days || 30;
  const metric = options.metric || 'duration';
  const params: any[] = [days];
  let envFilter = '';

  if (options.environment) {
    envFilter = 'AND r.environment = ?';
    params.push(options.environment);
  }

  const orderBy = metric === 'duration' ? 'avg_duration DESC' : 'executions DESC';

  const results = db.prepare(`
    SELECT 
      rt.test_key,
      rt.test_id,
      AVG(rt.duration_ms) as avg_duration,
      COUNT(*) as executions
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      AND rt.duration_ms IS NOT NULL
      ${envFilter}
    GROUP BY rt.test_key, rt.test_id
    ORDER BY ${orderBy}
    LIMIT ?
  `).all(...params, limit) as Array<{
    test_key: string;
    test_id: string;
    avg_duration: number;
    executions: number;
  }>;

  return results.map(result => {
    const testDef = db.prepare(`
      SELECT meta FROM test_definitions WHERE id = ?
    `).get(result.test_id) as { meta: string } | undefined;

    const meta = testDef ? JSON.parse(testDef.meta) : { friendlyName: result.test_key };

    return {
      testKey: result.test_key,
      testName: meta.friendlyName || result.test_key,
      avgDuration: Math.round(result.avg_duration),
      executions: result.executions,
      trend: 0, // TODO: Calculate trend by comparing with previous period
    };
  });
}

/**
 * Get statistics by tag
 */
export function getStatsByTag(options: {
  days?: number;
  environment?: string;
}): TagStatistics[] {
  const db = getDb();
  const days = options.days || 30;
  const params: any[] = [days];
  let envFilter = '';

  if (options.environment) {
    envFilter = 'AND r.environment = ?';
    params.push(options.environment);
  }

  // Get all test results with their tags
  const results = db.prepare(`
    SELECT 
      td.meta,
      rt.status,
      rt.duration_ms
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    JOIN test_definitions td ON rt.test_id = td.id
    WHERE r.finished_at >= date('now', '-' || ? || ' days')
      ${envFilter}
  `).all(...params) as Array<{
    meta: string;
    status: string;
    duration_ms: number | null;
  }>;

  // Aggregate by tag
  const tagMap = new Map<string, {
    executions: number;
    passed: number;
    failed: number;
    skipped: number;
    totalDuration: number;
    durationCount: number;
  }>();

  for (const result of results) {
    const meta = JSON.parse(result.meta);
    const tags = meta.tags || [];

    for (const tag of tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          executions: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          totalDuration: 0,
          durationCount: 0,
        });
      }

      const stats = tagMap.get(tag)!;
      stats.executions++;

      if (result.status === 'passed') stats.passed++;
      else if (result.status === 'failed') stats.failed++;
      else if (result.status === 'skipped') stats.skipped++;

      if (result.duration_ms) {
        stats.totalDuration += result.duration_ms;
        stats.durationCount++;
      }
    }
  }

  // Convert to array and calculate metrics
  const tagStats: TagStatistics[] = [];
  for (const [tag, stats] of tagMap.entries()) {
    const passRate = stats.executions > 0
      ? ((stats.passed / stats.executions) * 100)
      : 0;
    
    const avgDuration = stats.durationCount > 0
      ? stats.totalDuration / stats.durationCount
      : 0;

    tagStats.push({
      tag,
      executions: stats.executions,
      passed: stats.passed,
      failed: stats.failed,
      skipped: stats.skipped,
      passRate: Math.round(passRate * 10) / 10,
      avgDuration: Math.round(avgDuration),
    });
  }

  // Sort by execution count
  return tagStats.sort((a, b) => b.executions - a.executions);
}

// ============================================================================
// Individual Test Statistics
// ============================================================================

export interface TestStats {
  testKey: string;
  testName: string;
  overall: {
    totalRuns: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    avgDuration: number;
  };
  byEnvironment: Array<{
    environment: string;
    totalRuns: number;
    passed: number;
    failed: number;
    passRate: number;
    avgDuration: number;
    lastRun: {
      runId: string;
      status: string;
      date: Date;
      duration: number | null;
    } | null;
  }>;
  recentRuns: Array<{
    runId: string;
    environment: string;
    status: string;
    date: Date;
    duration: number | null;
    errorMessage: string | null;
  }>;
  trend: {
    current: number;
    previous: number;
    direction: 'up' | 'down' | 'stable';
  };
}

/**
 * Get statistics for a specific test
 */
export function getTestStats(testKey: string, days: number = 30): TestStats | null {
  const db = getDb();

  // Get test definition
  const testDef = db.prepare(`
    SELECT id, meta FROM test_definitions WHERE test_key = ?
  `).get(testKey) as { id: string; meta: string } | undefined;

  if (!testDef) {
    return null;
  }

  const meta = JSON.parse(testDef.meta);

  // Get overall stats
  const overall = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN rt.status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN rt.status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      AVG(rt.duration_ms) as avg_duration
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE rt.test_key = ?
      AND r.finished_at >= date('now', '-' || ? || ' days')
  `).get(testKey, days) as {
    total_runs: number;
    passed: number;
    failed: number;
    skipped: number;
    avg_duration: number | null;
  };

  // Get stats by environment
  const envStats = db.prepare(`
    SELECT 
      r.environment,
      COUNT(*) as total_runs,
      SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN rt.status = 'failed' THEN 1 ELSE 0 END) as failed,
      AVG(rt.duration_ms) as avg_duration
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE rt.test_key = ?
      AND r.finished_at >= date('now', '-' || ? || ' days')
    GROUP BY r.environment
    ORDER BY r.environment
  `).all(testKey, days) as Array<{
    environment: string;
    total_runs: number;
    passed: number;
    failed: number;
    avg_duration: number | null;
  }>;

  // Get last run per environment
  const lastRunsPerEnv = db.prepare(`
    SELECT 
      r.id as run_id,
      r.environment,
      rt.status,
      r.finished_at,
      rt.duration_ms
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE rt.test_key = ?
      AND r.finished_at IS NOT NULL
    ORDER BY r.finished_at DESC
  `).all(testKey) as Array<{
    run_id: string;
    environment: string;
    status: string;
    finished_at: string;
    duration_ms: number | null;
  }>;

  // Build last run map (first occurrence per env is the latest)
  const lastRunMap = new Map<string, typeof lastRunsPerEnv[0]>();
  for (const run of lastRunsPerEnv) {
    if (!lastRunMap.has(run.environment)) {
      lastRunMap.set(run.environment, run);
    }
  }

  // Get recent runs (last 10)
  const recentRuns = db.prepare(`
    SELECT 
      r.id as run_id,
      r.environment,
      rt.status,
      r.finished_at,
      rt.duration_ms,
      rt.error_message
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE rt.test_key = ?
      AND r.finished_at IS NOT NULL
    ORDER BY r.finished_at DESC
    LIMIT 10
  `).all(testKey) as Array<{
    run_id: string;
    environment: string;
    status: string;
    finished_at: string;
    duration_ms: number | null;
    error_message: string | null;
  }>;

  // Calculate trend (compare current period vs previous period)
  const currentPeriodPassRate = overall.total_runs > 0
    ? (overall.passed / overall.total_runs) * 100
    : 0;

  const previousPeriod = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      SUM(CASE WHEN rt.status = 'passed' THEN 1 ELSE 0 END) as passed
    FROM run_tests rt
    JOIN runs r ON rt.run_id = r.id
    WHERE rt.test_key = ?
      AND r.finished_at >= date('now', '-' || ? || ' days')
      AND r.finished_at < date('now', '-' || ? || ' days')
  `).get(testKey, days * 2, days) as { total_runs: number; passed: number };

  const previousPeriodPassRate = previousPeriod.total_runs > 0
    ? (previousPeriod.passed / previousPeriod.total_runs) * 100
    : 0;

  const trendDiff = currentPeriodPassRate - previousPeriodPassRate;
  let trendDirection: 'up' | 'down' | 'stable' = 'stable';
  if (trendDiff > 5) trendDirection = 'up';
  else if (trendDiff < -5) trendDirection = 'down';

  return {
    testKey,
    testName: meta.friendlyName || testKey,
    overall: {
      totalRuns: overall.total_runs || 0,
      passed: overall.passed || 0,
      failed: overall.failed || 0,
      skipped: overall.skipped || 0,
      passRate: overall.total_runs > 0
        ? Math.round((overall.passed / overall.total_runs) * 1000) / 10
        : 0,
      avgDuration: Math.round(overall.avg_duration || 0),
    },
    byEnvironment: envStats.map(env => {
      const lastRun = lastRunMap.get(env.environment);
      return {
        environment: env.environment,
        totalRuns: env.total_runs,
        passed: env.passed,
        failed: env.failed,
        passRate: env.total_runs > 0
          ? Math.round((env.passed / env.total_runs) * 1000) / 10
          : 0,
        avgDuration: Math.round(env.avg_duration || 0),
        lastRun: lastRun ? {
          runId: lastRun.run_id,
          status: lastRun.status,
          date: new Date(lastRun.finished_at),
          duration: lastRun.duration_ms,
        } : null,
      };
    }),
    recentRuns: recentRuns.map(run => ({
      runId: run.run_id,
      environment: run.environment,
      status: run.status,
      date: new Date(run.finished_at),
      duration: run.duration_ms,
      errorMessage: run.error_message,
    })),
    trend: {
      current: Math.round(currentPeriodPassRate * 10) / 10,
      previous: Math.round(previousPeriodPassRate * 10) / 10,
      direction: trendDirection,
    },
  };
}
