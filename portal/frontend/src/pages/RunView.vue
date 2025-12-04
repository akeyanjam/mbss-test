<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  getRunById,
  getTestLogs,
  getTestScreenshot,
  cancelRun,
  getArtifactUrl,
} from '@/api/client'
import type { RunWithTests, RunTest, LogsResponse } from '@/types'

// Components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import RunStatusBadge from '@/components/shared/RunStatusBadge.vue'
import TestStatusBadge from '@/components/shared/TestStatusBadge.vue'
import EnvironmentBadge from '@/components/shared/EnvironmentBadge.vue'
import {
  ArrowLeft,
  Ban,
  Clock,
  User,
  Video,
  FileText,
  Download,
  Image,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

// State
const run = ref<RunWithTests | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedTestKey = ref<string | null>(null)
const isCancelling = ref(false)

// Live updates state
const logs = ref('')
const logOffset = ref(0)
const screenshotUrl = ref<string | null>(null)
const isLogFinished = ref(false)

// Polling intervals
let runPollInterval: ReturnType<typeof setInterval> | null = null
let logPollInterval: ReturnType<typeof setInterval> | null = null
let screenshotPollInterval: ReturnType<typeof setInterval> | null = null

// Computed
const runId = computed(() => route.params.runId as string)

const selectedTest = computed(() => {
  if (!run.value || !selectedTestKey.value) return null
  return run.value.tests.find(t => t.testKey === selectedTestKey.value) ?? null
})

const isRunActive = computed(() => {
  return run.value?.status === 'queued' || run.value?.status === 'running'
})

const isTestRunning = computed(() => {
  return selectedTest.value?.status === 'running'
})

const formattedDuration = computed(() => {
  if (!run.value?.summary?.durationMs) return null
  const ms = run.value.summary.durationMs
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
})

const formattedDate = computed(() => {
  if (!run.value?.createdAt) return ''
  return new Date(run.value.createdAt).toLocaleString()
})

// Fetch run data
async function fetchRun() {
  try {
    const data = await getRunById(runId.value)
    run.value = data

    // Auto-select first running test, or first pending, or first test
    if (!selectedTestKey.value && data.tests.length > 0) {
      const running = data.tests.find(t => t.status === 'running')
      const pending = data.tests.find(t => t.status === 'pending')
      selectedTestKey.value = running?.testKey ?? pending?.testKey ?? data.tests[0]?.testKey ?? null
    }

    // Stop polling if run is complete
    if (!isRunActive.value && runPollInterval) {
      clearInterval(runPollInterval)
      runPollInterval = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch run'
  } finally {
    isLoading.value = false
  }
}

// Fetch logs for selected test
async function fetchLogs() {
  if (!selectedTestKey.value || isLogFinished.value) return

  try {
    const data: LogsResponse = await getTestLogs(runId.value, selectedTestKey.value, logOffset.value)
    if (data.content) {
      logs.value += data.content
      logOffset.value = data.offset
    }
    isLogFinished.value = data.finished
  } catch {
    // Ignore log fetch errors
  }
}

// Fetch screenshot for selected test
async function fetchScreenshot() {
  if (!selectedTestKey.value || !isTestRunning.value) {
    screenshotUrl.value = null
    return
  }

  try {
    const blob = await getTestScreenshot(runId.value, selectedTestKey.value)
    if (blob) {
      // Revoke old URL to prevent memory leaks
      if (screenshotUrl.value) {
        URL.revokeObjectURL(screenshotUrl.value)
      }
      screenshotUrl.value = URL.createObjectURL(blob)
    }
  } catch {
    screenshotUrl.value = null
  }
}

// Cancel run
async function handleCancel() {
  if (!run.value) return

  isCancelling.value = true
  try {
    await cancelRun(run.value.id)
    toast.success('Run cancelled')
    await fetchRun()
  } catch (e) {
    toast.error('Failed to cancel run', {
      description: e instanceof Error ? e.message : 'Unknown error',
    })
  } finally {
    isCancelling.value = false
  }
}

// Select a test
function selectTest(testKey: string) {
  selectedTestKey.value = testKey
  // Reset logs for new test
  logs.value = ''
  logOffset.value = 0
  isLogFinished.value = false
  screenshotUrl.value = null
  // Fetch immediately
  fetchLogs()
  fetchScreenshot()
}

// Start polling
function startPolling() {
  // Poll run status every 3 seconds
  runPollInterval = setInterval(fetchRun, 3000)

  // Poll logs every 2 seconds
  logPollInterval = setInterval(fetchLogs, 2000)

  // Poll screenshot every 5 seconds
  screenshotPollInterval = setInterval(fetchScreenshot, 5000)
}

// Stop polling
function stopPolling() {
  if (runPollInterval) {
    clearInterval(runPollInterval)
    runPollInterval = null
  }
  if (logPollInterval) {
    clearInterval(logPollInterval)
    logPollInterval = null
  }
  if (screenshotPollInterval) {
    clearInterval(screenshotPollInterval)
    screenshotPollInterval = null
  }
  if (screenshotUrl.value) {
    URL.revokeObjectURL(screenshotUrl.value)
    screenshotUrl.value = null
  }
}

// Watch for test selection changes
watch(selectedTestKey, () => {
  logs.value = ''
  logOffset.value = 0
  isLogFinished.value = false
  fetchLogs()
  fetchScreenshot()
})

// Watch for run completion to stop log polling
watch(isTestRunning, (running) => {
  if (!running && screenshotPollInterval) {
    clearInterval(screenshotPollInterval)
    screenshotPollInterval = null
    if (screenshotUrl.value) {
      URL.revokeObjectURL(screenshotUrl.value)
      screenshotUrl.value = null
    }
  }
})

onMounted(async () => {
  await fetchRun()
  if (run.value) {
    startPolling()
    fetchLogs()
    fetchScreenshot()
  }
})

onUnmounted(() => {
  stopPolling()
})

// Get artifact URL helper
function getVideoUrl(test: RunTest): string | null {
  if (!test.artifacts?.video) return null
  return getArtifactUrl(runId.value, test.testKey, test.artifacts.video)
}

function getLogsUrl(test: RunTest): string | null {
  if (!test.artifacts?.consoleLog) return null
  return getArtifactUrl(runId.value, test.testKey, test.artifacts.consoleLog)
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="border-b border-border bg-card px-6 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" @click="router.push('/runs')">
            <ArrowLeft class="w-4 h-4" />
          </Button>
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-semibold text-foreground">Run Details</h1>
              <RunStatusBadge v-if="run" :status="run.status" />
              <EnvironmentBadge v-if="run" :code="run.environment" />
            </div>
            <div v-if="run" class="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span class="flex items-center gap-1">
                <Clock class="w-3.5 h-3.5" />
                {{ formattedDate }}
              </span>
              <span v-if="run.triggeredByEmail" class="flex items-center gap-1">
                <User class="w-3.5 h-3.5" />
                {{ run.triggeredByEmail }}
              </span>
              <span v-if="formattedDuration">
                Duration: {{ formattedDuration }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="isRunActive"
            variant="destructive"
            :disabled="isCancelling"
            @click="handleCancel"
          >
            <Ban class="w-4 h-4 mr-2" />
            {{ isCancelling ? 'Cancelling...' : 'Cancel Run' }}
          </Button>
        </div>
      </div>

      <!-- Summary Bar -->
      <div v-if="run?.summary" class="flex items-center gap-6 mt-4 pt-4 border-t border-border">
        <div class="text-center">
          <p class="text-2xl font-semibold text-foreground">{{ run.summary.totalTests }}</p>
          <p class="text-xs text-muted-foreground">Total</p>
        </div>
        <Separator orientation="vertical" class="h-10" />
        <div class="text-center">
          <p class="text-2xl font-semibold text-green-600">{{ run.summary.passed }}</p>
          <p class="text-xs text-muted-foreground">Passed</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-red-600">{{ run.summary.failed }}</p>
          <p class="text-xs text-muted-foreground">Failed</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-semibold text-gray-500">{{ run.summary.skipped }}</p>
          <p class="text-xs text-muted-foreground">Skipped</p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 p-6">
      <div class="space-y-4">
        <Skeleton class="h-8 w-64" />
        <Skeleton class="h-64 w-full" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex-1 p-6">
      <div class="text-center py-12">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" class="mt-4" @click="fetchRun">
          Retry
        </Button>
      </div>
    </div>

    <!-- Main Content -->
    <ResizablePanelGroup v-else-if="run" direction="horizontal" class="flex-1">
      <!-- Test List Panel -->
      <ResizablePanel :defaultSize="30" :minSize="20" :maxSize="50">
        <div class="h-full border-r border-border bg-card">
          <div class="px-4 py-3 border-b border-border">
            <h2 class="text-sm font-medium text-foreground">
              Tests ({{ run.tests.length }})
            </h2>
          </div>
          <ScrollArea class="h-[calc(100%-48px)]">
            <div class="p-2">
              <button
                v-for="test in run.tests"
                :key="test.testKey"
                class="w-full text-left px-3 py-2.5 rounded-md transition-colors mb-1"
                :class="[
                  selectedTestKey === test.testKey
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                ]"
                @click="selectTest(test.testKey)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-medium truncate flex-1">
                    {{ test.testKey }}
                  </span>
                  <TestStatusBadge
                    :status="test.status"
                    :showIcon="true"
                    :class="[
                      selectedTestKey === test.testKey ? 'bg-primary-foreground/20 border-primary-foreground/30' : ''
                    ]"
                  />
                </div>
                <div v-if="test.durationMs" class="text-xs mt-1 opacity-70">
                  {{ (test.durationMs / 1000).toFixed(1) }}s
                </div>
              </button>
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle />

      <!-- Detail Panel -->
      <ResizablePanel :defaultSize="70">
        <div class="h-full flex flex-col">
          <!-- No Test Selected -->
          <div v-if="!selectedTest" class="flex-1 flex items-center justify-center text-muted-foreground">
            Select a test to view details
          </div>

          <!-- Test Details -->
          <template v-else>
            <!-- Test Header -->
            <div class="px-6 py-4 border-b border-border bg-muted/30">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-foreground">{{ selectedTest.testKey }}</h3>
                  <div class="flex items-center gap-2 mt-1">
                    <TestStatusBadge :status="selectedTest.status" />
                    <span v-if="selectedTest.durationMs" class="text-sm text-muted-foreground">
                      {{ (selectedTest.durationMs / 1000).toFixed(1) }}s
                    </span>
                  </div>
                </div>
                <!-- Artifact Links -->
                <div v-if="selectedTest.artifacts" class="flex items-center gap-2">
                  <Button
                    v-if="getVideoUrl(selectedTest)"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a :href="getVideoUrl(selectedTest)!" target="_blank">
                      <Video class="w-4 h-4 mr-1" />
                      Video
                    </a>
                  </Button>
                  <Button
                    v-if="getLogsUrl(selectedTest)"
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a :href="getLogsUrl(selectedTest)!" target="_blank">
                      <Download class="w-4 h-4 mr-1" />
                      Logs
                    </a>
                  </Button>
                </div>
              </div>
              <!-- Error Message -->
              <div
                v-if="selectedTest.errorMessage"
                class="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <p class="text-sm text-destructive font-mono">{{ selectedTest.errorMessage }}</p>
              </div>
            </div>

            <!-- Content Area -->
            <div class="flex-1 flex flex-col overflow-hidden">
              <!-- Live Screenshot (only when running) -->
              <div
                v-if="isTestRunning && screenshotUrl"
                class="p-4 border-b border-border bg-muted/20"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Image class="w-4 h-4 text-muted-foreground" />
                  <span class="text-sm font-medium text-muted-foreground">Live Screenshot</span>
                  <Badge variant="outline" class="text-xs bg-blue-100 text-blue-700 border-blue-200">
                    Updating every 5s
                  </Badge>
                </div>
                <div class="rounded-lg overflow-hidden border border-border bg-black">
                  <img
                    :src="screenshotUrl"
                    alt="Live screenshot"
                    class="w-full h-auto max-h-[300px] object-contain"
                  />
                </div>
              </div>

              <!-- Video Player (when completed) -->
              <div
                v-else-if="selectedTest.artifacts?.video && !isTestRunning"
                class="p-4 border-b border-border bg-muted/20"
              >
                <div class="flex items-center gap-2 mb-2">
                  <Video class="w-4 h-4 text-muted-foreground" />
                  <span class="text-sm font-medium text-muted-foreground">Recording</span>
                </div>
                <div class="rounded-lg overflow-hidden border border-border bg-black">
                  <video
                    :src="getVideoUrl(selectedTest)!"
                    controls
                    class="w-full max-h-[300px]"
                  />
                </div>
              </div>

              <!-- Logs -->
              <div class="flex-1 flex flex-col min-h-0">
                <div class="px-4 py-2 border-b border-border flex items-center gap-2">
                  <FileText class="w-4 h-4 text-muted-foreground" />
                  <span class="text-sm font-medium text-muted-foreground">Console Output</span>
                  <Badge
                    v-if="isTestRunning && !isLogFinished"
                    variant="outline"
                    class="text-xs bg-blue-100 text-blue-700 border-blue-200"
                  >
                    Live
                  </Badge>
                </div>
                <ScrollArea class="flex-1 bg-gray-900">
                  <pre class="p-4 text-sm text-gray-100 font-mono whitespace-pre-wrap">{{ logs || 'No logs available yet...' }}</pre>
                </ScrollArea>
              </div>
            </div>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
