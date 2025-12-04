# MBSS UI Test Dashboard & Runner

## Technical Requirements Document (TRD)

**Version:** 1.0
**Author:** alireza.keyanjam@bofa.com
**Scope:** Internal-use Node.js-based UI test runner + dashboard for Playwright tests 
**Environment:** Node.js backend, Vue/Vite frontend, SQLite DB, Playwright executor, Linux host

---

# 1. Overview

This system provides a **centralized dashboard**, **test runner**, and **scheduler** for executing end‑to‑end Playwright-based UI tests. Tests are bundled into a build output (`dist-tests/`) and deployed manually to a single server. On startup, the server discovers all tests, syncs DB entries, and exposes a web-based UI to:

* Browse and filter tests (folder + tag view)
* Manually execute tests
* View real-time progress (logs + screenshots)
* View detailed run history (video, logs, trace)
* Configure automated schedules (folder / tag / explicit test)
* Maintain run history and purge artifacts older than retention window

The system is intentionally simple: internal use only, no RBAC, no CI, no external APIs. Everything runs in a single-node service with DB-backed job queue.

---

# 2. Architecture Summary

```
+-----------------------------------------------------+
|                    Node Backend                     |
|-----------------------------------------------------|
| Express API         | Polling Endpoints             |
|                                                     |
| - Startup Discovery                                 |
| - Scheduler (cron tick)                             |
| - Cleanup Worker                                    |
| - Run Queue Processor                               |
| - Playwright Executor                               |
| - Artifact File Server (/artifacts/...)             |
+-----------------------------------------------------+
                ^                        ^
                |                        |
                |                        |
           Vue Dashboard               SQLite
           (Vite build)              (Data Store)
```

### Technology Choices

* **Node.js** backend (single-process service)
* **Vue 3 + Vite** frontend
* **SQLite** for permanent data (file-based, auto-migrating)
* **Local filesystem** for artifacts
* **HTTP Polling** for live status, logs, and screenshots
* **Playwright** for test execution
* **Cron-like scheduler** implemented inside Node via background tick

### Deployment Philosophy

* Manual deploy using SSH / system (local script, ssh/scp to target server)
* Entire test bundle copied fresh each deployment
* Discovery runs on startup; DB entries sync accordingly
* No drift detection required

---

# 3. Test Model

## 3.1 Test Unit Definition

A "test" = **one spec file**. Each folder contains exactly:

* `*.spec.ts` — the test source file (TypeScript, compiled to `.spec.js` during build)
* `meta.json` — metadata
* `constants.json` — environment-specific configuration

The system assumes **one Playwright test per file**. Tests use a base fixture that injects configuration based on the target environment.

## 3.2 Folder Structure

### Source (before build)

```
tests/src/
  auth/
    basic-login/
      basic-login.spec.ts
      meta.json
      constants.json
  transfers/
    domestic/
      domestic.spec.ts
      meta.json
      constants.json
```

### Built (after deployment)

```
dist/tests/
  auth/
    basic-login/
      basic-login.spec.js
      meta.json
      constants.json
  transfers/
    domestic/
      domestic.spec.js
      meta.json
      constants.json
```

## 3.3 meta.json Format

```
{
  "testKey": "login-basic",
  "friendlyName": "Login Flow",
  "description": "Basic login scenario.",
  "tags": ["login", "smoke"]
}
```

## 3.4 constants.json Format

Environment-specific configuration with shared defaults:

```json
{
  "shared": {
    "timeoutMs": 30000,
    "retryCount": 2
  },
  "environments": {
    "SIT1": {
      "baseUrl": "https://sit1.example.com",
      "username": "qa.user@bofa.com",
      "password": "secret123"
    },
    "SIT2": {
      "baseUrl": "https://sit2.example.com",
      "username": "qa.user@bofa.com",
      "password": "secret123"
    },
    "UAT": {
      "baseUrl": "https://uat.example.com",
      "username": "uat.user@bofa.com",
      "password": "uatSecret456"
    },
    "PROD": {
      "baseUrl": "https://prod.example.com",
      "username": "prod.user@bofa.com",
      "password": "prodSecret789"
    }
  }
}
```

## 3.5 Configuration Resolution

The effective configuration for a test run is resolved in this order:

1. **Base config**: `constants.json` (shared + environment-specific)
2. **DB overrides**: `test_definitions.overrides` (JSONB, optional)
3. **Run-level overrides**: Provided when triggering manual or scheduled runs

The backend merges these layers and injects the final config into the test execution environment via the `MBSS_TEST_CONFIG` environment variable, which the base fixture reads.

---

# 4. Startup Discovery

On service startup:

1. Read configured test root directory (e.g. `/opt/mbss-portal/dist/tests/`)
2. Recursively scan all folders
3. For each test folder:

   * Parse `meta.json`
   * Parse `constants.json`
   * Check that a single `*.spec.js` exists
4. Upsert DB entries in `test_definitions`
5. Mark any DB tests not found in the filesystem as `active = false` or delete

This ensures the DB exactly reflects the deployed test bundle.

---

# 5. Data Model (DB Schema Summary)

## 5.1 test_definitions

* `id` (uuid)
* `test_key` (string, unique)
* `folder_path` (string)
* `spec_path` (string)
* `meta` (jsonb)
* `constants` (jsonb)
* `overrides` (jsonb)
* `active` (bool)
* timestamps

## 5.2 runs

* `id` (uuid)
* `status` (queued | running | passed | failed | skipped | cancelled)
* `trigger_type` (manual | schedule)
* `schedule_id` (nullable)
* `run_overrides` (jsonb)
* `started_at`
* `finished_at`
* `summary` (jsonb) – pass/fail counts, durations

## 5.3 run_tests

* `id` (uuid)
* `run_id` (fk)
* `test_id` (fk)
* `status`
* `duration_ms`
* `error_message`
* `artifacts` (jsonb)

## 5.4 schedules

* `id`
* `name`
* `cron`
* `enabled`
* `last_triggered_at`
* `selector` (jsonb: folder | tags | explicit)
* `default_run_overrides` (jsonb)

## 5.5 system_settings

* key/value JSON config
* includes: `retention_days`

---

# 6. Scheduler

## 6.1 Trigger Logic

A background tick runs every **30 seconds**:

* Evaluate each schedule via cron expression
* If due:

  * Evaluate selector → get list of tests
  * If zero tests → create run with status `skipped`
  * Else create a run (queued)

## 6.2 Selector Types

### Folder:

```
{
  "type": "folder",
  "folderPrefix": "login/"
}
```

### Tags:

```
{
  "type": "tags",
  "tags": ["smoke", "critical"]
}
```

### Explicit:

```
{
  "type": "explicit",
  "testKeys": ["login-basic", "domestic-transfer"]
}
```

## 6.3 Schedule Overlapping Behavior

* If a schedule triggers but its **previous run is still running**, skip this new one
* Also enforce a **max runtime timeout** of 1 day

---

# 7. Run Execution

## 7.1 Run Queue

`runs.status = 'queued'` is the queue.

Worker loop:

```
SELECT next run FOR UPDATE SKIP LOCKED
if running runs < MAX_CONCURRENT_RUNS (default 10)
  → execute run
```

## 7.2 Execution Flow

Per run:

1. Launch **one Playwright browser instance**
2. For each test file (sequential):

   * Create a **new browser context**
   * Execute the single test in that file
   * Capture logs, screenshots, video
3. Close browser at end

## 7.3 Artifacts

Stored under configured folder:

```
<artifact_root>/<runId>/<testKey>/
    video.mp4
    trace.zip
    console.log
    screenshot.jpg (live only, overwritten)
```

### Live Screenshots

* Captured every **5 seconds** during test execution
* Saved to artifact directory as `live.jpg` (overwritten each capture)
* UI polls for latest screenshot via `GET /api/runs/:runId/tests/:testKey/screenshot`
* Removed after run ends

### Cleanup

Scheduler deletes runs + artifacts older than `retention_days`.

---

# 8. Logging (Polling + History)

## 8.1 Live Logs via Polling

During run, logs are appended to a file in real-time. UI polls:

```
GET /api/runs/:runId/tests/:testKey/logs?offset=<byteOffset>
```

Returns new log content since the given offset. Only **Playwright test output** and orchestrator logs are captured.
No page-level console logs.

## 8.2 History

After run ends, logs are stored in:

```
console.log
```

under the test’s artifact folder.

---

# 9. Polling Endpoints for Live Updates

The UI polls the following endpoints for real-time updates:

### Run Status Polling

```
GET /api/runs/:runId
```

Returns current run status, progress, and test statuses. Poll every **3 seconds**.

### Live Logs Polling

```
GET /api/runs/:runId/tests/:testKey/logs?offset=<byteOffset>
```

Returns log content starting from byte offset. Poll every **2 seconds** during active test.

Response:
```json
{
  "content": "[STEP] Navigating to login page\n[STEP] Filling credentials\n",
  "offset": 1024,
  "finished": false
}
```

### Live Screenshot Polling

```
GET /api/runs/:runId/tests/:testKey/screenshot
```

Returns the latest screenshot image (JPEG). Poll every **5 seconds** during active test.
Returns 404 if no screenshot available yet.

---

# 10. Front-End Behavior (Vue)

## 10.1 Test Catalog Screen

* Folder-based sidebar (recursive tree)
* Tag filters
* Table of tests: friendly name, last status
* Buttons:

  * **Run selected**
  * **Add schedule**

## 10.2 Run View

Left panel: list of tests in run

* Current test shows spinner
* Passed: green
* Failed: red

Right panel:

* Live screenshot area
* Logs area (scrolling)
* After completion: video + trace links

## 10.3 Schedules Screen

* Table of schedules: name, next run, last run
* Add/edit/delete schedules
* Selector editor

## 10.4 Identity Prompt

If no `localStorage.userEmail`:

* Prompt modal: "Enter your email"
* Store and send with manual run triggers

---

# 11. HTTP Endpoints

## Test Data

```
GET /tests
GET /tests/<testKey>
PUT /tests/<testKey>/overrides
```

## Runs

```
POST /runs                              (manual trigger)
GET /runs                               (list runs, with filters)
GET /runs/<runId>                       (run details + test statuses)
GET /runs/<runId>/tests                 (all tests in run)
GET /runs/<runId>/tests/<testKey>       (single test details)
GET /runs/<runId>/tests/<testKey>/logs  (live/historical logs)
GET /runs/<runId>/tests/<testKey>/screenshot (live screenshot)
POST /runs/<runId>/cancel               (cancel running/queued run)
```

## Artifacts

```
GET /artifacts/<runId>/<testKey>/<file> (video, trace, final logs)
```

## Schedules

```
GET /schedules
POST /schedules
PUT /schedules/<id>
DELETE /schedules/<id>
```

---

# 12. Configuration File

Example (JSON):

```json
{
  "testRoot": "./dist-tests",
  "artifactRoot": "../data/artifacts",
  "databasePath": "../data/mbss.db",
  "maxConcurrentRuns": 10,
  "retentionDays": 30
}
```

**Note:** `databasePath` and `artifactRoot` are outside the `dist/` folder to persist across deployments.

---

# 13. Deployment

### Folder Structure (Production)

```
/opt/mbss-portal/
├── dist/                    # Deployed artifacts (replaced on each deploy)
│   ├── backend/             # Compiled Node.js backend
│   ├── frontend/            # Built Vue frontend (static files)
│   └── tests/               # Compiled Playwright tests
└── data/                    # Persistent data (NOT replaced on deploy)
    ├── mbss.db              # SQLite database
    └── artifacts/           # Test run artifacts
```

### Deployment Steps

1. Build the test suite locally → produces `dist/tests/`
2. Build backend → produces `dist/backend/`
3. Build frontend → produces `dist/frontend/`
4. Copy entire `dist/` folder to server (e.g., `/opt/mbss-portal/dist/`)
5. Restart service (systemd)
6. Startup discovery syncs database automatically

---

# 14. Future Extensions (not in scope now)

* Parallel test execution per run
* CI integrations
* RBAC / SSO
* Distributed execution
* Notifications
* Automatic drift analysis

---

# 15. Environments & Access Control

## 15.1 Target Environments

The system supports multiple **target environments** (e.g., `SIT1`, `SIT2`, `UAT`, `PROD`).

* Environment identifiers are defined as a **static enum/config** in source code (no DB table required).
* Example config snippet:

  ```json
  {
    "environments": [
      { "code": "SIT1", "name": "System Integration Test 1", "isProd": false },
      { "code": "SIT2", "name": "System Integration Test 2", "isProd": false },
      { "code": "PROD", "name": "Production", "isProd": true }
    ]
  }
  ```

> **Note:** Environments are defined in `config/environments.json` and loaded at startup.

Each **run** targets exactly **one environment**. The selected environment is stored with the run and used when resolving configuration.

### DB Fields

* `runs.environment` (text) – environment code (e.g. `"SIT1"`)
* `schedules.environment` (text) – environment code used for scheduled runs

## 15.2 Environment-Specific Configuration

Tests may require different credentials, URLs, and constants per environment.

### constants.json Format (Extended)

Each test's `constants.json` can include shared and per-environment values:

```json
{
  "shared": {
    "timeoutMs": 30000
  },
  "environments": {
    "SIT1": {
      "baseUrl": "https://sit1.example.com",
      "username": "qa.user",
      "cardNumber": "4111...SIT1"
    },
    "SIT2": {
      "baseUrl": "https://sit2.example.com",
      "username": "qa.user2",
      "cardNumber": "4111...SIT2"
    },
    "PROD": {
      "baseUrl": "https://prod.example.com",
      "username": "prod.user",
      "cardNumber": "4111...PROD"
    }
  }
}
```

> Note: For v1, all environment-specific test data is still LLE and stored as JSON files/DB as required by the project. There is no dedicated secrets vault in this version.

### Effective Config with Environment

When running a test for environment `ENV`, the backend constructs:

```ts
effectiveConfig = {
  ...constants.shared,
  ...(constants.environments?.[ENV] || {}),
  ...(overrides.shared || {}),
  ...(overrides.environments?.[ENV] || {}),
  ...(run_overrides || {})
};
```

Where:

* `constants` comes from `constants.json`
* `overrides` comes from `test_definitions.overrides` (optionally structured similarly)
* `run_overrides` can include env-specific tweaks when triggering a run

The selected environment code is also passed into the test via `effectiveConfig.envCode` so test code can log/use it if needed.

## 15.3 User Access Control (Environment-Level)

There is still **no RBAC/SSO** in v1, but we enforce a simple **environment-level access list** based on user email.

### Identity Capture

* On first visit, the frontend prompts the user to enter their **email address**.
* Email is stored in `localStorage.userEmail` and reused on subsequent sessions.
* On manual actions (creating runs, creating/modifying schedules), the email is sent to the backend.

### Local User Access JSON

A local JSON file defines which environments each user can trigger runs on:

```json
{
  "users": [
    {
      "email": "qa.user@corp.com",
      "environments": ["SIT1", "SIT2"]
    },
    {
      "email": "uat.user@corp.com",
      "environments": ["SIT1", "SIT2", "PROD"]
    }
  ]
}
```

* This file is loaded by the backend at startup and optionally cached in memory.
* The mapping is LLE and maintained alongside the service config.

### Enforcement Rules

1. **Manual Run Creation**

   * Request must include `userEmail` and `environment`.
   * Backend checks:

     * `userEmail` exists in the local user JSON.
     * Requested `environment` is listed in that user’s `environments` array.
   * If not allowed → HTTP 403 and run is not created.

2. **Schedule Creation/Update**

   * Request must include `userEmail` and `environment`.
   * Same permission check as manual runs.
   * The environment is stored in `schedules.environment` and used for all runs created by that schedule.

3. **Run Execution**

   * Worker does not re-check user access; it trusts `runs.environment` as already validated at creation time.

4. **Visibility**

   * For v1, **viewing** tests, runs, and history is not restricted.
   * Only **executing** runs (manual and scheduled) is subject to environment-level access control.

5. **Audit Fields**

   * `runs.triggered_by_email` (string) – set for manual and scheduled runs.
   * `schedules.created_by_email` / `updated_by_email` – optional fields for audit.

## 15.4 UI Changes for Environments

### Test Run Dialog

* When user selects tests and clicks "Run":

  * Dialog includes required field **Target Environment** (dropdown of configured env codes/names).
  * Uses the current user’s allowed environments (from backend) as options; others are disabled/hidden.

### Schedules UI

* When creating a schedule from folder/tag/test:

  * Must choose **Target Environment**.
  * Backend validates the environment against the user’s access.

### Test List & Run History

* Each run row shows `environment` (e.g., `SIT1`, `PROD`).
* Test detail views and run detail views show environment label for clarity.

---

# End of TRD
