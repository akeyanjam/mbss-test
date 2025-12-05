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
  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
    <!-- Active Runs Card -->
    <div 
      class="group relative rounded-xl border p-6 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
      :class="overview.activeRuns.running > 0 ? 'bg-blue-50 border-blue-300 shadow-md' : 'bg-card border-border'"
      @click="goToActiveRun"
    >
      <div class="flex items-start justify-between mb-4">
        <div class="p-2.5 rounded-lg bg-blue-100 text-blue-600">
          <PlayCircle class="h-6 w-6" />
        </div>
        <div v-if="overview.activeRuns.running > 0" class="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Active Runs</h3>
        <div class="text-4xl font-bold text-foreground mb-1">
          {{ overview.activeRuns.running }}
        </div>
        <p class="text-sm text-muted-foreground">
          {{ overview.activeRuns.queued }} queued
        </p>
        <div v-if="overview.activeRuns.currentRuns.length > 0" class="mt-3 pt-3 border-t border-blue-200 space-y-1">
          <div v-for="run in overview.activeRuns.currentRuns" :key="run.id" class="flex items-center justify-between text-xs">
            <span class="text-blue-700 font-medium">{{ run.environment }}</span>
            <span class="text-blue-600">{{ run.progress.completed }}/{{ run.progress.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pass Rate Card -->
    <div 
      class="relative rounded-xl border p-6 transition-all duration-200 hover:shadow-lg"
      :class="[
        passRateBg,
        overview.passRate.percentage >= 90 ? 'border-green-300' : 
        overview.passRate.percentage >= 70 ? 'border-yellow-300' : 
        'border-red-300'
      ]"
    >
      <div class="flex items-start justify-between mb-4">
        <div class="p-2.5 rounded-lg" 
          :class="overview.passRate.percentage >= 90 ? 'bg-green-100' : 
                  overview.passRate.percentage >= 70 ? 'bg-yellow-100' : 'bg-red-100'"
        >
          <Activity class="h-6 w-6" :class="passRateColor" />
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Pass Rate</h3>
        <div class="text-4xl font-bold mb-2" :class="passRateColor">
          {{ overview.passRate.percentage }}%
        </div>
        <div class="flex items-center gap-1.5 text-sm">
          <TrendingUp v-if="overview.passRate.trend > 0" class="h-4 w-4 text-green-600" />
          <TrendingDown v-else-if="overview.passRate.trend < 0" class="h-4 w-4 text-red-600" />
          <span 
            class="font-semibold"
            :class="overview.passRate.trend > 0 ? 'text-green-600' : overview.passRate.trend < 0 ? 'text-red-600' : 'text-muted-foreground'"
          >
            {{ overview.passRate.trend > 0 ? '+' : '' }}{{ overview.passRate.trend }}%
          </span>
          <span class="text-muted-foreground text-xs">from last period</span>
        </div>
      </div>
    </div>

    <!-- Total Executions Card -->
    <div class="relative rounded-xl border border-border bg-purple-50 p-6 transition-all duration-200 hover:shadow-lg">
      <div class="flex items-start justify-between mb-4">
        <div class="p-2.5 rounded-lg bg-purple-100 text-purple-600">
          <Activity class="h-6 w-6" />
        </div>
        <div class="text-right space-y-1">
          <div v-for="(count, env) in overview.totalExecutions.byEnvironment" :key="env" class="flex items-center gap-2 text-xs">
            <span class="text-muted-foreground">{{ env }}</span>
            <span class="font-semibold text-purple-700">{{ count }}</span>
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Total Executions</h3>
        <div class="text-4xl font-bold text-foreground mb-1">
          {{ overview.totalExecutions.count }}
        </div>
        <div class="flex items-center gap-1.5 text-sm">
          <TrendingUp v-if="overview.totalExecutions.trend > 0" class="h-4 w-4 text-green-600" />
          <TrendingDown v-else-if="overview.totalExecutions.trend < 0" class="h-4 w-4 text-red-600" />
          <span 
            class="font-semibold"
            :class="overview.totalExecutions.trend > 0 ? 'text-green-600' : overview.totalExecutions.trend < 0 ? 'text-red-600' : 'text-muted-foreground'"
          >
            {{ overview.totalExecutions.trend > 0 ? '+' : '' }}{{ overview.totalExecutions.trend }}
          </span>
          <span class="text-muted-foreground text-xs">from last period</span>
        </div>
      </div>
    </div>

    <!-- Flaky Tests Card -->
    <div 
      class="relative rounded-xl border p-6 transition-all duration-200 hover:shadow-lg"
      :class="overview.flakyTests.count > 0 ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-gray-50 border-border'"
    >
      <div class="flex items-start justify-between mb-4">
        <div class="p-2.5 rounded-lg" 
          :class="overview.flakyTests.count > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'"
        >
          <AlertTriangle class="h-6 w-6" />
        </div>
        <div class="text-right">
          <div v-if="overview.flakyTests.critical > 0" class="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium mb-1">
            {{ overview.flakyTests.critical }} Critical
          </div>
          <div v-if="overview.flakyTests.count > 0" class="text-xs text-orange-600 font-medium">
            ⚠ Attention needed
          </div>
          <div v-else class="text-xs text-green-600 font-medium">
            ✓ All stable
          </div>
        </div>
      </div>
      <div>
        <h3 class="text-sm font-medium text-muted-foreground mb-2">Flaky Tests</h3>
        <div class="text-4xl font-bold mb-1" 
          :class="overview.flakyTests.count > 0 ? 'text-orange-600' : 'text-gray-400'"
        >
          {{ overview.flakyTests.count }}
        </div>
        <p class="text-sm text-muted-foreground">
          Tests with inconsistent results
        </p>
      </div>
    </div>
  </div>
</template>
