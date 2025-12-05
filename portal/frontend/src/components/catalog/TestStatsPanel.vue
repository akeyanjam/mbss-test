<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getTestStats, type TestStats } from '@/api/client'

// UI Components
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { VisuallyHidden } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle2,
  XCircle,
  SkipForward,
  ExternalLink,
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  testKey: string | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const router = useRouter()

// State
const isLoading = ref(false)
const error = ref<string | null>(null)
const stats = ref<TestStats | null>(null)

// Load stats when panel opens
watch(() => [props.open, props.testKey], async ([open, testKey]) => {
  if (open && testKey && typeof testKey === 'string') {
    await loadStats(testKey)
  } else {
    stats.value = null
    error.value = null
  }
}, { immediate: true })

async function loadStats(testKey: string) {
  isLoading.value = true
  error.value = null
  
  try {
    stats.value = await getTestStats(testKey)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load stats'
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('close')
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffHours < 48) return 'Yesterday'
  return date.toLocaleDateString()
}

function getPassRateColor(rate: number): string {
  if (rate >= 90) return 'text-green-600 dark:text-green-400'
  if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function navigateToRun(runId: string) {
  router.push(`/runs/${runId}`)
  handleClose()
}
</script>

<template>
  <Sheet :open="open" @update:open="(val) => !val && handleClose()">
    <SheetContent 
      side="right" 
      class="w-full sm:max-w-[50vw] p-0 flex flex-col"
      :aria-describedby="undefined"
    >
      <!-- Hidden title for accessibility when loading/error -->
      <VisuallyHidden v-if="isLoading || error || !stats" as-child>
        <SheetTitle>Test Statistics</SheetTitle>
      </VisuallyHidden>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex-1 p-6 space-y-4">
        <Skeleton class="h-8 w-3/4" />
        <div class="grid grid-cols-4 gap-4">
          <Skeleton class="h-20" />
          <Skeleton class="h-20" />
          <Skeleton class="h-20" />
          <Skeleton class="h-20" />
        </div>
        <Skeleton class="h-32 w-full" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex-1 p-6 flex flex-col items-center justify-center gap-4">
        <AlertCircle class="w-12 h-12 text-destructive" />
        <p class="text-destructive text-center">{{ error }}</p>
        <Button variant="outline" @click="handleClose">Close</Button>
      </div>

      <!-- Content -->
      <template v-else-if="stats">
        <!-- Header -->
        <SheetHeader class="px-6 pt-6 pb-4 border-b border-border">
          <div class="flex items-start justify-between gap-4 pr-8">
            <div class="space-y-1 min-w-0">
              <SheetTitle class="text-xl font-semibold truncate">
                {{ stats.testName }}
              </SheetTitle>
              <p class="text-sm text-muted-foreground">
                Test execution statistics (last 30 days)
              </p>
            </div>
            <!-- Trend indicator -->
            <div class="flex items-center gap-2 shrink-0">
              <div 
                v-if="stats.trend.direction === 'up'"
                class="flex items-center gap-1 text-green-600 dark:text-green-400"
              >
                <TrendingUp class="w-5 h-5" />
                <span class="text-sm font-medium">Improving</span>
              </div>
              <div 
                v-else-if="stats.trend.direction === 'down'"
                class="flex items-center gap-1 text-red-600 dark:text-red-400"
              >
                <TrendingDown class="w-5 h-5" />
                <span class="text-sm font-medium">Declining</span>
              </div>
              <div 
                v-else
                class="flex items-center gap-1 text-muted-foreground"
              >
                <Minus class="w-5 h-5" />
                <span class="text-sm font-medium">Stable</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <!-- Main content area - flex column to fill space -->
        <div class="flex-1 flex flex-col min-h-0 p-6 space-y-6">
          <!-- Overall Stats Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            <!-- Total Runs -->
            <div class="rounded-lg border bg-card p-4">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Total Runs</p>
              <p class="text-2xl font-bold mt-1">{{ stats.overall.totalRuns }}</p>
            </div>
            
            <!-- Pass Rate -->
            <div class="rounded-lg border bg-card p-4">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Pass Rate</p>
              <p class="text-2xl font-bold mt-1" :class="getPassRateColor(stats.overall.passRate)">
                {{ stats.overall.passRate }}%
              </p>
              <Progress 
                :model-value="stats.overall.passRate" 
                class="h-1.5 mt-2"
              />
            </div>
            
            <!-- Avg Duration -->
            <div class="rounded-lg border bg-card p-4">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Avg Duration</p>
              <p class="text-2xl font-bold mt-1 flex items-center gap-1">
                <Clock class="w-5 h-5 text-muted-foreground" />
                {{ formatDuration(stats.overall.avgDuration) }}
              </p>
            </div>
            
            <!-- Pass/Fail/Skip -->
            <div class="rounded-lg border bg-card p-4">
              <p class="text-xs text-muted-foreground uppercase tracking-wide">Results</p>
              <div class="flex items-center gap-3 mt-2">
                <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle2 class="w-4 h-4" />
                  <span class="font-medium">{{ stats.overall.passed }}</span>
                </div>
                <div class="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <XCircle class="w-4 h-4" />
                  <span class="font-medium">{{ stats.overall.failed }}</span>
                </div>
                <div class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <SkipForward class="w-4 h-4" />
                  <span class="font-medium">{{ stats.overall.skipped }}</span>
                </div>
              </div>
            </div>
          </div>

          <Separator class="shrink-0" />

          <!-- Stats by Environment -->
          <div class="shrink-0">
            <h3 class="text-sm font-medium text-foreground mb-3">By Environment</h3>
            <div v-if="stats.byEnvironment.length === 0" class="text-sm text-muted-foreground py-4 text-center">
              No execution data available
            </div>
            <div v-else class="space-y-3">
              <div 
                v-for="env in stats.byEnvironment" 
                :key="env.environment"
                class="rounded-lg border bg-card p-4"
              >
                <div class="flex items-center justify-between mb-2">
                  <Badge variant="outline" class="font-mono">{{ env.environment }}</Badge>
                  <span class="text-sm" :class="getPassRateColor(env.passRate)">
                    {{ env.passRate }}% pass rate
                  </span>
                </div>
                <Progress :model-value="env.passRate" class="h-1.5 mb-3" />
                <div class="flex items-center justify-between text-sm text-muted-foreground">
                  <div class="flex items-center gap-4">
                    <span>{{ env.totalRuns }} runs</span>
                    <span class="text-green-600 dark:text-green-400">{{ env.passed }} passed</span>
                    <span class="text-red-600 dark:text-red-400">{{ env.failed }} failed</span>
                  </div>
                  <div v-if="env.lastRun" class="flex items-center gap-2">
                    <span>Last: {{ formatDate(env.lastRun.date) }}</span>
                    <Badge 
                      :variant="env.lastRun.status === 'passed' ? 'default' : 'destructive'"
                      class="text-xs"
                    >
                      {{ env.lastRun.status }}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator class="shrink-0" />

          <!-- Recent Runs - fills remaining space with internal scroll -->
          <div class="flex-1 flex flex-col min-h-0">
            <h3 class="text-sm font-medium text-foreground mb-3 shrink-0">Recent Runs</h3>
            <div v-if="stats.recentRuns.length === 0" class="text-sm text-muted-foreground py-4 text-center">
              No recent runs
            </div>
            <div v-else class="flex-1 min-h-0 rounded-lg border overflow-hidden">
              <ScrollArea class="h-full">
                <div class="divide-y divide-border">
                  <div 
                    v-for="run in stats.recentRuns" 
                    :key="run.runId"
                    class="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
                    @click="navigateToRun(run.runId)"
                  >
                    <div class="flex items-center gap-3">
                      <CheckCircle2 
                        v-if="run.status === 'passed'" 
                        class="w-4 h-4 text-green-600 dark:text-green-400" 
                      />
                      <XCircle 
                        v-else-if="run.status === 'failed'" 
                        class="w-4 h-4 text-red-600 dark:text-red-400" 
                      />
                      <SkipForward 
                        v-else 
                        class="w-4 h-4 text-yellow-600 dark:text-yellow-400" 
                      />
                      <Badge variant="outline" class="font-mono text-xs">{{ run.environment }}</Badge>
                      <span class="text-sm text-muted-foreground">{{ formatDate(run.date) }}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span v-if="run.duration" class="text-sm text-muted-foreground">
                        {{ formatDuration(run.duration) }}
                      </span>
                      <ExternalLink class="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
