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

function getHealthColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
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
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="env in environments"
        :key="env.code"
        class="rounded-lg border p-4"
        :class="getHealthColor(env.healthStatus)"
      >
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="font-semibold text-lg">{{ env.code }}</h3>
            <p class="text-xs text-muted-foreground">{{ env.name }}</p>
          </div>
          <component :is="getHealthIcon(env.healthStatus)" class="h-6 w-6" />
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Pass Rate:</span>
            <span class="font-medium">{{ env.stats.passRate }}%</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-muted-foreground">Avg Duration:</span>
            <span class="font-medium">{{ formatDuration(env.stats.avgDuration) }}</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-muted-foreground">Total Runs:</span>
            <span class="font-medium">{{ env.stats.totalRuns }}</span>
          </div>
          
          <div class="flex justify-between">
            <span class="text-muted-foreground">Last 24h:</span>
            <span class="font-medium">{{ env.stats.last24Hours }}</span>
          </div>
          
          <div v-if="env.lastRun" class="pt-2 border-t">
            <div class="flex justify-between text-xs">
              <span class="text-muted-foreground">Last Run:</span>
              <span class="font-medium">{{ formatTimeAgo(env.lastRun.finishedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="environments.length === 0" class="text-center py-12 text-muted-foreground">
      No environment data available
    </div>
  </div>
</template>
