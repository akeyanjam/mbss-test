# Dashboard Design - MBSS Test Portal

## Overview
A comprehensive dashboard providing real-time insights into test execution history, system health, test reliability, and performance metrics.

---

## Dashboard Layout

### 1. **Header Section - Quick Stats Cards**
Four prominent metric cards displaying:

- **Active Run Status**
  - Current running tests count
  - Queued runs count
  - Real-time progress indicator
  - Link to active run details

- **Overall Pass Rate (Last 30 Days)**
  - Percentage of passed tests
  - Trend indicator (up/down from previous period)
  - Color-coded: Green (>90%), Yellow (70-90%), Red (<70%)

- **Total Executions (Last 30 Days)**
  - Total number of test runs
  - Breakdown by environment (SIT1, SIT2, PROD)
  - Trend comparison

- **Flaky Tests Detected**
  - Count of tests with inconsistent results
  - Critical flaky tests requiring attention
  - Link to detailed flaky test report

---

### 2. **Main Content Area**

#### **2.1 Recent Executions Table**
Displays the last 20-50 test runs with:
- Run ID (clickable to details)
- Trigger type (Manual/Scheduled)
- Environment
- Status (with color coding)
- Test count (passed/failed/total)
- Duration
- Triggered by (user email)
- Started/Finished timestamp
- Actions (View Details, View Logs, Cancel if running)

**Filters:**
- Environment dropdown
- Status filter (All, Running, Passed, Failed, Cancelled)
- Date range picker
- Trigger type (Manual, Scheduled)

**Sorting:**
- By date (default: newest first)
- By duration
- By pass rate

---

#### **2.2 Test Execution Timeline Chart**
Visual representation of test executions over time:
- Line/Area chart showing daily execution counts
- Stacked by status (Passed, Failed, Skipped)
- Selectable time ranges: 7 days, 30 days, 90 days
- Hover tooltips with detailed breakdown

---

#### **2.3 Environment Health Matrix**
Grid showing health status per environment:

| Environment | Last Run | Pass Rate | Avg Duration | Status |
|-------------|----------|-----------|--------------|--------|
| SIT1        | 2h ago   | 95%       | 12m 34s      | ✅ Healthy |
| SIT2        | 5h ago   | 78%       | 15m 12s      | ⚠️ Warning |
| PROD        | 1d ago   | 100%      | 18m 45s      | ✅ Healthy |

**Status Indicators:**
- ✅ Healthy: Pass rate > 90%, recent execution
- ⚠️ Warning: Pass rate 70-90% or no execution in 24h
- ❌ Critical: Pass rate < 70% or no execution in 48h

---

#### **2.4 Flaky Tests Report**
Table showing tests with inconsistent results:

**Flakiness Detection Logic:**
- Test executed at least 5 times in last 30 days
- Has both passed and failed results
- Failure rate between 10-90% (not consistently failing)

**Columns:**
- Test Name
- Flakiness Score (percentage of failures)
- Last 10 Results (visual indicator: ✅❌✅❌✅✅❌✅✅✅)
- Total Executions
- Environment(s) affected
- Last Failure Date
- Actions (View History, View Logs)

**Sorting:**
- By flakiness score (default: highest first)
- By execution count
- By last failure date

---

#### **2.5 Test Performance Trends**
Charts showing:
- **Average Test Duration Over Time**
  - Line chart per environment
  - Identify performance degradation
  
- **Slowest Tests**
  - Bar chart of top 10 slowest tests
  - Average duration
  - Link to test details

---

#### **2.6 Execution Statistics by Tag**
Breakdown of test results by tags (smoke, regression, etc.):
- Pie/Donut chart showing distribution
- Pass rate per tag
- Execution count per tag
- Filterable by environment and date range

---

## Backend API Requirements

### New Endpoints Needed

#### **1. Dashboard Overview**
```
GET /api/dashboard/overview
```

**Response:**
```json
{
  "activeRuns": {
    "running": 2,
    "queued": 5,
    "currentRuns": [
      {
        "id": "run-uuid",
        "environment": "SIT1",
        "progress": { "completed": 3, "total": 10 },
        "startedAt": "2025-12-04T18:00:00Z"
      }
    ]
  },
  "passRate": {
    "percentage": 87.5,
    "trend": "+2.3",
    "period": "last_30_days"
  },
  "totalExecutions": {
    "count": 450,
    "byEnvironment": {
      "SIT1": 200,
      "SIT2": 180,
      "PROD": 70
    },
    "trend": "+15"
  },
  "flakyTests": {
    "count": 8,
    "critical": 3
  }
}
```

---

#### **2. Execution History**
```
GET /api/dashboard/executions
Query params:
  - environment: string (optional)
  - status: string (optional)
  - triggerType: string (optional)
  - startDate: ISO date (optional)
  - endDate: ISO date (optional)
  - limit: number (default 50)
  - offset: number (default 0)
```

**Response:**
```json
{
  "executions": [
    {
      "id": "run-uuid",
      "environment": "SIT1",
      "status": "passed",
      "triggerType": "manual",
      "triggeredBy": "user@example.com",
      "startedAt": "2025-12-04T18:00:00Z",
      "finishedAt": "2025-12-04T18:15:30Z",
      "duration": 930000,
      "summary": {
        "total": 10,
        "passed": 9,
        "failed": 1,
        "skipped": 0
      }
    }
  ],
  "total": 450,
  "limit": 50,
  "offset": 0
}
```

---

#### **3. Execution Timeline**
```
GET /api/dashboard/timeline
Query params:
  - days: number (default 30)
  - environment: string (optional)
```

**Response:**
```json
{
  "timeline": [
    {
      "date": "2025-12-04",
      "passed": 15,
      "failed": 2,
      "skipped": 1,
      "total": 18
    },
    {
      "date": "2025-12-03",
      "passed": 20,
      "failed": 3,
      "skipped": 0,
      "total": 23
    }
  ],
  "summary": {
    "totalRuns": 450,
    "totalPassed": 390,
    "totalFailed": 50,
    "totalSkipped": 10
  }
}
```

---

#### **4. Environment Health**
```
GET /api/dashboard/environment-health
```

**Response:**
```json
{
  "environments": [
    {
      "code": "SIT1",
      "name": "System Integration Test 1",
      "lastRun": {
        "id": "run-uuid",
        "status": "passed",
        "finishedAt": "2025-12-04T18:00:00Z"
      },
      "stats": {
        "passRate": 95.5,
        "avgDuration": 754000,
        "totalRuns": 200,
        "last24Hours": 12
      },
      "healthStatus": "healthy"
    }
  ]
}
```

---

#### **5. Flaky Tests**
```
GET /api/dashboard/flaky-tests
Query params:
  - minExecutions: number (default 5)
  - days: number (default 30)
  - environment: string (optional)
```

**Response:**
```json
{
  "flakyTests": [
    {
      "testKey": "payment.checkout-flow",
      "testName": "Payment Checkout Flow",
      "flakinessScore": 35.5,
      "executions": {
        "total": 20,
        "passed": 13,
        "failed": 7
      },
      "lastResults": ["passed", "failed", "passed", "passed", "failed", "passed", "passed", "failed", "passed", "passed"],
      "environments": ["SIT1", "SIT2"],
      "lastFailure": {
        "runId": "run-uuid",
        "date": "2025-12-04T15:30:00Z",
        "environment": "SIT1",
        "errorMessage": "Timeout waiting for element"
      }
    }
  ],
  "total": 8
}
```

---

#### **6. Test Performance**
```
GET /api/dashboard/test-performance
Query params:
  - metric: "duration" | "execution_count"
  - limit: number (default 10)
  - days: number (default 30)
  - environment: string (optional)
```

**Response:**
```json
{
  "tests": [
    {
      "testKey": "auth.full-login-flow",
      "testName": "Full Login Flow",
      "avgDuration": 125000,
      "executions": 45,
      "trend": "+5.2"
    }
  ]
}
```

---

#### **7. Statistics by Tag**
```
GET /api/dashboard/stats-by-tag
Query params:
  - days: number (default 30)
  - environment: string (optional)
```

**Response:**
```json
{
  "tags": [
    {
      "tag": "smoke",
      "executions": 150,
      "passed": 140,
      "failed": 8,
      "skipped": 2,
      "passRate": 93.3,
      "avgDuration": 45000
    },
    {
      "tag": "regression",
      "executions": 300,
      "passed": 270,
      "failed": 25,
      "skipped": 5,
      "passRate": 90.0,
      "avgDuration": 120000
    }
  ]
}
```

---

## Database Queries Required

### Flaky Test Detection Query
```sql
WITH test_results AS (
  SELECT 
    rt.test_key,
    rt.status,
    r.environment,
    r.finished_at,
    rt.error_message
  FROM run_tests rt
  JOIN runs r ON rt.run_id = r.id
  WHERE r.finished_at >= date('now', '-30 days')
    AND rt.status IN ('passed', 'failed')
),
test_stats AS (
  SELECT 
    test_key,
    COUNT(*) as total_executions,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
  FROM test_results
  GROUP BY test_key
  HAVING total_executions >= 5
    AND passed_count > 0 
    AND failed_count > 0
    AND (failed_count * 100.0 / total_executions) BETWEEN 10 AND 90
)
SELECT * FROM test_stats
ORDER BY (failed_count * 100.0 / total_executions) DESC;
```

### Pass Rate Calculation
```sql
SELECT 
  COUNT(*) as total_tests,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_tests,
  (SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as pass_rate
FROM run_tests rt
JOIN runs r ON rt.run_id = r.id
WHERE r.finished_at >= date('now', '-30 days')
  AND rt.status IN ('passed', 'failed');
```

### Environment Health
```sql
SELECT 
  r.environment,
  COUNT(*) as total_runs,
  SUM(CASE WHEN r.status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
  AVG(CASE WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
    THEN (julianday(r.finished_at) - julianday(r.started_at)) * 86400000 
    ELSE NULL END) as avg_duration_ms,
  MAX(r.finished_at) as last_run_at
FROM runs r
WHERE r.finished_at >= date('now', '-30 days')
GROUP BY r.environment;
```

---

## UI Component Structure

```
Dashboard/
├── DashboardView.vue (main container)
├── components/
│   ├── StatsCards.vue (4 metric cards)
│   ├── ExecutionTable.vue (recent runs table)
│   ├── TimelineChart.vue (execution timeline)
│   ├── EnvironmentHealth.vue (environment matrix)
│   ├── FlakyTestsTable.vue (flaky tests report)
│   ├── PerformanceCharts.vue (duration trends)
│   └── TagStatistics.vue (stats by tag)
└── composables/
    ├── useDashboardStats.ts
    ├── useExecutionHistory.ts
    └── useFlakyTests.ts
```

---

## Implementation Priority

### Phase 1 (MVP)
1. ✅ Dashboard overview endpoint
2. ✅ Execution history endpoint
3. ✅ Stats cards component
4. ✅ Recent executions table

### Phase 2
5. ✅ Execution timeline chart
6. ✅ Environment health matrix
7. ✅ Flaky tests detection & report

### Phase 3
8. ✅ Test performance trends
9. ✅ Statistics by tag
10. ✅ Advanced filters & date ranges

---

## Technical Considerations

### Performance
- Cache dashboard stats for 30 seconds
- Use database indexes on `created_at`, `finished_at`, `status`, `environment`
- Paginate large result sets
- Consider materialized views for complex aggregations

### Real-time Updates
- Poll dashboard overview every 5 seconds when active runs exist
- Poll execution table every 10 seconds
- Use optimistic UI updates for better UX

### Data Retention
- Dashboard queries respect retention policy (default 30 days)
- Allow custom date ranges up to retention limit
- Show warning when querying near retention boundary

---

## Next Steps

1. Implement backend API endpoints in `portal/backend/src/api/dashboard.ts`
2. Add database query functions in `portal/backend/src/db/models/dashboard.ts`
3. Create Vue components in `portal/frontend/src/views/Dashboard/`
4. Add routing and navigation
5. Implement polling and real-time updates
6. Add unit tests for calculations
7. Performance testing with large datasets
