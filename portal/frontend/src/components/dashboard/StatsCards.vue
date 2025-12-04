<script setup lang="ts">
import { computed } from 'vue'
import { Activity, TrendingUp, TrendingDown, AlertTriangle, PlayCircle } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const props = defineProps<{
  overview: {
    activeRuns: {
      running: number
      queued: number
      currentRuns: Array<{
        id: string
        environment: string
        progress: { completed: number; total: number }
      }>
    }
    passRate: {
      percentage: number
      trend: number
    }
    totalExecutions: {
      count: number
      trend: number
      byEnvironment: Record<string, number>
    }
    flakyTests: {
      count: number
      critical: number
    }
  }
}>()

const router = useRouter()

const passRateColor = computed(() => {
  if (props.overview.passRate.percentage >= 90) return 'text-green-600'
  if (props.overview.passRate.percentage >= 70) return 'text-yellow-600'
  return 'text-red-600'
})

const passRateBg = computed(() => {
  if (props.overview.passRate.percentage >= 90) return 'bg-green-50 border-green-200'
  if (props.overview.passRate.percentage >= 70) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
})

function goToActiveRun() {
  if (props.overview?.activeRuns?.currentRuns?.length > 0) {
    router.push(`/runs/${props.overview.activeRuns.currentRuns[0].id}`)
  }
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <!-- Active Runs Card -->
    <div 
      class="rounded-lg border bg-card p-6 cursor-pointer hover:shadow-md transition-shadow"
      :class="overview.activeRuns.running > 0 ? 'border-blue-200 bg-blue-50' : ''"
      @click="goToActiveRun"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <PlayCircle class="h-5 w-5 text-blue-600" />
          <h3 class="text-sm font-medium text-muted-foreground">Active Runs</h3>
        </div>
      </div>
      <div class="mt-3">
        <div class="text-3xl font-bold">
          {{ overview.activeRuns.running }}
        </div>
        <p class="text-sm text-muted-foreground mt-1">
          {{ overview.activeRuns.queued }} queued
        </p>
        <div v-if="overview.activeRuns.currentRuns.length > 0" class="mt-2 text-xs text-blue-600">
          <div v-for="run in overview.activeRuns.currentRuns" :key="run.id" class="flex items-center justify-between">
            <span>{{ run.environment }}</span>
            <span>{{ run.progress.completed }}/{{ run.progress.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pass Rate Card -->
    <div 
      class="rounded-lg border p-6"
      :class="passRateBg"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Activity class="h-5 w-5" :class="passRateColor" />
          <h3 class="text-sm font-medium text-muted-foreground">Pass Rate</h3>
        </div>
      </div>
      <div class="mt-3">
        <div class="text-3xl font-bold" :class="passRateColor">
          {{ overview.passRate.percentage }}%
        </div>
        <div class="flex items-center gap-1 mt-1 text-sm">
          <TrendingUp v-if="overview.passRate.trend > 0" class="h-4 w-4 text-green-600" />
          <TrendingDown v-else-if="overview.passRate.trend < 0" class="h-4 w-4 text-red-600" />
          <span 
            :class="overview.passRate.trend > 0 ? 'text-green-600' : overview.passRate.trend < 0 ? 'text-red-600' : 'text-muted-foreground'"
          >
            {{ overview.passRate.trend > 0 ? '+' : '' }}{{ overview.passRate.trend }}%
          </span>
          <span class="text-muted-foreground">vs previous period</span>
        </div>
      </div>
    </div>

    <!-- Total Executions Card -->
    <div class="rounded-lg border bg-card p-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-muted-foreground">Total Executions</h3>
      </div>
      <div class="mt-3">
        <div class="text-3xl font-bold">
          {{ overview.totalExecutions.count }}
        </div>
        <div class="flex items-center gap-1 mt-1 text-sm">
          <TrendingUp v-if="overview.totalExecutions.trend > 0" class="h-4 w-4 text-green-600" />
          <TrendingDown v-else-if="overview.totalExecutions.trend < 0" class="h-4 w-4 text-red-600" />
          <span 
            :class="overview.totalExecutions.trend > 0 ? 'text-green-600' : overview.totalExecutions.trend < 0 ? 'text-red-600' : 'text-muted-foreground'"
          >
            {{ overview.totalExecutions.trend > 0 ? '+' : '' }}{{ overview.totalExecutions.trend }}
          </span>
          <span class="text-muted-foreground">vs previous period</span>
        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          <div v-for="(count, env) in overview.totalExecutions.byEnvironment" :key="env" class="flex justify-between">
            <span>{{ env }}:</span>
            <span class="font-medium">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Flaky Tests Card -->
    <div 
      class="rounded-lg border p-6"
      :class="overview.flakyTests.count > 0 ? 'border-orange-200 bg-orange-50' : 'bg-card'"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <AlertTriangle class="h-5 w-5 text-orange-600" />
          <h3 class="text-sm font-medium text-muted-foreground">Flaky Tests</h3>
        </div>
      </div>
      <div class="mt-3">
        <div class="text-3xl font-bold text-orange-600">
          {{ overview.flakyTests.count }}
        </div>
        <p class="text-sm text-muted-foreground mt-1">
          {{ overview.flakyTests.critical }} critical
        </p>
        <p v-if="overview.flakyTests.count > 0" class="text-xs text-orange-600 mt-2">
          Requires attention
        </p>
      </div>
    </div>
  </div>
</template>
