<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getDashboardOverview, getExecutionHistory, getEnvironmentHealth, getFlakyTests } from '@/api/client'
import StatsCards from '@/components/dashboard/StatsCards.vue'
import ExecutionTable from '@/components/dashboard/ExecutionTable.vue'
import EnvironmentHealth from '@/components/dashboard/EnvironmentHealth.vue'
import FlakyTestsTable from '@/components/dashboard/FlakyTestsTable.vue'
import { toast } from 'vue-sonner'

const loading = ref(true)
const overview = ref<any>(null)
const executions = ref<any[]>([])
const environmentHealth = ref<any[]>([])
const flakyTests = ref<any[]>([])
const selectedDays = ref(30)
let pollInterval: number | null = null

async function loadDashboard() {
  try {
    loading.value = true
    
    // Load all dashboard data in parallel
    const [overviewData, executionsData, healthData, flakyData] = await Promise.all([
      getDashboardOverview(selectedDays.value),
      getExecutionHistory({ limit: 20 }),
      getEnvironmentHealth(selectedDays.value),
      getFlakyTests({ days: selectedDays.value, minExecutions: 5 }),
    ])

    overview.value = overviewData
    executions.value = executionsData.executions
    environmentHealth.value = healthData.environments
    flakyTests.value = flakyData.flakyTests
  } catch (error: any) {
    console.error('Failed to load dashboard:', error)
    toast.error('Failed to load dashboard data')
  } finally {
    loading.value = false
  }
}

function startPolling() {
  // Poll every 10 seconds for active runs
  pollInterval = window.setInterval(async () => {
    try {
      const overviewData = await getDashboardOverview(selectedDays.value)
      overview.value = overviewData
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, 10000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

onMounted(() => {
  loadDashboard()
  startPolling()
})

onUnmounted(() => {
  stopPolling()
})

function handleDaysChange(days: number) {
  selectedDays.value = days
  loadDashboard()
}
</script>

<template>
  <div class="space-y-6 max-w-[1600px]">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p class="text-muted-foreground mt-1">
          Overview of test execution history and system health
        </p>
      </div>
      
      <!-- Time Range Selector -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">Time Range:</span>
        <select
          v-model="selectedDays"
          @change="handleDaysChange(selectedDays)"
          class="px-3 py-2 border rounded-md bg-background text-sm"
        >
          <option :value="7">Last 7 days</option>
          <option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
        <p class="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>

    <!-- Dashboard Content -->
    <template v-else-if="overview">
      <!-- Stats Cards -->
      <StatsCards :overview="overview" />

      <!-- Recent Executions -->
      <div class="rounded-lg border bg-card">
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold">Recent Executions</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Latest test runs across all environments
          </p>
        </div>
        <ExecutionTable :executions="executions" />
      </div>

      <!-- Environment Health -->
      <div class="rounded-lg border bg-card">
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold">Environment Health</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Health status and metrics for each environment
          </p>
        </div>
        <EnvironmentHealth :environments="environmentHealth" />
      </div>

      <!-- Flaky Tests -->
      <div v-if="flakyTests.length > 0" class="rounded-lg border bg-card">
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold">Flaky Tests</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Tests with inconsistent results requiring attention
          </p>
        </div>
        <FlakyTestsTable :tests="flakyTests" />
      </div>
    </template>
  </div>
</template>
