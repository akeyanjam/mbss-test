<script setup lang="ts">
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-vue-next'

defineProps<{
  environments: Array<{
    code: string
    name: string
    isProd: boolean
    lastRun: {
      id: string
      status: string
      finishedAt: string
    } | null
    stats: {
      passRate: number
      avgDuration: number
      totalRuns: number
      last24Hours: number
    }
    healthStatus: 'healthy' | 'warning' | 'critical'
  }>
}>()

function getHealthIcon(status: string) {
  switch (status) {
    case 'healthy':
      return CheckCircle2
    case 'warning':
      return AlertTriangle
    case 'critical':
      return XCircle
    default:
      return CheckCircle2
  }
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatTimeAgo(date: string) {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  return 'Just now'
}
</script>

<template>
  <div class="p-6">
    <!-- Environment Cards with Gauges -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="env in environments"
        :key="env.code"
        class="rounded-lg border p-4 bg-card hover:shadow-md transition-shadow"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-lg">{{ env.code }}</h3>
            <p class="text-xs text-muted-foreground">{{ env.name }}</p>
          </div>
          <component
            :is="getHealthIcon(env.healthStatus)"
            class="h-5 w-5"
            :class="{
              'text-green-600': env.healthStatus === 'healthy',
              'text-yellow-600': env.healthStatus === 'warning',
              'text-red-600': env.healthStatus === 'critical'
            }"
          />
        </div>

        <!-- Gauge Chart for Pass Rate -->
        <div class="mb-4">
          <div class="relative w-full h-24 flex items-end justify-center">
            <svg viewBox="0 0 120 70" class="w-full h-full">
              <!-- Background arc -->
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                stroke="#e5e7eb"
                stroke-width="8"
                stroke-linecap="round"
              />
              <!-- Colored arc based on pass rate -->
              <path
                d="M 10 60 A 50 50 0 0 1 110 60"
                fill="none"
                :stroke="env.stats.passRate >= 90 ? '#22c55e' : env.stats.passRate >= 70 ? '#eab308' : '#ef4444'"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="`${(env.stats.passRate / 100) * 157} 157`"
                class="transition-all duration-500"
              />
              <!-- Center text -->
              <text x="60" y="50" text-anchor="middle" class="text-2xl font-bold" fill="currentColor">
                {{ env.stats.passRate }}%
              </text>
              <text x="60" y="65" text-anchor="middle" class="text-xs" fill="currentColor" opacity="0.6">
                Pass Rate
              </text>
            </svg>
          </div>
        </div>

        <!-- Compact Stats Grid -->
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="flex flex-col">
            <span class="text-muted-foreground">Avg Duration</span>
            <span class="font-semibold text-sm">{{ formatDuration(env.stats.avgDuration) }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-muted-foreground">Total Runs</span>
            <span class="font-semibold text-sm">{{ env.stats.totalRuns }}</span>
          </div>
          <div class="flex flex-col">
            <span class="text-muted-foreground">Last 24h</span>
            <span class="font-semibold text-sm">{{ env.stats.last24Hours }}</span>
          </div>
          <div v-if="env.lastRun" class="flex flex-col">
            <span class="text-muted-foreground">Last Run</span>
            <span class="font-semibold text-sm">{{ formatTimeAgo(env.lastRun.finishedAt) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="environments.length === 0" class="text-center py-12 text-muted-foreground">
      No environment data available
    </div>
  </div>
</template>
