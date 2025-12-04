# MBSS UI Test Dashboard & Runner

Centralized dashboard, test runner, and scheduler for Playwright UI tests.

## Project Structure

```
BofA.Mbss.TestPortal/
├── portal/
│   ├── backend/          # Node.js backend service
│   └── frontend/         # Vue 3 frontend (TBD)
├── tests/                # Playwright test suite
├── docs/                 # Documentation
├── build-all.js          # Production build script
└── package.json          # Root package.json
```

## Quick Start (Development)

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or manually:
cd portal/backend && npm install
cd ../../tests && npm install
```

### 2. Build Tests

```bash
cd tests
npm run build
```

This creates `tests/dist-tests/` with compiled test files.

### 3. Run Backend

```bash
cd portal/backend

# Copy tests to backend (required for discovery)
npm run copy-tests

# Start backend in dev mode
npm run dev

# Or use the combined command:
npm run dev:full
```

The backend will:
- Initialize SQLite database at `../data/mbss.db`
- Discover tests from `./dist-tests/`
- Start HTTP server on port 3000
- Start queue processor, scheduler, and cleanup worker

### 4. Test the API

```bash
# Health check
curl http://localhost:3000/health

# List tests
curl http://localhost:3000/api/tests

# List environments
curl http://localhost:3000/api/environments
```

## Development Workflow

### When You Modify Tests

```bash
# 1. Build tests
cd tests
npm run build

# 2. Copy to backend
cd ../portal/backend
npm run copy-tests

# 3. Restart backend (or it will auto-reload with tsx watch)
```

### When You Modify Backend

The backend uses `tsx watch` so it auto-reloads on file changes.

## Production Build

```bash
# From root directory
npm run build
```

This creates:
```
dist/
├── backend/              # Compiled backend + config
├── tests/                # Built test suite
└── frontend/             # UI (placeholder)

data/                     # Created on first run
├── mbss.db               # SQLite database
└── artifacts/            # Test artifacts (videos, logs, etc.)
```

## Deployment

### 1. Build

```bash
npm run build
```

### 2. Copy to Server

```bash
# Copy dist/ folder to target server
scp -r dist/ user@server:/opt/mbss-portal/
```

### 3. Install Production Dependencies

```bash
ssh user@server
cd /opt/mbss-portal/dist/backend
npm install --production
```

### 4. Run

```bash
# Set environment variables if needed
export PORT=3000
export NODE_ENV=production

# Start the server
node index.js
```

Or use a process manager like PM2:

```bash
pm2 start index.js --name mbss-portal
pm2 save
pm2 startup
```

## Configuration

### Backend Config (`portal/backend/config/`)

- **`app.config.json`** - Application settings (port, paths, retention, etc.)
- **`environments.json`** - Available environments (SIT1, SIT2, PROD)
- **`users.json`** - User access control per environment

### Environment Variables (`.env`)

```bash
PORT=3000
NODE_ENV=development
TEST_ROOT=./dist-tests
ARTIFACT_ROOT=../data/artifacts
DATABASE_PATH=../data/mbss.db
DEBUG=true
```

## API Endpoints

### Tests
- `GET /api/tests` - List all tests
- `GET /api/tests/:testKey` - Get test details
- `PUT /api/tests/:testKey/overrides` - Update test overrides

### Runs
- `POST /api/runs` - Create a new run
- `GET /api/runs` - List runs
- `GET /api/runs/:runId` - Get run details
- `POST /api/runs/:runId/cancel` - Cancel a run
- `GET /api/runs/:runId/tests/:testKey/logs?offset=N` - Get test logs (polling)
- `GET /api/runs/:runId/tests/:testKey/screenshot` - Get live screenshot

### Schedules
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Artifacts
- `GET /artifacts/:runId/:testKey/:file` - Download artifact

## Database

SQLite database with auto-migrations on startup.

**Schema:**
- `test_definitions` - Test metadata and configuration
- `runs` - Test run records
- `run_tests` - Individual test results per run
- `schedules` - Automated schedule definitions
- `system_settings` - System configuration
- `schema_migrations` - Migration tracking

## Architecture

- **Backend**: Node.js + Express + SQLite
- **Test Execution**: Playwright (spawned as child processes)
- **Live Updates**: HTTP polling (no WebSocket)
- **Scheduler**: Cron-based (checks every 30s)
- **Queue**: Processes queued runs (checks every 5s)
- **Cleanup**: Deletes old runs/artifacts (runs hourly)

## Troubleshooting

### Tests not discovered

```bash
# Make sure tests are built
cd tests && npm run build

# Copy to backend
cd ../portal/backend && npm run copy-tests

# Restart backend
```

### Database errors

```bash
# Delete and recreate database
rm ../data/mbss.db
# Restart backend - it will recreate with migrations
```

### Port already in use

```bash
# Change port in .env or app.config.json
PORT=3001
```

## Documentation

See `docs/mbss_test.md` for full Technical Requirements Document.

## License

UNLICENSED - Internal use only
