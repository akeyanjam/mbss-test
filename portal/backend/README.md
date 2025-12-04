# MBSS Portal - Backend

Node.js backend service for the MBSS UI Test Dashboard & Runner.

## Tech Stack

- **Runtime**: Node.js with TypeScript (ESM)
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Test Execution**: Playwright
- **Scheduler**: cron-parser

## Project Structure

```
src/
├── api/              # HTTP API routes
│   ├── tests.ts      # Test catalog endpoints
│   ├── runs.ts       # Run management endpoints
│   ├── schedules.ts  # Schedule management endpoints
│   └── artifacts.ts  # Artifact serving endpoints
├── core/             # Core business logic
│   ├── discovery/    # Test discovery on startup
│   ├── scheduler/    # Cron-based scheduler
│   ├── executor/     # Playwright test execution
│   ├── queue/        # Run queue processor
│   └── cleanup/      # Artifact cleanup worker
├── db/               # Database layer
│   ├── index.ts      # Database initialization
│   ├── migrations.ts # Auto-migrations
│   └── models/       # Database models (tests, runs, schedules)
├── config/           # Configuration management
├── utils/            # Shared utilities
├── types/            # TypeScript type definitions
└── index.ts          # Application entry point

config/               # Runtime configuration files
├── app.config.json   # Application settings
├── environments.json # Environment definitions (SIT1, SIT2, PROD)
└── users.json        # User access control per environment
```

## Development

### Prerequisites

- Node.js 18+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production build
- `npm run typecheck` - Type check without building

## Configuration

### Environment Variables (.env)

See `.env.example` for all available options.

### Config Files

- **app.config.json**: Application settings (ports, paths, limits)
- **environments.json**: Target environment definitions (SIT1, SIT2, UAT, PROD)
- **users.json**: User access control per environment

## API Endpoints

### Tests
- `GET /api/tests` - List all tests
- `GET /api/tests/:testKey` - Get test details
- `PUT /api/tests/:testKey/overrides` - Update test overrides

### Runs
- `POST /api/runs` - Create manual run
- `GET /api/runs` - List runs
- `GET /api/runs/:runId` - Get run details
- `GET /api/runs/:runId/tests` - Get run tests

### Schedules
- `GET /api/schedules` - List schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Artifacts
- `GET /artifacts/:runId/:testKey/:file` - Download artifact

### Health
- `GET /health` - Health check

## Polling Endpoints

For live updates, the UI polls:
- `GET /api/runs/:runId` - Run status (every 3s)
- `GET /api/runs/:runId/tests/:testKey/logs?offset=N` - Live logs (every 2s)
- `GET /api/runs/:runId/tests/:testKey/screenshot` - Live screenshot (every 5s)

## Database Schema

SQLite database with auto-migrations. Schema is defined in `src/db/migrations.ts`.

Main tables:
- `test_definitions` - Test metadata and configuration
- `runs` - Test run records
- `run_tests` - Individual test results per run
- `schedules` - Automated schedule definitions
- `system_settings` - System configuration
- `schema_migrations` - Migration tracking

## License

UNLICENSED - Internal use only
