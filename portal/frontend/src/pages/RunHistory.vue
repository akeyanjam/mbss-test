<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getRuns } from '@/api/client'
import type { Run, RunStatus } from '@/types'

// Components
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import RunStatusBadge from '@/components/shared/RunStatusBadge.vue'
import EnvironmentBadge from '@/components/shared/EnvironmentBadge.vue'
import {
  RefreshCw,
  Clock,
  User,
  Calendar,
  ChevronRight,
  Inbox,
} from 'lucide-vue-next'

const router = useRouter()

// State
const runs = ref<Run[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<RunStatus | 'all'>('all')
const isRefreshing = ref(false)

// Computed
const filteredRuns = computed(() => {
  if (statusFilter.value === 'all') return runs.value
  return runs.value.filter(r => r.status === statusFilter.value)
})

// Fetch runs
async function fetchRuns(showRefresh = false) {
  if (showRefresh) {
    isRefreshing.value = true
  } else {
    isLoading.value = true
  }
  error.value = null

  try {
    const data = await getRuns({ limit: 100 })
    runs.value = data.runs
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch runs'
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

function navigateToRun(runId: string) {
  router.push(`/runs/${runId}`)
}

onMounted(() => {
  fetchRuns()
})
</script>

<template>
  <div class="flex flex-col max-w-[1400px]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Run History</h1>
        <p class="text-muted-foreground mt-1">
          {{ runs.length }} runs
        </p>
      </div>
      <div class="flex items-center gap-3">
        <!-- Status Filter -->
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="passed">Passed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          @click="fetchRuns(true)"
          :disabled="isRefreshing"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isRefreshing }" />
        </Button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="space-y-3">
      <div class="space-y-3">
        <Skeleton v-for="i in 8" :key="i" class="h-20 w-full" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error">
      <div class="text-center py-12">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" class="mt-4" @click="fetchRuns()">
          Retry
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredRuns.length === 0">
      <div class="text-center py-12">
        <Inbox class="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p class="text-muted-foreground">
          {{ statusFilter === 'all' ? 'No runs yet' : `No ${statusFilter} runs` }}
        </p>
        <Button
          v-if="statusFilter !== 'all'"
          variant="link"
          @click="statusFilter = 'all'"
        >
          Show all runs
        </Button>
      </div>
    </div>

    <!-- Runs List -->
    <div v-else class="space-y-2">
        <button
          v-for="run in filteredRuns"
          :key="run.id"
          class="w-full text-left p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
          @click="navigateToRun(run.id)"
        >
          <div class="flex items-start justify-between gap-4">
            <!-- Left: Status & Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <RunStatusBadge :status="run.status" />
                <EnvironmentBadge :code="run.environment" />
                <span
                  v-if="run.triggerType === 'schedule'"
                  class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
                >
                  <Calendar class="w-3 h-3 inline mr-1" />
                  Scheduled
                </span>
              </div>

              <!-- Summary -->
              <div v-if="run.summary" class="mt-2 flex items-center gap-4 text-sm">
                <span class="text-foreground font-medium">
                  {{ run.summary.totalTests }} tests
                </span>
                <span class="text-green-600">{{ run.summary.passed }} passed</span>
                <span v-if="run.summary.failed > 0" class="text-red-600">
                  {{ run.summary.failed }} failed
                </span>
                <span v-if="run.summary.skipped > 0" class="text-gray-500">
                  {{ run.summary.skipped }} skipped
                </span>
              </div>

              <!-- Meta -->
              <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span class="flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  {{ formatDate(run.createdAt) }}
                </span>
                <span v-if="run.summary?.durationMs">
                  Duration: {{ formatDuration(run.summary.durationMs) }}
                </span>
                <span v-if="run.triggeredByEmail" class="flex items-center gap-1">
                  <User class="w-3 h-3" />
                  {{ run.triggeredByEmail }}
                </span>
              </div>
            </div>

            <!-- Right: Arrow -->
            <ChevronRight class="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
          </div>
        </button>
    </div>
  </div>
</template>
