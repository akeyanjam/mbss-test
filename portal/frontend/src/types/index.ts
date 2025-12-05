// ============================================================================
// Environment Types
// ============================================================================

export interface Environment {
  code: string
  name: string
  isProd: boolean
}

// ============================================================================
// Test Types
// ============================================================================

export interface TestConstants {
  shared?: Record<string, unknown>
  environments?: Record<string, Record<string, unknown>>
}

export interface TestDefinition {
  id: string
  testKey: string
  friendlyName: string
  description?: string
  folderPath: string
  specPath: string
  tags: string[]
  constants: TestConstants
  overrides?: TestConstants
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FolderNode {
  name: string
  path: string
  testCount: number
  children: FolderNode[]
}

// ============================================================================
// Run Types
// ============================================================================

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled'
export type TriggerType = 'manual' | 'schedule'
export type RunTestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped'

export interface RunSummary {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
}

export interface TestArtifacts {
  consoleLog?: string
  video?: string
  trace?: string
  screenshots?: string[]
}

export interface RunTest {
  runId: string
  testId: string
  testKey: string
  status: RunTestStatus
  durationMs?: number
  errorMessage?: string
  artifacts?: TestArtifacts
  startedAt?: string
  completedAt?: string
}

export interface RunMetadata {
  selectionType: 'manual' | 'tags' | 'folder' | 'schedule'
  tags?: string[]
  folder?: string
  testNames?: string[]
}

export interface Run {
  id: string
  status: RunStatus
  triggerType: TriggerType
  environment: string
  scheduleId?: string
  triggeredByEmail?: string
  runOverrides?: Record<string, unknown>
  metadata?: RunMetadata
  summary?: RunSummary
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface RunWithTests extends Run {
  tests: RunTest[]
}

// ============================================================================
// Schedule Types
// ============================================================================

export type ScheduleSelector =
  | { type: 'folder'; folderPrefix: string }
  | { type: 'tags'; tags: string[] }
  | { type: 'explicit'; testKeys: string[] }

export interface Schedule {
  id: string
  name: string
  cron: string
  enabled: boolean
  environment: string
  lastTriggeredAt?: string
  selector: ScheduleSelector
  defaultRunOverrides?: Record<string, unknown>
  createdByEmail?: string
  updatedByEmail?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateRunRequest {
  testKeys: string[]
  environment: string
  userEmail: string
  overrides?: Record<string, unknown>
  metadata?: RunMetadata
}

export interface CreateScheduleRequest {
  name: string
  cron: string
  environment: string
  selector: ScheduleSelector
  userEmail: string
  defaultRunOverrides?: Record<string, unknown>
}

export interface UpdateScheduleRequest {
  name?: string
  cron?: string
  enabled?: boolean
  environment?: string
  selector?: ScheduleSelector
  userEmail: string
  defaultRunOverrides?: Record<string, unknown>
}

export interface LogsResponse {
  content: string
  offset: number
  finished: boolean
}

export interface ArtifactInfo {
  name: string
  size: number
  modified: string
  url: string
}
