<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CheckCircle2, XCircle, Clock, Ban } from 'lucide-vue-next'

const props = defineProps<{
  executions: Array<{
    id: string
    environment: string
    status: string
    triggerType: string
    triggeredBy: string | null
    startedAt: string | null
    finishedAt: string | null
    duration: number | null
    summary: {
      total: number
      passed: number
      failed: number
      skipped: number
    }
  }>
}>()

const router = useRouter()

function getStatusIcon(status: string) {
  switch (status) {
    case 'passed':
      return CheckCircle2
    case 'failed':
      return XCircle
    case 'running':
      return Clock
    default:
      return Ban
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'passed':
      return 'text-green-600'
    case 'failed':
      return 'text-red-600'
    case 'running':
      return 'text-blue-600'
    case 'queued':
      return 'text-yellow-600'
    default:
      return 'text-gray-600'
  }
}

function formatDuration(ms: number | null) {
  if (!ms) return '-'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString()
}

function viewRun(id: string) {
  router.push(`/runs/${id}`)
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Environment
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tests
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Duration
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Trigger
          </th>
          <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Finished
          </th>
        </tr>
      </thead>
      <tbody class="divide-y">
        <tr
          v-for="execution in executions"
          :key="execution.id"
          class="hover:bg-muted/30 cursor-pointer transition-colors"
          @click="viewRun(execution.id)"
        >
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center gap-2">
              <component :is="getStatusIcon(execution.status)" class="h-4 w-4" :class="getStatusColor(execution.status)" />
              <span class="text-sm font-medium capitalize" :class="getStatusColor(execution.status)">
                {{ execution.status }}
              </span>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ execution.environment }}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm">
              <span class="text-green-600 font-medium">{{ execution.summary.passed }}</span>
              <span class="text-muted-foreground mx-1">/</span>
              <span class="text-red-600 font-medium">{{ execution.summary.failed }}</span>
              <span class="text-muted-foreground mx-1">/</span>
              <span class="text-gray-600">{{ execution.summary.total }}</span>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
            {{ formatDuration(execution.duration) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm">
              <div class="font-medium capitalize">{{ execution.triggerType }}</div>
              <div v-if="execution.triggeredBy" class="text-xs text-muted-foreground">
                {{ execution.triggeredBy }}
              </div>
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
            {{ formatDate(execution.finishedAt) }}
          </td>
        </tr>
      </tbody>
    </table>
    
    <div v-if="executions.length === 0" class="text-center py-12 text-muted-foreground">
      No executions found
    </div>
  </div>
</template>
