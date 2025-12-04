/**
 * API Client - Typed fetch wrapper for MBSS backend
 */

const API_BASE = ''  // Uses Vite proxy in dev, same origin in prod

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | undefined>
}

class ApiError extends Error {
  status: number
  statusText: string
  data?: { error?: string }

  constructor(status: number, statusText: string, data?: { error?: string }) {
    super(data?.error || statusText)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
    this.data = data
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options

  // Build URL with query params
  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += `?${queryString}`
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Handle non-JSON responses (like screenshots)
  const contentType = response.headers.get('content-type')
  if (contentType?.startsWith('image/')) {
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText)
    }
    return response.blob() as Promise<T>
  }

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, data)
  }

  return data as T
}

// ============================================================================
// API Methods
// ============================================================================

import type {
  Environment,
  TestDefinition,
  Run,
  RunWithTests,
  RunTest,
  Schedule,
  CreateRunRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  LogsResponse,
  ArtifactInfo,
  RunStatus,
} from '@/types'

// Health
export async function getHealth() {
  return request<{ status: string; timestamp: string; environments: string[] }>('/health')
}

// Environments
export async function getEnvironments() {
  return request<{ environments: Environment[] }>('/api/environments')
}

export async function getUserEnvironments(email: string) {
  return request<{ email: string; environments: Environment[] }>('/api/user/environments', {
    params: { email },
  })
}

// Tests
export async function getTests(filters?: { folder?: string; tags?: string }) {
  return request<{ tests: TestDefinition[]; count: number }>('/api/tests', {
    params: filters,
  })
}

export async function getTestByKey(testKey: string) {
  return request<TestDefinition>(`/api/tests/${encodeURIComponent(testKey)}`)
}

export async function getTags() {
  return request<{ tags: string[] }>('/api/tests/tags')
}

export async function getFolders() {
  return request<{ folders: string[] }>('/api/tests/folders')
}

export async function updateTestOverrides(testKey: string, overrides: Record<string, unknown>) {
  return request<TestDefinition>(`/api/tests/${encodeURIComponent(testKey)}/overrides`, {
    method: 'PUT',
    body: overrides,
  })
}

// Runs
export async function getRuns(filters?: {
  status?: RunStatus
  environment?: string
  limit?: number
  offset?: number
}) {
  return request<{ runs: Run[]; count: number }>('/api/runs', {
    params: filters as Record<string, string | number | undefined>,
  })
}

export async function createRun(data: CreateRunRequest) {
  return request<Run>('/api/runs', {
    method: 'POST',
    body: data,
  })
}

export async function getRunById(runId: string) {
  return request<RunWithTests>(`/api/runs/${runId}`)
}

export async function getRunTests(runId: string) {
  return request<{ tests: RunTest[] }>(`/api/runs/${runId}/tests`)
}

export async function getRunTest(runId: string, testKey: string) {
  return request<RunTest>(`/api/runs/${runId}/tests/${encodeURIComponent(testKey)}`)
}

export async function getTestLogs(runId: string, testKey: string, offset = 0) {
  return request<LogsResponse>(`/api/runs/${runId}/tests/${encodeURIComponent(testKey)}/logs`, {
    params: { offset },
  })
}

export async function getTestScreenshot(runId: string, testKey: string): Promise<Blob | null> {
  try {
    return await request<Blob>(`/api/runs/${runId}/tests/${encodeURIComponent(testKey)}/screenshot`)
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return null
    }
    throw e
  }
}

export async function cancelRun(runId: string) {
  return request<{ success: boolean; message: string }>(`/api/runs/${runId}/cancel`, {
    method: 'POST',
  })
}

// Schedules
export async function getSchedules() {
  return request<{ schedules: Schedule[]; count: number }>('/api/schedules')
}

export async function getScheduleById(id: string) {
  return request<Schedule>(`/api/schedules/${id}`)
}

export async function createSchedule(data: CreateScheduleRequest) {
  return request<Schedule>('/api/schedules', {
    method: 'POST',
    body: data,
  })
}

export async function updateSchedule(id: string, data: UpdateScheduleRequest) {
  return request<Schedule>(`/api/schedules/${id}`, {
    method: 'PUT',
    body: data,
  })
}

export async function deleteSchedule(id: string) {
  return request<{ success: boolean; message: string }>(`/api/schedules/${id}`, {
    method: 'DELETE',
  })
}

export async function toggleSchedule(id: string, enabled: boolean) {
  return request<Schedule>(`/api/schedules/${id}/toggle`, {
    method: 'POST',
    body: { enabled },
  })
}

// Artifacts
export async function getArtifacts(runId: string, testKey: string) {
  return request<{ artifacts: ArtifactInfo[] }>(`/artifacts/${runId}/${encodeURIComponent(testKey)}`)
}

export function getArtifactUrl(runId: string, testKey: string, file: string) {
  return `${API_BASE}/artifacts/${runId}/${encodeURIComponent(testKey)}/${file}`
}

// Export error class for handling
export { ApiError }
