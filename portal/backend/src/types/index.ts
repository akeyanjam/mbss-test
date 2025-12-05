// Shared TypeScript types and interfaces

// ============================================================================
// Test Definitions
// ============================================================================

export interface TestDefinition {
  id: string;
  testKey: string;
  folderPath: string;
  specPath: string;
  meta: TestMeta;
  constants: TestConstants;
  overrides?: Record<string, any> | undefined;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMeta {
  testKey: string;
  friendlyName: string;
  description: string;
  tags: string[];
}

export interface TestConstants {
  shared?: Record<string, any>;
  environments?: Record<string, Record<string, any>>;
}

// ============================================================================
// Runs
// ============================================================================

export interface Run {
  id: string;
  status: RunStatus;
  triggerType: 'manual' | 'schedule';
  environment: string;
  scheduleId?: string | undefined;
  triggeredByEmail?: string | undefined;
  runOverrides?: Record<string, any> | undefined;
  metadata?: RunMetadata | undefined;
  startedAt?: Date | undefined;
  finishedAt?: Date | undefined;
  summary?: RunSummary | undefined;
  createdAt: Date;
}

export interface RunMetadata {
  selectionType: 'manual' | 'tags' | 'folder' | 'schedule';
  tags?: string[];
  folder?: string;
  testNames?: string[];
}

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';

export interface RunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface RunTest {
  id: string;
  runId: string;
  testId: string;
  testKey: string;
  status: RunTestStatus;
  durationMs?: number | undefined;
  errorMessage?: string | undefined;
  artifacts?: TestArtifacts | undefined;
  startedAt?: Date | undefined;
  finishedAt?: Date | undefined;
}

export type RunTestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestArtifacts {
  video?: string | undefined;
  trace?: string | undefined;
  consoleLog?: string | undefined;
  screenshots?: string[] | undefined;
}

// ============================================================================
// Schedules
// ============================================================================

export interface Schedule {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  environment: string;
  lastTriggeredAt?: Date | undefined;
  selector: ScheduleSelector;
  defaultRunOverrides?: Record<string, any> | undefined;
  createdByEmail?: string | undefined;
  updatedByEmail?: string | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleSelector =
  | { type: 'folder'; folderPrefix: string }
  | { type: 'tags'; tags: string[] }
  | { type: 'explicit'; testKeys: string[] };

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateRunRequest {
  testKeys: string[];
  environment: string;
  userEmail: string;
  overrides?: Record<string, any> | undefined;
  metadata?: RunMetadata | undefined;
}

export interface CreateScheduleRequest {
  name: string;
  cron: string;
  environment: string;
  selector: ScheduleSelector;
  userEmail: string;
  defaultRunOverrides?: Record<string, any> | undefined;
}

export interface UpdateScheduleRequest {
  name?: string | undefined;
  cron?: string | undefined;
  enabled?: boolean | undefined;
  environment?: string | undefined;
  selector?: ScheduleSelector | undefined;
  userEmail: string;
  defaultRunOverrides?: Record<string, any> | undefined;
}

export interface LogsResponse {
  content: string;
  offset: number;
  finished: boolean;
}

export interface RunWithTests extends Run {
  tests: RunTest[];
}

// ============================================================================
// Discovery Types
// ============================================================================

export interface DiscoveredTest {
  folderPath: string;
  specPath: string;
  meta: TestMeta;
  constants: TestConstants;
}
