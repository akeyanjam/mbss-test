# MBSS Portal - Backend API Documentation

**Base URL**: `http://localhost:3000`

**Content-Type**: `application/json`

---

## Table of Contents

1. [Health & System](#health--system)
2. [Environments](#environments)
3. [Tests](#tests)
4. [Runs](#runs)
5. [Schedules](#schedules)
6. [Artifacts](#artifacts)
7. [Data Models](#data-models)

---

## Health & System

### Health Check

**GET** `/health`

Check if the backend service is running.

**Response**: `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-12-04T19:00:00.000Z",
  "environments": ["SIT1", "SIT2", "PROD"]
}
```

---

## Environments

### Get All Environments

**GET** `/api/environments`

Get list of all available test environments.

**Response**: `200 OK`
```json
{
  "environments": [
    {
      "code": "SIT1",
      "name": "System Integration Test 1",
      "isProd": false
    },
    {
      "code": "SIT2",
      "name": "System Integration Test 2",
      "isProd": false
    },
    {
      "code": "PROD",
      "name": "Production",
      "isProd": true
    }
  ]
}
```

### Get User Environments

**GET** `/api/user/environments?email={email}`

Get environments accessible by a specific user.

**Query Parameters**:
- `email` (required): User email address

**Response**: `200 OK`
```json
{
  "email": "qa.user@bofa.com",
  "environments": [
    {
      "code": "SIT1",
      "name": "System Integration Test 1",
      "isProd": false
    },
    {
      "code": "SIT2",
      "name": "System Integration Test 2",
      "isProd": false
    }
  ]
}
```

**Error Response**: `400 Bad Request`
```json
{
  "error": "email query parameter is required"
}
```

---

## Tests

### List All Tests

**GET** `/api/tests`

Get all active tests with optional filters.

**Query Parameters**:
- `folder` (optional): Filter by folder prefix (e.g., `auth`)
- `tags` (optional): Filter by tags, comma-separated (e.g., `smoke,regression`)

**Response**: `200 OK`
```json
{
  "tests": [
    {
      "id": "uuid-here",
      "testKey": "auth.basic-login",
      "friendlyName": "Basic Login Flow",
      "description": "Tests the basic login functionality",
      "folderPath": "auth/basic-login",
      "specPath": "auth/basic-login/basic-login.spec.js",
      "tags": ["smoke", "auth"],
      "constants": {
        "shared": {
          "timeoutMs": 30000,
          "retryCount": 2
        },
        "environments": {
          "SIT1": {
            "baseUrl": "https://sit1.example.com",
            "email": "test@example.com",
            "password": "password123"
          },
          "SIT2": { /* ... */ },
          "PROD": { /* ... */ }
        }
      },
      "overrides": null,
      "isActive": true,
      "createdAt": "2025-12-04T10:00:00.000Z",
      "updatedAt": "2025-12-04T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Get Test by Key

**GET** `/api/tests/:testKey`

Get details of a specific test.

**Path Parameters**:
- `testKey`: Unique test identifier (e.g., `auth.basic-login`)

**Response**: `200 OK`
```json
{
  "id": "uuid-here",
  "testKey": "auth.basic-login",
  "friendlyName": "Basic Login Flow",
  "description": "Tests the basic login functionality",
  "folderPath": "auth/basic-login",
  "specPath": "auth/basic-login/basic-login.spec.js",
  "tags": ["smoke", "auth"],
  "constants": { /* ... */ },
  "overrides": null,
  "isActive": true,
  "createdAt": "2025-12-04T10:00:00.000Z",
  "updatedAt": "2025-12-04T10:00:00.000Z"
}
```

**Error Response**: `404 Not Found`
```json
{
  "error": "Test not found"
}
```

### Get All Tags

**GET** `/api/tests/tags`

Get all unique tags across all tests.

**Response**: `200 OK`
```json
{
  "tags": ["smoke", "regression", "auth", "critical"]
}
```

### Get Folder Tree

**GET** `/api/tests/folders`

Get hierarchical folder structure of tests.

**Response**: `200 OK`
```json
{
  "folders": [
    {
      "name": "auth",
      "path": "auth",
      "testCount": 2,
      "children": [
        {
          "name": "basic-login",
          "path": "auth/basic-login",
          "testCount": 1,
          "children": []
        }
      ]
    }
  ]
}
```

### Update Test Overrides

**PUT** `/api/tests/:testKey/overrides`

Update runtime overrides for a test (does not modify constants.json).

**Path Parameters**:
- `testKey`: Unique test identifier

**Request Body**:
```json
{
  "shared": {
    "timeoutMs": 60000
  },
  "environments": {
    "SIT1": {
      "baseUrl": "https://custom-sit1.example.com"
    }
  }
}
```

**Response**: `200 OK`
```json
{
  "id": "uuid-here",
  "testKey": "auth.basic-login",
  "overrides": {
    "shared": {
      "timeoutMs": 60000
    },
    "environments": {
      "SIT1": {
        "baseUrl": "https://custom-sit1.example.com"
      }
    }
  },
  /* ... other test fields ... */
}
```

**Error Responses**:
- `400 Bad Request`: Invalid overrides format
- `404 Not Found`: Test not found

---

## Runs

### List Runs

**GET** `/api/runs`

Get list of test runs with optional filters.

**Query Parameters**:
- `status` (optional): Filter by status (`queued`, `running`, `passed`, `failed`, `cancelled`)
- `environment` (optional): Filter by environment code
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response**: `200 OK`
```json
{
  "runs": [
    {
      "id": "run-uuid",
      "status": "passed",
      "triggerType": "manual",
      "environment": "SIT1",
      "scheduleId": null,
      "triggeredByEmail": "qa.user@bofa.com",
      "runOverrides": null,
      "summary": {
        "totalTests": 5,
        "passed": 5,
        "failed": 0,
        "skipped": 0,
        "durationMs": 45000
      },
      "createdAt": "2025-12-04T14:00:00.000Z",
      "startedAt": "2025-12-04T14:00:05.000Z",
      "completedAt": "2025-12-04T14:00:50.000Z"
    }
  ],
  "count": 1
}
```

### Create Run

**POST** `/api/runs`

Create a new manual test run.

**Request Body**:
```json
{
  "testKeys": ["auth.basic-login", "auth.logout"],
  "environment": "SIT1",
  "userEmail": "qa.user@bofa.com",
  "overrides": {
    "timeoutMs": 60000
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "run-uuid",
  "status": "queued",
  "triggerType": "manual",
  "environment": "SIT1",
  "scheduleId": null,
  "triggeredByEmail": "qa.user@bofa.com",
  "runOverrides": {
    "timeoutMs": 60000
  },
  "summary": null,
  "createdAt": "2025-12-04T14:00:00.000Z",
  "startedAt": null,
  "completedAt": null
}
```

**Error Responses**:
- `400 Bad Request`: Missing or invalid fields
  ```json
  {
    "error": "testKeys is required and must be a non-empty array"
  }
  ```
- `403 Forbidden`: User doesn't have access to environment
  ```json
  {
    "error": "User qa.user@bofa.com does not have access to environment PROD"
  }
  ```

### Get Run Details

**GET** `/api/runs/:runId`

Get detailed run information including all test statuses.

**Path Parameters**:
- `runId`: Run UUID

**Response**: `200 OK`
```json
{
  "id": "run-uuid",
  "status": "running",
  "triggerType": "manual",
  "environment": "SIT1",
  "scheduleId": null,
  "triggeredByEmail": "qa.user@bofa.com",
  "runOverrides": null,
  "summary": null,
  "createdAt": "2025-12-04T14:00:00.000Z",
  "startedAt": "2025-12-04T14:00:05.000Z",
  "completedAt": null,
  "tests": [
    {
      "runId": "run-uuid",
      "testId": "test-uuid",
      "testKey": "auth.basic-login",
      "status": "passed",
      "durationMs": 8500,
      "errorMessage": null,
      "artifacts": {
        "consoleLog": "console.log",
        "video": "video.webm",
        "trace": null
      },
      "startedAt": "2025-12-04T14:00:05.000Z",
      "completedAt": "2025-12-04T14:00:13.500Z"
    }
  ]
}
```

**Error Response**: `404 Not Found`
```json
{
  "error": "Run not found"
}
```

### Get Run Tests

**GET** `/api/runs/:runId/tests`

Get all tests in a run.

**Response**: `200 OK`
```json
{
  "tests": [
    {
      "runId": "run-uuid",
      "testId": "test-uuid",
      "testKey": "auth.basic-login",
      "status": "running",
      "durationMs": null,
      "errorMessage": null,
      "artifacts": null,
      "startedAt": "2025-12-04T14:00:05.000Z",
      "completedAt": null
    }
  ]
}
```

### Get Specific Test from Run

**GET** `/api/runs/:runId/tests/:testKey`

Get details of a specific test within a run.

**Response**: `200 OK`
```json
{
  "runId": "run-uuid",
  "testId": "test-uuid",
  "testKey": "auth.basic-login",
  "status": "passed",
  "durationMs": 8500,
  "errorMessage": null,
  "artifacts": {
    "consoleLog": "console.log",
    "video": "video.webm",
    "trace": null
  },
  "startedAt": "2025-12-04T14:00:05.000Z",
  "completedAt": "2025-12-04T14:00:13.500Z"
}
```

### Get Test Logs (Polling)

**GET** `/api/runs/:runId/tests/:testKey/logs?offset={offset}`

Get console logs for a running or completed test. Use for live log streaming via polling.

**Query Parameters**:
- `offset` (optional): Byte offset to start reading from (default: 0)

**Response**: `200 OK`
```json
{
  "content": "[2025-12-04T14:00:05.123Z] Starting test: auth.basic-login\n[2025-12-04T14:00:05.456Z] [CONSOLE] log: Navigating to login page\n",
  "offset": 256,
  "finished": false
}
```

**Use Case**: Poll every 2 seconds with the returned `offset` to get new log content.

```javascript
// Example polling logic
let offset = 0;
const pollLogs = async () => {
  const response = await fetch(`/api/runs/${runId}/tests/${testKey}/logs?offset=${offset}`);
  const data = await response.json();
  
  // Append new content to UI
  appendLogs(data.content);
  offset = data.offset;
  
  // Continue polling if not finished
  if (!data.finished) {
    setTimeout(pollLogs, 2000);
  }
};
```

### Get Live Screenshot (Polling)

**GET** `/api/runs/:runId/tests/:testKey/screenshot`

Get the latest screenshot of a running test. Returns JPEG image.

**Response**: `200 OK` (image/jpeg)

**Use Case**: Poll every 5 seconds to display live test execution.

```javascript
// Example polling logic
const pollScreenshot = () => {
  const img = document.getElementById('live-screenshot');
  img.src = `/api/runs/${runId}/tests/${testKey}/screenshot?t=${Date.now()}`;
  
  if (!testFinished) {
    setTimeout(pollScreenshot, 5000);
  }
};
```

**Error Response**: `404 Not Found`
```json
{
  "error": "No screenshot available"
}
```

### Cancel Run

**POST** `/api/runs/:runId/cancel`

Cancel a queued or running test run.

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Run cancelled"
}
```

**Error Responses**:
- `400 Bad Request`: Cannot cancel run with current status
  ```json
  {
    "error": "Cannot cancel run with status: passed"
  }
  ```
- `404 Not Found`: Run not found

---

## Schedules

### List Schedules

**GET** `/api/schedules`

Get all schedules.

**Response**: `200 OK`
```json
{
  "schedules": [
    {
      "id": "schedule-uuid",
      "name": "Nightly Smoke Tests",
      "cron": "0 0 2 * * *",
      "enabled": true,
      "environment": "SIT1",
      "lastTriggeredAt": "2025-12-04T02:00:00.000Z",
      "selector": {
        "type": "tags",
        "tags": ["smoke"]
      },
      "defaultRunOverrides": null,
      "createdByEmail": "admin.user@bofa.com",
      "updatedByEmail": null,
      "createdAt": "2025-12-01T10:00:00.000Z",
      "updatedAt": "2025-12-01T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Get Schedule

**GET** `/api/schedules/:id`

Get details of a specific schedule.

**Response**: `200 OK`
```json
{
  "id": "schedule-uuid",
  "name": "Nightly Smoke Tests",
  "cron": "0 0 2 * * *",
  "enabled": true,
  "environment": "SIT1",
  "lastTriggeredAt": "2025-12-04T02:00:00.000Z",
  "selector": {
    "type": "tags",
    "tags": ["smoke"]
  },
  "defaultRunOverrides": null,
  "createdByEmail": "admin.user@bofa.com",
  "updatedByEmail": null,
  "createdAt": "2025-12-01T10:00:00.000Z",
  "updatedAt": "2025-12-01T10:00:00.000Z"
}
```

### Create Schedule

**POST** `/api/schedules`

Create a new schedule.

**Request Body**:
```json
{
  "name": "Nightly Smoke Tests",
  "cron": "0 0 2 * * *",
  "environment": "SIT1",
  "selector": {
    "type": "tags",
    "tags": ["smoke"]
  },
  "userEmail": "admin.user@bofa.com",
  "defaultRunOverrides": {
    "timeoutMs": 60000
  }
}
```

**Selector Types**:
1. **Folder-based**:
   ```json
   {
     "type": "folder",
     "folderPrefix": "auth"
   }
   ```

2. **Tag-based**:
   ```json
   {
     "type": "tags",
     "tags": ["smoke", "regression"]
   }
   ```

3. **Explicit test list**:
   ```json
   {
     "type": "explicit",
     "testKeys": ["auth.basic-login", "auth.logout"]
   }
   ```

**Response**: `201 Created`
```json
{
  "id": "schedule-uuid",
  "name": "Nightly Smoke Tests",
  "cron": "0 0 2 * * *",
  "enabled": true,
  "environment": "SIT1",
  "lastTriggeredAt": null,
  "selector": {
    "type": "tags",
    "tags": ["smoke"]
  },
  "defaultRunOverrides": {
    "timeoutMs": 60000
  },
  "createdByEmail": "admin.user@bofa.com",
  "updatedByEmail": null,
  "createdAt": "2025-12-04T14:00:00.000Z",
  "updatedAt": "2025-12-04T14:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid cron expression
  ```json
  {
    "error": "Invalid cron expression"
  }
  ```
- `403 Forbidden`: User doesn't have access to environment

### Update Schedule

**PUT** `/api/schedules/:id`

Update an existing schedule.

**Request Body** (all fields optional except `userEmail`):
```json
{
  "name": "Updated Schedule Name",
  "cron": "0 0 3 * * *",
  "enabled": false,
  "environment": "SIT2",
  "selector": {
    "type": "folder",
    "folderPrefix": "auth"
  },
  "defaultRunOverrides": null,
  "userEmail": "admin.user@bofa.com"
}
```

**Response**: `200 OK`
```json
{
  "id": "schedule-uuid",
  "name": "Updated Schedule Name",
  /* ... updated fields ... */
}
```

### Delete Schedule

**DELETE** `/api/schedules/:id`

Delete a schedule.

**Response**: `200 OK`
```json
{
  "success": true,
  "message": "Schedule deleted"
}
```

### Toggle Schedule

**POST** `/api/schedules/:id/toggle`

Enable or disable a schedule.

**Request Body**:
```json
{
  "enabled": false
}
```

**Response**: `200 OK`
```json
{
  "id": "schedule-uuid",
  "enabled": false,
  /* ... other schedule fields ... */
}
```

---

## Artifacts

### Download Artifact

**GET** `/artifacts/:runId/:testKey/:file`

Download a test artifact (video, trace, logs).

**Path Parameters**:
- `runId`: Run UUID
- `testKey`: Test key
- `file`: Artifact filename (e.g., `video.webm`, `console.log`, `trace.zip`)

**Response**: File download with appropriate Content-Type

**Common Artifacts**:
- `console.log` - Test execution logs
- `video.webm` - Screen recording
- `trace.zip` - Playwright trace file

**Error Response**: `404 Not Found`
```json
{
  "error": "Artifact not found"
}
```

### List Artifacts

**GET** `/artifacts/:runId/:testKey`

List all available artifacts for a test.

**Response**: `200 OK`
```json
{
  "artifacts": [
    {
      "name": "console.log",
      "size": 12345,
      "modified": "2025-12-04T14:00:50.000Z",
      "url": "/artifacts/run-uuid/auth.basic-login/console.log"
    },
    {
      "name": "video.webm",
      "size": 1234567,
      "modified": "2025-12-04T14:00:50.000Z",
      "url": "/artifacts/run-uuid/auth.basic-login/video.webm"
    }
  ]
}
```

---

## Data Models

### Environment

```typescript
interface Environment {
  code: string;           // e.g., "SIT1", "PROD"
  name: string;           // e.g., "System Integration Test 1"
  isProd: boolean;        // true if production environment
}
```

### TestDefinition

```typescript
interface TestDefinition {
  id: string;                    // UUID
  testKey: string;               // Unique key (e.g., "auth.basic-login")
  friendlyName: string;          // Display name
  description?: string;          // Test description
  folderPath: string;            // Relative folder path
  specPath: string;              // Path to .spec.js file
  tags: string[];                // Test tags
  constants: TestConstants;      // Test configuration
  overrides?: TestConstants;     // Runtime overrides
  isActive: boolean;             // Discovery status
  createdAt: Date;
  updatedAt: Date;
}

interface TestConstants {
  shared?: Record<string, any>;
  environments?: {
    [envCode: string]: Record<string, any>;
  };
}
```

### Run

```typescript
type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
type TriggerType = 'manual' | 'schedule';

interface Run {
  id: string;                    // UUID
  status: RunStatus;
  triggerType: TriggerType;
  environment: string;           // Environment code
  scheduleId?: string;           // If triggered by schedule
  triggeredByEmail?: string;     // User who triggered
  runOverrides?: Record<string, any>;
  summary?: RunSummary;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface RunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}
```

### RunTest

```typescript
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

interface RunTest {
  runId: string;
  testId: string;
  testKey: string;
  status: TestStatus;
  durationMs?: number;
  errorMessage?: string;
  artifacts?: TestArtifacts;
  startedAt?: Date;
  completedAt?: Date;
}

interface TestArtifacts {
  consoleLog?: string;           // Filename
  video?: string;                // Filename
  trace?: string;                // Filename
}
```

### Schedule

```typescript
interface Schedule {
  id: string;                    // UUID
  name: string;
  cron: string;                  // Cron expression
  enabled: boolean;
  environment: string;           // Environment code
  lastTriggeredAt?: Date;
  selector: ScheduleSelector;
  defaultRunOverrides?: Record<string, any>;
  createdByEmail?: string;
  updatedByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
}

type ScheduleSelector = 
  | { type: 'folder'; folderPrefix: string; }
  | { type: 'tags'; tags: string[]; }
  | { type: 'explicit'; testKeys: string[]; };
```

---

## Polling Strategy

For live updates, the UI should poll the following endpoints:

### Run Status Polling
**Frequency**: Every 3 seconds  
**Endpoint**: `GET /api/runs/:runId`  
**Stop Condition**: `status` is `passed`, `failed`, or `cancelled`

### Live Logs Polling
**Frequency**: Every 2 seconds  
**Endpoint**: `GET /api/runs/:runId/tests/:testKey/logs?offset={offset}`  
**Stop Condition**: `finished` is `true`

### Live Screenshot Polling
**Frequency**: Every 5 seconds  
**Endpoint**: `GET /api/runs/:runId/tests/:testKey/screenshot`  
**Stop Condition**: Test status is not `running`

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes**:
- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request data
- `403 Forbidden` - User doesn't have permission
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## CORS

CORS is enabled for all origins in development. Configure appropriately for production.

---

## Authentication

Currently, authentication is handled via email-based access control defined in `config/users.json`. The UI should:

1. Prompt user for email on first visit
2. Store email in localStorage
3. Include email in requests that require it (`userEmail` field)
4. Check user's allowed environments via `/api/user/environments?email={email}`

Future enhancement: Integrate with corporate SSO/LDAP.

---

## Rate Limiting

No rate limiting is currently implemented. Consider adding for production use.

---

## WebSocket Alternative

This API uses **HTTP polling** instead of WebSockets for live updates. See [Polling Strategy](#polling-strategy) section for implementation details.
